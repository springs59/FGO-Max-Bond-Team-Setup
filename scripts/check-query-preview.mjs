// Ordinary recommendation does not produce a journal or write the scheme bank.
// Explicit save retains the completed answer and physical schemes after search.
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
  const context=await browser.newContext(),page=await context.newPage()
  await page.goto('http://127.0.0.1:5190/glossary.html')
  const saved=await page.evaluate(async()=>{
    const library=await import('./src/solver/query-library.js')
    const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
    const [servants,ces]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
    const opts={servants:servants.filter(isPlayableServant).slice(0,30),ces:ces.filter(ceHasBondGain).slice(0,36),mode:'free',base:800,costLimit:95,useInventoryCurveSolver:true,aiMode:'off'}
    const worker=new Worker('./src/recommend-worker.js',{type:'module'})
    const value=await new Promise((resolve,reject)=>{
      worker.onerror=e=>reject(Error(e.message))
      worker.onmessage=({data})=>{if(data.type==='progress')return;if(!data.ok)reject(Error(data.error));else resolve(data.result.value)}
      worker.postMessage({id:1,opts})
    })
    worker.terminate()
    const check=(ok,message)=>{if(!ok)throw Error(message)}
    check(value.total===7956,'Unexpected settlement')
    check((await library.aggregateLibrary()).count===0,'Ordinary query wrote scheme library')
    const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
    const pending=await recoverArchivedCandidates()
    check(!pending.busy&&!pending.entries.length,'Ordinary query created temporary journals')
    const {saveManualResult}=await import('./src/solver/manual-result.js')
    const result=await saveManualResult('bond',opts,value)
    check(result.saved,result.error)
    const restored=await library.readQuery(await library.describeQuery('bond',opts))
    check(restored.total===value.total,'Explicit save lost completed answer')
    const backup=await library.exportQueries(),text=await backup.blob.text()
    check(backup.count>1&&text.trim().split('\n').length===backup.count+1,'Explicit save did not include physical plans')
    check(!text.includes('@completed-query:'),'Temporary state escaped into backup')
    return {total:value.total,records:backup.count,noQueryJournals:true}
  })
  await context.close()
  const uiContext=await browser.newContext(),ui=await uiContext.newPage(),errors=[]
  ui.on('pageerror',e=>errors.push(e.message))
  await uiContext.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
  await uiContext.route('**/src/recommend-worker.js?*',async route=>{
    const response=await route.fetch(),source=await response.text()
    const marker='    const opts = receiveCatalog(msg).opts'
    assert.ok(source.includes(marker))
    await route.fulfill({response,body:source.replace(marker,marker+`;
      Object.assign(opts,{base:800,costLimit:95,account:null,mode:'free',game:null,quest:null,bondBonuses:null,filter:null,preferSvtIds:[],lockSvtIds:[],frontIds:[],pinCes:[],pinSprites:[],slotPins:[],allowSupport:true,accountProjection:null,solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null});
      const {isPlayableServant,ceHasBondGain}=await import('./game-data.js');
      opts.servants=opts.servants.filter(isPlayableServant).slice(0,30);opts.ces=opts.ces.filter(ceHasBondGain).slice(0,36);`)})
  })
  let dialogs=0;ui.on('dialog',async d=>{dialogs++;await d.dismiss()})
  await ui.goto('http://127.0.0.1:5190/index.html')
  await ui.locator('#base').fill('800');await ui.locator('#base').blur()
  await ui.locator('#recommendNow').click()
  await ui.locator('#saveRecommendation').waitFor({timeout:120000})
  assert.match(await ui.locator('.recommend').innerText(),/7956/)
  assert.equal(await ui.evaluate(async()=>(await(await import('./src/solver/query-library.js')).aggregateLibrary()).count),0)
  await ui.locator('#saveRecommendation').click()
  await ui.locator('#saveRecommendationStatus').filter({hasText:'已保存到方案库'}).waitFor()
  assert.ok(await ui.evaluate(async()=>(await(await import('./src/solver/query-library.js')).aggregateLibrary()).count)>0)
  await ui.locator('#queryLibraryOpen').click()
  const download=ui.waitForEvent('download');await ui.locator('#queryExportAll').click()
  assert.match((await download).suggestedFilename(),/\.jsonl$/)
  assert.equal(dialogs,0);assert.deepEqual(errors,[])
  await uiContext.close()
  const report={passed:true,saved,ui:{explicitSave:true,noAutomaticSave:true,export:true},endedAt:new Date().toISOString()}
  writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('MANUAL_RESULT_SAVE_PASSED',JSON.stringify(report))
} finally { await browser?.close();server.kill() }
