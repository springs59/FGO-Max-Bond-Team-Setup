import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const port=5187,origin=`http://127.0.0.1:${port}`,output='test-output/all-score-teams'
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'})
let browser,page
const errors=[]
try{
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 page=await browser.newPage({viewport:{width:1280,height:900}})
 page.on('pageerror',e=>errors.push(e.message))
 // Expose existing closure state only in the test response, never in shipped
 // application source. The actual application rendering/bindings are tested.
 await page.route(/\/src\/app\.js(?:\?.*)?$/,async route=>{
  const response=await route.fetch(),body=await response.text()
  await route.fulfill({response,body:body+'\nwindow.__scoreTest={state,runRecommend,cancelRecommend,stopRecWorker,render};\n'})
 })
 await page.route(/https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort())
 await page.goto(origin+'/index.html')
 await page.waitForFunction(()=>window.__scoreTest?.state.data.regionReady,null,{timeout:60000})
 async function fixture(n=5,base=0,ces=[]){
  await page.evaluate(async({n,base,ces})=>{
   const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js')
   const servants=Array.from({length:n},(_,i)=>({id:100+i,collectionNo:100+i,name:'测试从者'+i,className:'saber',rarity:3,cost:i+1,traitIds:[10+i%2]}))
   Object.assign(s,{mode:'free',account:null,base:String(base),costLimit:'20',allowSupport:false,solverMode:'bond',preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],grandPosition:0,
    slotPins:[3,5,6].map(position=>({position,empty:true})),slots:s.slots.map(x=>({...x,filled:false,pinned:false,svtId:0,ceId:0}))})
   Object.assign(s.data,{servants,ces,game:createGameData({servants,craftEssences:ces,version:{region:'CN',dataVersion:'all-score-browser-fixture'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
   h.render();await h.runRecommend()
  },{n,base,ces})
 }
 await fixture()
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete)
 const first=await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults)
 assert.equal(first.grouped,true);assert.equal(first.bestCount,65);assert.equal(first.diskBacked,true)
 assert.ok(await page.locator('#scoreTeamFamily').count());assert.match(await page.locator('#scoreTeamResults').innerText(),/每页 64 组/)
 await page.locator('[data-score-page="64"]').click()
 await page.waitForFunction(()=>window.__scoreTest.state.recommend.scoreTeamResults.offset===64)
 assert.equal(await page.evaluate(()=>window.__scoreTest.state.recommend.plans.length),first.bestCount-64)
 await page.locator('[data-score-page="0"]').first().click()
 await page.waitForFunction(()=>window.__scoreTest.state.recommend.scoreTeamResults.offset===0)
 await mkdir(output,{recursive:true})
 await page.screenshot({path:output+'/desktop.png',fullPage:true})
 const downloaded=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const file=await downloaded,lines=(await readFile(await file.path(),'utf8')).trim().split('\n').map(JSON.parse)
 assert.equal(lines[0].complete,true);assert.equal(lines[0].resultUnit,'equivalence-group');assert.ok(lines[0].equivalenceCatalogs.length);assert.ok(lines.slice(1).every(r=>r.family?.packed.equivalence===1));assert.equal(lines.length-1,first.bestCount+first.otherCount)
 assert.equal(new Set(lines.slice(1).map(r=>JSON.stringify(r.slots))).size,lines.length-1)
 // Reusing a completed archive must retain every page without a new search.
 await page.locator('#work-tab-conditions').click()
 await page.locator('#recommendNow').click()
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete)
 const reused=await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults)
 assert.equal(reused.cacheHit,true);assert.equal(reused.bestCount,first.bestCount)
 for(const width of [320,390,834,1440]){
  await page.setViewportSize({width,height:900})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Complete-score results overflow at ${width}`)
 }
 const ces=[{id:101,name:'本人加成',cost:1,skills:[{condLimitCount:0,funcs:[{target:'self',rate:500,add:0,tvals:[]}]},{condLimitCount:4,funcs:[{target:'self',rate:1000,add:0,tvals:[]}]}]}]
 await fixture(2,100,ces)
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete)
 const second=await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults)
 assert.ok(second.otherCount>0)
 await page.locator('[data-score-kind="other"]').click()
 await page.waitForFunction(()=>window.__scoreTest.state.recommend.scoreTeamResults.kind==='other')
 assert.ok(await page.evaluate(()=>{const r=window.__scoreTest.state.recommend;return r.plans.every(p=>p.total<r.scoreTeamResults.bestScore)}))
 await page.setViewportSize({width:390,height:900})
 await page.screenshot({path:output+'/mobile.png',fullPage:true})
 await fixture(40,0,ces)
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.scoreTeamResults&&!window.__scoreTest.state.recommend.scoreTeamResults.complete)
 await page.locator('#work-tab-compare').click()
 await page.locator('[data-comparison-new]').click()
 await page.locator('[data-comparison-name]').fill('保留我的编辑')
 await page.waitForTimeout(400)
 assert.equal(await page.locator('#work-compare').isVisible(),true,'Background result pages must not navigate away from comparison')
 assert.equal(await page.locator('[data-comparison-name]').inputValue(),'保留我的编辑')
 await page.evaluate(()=>window.__scoreTest.cancelRecommend())
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.stopped)
 await page.waitForTimeout(200)
 const stopped=await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults)
 assert.equal(stopped.complete,false);assert.equal(stopped.maximumProven,false)
 assert.ok(stopped.bestCount>0)
 assert.ok(await page.evaluate(()=>window.__scoreTest.state.recommend.plans.length>0),'Stopping retains a selectable result list')
 await page.locator('#work-tab-results').click()
 await page.waitForFunction(()=>document.querySelector('#scoreTeamResults .score-partial-note'))
 assert.match(await page.locator('#scoreTeamResults').innerText(),/尚未证明为全局最优.*同分方案尚未收齐/s)
 const partialDownload=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const partialFile=await partialDownload,partialLines=(await readFile(await partialFile.path(),'utf8')).trim().split('\n').map(JSON.parse)
 assert.equal(partialLines[0].complete,false);assert.equal(partialLines[0].stopped,true)
 assert.equal(partialLines.length-1,stopped.bestCount+stopped.otherCount)
 // Delay only storage initialization in this test response. Stop while no
 // score-start/progress has arrived: the UI must retain the worker and wait
 // for an honest stopped/empty result instead of hard-terminating it.
 await page.route(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/,async route=>{
  const response=await route.fetch(),body=await response.text()
  await route.fulfill({response,body:body.replace('const store=await createStore()',
   'await new Promise(resolve=>setTimeout(resolve,500));const store=await createStore()')})
 })
 await page.evaluate(()=>window.__scoreTest.stopRecWorker())
 await fixture(4,0,[])
 await page.evaluate(()=>window.__scoreTest.cancelRecommend())
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.scoreTeamResults?.stopped)
 const earlyStopped=await page.evaluate(()=>window.__scoreTest.state.recommend)
 assert.equal(earlyStopped.ok,false);assert.equal(earlyStopped.scoreTeamResults.complete,false)
 assert.match(earlyStopped.error,/尚未计算出.*不表示.*无解/)
 assert.ok(await page.locator('#scoreTeamResults').count(),'An empty stopped query still displays its status panel')
 assert.deepEqual(errors,[])
 const report={passed:true,first,reused,second,stopped,earlyStopped,exportedRecords:lines.length-1,checks:['real application and Worker','completed archive reuse','320/390/834/1440 responsive widths','OPFS disk paging beyond 64 groups','compact family catalog export','constrained alternative display','other legal teams','complete JSONL export','soft cancellation preserves readable results','stopped results retain plans and export with incomplete status','stop before first result preserves worker and shows honest empty state','background enumeration preserves the comparison editor','desktop and mobile rendering'],errors}
 await writeFile(output+'/browser.json',JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify(report))
}catch(error){
 await mkdir(output,{recursive:true})
 const diagnostic={error:String(error),errors,state:await page?.evaluate(()=>({hook:Boolean(window.__scoreTest),regionReady:window.__scoreTest?.state.data.regionReady,
   recBusy:window.__scoreTest?.state.recBusy,result:window.__scoreTest?.state.recommend?.scoreTeamResults,error:window.__scoreTest?.state.recommend?.error,
   text:document.body.innerText.slice(0,1800)})).catch(()=>null)}
 await writeFile(output+'/failure.json',JSON.stringify(diagnostic,null,2)+'\n')
 await page?.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{})
 console.log(JSON.stringify(diagnostic));throw error
}finally{await browser?.close();server.kill('SIGTERM')}



