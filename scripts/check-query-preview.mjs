import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright'
const out=process.env.FGO_PREVIEW_OUTPUT||'/tmp/fgo-preview'
mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','5190','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5190/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch()
 const context=await browser.newContext(),page=await context.newPage()
 await page.goto('http://127.0.0.1:5190/glossary.html')
 const recovered=await page.evaluate(async()=>{
  const transport=await import('./src/worker-transport.js'),library=await import('./src/solver/query-library.js')
  const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
  const [servants,ces]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
  const opts={servants:servants.filter(isPlayableServant).slice(0,30),ces:ces.filter(ceHasBondGain).slice(0,36),mode:'free',base:800,costLimit:95,useInventoryCurveSolver:true}
  const url=new URL('./src/recommend-worker.js',location.href)
  let source=await(await fetch(url)).text()
  source=source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(new URL(p,url).href))
  const marker='    const candidates = collector ? await collector.finish({beforeRemove})'
  if(!source.includes(marker))throw Error('Archive pause marker missing')
  source=source.replace(marker,'    await new Promise(resolve=>setTimeout(resolve,3000))\n'+marker)
  const blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'}))
  const worker=transport.createBoundedWorker(blob,{type:'module'})
  const ready=await new Promise((resolve,reject)=>{
   worker.onerror=e=>reject(Error(e.message))
   worker.onmessage=({data})=>{if(data.type==='result-ready')resolve(data);else if(data.ok===false)reject(Error(data.error))}
   transport.postWorkerMessage(worker,{id:1,previewResult:true,opts}).catch(reject)
  })
  if(!ready.result.value.ok||ready.result.value.total!==7956||!ready.result.value.localResult.saving||ready.result.value.localResult.saved)throw Error('Invalid completed preview')
  const description=await library.describeQuery('bond',opts)
  if(await library.readQuery(description))throw Error('An unfinished archive was accepted as exact')
  const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
  const live=await recoverArchivedCandidates()
  if(live.busy!==1)throw Error('Live log was stolen')
  worker.terminate();URL.revokeObjectURL(blob)
  let recovery=await recoverArchivedCandidates()
  for(let i=0;recovery.busy&&i<100;i++){await new Promise(r=>setTimeout(r,50));recovery=await recoverArchivedCandidates()}
  if(!recovery.ok||recovery.busy||recovery.records!==664)throw Error('Completed journal recovery failed')
  const saved=await library.readQuery(description)
  if(!saved||saved.total!==7956)throw Error('Completed mathematical work was lost')
  const cached=transport.createBoundedWorker('./src/recommend-worker.js',{type:'module'})
  const reused=await new Promise((resolve,reject)=>{
   cached.onerror=e=>reject(Error(e.message))
   cached.onmessage=({data})=>{if(data.type==='progress')return;if(!data.ok)reject(Error(data.error));else resolve(data.result.value)}
   transport.postWorkerMessage(cached,{id:2,previewResult:true,opts:{...opts,accountProfileId:'other'}}).catch(reject)
  })
  cached.terminate()
  if(!reused.localResult.hit||reused.total!==7956||reused.solverStats.nodes!==0)throw Error('Recovery repeated the mathematical search')
  const backup=await library.exportQueries(),text=await backup.blob.text()
  if(text.includes('@completed-query:')||text.trim().split('\n').length!==backup.count+1)throw Error('Temporary state escaped to backup')
  return {live,recovery,cacheHit:reused.localResult.hit,total:reused.total,records:backup.count}
 })
 await context.close()
 const uiContext=await browser.newContext(),ui=await uiContext.newPage(),errors=[]
 ui.on('pageerror',e=>errors.push(e.message))
 await uiContext.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
 await uiContext.route('**/src/recommend-worker.js?*',async route=>{
  let source=await(await route.fetch()).text()
  source=source.replace('  const opts = msg.opts || {}',`  const opts={...msg.opts,base:800,costLimit:95,account:null,mode:'free',game:null,quest:null,bondBonuses:null,filter:null,preferSvtIds:[],lockSvtIds:[],frontIds:[],pinCes:[],pinSprites:[],slotPins:[],allowSupport:true,accountProjection:null,solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null};
  const {isPlayableServant,ceHasBondGain}=await import('./game-data.js');
  opts.servants=opts.servants.filter(isPlayableServant).slice(0,30);opts.ces=opts.ces.filter(ceHasBondGain).slice(0,36);`)
  source=source.replace('    const candidates = collector ? await collector.finish({beforeRemove})','    await new Promise(r=>setTimeout(r,3000))\n    const candidates = collector ? await collector.finish({beforeRemove})')
  await route.fulfill({response:await route.fetch(),body:source})
 })
 await ui.goto('http://127.0.0.1:5190/index.html')
 await ui.locator('#recommendNow').waitFor()
 await ui.locator('#base').fill('800');await ui.locator('#base').blur()
 await ui.locator('#costLimit').fill('95');await ui.locator('#costLimit').blur()
 await ui.locator('#recommendNow').click()
 await ui.locator('.recommend').waitFor({timeout:120000})
 assert.match(await ui.locator('.recommend').innerText(),/7956/)
 assert.equal(await ui.locator('#recommendNow').innerText(),'停止保存')
 assert.match(await ui.locator('.recommend').innerText(),/正在保存全部已计算候选/)
 await ui.evaluate(()=>{window.__backupBegun=false;window.__backupFinished=false;window.fgoDesktop={beginQueryExport:async()=>{window.__backupBegun=true;return{}},appendQueryExport:async()=>{},finishQueryExport:async()=>{window.__backupFinished=true;return{saved:true}}}})
 await ui.locator('#queryLibraryOpen').click()
 await ui.locator('#queryExportAll').waitFor({state:'visible'})
 await ui.locator('#queryExportAll').click()
 await ui.waitForTimeout(300)
 assert.equal(await ui.evaluate(()=>window.__backupBegun),false,'Export started before the displayed query finished saving')
 await ui.waitForFunction(()=>window.__backupFinished,null,{timeout:120000})
 await ui.waitForFunction(()=>document.querySelector('#queryLibraryStatus')?.textContent.includes('已导出整个库'),null,{timeout:120000})
 assert.match(await ui.locator('#queryLibraryStatus').innerText(),/已导出整个库/)
 assert.deepEqual(errors,[])
 await uiContext.close()
 const report={passed:true,recovered,ui:{readyBeforeSave:true,exportWaited:true},endedAt:new Date().toISOString()}
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('PREVIEW_RECOVERY_PASSED',JSON.stringify(report))
}finally{await browser?.close();server.kill()}
