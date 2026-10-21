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
  await route.fulfill({response,body:body+'\nwindow.__scoreTest={state,runRecommend,cancelRecommend,render};\n'})
 })
 await page.route(/https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort())
 await page.goto(origin+'/index.html')
 await page.waitForFunction(()=>window.__scoreTest?.state.data.regionReady,null,{timeout:60000})
 async function fixture(n=2,base=0,ces=[]){
  await page.evaluate(async({n,base,ces})=>{
   const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js')
   const servants=Array.from({length:n},(_,i)=>({id:100+i,collectionNo:100+i,name:'测试从者'+i,className:'saber',rarity:3,cost:i%3+1,traitIds:[10+i%2]}))
   Object.assign(s,{mode:'free',account:null,base:String(base),costLimit:'20',allowSupport:false,solverMode:'bond',preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],grandPosition:0,
    slotPins:[3,5,6].map(position=>({position,empty:true})),slots:s.slots.map(x=>({...x,filled:false,pinned:false,svtId:0,ceId:0}))})
   Object.assign(s.data,{servants,ces,game:createGameData({servants,craftEssences:ces,version:{region:'CN',dataVersion:'all-score-browser-fixture'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
   h.render();await h.runRecommend()
  },{n,base,ces})
 }
 await fixture()
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete)
 const first=await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults)
 assert.ok(first.bestCount>64);assert.equal(first.diskBacked,true)
 await page.locator('[data-score-page="64"]').click()
 await page.waitForFunction(()=>window.__scoreTest.state.recommend.scoreTeamResults.offset===64)
 assert.equal(await page.evaluate(()=>window.__scoreTest.state.recommend.plans.length),first.bestCount-64)
 await page.locator('[data-score-page="0"]').first().click()
 await page.waitForFunction(()=>window.__scoreTest.state.recommend.scoreTeamResults.offset===0)
 await mkdir(output,{recursive:true})
 await page.screenshot({path:output+'/desktop.png',fullPage:true})
 const downloaded=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const file=await downloaded,lines=(await readFile(await file.path(),'utf8')).trim().split('\n').map(JSON.parse)
 assert.equal(lines[0].complete,true);assert.equal(lines.length-1,first.bestCount+first.otherCount)
 assert.equal(new Set(lines.slice(1).map(r=>JSON.stringify(r.slots))).size,lines.length-1)
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
 await fixture(20)
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
 assert.deepEqual(errors,[])
 const report={passed:true,first,second,stopped,exportedRecords:lines.length-1,checks:['real application and Worker','OPFS disk paging beyond 64 results','other legal teams','complete JSONL export','soft cancellation preserves readable results','background enumeration preserves the comparison editor','desktop and mobile rendering'],errors}
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

