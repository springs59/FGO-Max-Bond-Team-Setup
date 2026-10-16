import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile,mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
const server=spawn('python3',['-m','http.server','5184','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try {
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5184/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5184/glossary.html')
  const result=await page.evaluate(async()=>{
    const {createBoundedWorker,postWorkerMessage}=await import('./src/worker-transport.js')
    const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i===6?1:i?16:3,traitIds:[100]}))
    const account={servants:servants.slice(0,6).map(s=>({id:s.id,bondLv:1,bondCap:10})),ces:[]}
    const opts={servants,ces:[],account,mode:'account',base:1000,costLimit:20,useInventoryCurveSolver:true,accountProfileId:'a'}
    window.fixture=opts
    window.query=async extra=>{
      const worker=new Worker('./src/recommend-worker.js',{type:'module'}),progress=[]
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('worker timeout')),30000)
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))}
        worker.onmessage=({data})=>{if(data.type==='progress'){progress.push(data.progress);return}clearTimeout(timer);if(!data.ok)return reject(Error(data.error));window.lastQuery={opts:{...opts,...extra},value:data.result.value};resolve({value:data.result.value,progress})}
        worker.postMessage({id:1,opts:{...opts,...extra}})
      })}finally{worker.terminate()}
    }
    const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
    window.saveTemporary=async()=>{
      const pending=await recoverArchivedCandidates()
      if(pending.entries.length||pending.busy)throw Error('Ordinary query created a temporary journal')
      const {saveManualResult}=await import('./src/solver/manual-result.js')
      const before=(await(await import('./src/solver/query-library.js')).aggregateLibrary()).count
      const result=await saveManualResult('bond',window.lastQuery.opts,window.lastQuery.value)
      if(!result.saved)throw Error(result.error)
      return {added:(await(await import('./src/solver/query-library.js')).aggregateLibrary()).count-before}
    }
    const first=await window.query({})
    const library=await import('./src/solver/query-library.js')
    if((await library.aggregateLibrary()).count!==0)throw Error('Automatic library write')
    await window.saveTemporary()
    const restart=await window.query({accountProfileId:'b',account:{...account,QP:999,updatedAt:123}})
    const expanded={...account,servants:servants.map(s=>({id:s.id,bondLv:1,bondCap:10}))}
    const grown=await window.query({account:expanded});await window.saveTemporary()
    const free=await window.query({mode:'free',account:null,base:997});await window.saveTemporary()
    const plans=await library.sharedPlans(opts)
    const called=await window.query({reuseOnly:true,reusePlans:[plans[0]],base:777}),manualSave=await window.saveTemporary()
    window.callablePlanId=(await library.describeQuery('shared-plan',plans[0])).queryId
    const counts=await library.listQueries()
    const {openQueryLibrary}=await import('./src/ui/query-library.js')
    await openQueryLibrary({servants,ces:[],onUsePlan:async plans=>{window.calledFromUI=await window.query({reuseOnly:true,reusePlans:Array.isArray(plans)?plans:[]})}})
    return {first,restart,grown,free,called,manualSave,planCount:counts.filter(r=>r.kind==='shared-plan').length}
  })
  assert.equal(result.first.value.total,2480);assert.equal(!!result.restart.value.queryStats.cacheHit,false)
  assert.equal(result.grown.value.total,3600);assert.equal(!!result.grown.value.queryStats.cacheHit,false)
  assert.equal(result.grown.value.resultStatus.reusedPlans,0)
  assert.equal(result.free.value.resultStatus.reusedPlans,0,'ordinary queries no longer fit stored curves')
  assert.equal(result.called.value.resultStatus.source,'shared-plan-library')
  assert.equal(result.called.value.resultStatus.optimality,'candidate')
  assert.ok(result.manualSave.added>0,'manual whole-library calls retain new settlements without claiming global optimality')
  for(const r of [result.first,result.grown,result.free])for(const p of r.progress)assert.ok(p.bestScore<=r.value.total)
  assert.ok(result.planCount>=2)
  const repeat=await page.evaluate(()=>window.query({}))
  assert.equal(repeat.value.queryStats.cacheHit,true,'same profile and conditions reuse completed results after restart')
  assert.equal(repeat.progress.length,0)
  await page.locator('#queryLibraryStatus').filter({hasText:'个全局方案'}).waitFor()
  const downloaded=page.waitForEvent('download');await page.locator('#queryExportAll').click()
  const download=await downloaded;assert.match(download.suggestedFilename(),/\.jsonl$/)
  const bytes=await readFile(await download.path()),plain=bytes.toString('utf8')
  const rows=plain.trim().split('\n').slice(1).map(JSON.parse)
  assert.equal(plain[0],'{','one click downloads a plain data file')
  const storedCount=await page.evaluate(async()=>(await (await import('./src/solver/query-library.js')).listQueries()).length)
  assert.equal(rows.length,storedCount,'one click automatically exports every kind of stored content')
  assert.ok(rows.some(r=>r.kind==='shared-plan'))
  await page.locator('#queryExportAll').waitFor({state:'visible'})
  await page.waitForFunction(()=>!document.querySelector('#queryImport').disabled)
  await page.locator('#queryImport').setInputFiles({name:download.suggestedFilename(),mimeType:'application/x-ndjson',buffer:bytes})
  await page.waitForFunction(()=>document.querySelector('#queryLibraryStatus').textContent.includes('重复'))
  assert.equal(await page.locator('#queryExportSelected').count(),0)
  assert.equal(await page.locator('#queryLibraryRows input[type=checkbox]').count(),0)
  assert.equal(await page.locator('[data-kind="computed-candidate"]').count(),0)
  assert.ok(!rows.some(r=>r.kind==='computed-candidate'),'ordinary queries do not archive candidate checkpoints or loadouts')
  await page.locator('#queryUseLibrary').click()
  await page.waitForFunction(()=>Boolean(window.calledFromUI))
  const applied=await page.evaluate(()=>window.calledFromUI.value)
  assert.equal(applied.ok,true,applied.error)
  assert.equal(applied.resultStatus.source,'shared-plan-library')
  await mkdir('ui-checks',{recursive:true})
  const second=await browser.newContext(),other=await second.newPage();await other.goto('http://127.0.0.1:5184/glossary.html')
  const imported=await other.evaluate(async bytes=>{
    const library=await import('./src/solver/query-library.js'),file=new Blob([Uint8Array.from(bytes)])
    const merged=await library.importQueries(file)
    const rows=await library.listQueries()
    const cached=await library.readQuery(rows.find(r=>r.kind==='bond'))
    const global=rows.filter(r=>r.kind==='shared-plan'),plan=await library.readSharedPlan(global[0].id)
    return {merged,cached,global:global.length,plan}
  },[...bytes])
  assert.equal(imported.merged.added,rows.length);assert.ok(imported.cached.ok);assert.ok(imported.global>=2)
  assert.ok(!('bondLv' in imported.plan.slots[0]))
  console.log('Browser: actual worker restart, global free/account reuse, scheme call, real backup download/upload and second-install merge passed')
}finally{await browser?.close();server.kill()}
