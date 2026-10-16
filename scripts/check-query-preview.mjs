// 2.1 ordinary queries use only a bounded completed-result cache. No candidate
// journal, automatic scheme-library archive or computation deadline is added.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const out=process.env.FGO_PREVIEW_OUTPUT||'/tmp/fgo-preview'
mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','5190','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5190/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  const page=await browser.newPage()
  await page.goto('http://127.0.0.1:5190/glossary.html')
  const result=await page.evaluate(async()=>{
    const library=await import('./src/solver/query-library.js')
    const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
    const {SEARCH_MODEL}=await import('./src/solver/ai-model.js')
    const [servants,ces]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
    const opts={servants:servants.filter(isPlayableServant).slice(0,30),ces:ces.filter(ceHasBondGain).slice(0,36),mode:'free',base:800,costLimit:95,useInventoryCurveSolver:true}
    async function query(aiMode) {
      const worker=new Worker('./src/recommend-worker.js',{type:'module'})
      try { return await new Promise((resolve,reject)=>{
        worker.onerror=e=>reject(Error(e.message))
        worker.onmessage=({data})=>{if(data.type==='progress')return;if(!data.ok)reject(Error(data.error));else resolve(data.result.value)}
        worker.postMessage({id:1,opts:{...opts,aiMode,...(aiMode==='on'?{aiModel:SEARCH_MODEL}:{})}})
      }) } finally { worker.terminate() }
    }
    const off=await query('off'),on=await query('on'),repeatOn=await query('on'),repeatOff=await query('off')
    const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
    const pending=await recoverArchivedCandidates()
    return {off,on,repeatOn,repeatOff,libraryCount:(await library.aggregateLibrary()).count,pending}
  })
  assert.equal(result.off.total,7956)
  assert.equal(result.on.total,result.off.total)
  assert.equal(result.off.resultStatus.ai.enabled,false)
  assert.equal(result.on.resultStatus.ai.enabled,true)
  assert.ok(!result.on.queryStats.cacheHit)
  assert.equal(result.repeatOn.queryStats.cacheHit,true)
  assert.equal(result.repeatOff.queryStats.cacheHit,true)
  assert.equal(result.libraryCount,0)
  assert.equal(result.pending.busy||0,0)
  assert.equal(result.pending.entries.length,0)
  const report={passed:true,total:result.on.total,noQueryJournals:true,noLibraryWrites:true,policyIsolation:true,restartCache:true,endedAt:new Date().toISOString()}
  writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('QUERY_21_CACHE_PASSED',JSON.stringify(report))
} finally { await browser?.close();server.kill() }
