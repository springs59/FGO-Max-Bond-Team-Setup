import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright'
const count=+(process.env.FGO_BROWSER_CASES||24),rounds=+(process.env.FGO_BROWSER_ROUNDS||3)
const server=spawn('python3',['-m','http.server','5197','--bind','127.0.0.1'],{cwd:'..',stdio:'ignore'})
const report={schema:1,status:'running',startedAt:new Date().toISOString(),count,rounds,
  method:'Real Chromium, production Worker modules and native IndexedDB/OPFS. Generated accounts use full public CE catalogs but own only six eligible bond CEs and fix one support CE. Separate context for every version/case/round; rotated sequential order. Cold timing includes Worker startup. Repeat and restarted-Worker timing measured separately. 2.0.9 explicit save happens outside timing.',records:[]}
const path='docs/test-results/ai-21-browser.json'
mkdirSync('docs/test-results',{recursive:true})
const persist=()=>writeFileSync(path,JSON.stringify(report)+'\n')
let browser
try {
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5197/fgo/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  report.browser=browser.version()
  for(let i=0;i<count;i++)for(let round=0;round<rounds;round++){
    const versions=['2.0.0','2.0.9','2.1'],offset=(i+round)%3;versions.push(...versions.splice(0,offset))
    for(const version of versions){
      const context=await browser.newContext(),page=await context.newPage()
      await page.goto('http://127.0.0.1:5197/fgo/glossary.html')
      let record
      try{record=await page.evaluate(async({i,round,version})=>{
        const root=location.origin+'/',region=Math.floor(i/4)%2?'JP':'CN'
        const {isPlayableServant}=await import(root+'fgo/src/game-data.js')
        const {pickCeSkill}=await import(root+'fgo/src/atlas.js')
        const data=region==='JP'?await(await fetch(root+'fgo/src/data/jp/bundle.json')).json():{
          servants:await(await fetch(root+'fgo/src/data/servants.json')).json(),ces:await(await fetch(root+'fgo/src/data/ces.json')).json()}
        const playable=data.servants.filter(isPlayableServant),n=[30,120,240,playable.length][i%4]
        // Stable rotation changes the inventory as well as COST/base.
        const shift=(i*17)%playable.length,servants=[...playable.slice(shift),...playable.slice(0,shift)].slice(0,n)
        const eligible=data.ces.filter(c=>{const fs=pickCeSkill(c,true)?.funcs||[];return fs.length===1&&!fs[0].eventId&&fs[0].target==='ptFull'&&!fs[0].add&&fs[0].rate>0})
        const ces=eligible.slice((i%3)*2,(i%3)*2+6)
        const opts={servants,ces:data.ces,region,base:815+i,mode:'account',costLimit:[60,95,113][Math.floor(i/8)%3],
          useInventoryCurveSolver:true,lockSupportCeId:ces[0].id,
          accountProfileId:'generated-'+i,account:{servants:servants.map((s,j)=>({id:s.id,bondLv:j%9===0?10:5,bondCap:10,limitCount:4})),
            ces:ces.flatMap(c=>[{id:c.id,mlb:true,limitCount:4},{id:c.id,mlb:false,limitCount:0}])}}
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(opts)))),n=>n.toString(16).padStart(2,'0')).join('')
        const prefix=version==='2.0.0'?'baseline-200/':version==='2.0.9'?'baseline-209/':'fgo/'
        const transport=version==='2.0.9'?await import(root+prefix+'src/worker-transport.js'):null
        const catalog=version==='2.0.0'?null:await import(root+prefix+'src/worker-catalog.js')
        const make=()=>transport?transport.createBoundedWorker(root+prefix+'src/recommend-worker.js',{type:'module'}):new Worker(root+prefix+'src/recommend-worker.js',{type:'module'})
        let id=0,worker
        const query=async(worker,extra={},began=performance.now())=>{
          const requestId=++id
          const result=await new Promise(resolve=>{
            const timer=null // Search has no automatic deadline; browser close/manual cancellation still works.
            worker.onerror=e=>{clearTimeout(timer);resolve({status:'error',error:e.message})}
            worker.onmessage=({data})=>{
              if(data.id!==requestId||data.type==='progress')return
              clearTimeout(timer)
              resolve({status:data.ok?'ok':'error',error:data.error,value:data.result?.value})
            }
            const message={id:requestId,opts:{...opts,...extra}}
            const post=catalog?catalog.postRecommendRequest(worker,message):worker.postMessage(message)
            Promise.resolve(post).catch(e=>{clearTimeout(timer);resolve({status:'error',error:String(e)})})
          })
          return {...result,ms:performance.now()-began}
        }
        const measurements=[]
        try {
          const began=performance.now();worker=make()
          const cold=await query(worker,{},began)
          const trim=r=>({status:r.status,error:r.error,ms:r.ms,facts:r.value?.ok?[r.value.total,r.value.costUsed]:null,
            cacheHit:!!r.value?.queryStats?.cacheHit,source:r.value?.resultStatus?.source,ai:r.value?.resultStatus?.ai})
          measurements.push({kind:'cold',...trim(cold)})
          if(cold.status!=='ok'||!cold.value?.ok)return {i,round,version,region,n,ces:data.ces.length,digest,measurements}
          if(version==='2.0.9'&&cold.value.localResult?.temporary){
            const {recoverArchivedCandidates}=await import(root+prefix+'src/ui/query-recovery.js')
            const saved=await recoverArchivedCandidates({action:'save',name:cold.value.localResult.name})
            if(!saved.ok||!saved.exact)throw Error(saved.error||'Explicit save failed')
          }
          measurements.push({kind:'retained',...trim(await query(worker))})
          worker.terminate();const restart=performance.now();worker=make()
          measurements.push({kind:'restart',...trim(await query(worker,{},restart))})
          measurements.push({kind:'changed',...trim(await query(worker,{base:1017+i}))})
          return {i,round,version,region,n,ces:data.ces.length,digest,measurements}
        }finally{worker?.terminate()}
      },{i,round,version})}catch(e){record={i,round,version,status:'error',error:String(e)}}
      finally{await context.close()}
      report.records.push(record);persist()
    }
    console.log('browser',i+1,'/',count,'round',round+1)
  }
  report.status='complete';report.endedAt=new Date().toISOString();persist()
}finally{await browser?.close();server.kill();persist()}
