// Exercise each unmodified production Worker. Visible-result latency and the
// optional explicit library save are measured separately, including all setup.
import assert from 'node:assert/strict'
import {spawn,execFileSync} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright'
const output=process.env.FGO_PERFORMANCE_OUTPUT||'/tmp/fgo-cold-query'
mkdirSync(output,{recursive:true})
const server=spawn('python3',['-m','http.server','5189','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
const report={startedAt:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),versions:{},passed:false}
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5189/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 for(const [version,prefix] of [['2.0.0','baseline-release/'],['2.0.6','baseline-current/'],['current','']]){
  const trials=[]
  for(let trial=0;trial<3;trial++){
   const context=await browser.newContext(),page=await context.newPage()
   await page.goto('http://127.0.0.1:5189/glossary.html')
   try{trials.push(await page.evaluate(async({version,prefix,trial})=>{
    const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
    const [servants,ces]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
    const fixture={servants:servants.filter(isPlayableServant).slice(0,30),ces:ces.filter(ceHasBondGain).slice(0,36),mode:'free',costLimit:95,useInventoryCurveSolver:true,aiMode:'off'}
    const transport=version==='2.0.0'||version==='current'?null:await import('./'+prefix+'src/worker-transport.js')
    const samples=[]
    let coldArchive
    for(let i=0;i<4;i++){
     // A new Worker for every call also checks persistent cache correctness.
     const url='./'+prefix+'src/recommend-worker.js'
     const start=performance.now()
     const worker=transport?transport.createBoundedWorker(url,{type:'module'}):new Worker(url,{type:'module'})
     let value
     try{value=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Worker benchmark timed out')),180000)
      worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))}
      worker.onmessage=({data})=>{if(data.type==='progress')return;clearTimeout(timer);if(!data.ok||!data.result?.value?.ok)reject(Error(data.error||'Invalid result'));else resolve(data.result.value)}
      const msg={id:i+1,opts:{...fixture,base:800+2*trial+Math.min(i,1),accountProfileId:i===3?'other':'initial'}}
      if(transport)transport.postWorkerMessage(worker,msg).catch(reject);else worker.postMessage(msg)
     })}finally{worker.terminate()}
     const readyMs=performance.now()-start,saveStart=performance.now()
     let savedRecords=0
     if(version==='current'){
      const library=await import('./src/solver/query-library.js')
      if(i===0&&(await library.aggregateLibrary()).count!==0)throw Error('Result saved without user choice')
      const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
      const pending=await recoverArchivedCandidates()
      if(pending.entries.length||pending.busy)throw Error('Ordinary query produced a candidate journal')
      if((await library.aggregateLibrary()).count!==0)throw Error('2.1 query unexpectedly wrote scheme library')
     }
     samples.push({stage:['cold','changed','repeat','crossProfile'][i],readyMs,manualSaveMs:version==='current'?performance.now()-saveStart:0,total:value.total,cacheHit:!!(value.localResult?.hit||value.queryStats?.cacheHit),savedRecords,curve:value.libraryCurve,solverStats:value.solverStats})
     if(i===0&&version!=='2.0.0'){
      const library=await import('./'+prefix+'src/solver/query-library.js'),archive=await library.exportQueries()
      coldArchive={count:archive.count,text:await archive.blob.text()}
     }
    }
    return {samples,coldArchive}
   },{version,prefix,trial}))}finally{await context.close()}
  }
  const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]
  report.versions[version]={trials,mediansMs:Object.fromEntries(['cold','changed','repeat','crossProfile'].map((s,i)=>[s,median(trials.map(t=>t.samples[i].readyMs))]))}
 }
 const totals=version=>report.versions[version].trials.map(t=>t.samples.map(s=>s.total))
 assert.deepEqual(totals('2.0.0'),totals('2.0.6'));assert.deepEqual(totals('2.0.6'),totals('current'))
 for(const t of report.versions.current.trials)assert.equal(t.coldArchive.count,0,'2.1 queries do not archive scheme records')
 for(const version of Object.values(report.versions))for(const t of version.trials)if(t.coldArchive)delete t.coldArchive.text
 for(const t of report.versions.current.trials){assert.equal(t.samples[2].cacheHit,true);assert.equal(t.samples[3].cacheHit,false,'Result caches isolate account profiles')}
 report.relativeColdLatency=report.versions.current.mediansMs.cold/report.versions['2.0.0'].mediansMs.cold
 report.passed=true;report.endedAt=new Date().toISOString()
 console.log('COLD_QUERY_REPORT',JSON.stringify(report))
}finally{writeFileSync(output+'/performance.json',JSON.stringify(report,null,2));await browser?.close();server.kill()}
