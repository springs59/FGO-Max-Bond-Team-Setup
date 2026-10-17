import {spawn} from 'node:child_process'
import {mkdirSync,mkdtempSync,writeFileSync,symlinkSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {wideCases} from './performance-wide-cases.mjs'
const roots={'2.0.0':process.env.FGO_WIDE_200,'2.1.2':process.env.FGO_WIDE_212,'2.1-interval':process.env.FGO_WIDE_INTERVAL||process.cwd()}
const web=mkdtempSync(tmpdir()+'/fgo-wide-web-')
for(const [name,p]of Object.entries(roots))symlinkSync(resolve(p),web+'/'+name,'dir')
writeFileSync(web+'/index.html','<!doctype html><meta charset="utf-8"><title>Production worker performance test</title>')
const server=spawn('python3',['-m','http.server','5199','--bind','127.0.0.1'],{cwd:web,stdio:'ignore'})
const chosen=['request-CN-30-false','request-CN-120-false','request-CN-Infinity-false','request-JP-30-false','request-JP-240-false','request-JP-Infinity-false',
 'request-CN-30-true','request-JP-30-true','special-0','special-4','special-7','special-9']
const cases=wideCases().filter(c=>chosen.includes(c.id)),rounds=Number(process.env.FGO_WIDE_BROWSER_ROUNDS||3)
const path='docs/test-results/performance-wide-browser.json'
mkdirSync('docs/test-results',{recursive:true})
const report={status:'running',startedAt:new Date().toISOString(),rounds,queryTimeout:null,
 method:'Native Chromium production Worker, real IndexedDB and OPFS. Each case/version/round has a fresh browser context. Rotated version order. Cold includes Worker startup, retained repeat, restarted Worker and changed-base recomputation measured separately. AI on for both 2.1 versions. No per-query timer. Browser does not include UI rendering or human interaction.',records:[]}
const persist=()=>writeFileSync(path,JSON.stringify(report)+'\n');let browser
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5199')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined});report.browser=browser.version()
 for(let i=0;i<cases.length;i++)for(let round=0;round<rounds;round++){
  const c=cases[i],names=Object.keys(roots),offset=(i+round)%names.length;names.push(...names.splice(0,offset))
  for(const version of names){
   console.log('browser active',c.id,version,round);report.active={id:c.id,version,round};persist()
   const context=await browser.newContext(),page=await context.newPage()
   try{
    await page.goto('http://127.0.0.1:5199')
    const result=await page.evaluate(async({version,opts})=>{
     const prefix=location.origin+'/'+version+'/'
     let catalog=null
     if(version!=='2.0.0')catalog=await import(prefix+'src/worker-catalog.js')
     const make=()=>new Worker(prefix+'src/recommend-worker.js',{type:'module'})
     const settings={...opts,aiMode:version==='2.0.0'?'off':'on'}
     let worker,id=0
     const query=async(extra={},start=performance.now())=>{
      const requestId=++id
      const value=await new Promise((yes,no)=>{
       worker.onerror=e=>no(Error(e.message))
       worker.onmessage=({data:d})=>{if(d.id===requestId&&d.type!=='progress')d.ok?yes(d.result?.value):no(Error(d.error))}
       const msg={id:requestId,opts:{...settings,...extra}}
       Promise.resolve(catalog?catalog.postRecommendRequest(worker,msg):worker.postMessage(msg)).catch(no)
      })
      return {ms:performance.now()-start,valid:!!value?.ok,error:value?.error,
       facts:value?.ok?[value.total,value.costUsed,value.preferBond||0,value.bond15Count||0,value.priorityScore||0]:null,
       cacheHit:!!value?.queryStats?.cacheHit,ai:value?.resultStatus?.ai,source:value?.resultStatus?.source}
     }
     try{
      const start=performance.now();worker=make()
      const measurements=[{kind:'cold',...await query({},start)},{kind:'retained',...await query()}]
      worker.terminate();const restart=performance.now();worker=make()
      measurements.push({kind:'restart',...await query({},restart)},{kind:'changed',...await query({base:opts.base+202})})
      const storage=await navigator.storage.estimate(),files=[]
      async function walk(dir,prefix=''){for await(const [name,h]of dir.entries()){if(h.kind==='directory')await walk(h,prefix+name+'/');else files.push({path:prefix+name,bytes:(await h.getFile()).size})}}
      if(navigator.storage.getDirectory)await walk(await navigator.storage.getDirectory())
      return {measurements,storageUsage:storage.usage,storageDetails:storage.usageDetails,opfsFiles:files,
       databases:(await indexedDB.databases()).map(x=>x.name)}
     }finally{worker?.terminate()}
    },{version,opts:c.opts})
    report.records.push({id:c.id,cohort:c.cohort,domain:c.domain,version,round,...result})
   }catch(e){report.records.push({id:c.id,version,round,status:'error',error:String(e)})}
   finally{await context.close();delete report.active;persist()}
  }
 }
 report.status='complete';report.endedAt=new Date().toISOString()
}finally{await browser?.close();server.kill();persist()}
