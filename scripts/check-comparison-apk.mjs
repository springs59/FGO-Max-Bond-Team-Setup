import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {writeFileSync,mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const out=process.env.FGO_COMPARE_OUTPUT||'ui-checks/comparison'
mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','5196','--bind','127.0.0.1'],{stdio:'ignore'})
const report={startedAt:new Date().toISOString(),passed:false,timing:'request through decoded result; excludes rendering and manual save',samples:[]}
let browser
try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5196/native/site/comparison-manifest.json')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  report.browser=browser.version()
  for(let block=0;block<3;block++)for(const fixture of [30,120])for(const folder of [['200','208','209'],['208','209','200'],['209','200','208']][block]){
    const context=await browser.newContext(),page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    try{
      await page.goto(`http://127.0.0.1:5196/native/site/versions/${folder}/index.html`)
      await page.locator('#accountFile').waitFor({state:'attached',timeout:60000})
      const samples=await page.evaluate(async({folder,fixture})=>{
        const check=(value,message)=>{if(!value)throw Error(message)}
        const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
        const [s,c]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
        const opts={servants:s.filter(isPlayableServant).slice(0,fixture),ces:c.filter(ceHasBondGain).slice(0,36),base:800,costLimit:95,mode:'free',useInventoryCurveSolver:true}
        const transport=folder==='200'?null:await import('./src/worker-transport.js')
        const sender=folder==='209'?(await import('./src/worker-catalog.js')).postRecommendRequest:transport?.postWorkerMessage
        const make=()=>transport?transport.createBoundedWorker(new URL('./src/recommend-worker.js',location.href),{type:'module'}):new Worker(new URL('./src/recommend-worker.js',location.href),{type:'module'})
        let id=0
        async function query(w,start=performance.now()){
          const next=++id
          const value=await new Promise((resolve,reject)=>{
            const timer=setTimeout(()=>reject(Error('query timeout')),120000)
            w.onmessage=({data})=>{if(data.id!==next||data.type==='progress')return;clearTimeout(timer);data.ok?resolve(data.result.value):reject(Error(data.error))}
            w.onerror=e=>{clearTimeout(timer);reject(Error(e.message))}
            const message={id:next,opts}
            if(sender)sender(w,message).catch(reject);else w.postMessage(message)
          })
          check(value.ok,value.error||'invalid result')
          return {ms:performance.now()-start,total:value.total,hit:!!(value.localResult?.hit||value.queryStats?.cacheHit),value}
        }
        async function save(value){
          if(folder==='200')return
          check(value.localResult?.temporary,'missing temporary result')
          const r=await(await import('./src/ui/query-recovery.js')).recoverArchivedCandidates({action:'save',name:value.localResult.name})
          check(r.ok&&r.exact,'manual save failed')
        }
        const results=[],w=make()
        try{
          let r=await query(w);check(!r.hit,'cold cache hit');results.push({scenario:'cold',...r,value:undefined});await save(r.value)
          opts.base=801;r=await query(w);check(!r.hit,'changed cache hit');results.push({scenario:'changed',...r,value:undefined});await save(r.value)
          const expected=r.total
          for(let i=0;i<2;i++)await query(w)
          for(let i=0;i<5;i++){
            r=await query(w);check(r.hit&&r.total===expected,'retained cache/result parity');results.push({scenario:'retained',...r,value:undefined})
            const start=performance.now(),fresh=make()
            try{r=await query(fresh,start);check(r.hit&&r.total===expected,'restarted cache/result parity');results.push({scenario:'restart',...r,value:undefined})}finally{fresh.terminate()}
          }
          check(JSON.parse(localStorage.getItem('comparison-records')).length>=14,'timing observer missed messages')
        }finally{w.terminate()}
        return results
      },{folder,fixture})
      assert.deepEqual(errors,[],`UI exceptions for ${folder}`)
      for(const sample of samples)report.samples.push({version:`2.0.${folder.at(-1)}`,fixture,block,...sample})
      console.log(JSON.stringify({folder,fixture,block,retained:samples.filter(r=>r.scenario==='retained').map(r=>Math.round(r.ms))}))
    }finally{await context.close()}
    writeFileSync(out+'/results.json',JSON.stringify(report,null,2))
  }
  for(const fixture of [30,120])for(const scenario of ['cold','changed','retained','restart']){
    const rows=report.samples.filter(r=>r.fixture===fixture&&r.scenario===scenario)
    assert.equal(new Set(rows.map(r=>r.total)).size,1,'scores must agree across versions')
  }
  report.passed=true;report.finishedAt=new Date().toISOString()
}finally{
  writeFileSync(out+'/results.json',JSON.stringify(report,null,2))
  await browser?.close();server.kill('SIGTERM')
}
