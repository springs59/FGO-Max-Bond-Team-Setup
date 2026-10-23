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
  await route.fulfill({response,body:body+'\nwindow.__scoreTest={state,runRecommend,cancelRecommend,stopRecWorker,render,currentQuestPayload,collectSlotPins};\n'})
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
 // Gain-first ordering can reach the maximum immediately, without retaining
 // lower-score improvements. The other-results control must reflect reality.
 if(second.otherCount){
  await page.locator('[data-score-kind="other"]').click()
  await page.waitForFunction(()=>window.__scoreTest.state.recommend.scoreTeamResults.kind==='other')
  assert.ok(await page.evaluate(()=>{const r=window.__scoreTest.state.recommend;return r.plans.every(p=>p.total<r.scoreTeamResults.bestScore)}))
 }else assert.equal(await page.locator('[data-score-kind="other"]').isDisabled(),true)
 await page.setViewportSize({width:390,height:900})
 await page.screenshot({path:output+'/mobile.png',fullPage:true})
 // Inject an incomplete first proof only in the test response. Real teams,
 // scoring, phase recovery, Worker storage and UI remain the production code.
 const phasesRoute=/\/src\/solver\/score-team-phases\.js(?:\?.*)?$/,workerRoute=/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/
 await page.route(phasesRoute,async route=>{
  const response=await route.fetch(),body=await response.text(),needle='for(const event of enumerateDomain(d,state)){'
  assert.ok(body.includes(needle))
  await route.fulfill({response,body:body.replace(needle,"for(const event of (phase==='optimizing'&&!state.recoveries?[]:enumerateDomain(d,state))){")})
 })
 await page.route(workerRoute,async route=>{
  const response=await route.fetch(),body=await response.text(),needle="if(event.recovery||timestamp-lastYield>=16||event.type==='tick')"
  assert.ok(body.includes(needle))
  await route.fulfill({response,body:body.replace(needle,"if(event.recovery)await new Promise(resolve=>setTimeout(resolve,500));"+needle)})
 })
 await page.evaluate(async()=>{window.__scoreTest.stopRecWorker();const {aiSettings}=await import('/src/ai-update-ui.js');aiSettings.setSelection('off')})
 await fixture(2,100,ces)
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete)
 const recoveryCompleted=await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults)
 assert.equal(recoveryCompleted.recoveries,1);assert.equal(recoveryCompleted.maximumProven,true)
 assert.equal(recoveryCompleted.bestScore,second.bestScore);assert.equal(recoveryCompleted.bestCount,second.bestCount)
 assert.match(await page.locator('#scoreTeamResults .score-recovery-note').innerText(),/更高收益.*自动重新搜索/)
 await page.evaluate(()=>window.__scoreTest.stopRecWorker())
 await fixture(2,101,ces)
 await page.waitForFunction(()=>{const s=window.__scoreTest.state,i=s.recommend?.scoreTeamResults;return s.recBusy&&i?.recoveries===1&&!i.maximumProven})
 await page.evaluate(()=>window.__scoreTest.cancelRecommend())
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.scoreTeamResults?.stopped)
 const recoveryStopped=await page.evaluate(()=>window.__scoreTest.state.recommend)
 assert.equal(recoveryStopped.ok,true);assert.equal(recoveryStopped.scoreTeamResults.recoveries,1)
 assert.equal(recoveryStopped.scoreTeamResults.maximumProven,false);assert.equal(recoveryStopped.scoreTeamResults.complete,false)
 assert.equal(recoveryStopped.total,363);assert.ok(recoveryStopped.plans.length)
 assert.match(await page.locator('#searchResultStatus').innerText(),/尚未证明最优/)
 assert.match(await page.locator('#scoreTeamResults .score-partial-note').innerText(),/尚未证明为全局最优/)
 const recoveryDownload=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const recoveryFile=await recoveryDownload,recoveryLines=(await readFile(await recoveryFile.path(),'utf8')).trim().split('\n').map(JSON.parse)
 assert.equal(recoveryLines[0].recoveries,1);assert.equal(recoveryLines[0].maximumProven,false)
 assert.equal(recoveryLines[0].feasiblePreview.total,363)
 await page.unroute(phasesRoute);await page.unroute(workerRoute)
 await page.evaluate(()=>window.__scoreTest.stopRecWorker())
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
 assert.equal(stopped.complete,false);assert.equal(stopped.maximumProven,true)
 assert.ok(stopped.bestCount>0)
 assert.ok(await page.evaluate(()=>window.__scoreTest.state.recommend.plans.length>0),'Stopping retains a selectable result list')
 await page.locator('#work-tab-results').click()
 await page.waitForFunction(()=>document.querySelector('#scoreTeamResults .score-partial-note'))
 assert.match(await page.locator('#scoreTeamResults').innerText(),/最高分已证明.*同分方案尚未收齐/s)
 assert.match(await page.locator('#searchResultStatus').innerText(),/最高分已证明/)
 const partialDownload=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const partialFile=await partialDownload,partialLines=(await readFile(await partialFile.path(),'utf8')).trim().split('\n').map(JSON.parse)
 assert.equal(partialLines[0].complete,false);assert.equal(partialLines[0].stopped,true);assert.equal(partialLines[0].maximumProven,true)
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
 // Stop after a real non-AI feasibility checkpoint, before any group is
 // appended. Slow only cooperative yields so the UI can click stop in this
 // narrow window, and verify that the legal team survives outside the store.
 await page.unroute(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/)
 await page.route(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/,async route=>{
  const response=await route.fetch(),body=await response.text()
  assert.ok(body.includes('yieldTask=pause'))
  assert.ok(body.includes("if(event.recovery||timestamp-lastYield>=16||event.type==='tick')"))
  await route.fulfill({response,body:body.replace('yieldTask=pause','yieldTask=()=>new Promise(resolve=>setTimeout(resolve,500))')
   .replace("if(event.recovery||timestamp-lastYield>=16||event.type==='tick')",'if(true)')})
 })
 await page.evaluate(()=>window.__scoreTest.stopRecWorker())
 await fixture(4,0,[])
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.ok&&window.__scoreTest.state.recBusy)
 await page.evaluate(()=>window.__scoreTest.cancelRecommend())
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.scoreTeamResults?.stopped)
 const checkpointStopped=await page.evaluate(()=>window.__scoreTest.state.recommend)
 assert.equal(checkpointStopped.ok,true);assert.equal(checkpointStopped.plans.length,1)
 assert.equal(checkpointStopped.scoreTeamResults.bestCount,0);assert.equal(checkpointStopped.scoreTeamResults.previewOnly,true)
 assert.equal(checkpointStopped.scoreTeamResults.maximumProven,false)
 assert.ok(await page.locator('.recommend').isVisible(),'A stopped checkpoint displays its actual team, not an empty-result error')
 assert.match(await page.locator('#scoreTeamResults').innerText(),/下方仍保留该队伍/)
 const checkpointDownload=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const checkpointFile=await checkpointDownload,checkpointHeader=JSON.parse((await readFile(await checkpointFile.path(),'utf8')).trim())
 assert.equal(checkpointHeader.stopped,true);assert.equal(checkpointHeader.complete,false)
 assert.equal(checkpointHeader.feasiblePreview.total,checkpointStopped.total)
 // Hold the real Worker in a sparse iterator with no preview or team events.
 // Progress must remain visible on both tabs even when both result counts
 // stay zero. Only the test response changes the iterator; shipping code
 // retains its exact search and cooperative scheduler.
 await page.unroute(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/)
 await page.route(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/,async route=>{
  const response=await route.fetch(),body=await response.text()
  const replacement=`createSearch=(opts)=>{const query=createScoreTeamSearch(opts),iterator=query.iterator;query.initial=null;query.iterator=(function*(){for(let i=0;i<100000;i++){query.state.stats.nodes+=512;yield {type:'tick'}}yield* iterator})();return query}`
  assert.ok(body.includes('createSearch=createScoreTeamSearch'))
  await route.fulfill({response,body:body.replace('createSearch=createScoreTeamSearch',replacement)})
 })
 await page.evaluate(()=>window.__scoreTest.stopRecWorker())
 await fixture(4,0,[])
 await page.waitForFunction(()=>window.__scoreTest.state.solverProgress?.elapsedMs>=300)
 assert.match(await page.locator('#recBusyHint').innerText(),/已搜索 \d+ 个节点.*用时/)
 assert.equal(await page.evaluate(()=>window.__scoreTest.state.recommend),null)
 await page.locator('#work-tab-results').click()
 const sparseBefore=await page.locator('#scoreTeamPendingProgress').innerText()
 await page.waitForFunction(previous=>document.querySelector('#scoreTeamPendingProgress')?.textContent!==previous,sparseBefore)
 const sparseAfter=await page.locator('#scoreTeamPendingProgress').innerText()
 assert.match(sparseAfter,/同分 0 组.*已搜索 \d+ 个节点.*已计算 0 个完整组合.*用时/)
 await page.evaluate(()=>window.__scoreTest.cancelRecommend())
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.scoreTeamResults?.stopped)
 assert.equal(await page.evaluate(()=>window.__scoreTest.state.recommend.scoreTeamResults.maximumProven),false)
 // Real Grand-account regression: own Grand is fixed at 1, while the friend
 // seat is free. The old iterator exhausted the impossible friend-at-1
 // layout before reaching any complete team. Use the shipped scheduler.
 await page.unroute(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/)
 await page.evaluate(async()=>{
  const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js')
  h.stopRecWorker()
  const servants=Array.from({length:24},(_,i)=>({id:100+i,collectionNo:100+i,name:'冠位测试'+i,className:'assassin',rarity:3,cost:1,traitIds:[]}))
  const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id===123})),ces:[]}
  Object.assign(s,{mode:'account',account,base:'4748',costLimit:'116',costLocked:false,allowSupport:true,solverMode:'bond',questId:'',questType:'grand',questClass:'assassin',grandPosition:1,
   preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],slotPins:[],slots:s.slots.map(x=>({...x,filled:false,pinned:false,isSupport:false,isGrand:false,svtId:0,ceId:0,ceBondId:0,ceRewardId:0}))})
  Object.assign(s.data,{servants,ces:[],game:createGameData({servants,craftEssences:[],version:{region:'CN',dataVersion:'grand-first-team-regression'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
  h.render();await h.runRecommend()
 })
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.ok,null,{timeout:10000})
 await page.evaluate(()=>window.__scoreTest.cancelRecommend())
 await page.waitForFunction(()=>window.__scoreTest.state.recommend?.scoreTeamResults?.stopped)
 const grandStopped=await page.evaluate(()=>{
  const r=window.__scoreTest.state.recommend
  return {ok:r.ok,total:r.total,cost:r.costUsed,info:r.scoreTeamResults,grand:r.slots.find(s=>s.isGrand&&!s.isSupport),support:r.slots.find(s=>s.isSupport)}
 })
 assert.equal(grandStopped.ok,true);assert.equal(grandStopped.grand.svtId,123);assert.equal(grandStopped.grand.position,1)
 assert.notEqual(grandStopped.support.position,1);assert.ok(grandStopped.cost<=116)
 assert.equal(grandStopped.info.maximumProven,false)
 assert.ok(await page.locator('.recommend').isVisible())
 await page.setViewportSize({width:390,height:900})
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.screenshot({path:output+'/grand-stopped-mobile.png',fullPage:true})
 // Actual form -> payload -> Worker -> page/export for simultaneous guests.
 await page.evaluate(async()=>{
  const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js');h.stopRecWorker()
  const servants=[{id:101,collectionNo:101,name:'己方测试',className:'saber',rarity:3,cost:1,traitIds:[101]}]
  const card=(id,rate)=>({id,name:'NPC固定礼装'+id,cost:99,skills:[{condLimitCount:0,funcs:[{target:'ptFull',rate}]},{condLimitCount:4,funcs:[{target:'ptFull',rate}]}]})
  const guests=[{id:90,svtId:900,name:'固定NPC一',required:true,script:{eventDeckIndex:2},equips:[{ceId:901,ceMlb:true,ce:card(901,100)},{ceId:902,ceMlb:true,ce:card(902,200)}]},
   {id:91,svtId:910,name:'固定NPC二',required:true,script:{eventDeckIndex:3},equips:[]}]
  const quest={id:999901,phase:1,type:'main',name:'多NPC规则回归',bond:100,region:'CN',flags:['noSupportList','supportSvtMultipleSet'],supportServants:guests,npcSupportCount:2,partyMetadataComplete:true,partyMetadataDetailed:true,partyScript:{isInfinityCost:1},restrictions:[{type:'svtNum',rangeType:'equal',targetVals:[3]}]}
  Object.assign(s,{mode:'free',account:null,base:'100',costLimit:'0',allowSupport:true,questId:'999901',questPhase:'1',questName:quest.name,questType:'normal',questClass:'',grandPosition:0,
   frontIds:[0,0,0],preferIds:[],lockIds:[],pinCes:[],pinSprites:[],slotPins:[{position:1,svtId:101},...[4,5,6].map(position=>({position,empty:true}))]})
  Object.assign(s.data,{servants,ces:[],quests:[quest],game:createGameData({servants,craftEssences:[],quests:[quest],version:{region:'CN',dataVersion:'multi-NPC-rules-regression'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
  h.render();await h.runRecommend()
 })
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete,null,{timeout:10000})
 const multiNpc=await page.evaluate(()=>{const r=window.__scoreTest.state.recommend;return {ok:r.ok,total:r.total,cost:r.costUsed,slots:r.slots,error:r.error}})
 assert.equal(multiNpc.ok,true,multiNpc.error);assert.equal(multiNpc.total,166);assert.equal(multiNpc.cost,1)
 assert.equal(multiNpc.slots.filter(s=>s.isSupport).length,2);assert.equal(multiNpc.slots[1].fixedEquips.length,2)
 assert.match(await page.locator('.ce-kit').innerText(),/NPC固定礼装901/);assert.match(await page.locator('.ce-kit').innerText(),/NPC固定礼装902/)
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 const npcDownload=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const npcFile=await npcDownload,npcRows=(await readFile(await npcFile.path(),'utf8')).trim().split('\n').map(JSON.parse)
 assert.ok(npcRows.slice(1).every(r=>r.slots[1].fixedEquips.length===2&&r.slots[1].supportKind==='system'))
 // Quest NPC occupancy and required owned starting members are independent.
 // These phase rules must not become persistent user pins.
 await page.evaluate(async()=>{
  const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js');h.stopRecWorker()
  const npc={id:92,svtId:920,name:'副本固定NPC',required:true,script:{eventDeckIndex:1},equips:[]}
  const quest={id:999902,phase:1,type:'main',name:'副本出战规则回归',bond:100,region:'CN',flags:['noSupportList','supportSvtMultipleSet'],supportServants:[npc],npcSupportCount:1,partyMetadataComplete:true,partyMetadataDetailed:true,restrictions:[
   {type:'svtNum',rangeType:'equal',targetVals:[2]},
   {type:'fixedMySvtIndividualityPositionMain',rangeType:'equal',targetVals:[101],targetVals2:[1]}]}
  Object.assign(s,{mode:'account',account:{region:'CN',servants:[{id:101,bondLv:5,bondCap:10,maxAscension:0}],ces:[]},costLimit:'116',questId:'999902',questPhase:'1',questName:quest.name,slotPins:[],frontIds:[0,0,0]})
  Object.assign(s.data,{quests:[quest],game:createGameData({servants:s.data.servants,craftEssences:[],quests:[quest],version:{region:'CN',dataVersion:'phase-deployment-regression'}})})
  s.slots=s.slots.map(x=>({...x,filled:false,pinned:false,isSupport:false,isGrand:false,svtId:0,ceId:0,ceBondId:0,ceRewardId:0}))
  h.render();await h.runRecommend()
 })
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete,null,{timeout:10000})
 const deployment=await page.evaluate(()=>{const s=window.__scoreTest.state,r=s.recommend;return {ok:r.ok,error:r.error,total:r.total,count:r.scoreTeamResults.bestCount,pins:s.slotPins,positions:(r.plans||[]).map(p=>p.slots.find(s=>s.filled&&!s.isSupport).position),quest:window.__scoreTest.currentQuestPayload(),actualPins:window.__scoreTest.collectSlotPins()}})
 assert.equal(deployment.ok,true,deployment.error);assert.equal(deployment.total,124);assert.equal(deployment.count,2)
 assert.deepEqual([...new Set(deployment.positions)].sort(),[2,3]);assert.deepEqual(deployment.pins,[])
 const deploymentText=await page.locator('.query-context').first().innerText()
 assert.match(deploymentText,/副本固定出战：NPC 副本固定NPC占 1 号位/)
 assert.match(deploymentText,/副本必选首发：己方己方测试须在 1–3 号位/)
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await page.evaluate(async()=>{
  const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js');h.stopRecWorker()
  const previous=s.data.quests[0],quest={...previous,phase:2,name:'后续自由出战阶段',flags:['eventDeckNoSupport'],supportServants:[],npcSupportCount:0,restrictions:[]}
  const servant={id:102,collectionNo:102,name:'后续己方',className:'saber',rarity:3,cost:1,traitIds:[102]}
  Object.assign(s,{questPhase:'2',questName:quest.name,account:{region:'CN',servants:[{id:102,bondLv:5,bondCap:10,maxAscension:0}],ces:[]},slotPins:[{position:1,svtId:102},...[2,3,4,5,6].map(position=>({position,empty:true}))]})
  Object.assign(s.data,{servants:[...s.data.servants,servant],quests:[previous,quest]})
  s.data.game=createGameData({servants:s.data.servants,craftEssences:[],quests:s.data.quests,version:{region:'CN',dataVersion:'phase-switch-regression'}})
  h.render();await h.runRecommend()
 })
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete,null,{timeout:10000})
 const phaseSwitch=await page.evaluate(()=>{const h=window.__scoreTest,r=h.state.recommend;return {ok:r.ok,error:r.error,quest:h.currentQuestPayload(),slots:r.slots?.filter(s=>s.filled)}})
 assert.equal(phaseSwitch.ok,true,JSON.stringify(phaseSwitch));assert.equal(phaseSwitch.quest.phase,2)
 assert.equal(phaseSwitch.slots.length,1);assert.equal(phaseSwitch.slots[0].svtId,102);assert.equal(phaseSwitch.slots[0].position,1)
 assert.doesNotMatch(await page.locator('.query-context').first().innerText(),/副本固定出战|副本必选首发/)
 // Pin through the real UI, without checking the Grand seat separately.
 // Both the marker and Worker must derive seat 4 from account designation.
 await page.evaluate(async()=>{
  const h=window.__scoreTest,s=h.state,{createGameData}=await import('/src/data-layer.js');h.stopRecWorker()
  const servants=[101,102,103].map(id=>({id,collectionNo:id,name:id===103?'冠位联动测试':'普通联动'+id,className:'assassin',rarity:3,cost:1,traitIds:[]}))
  Object.assign(s,{mode:'account',account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,maxAscension:0,isGrand:s.id===103})),ces:[]},base:'100',costLimit:'116',allowSupport:false,
   questId:'',questPhase:'1',questName:'',questType:'grand',questClass:'assassin',grandPosition:0,slotPins:[],frontIds:[0,0,0],slotQuery:['','','','冠位联动','',''],constraintsOpen:true,advancedOpen:true,workspaceView:'conditions',
   slots:s.slots.map(x=>({...x,filled:false,pinned:false,isSupport:false,isGrand:false,svtId:0,ceId:0,ceBondId:0,ceRewardId:0}))})
  Object.assign(s.data,{servants,ces:[],quests:[],game:createGameData({servants,craftEssences:[],version:{region:'CN',dataVersion:'grand-pin-link-regression'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
  h.render()
 })
 await page.locator('[data-slot-set="3"][data-id="103"]').click()
 assert.equal(await page.locator('#work-conditions [data-grand-pos="4"]').isChecked(),true)
 assert.match(await page.locator('.query-context').first().innerText(),/出战冠位：冠位联动测试 · 4 号位.*自动关联/)
 assert.match(await page.locator('.rec-pickers.slot-pins').innerText(),/账号冠位/)
 assert.equal(await page.evaluate(()=>window.__scoreTest.state.grandPosition),0,'Automatic inference must not become a persisted manual position')
 await page.locator('#recommendNow').click()
 await page.waitForFunction(()=>!window.__scoreTest.state.recBusy&&window.__scoreTest.state.recommend?.scoreTeamResults?.complete,null,{timeout:10000})
 const grandLinked=await page.evaluate(()=>{const s=window.__scoreTest.state,r=s.recommend;return {ok:r.ok,error:r.error,manualPosition:s.grandPosition,grand:r.slots?.find(s=>s.isGrand&&!s.isSupport)}})
 assert.equal(grandLinked.ok,true,grandLinked.error);assert.equal(grandLinked.grand.svtId,103);assert.equal(grandLinked.grand.position,4)
 await page.locator('#work-tab-conditions').click()
 await page.locator('[data-slot-clear="3"]').click()
 assert.equal(await page.locator('#work-conditions [data-grand-pos="4"]').isChecked(),false)
 assert.doesNotMatch(await page.locator('.query-context').first().innerText(),/出战冠位：冠位联动测试/)
 assert.equal(await page.evaluate(()=>window.__scoreTest.state.account.servants.find(s=>s.id===103).isGrand),true,'Unpinning does not erase account designation')
 assert.deepEqual(errors,[])
 const report={passed:true,first,reused,second,stopped,earlyStopped,checkpointStopped:checkpointStopped.scoreTeamResults,grandStopped,multiNpc,deployment,phaseSwitch,grandLinked,recoveryCompleted,recoveryStopped:recoveryStopped.scoreTeamResults,sparseBefore,sparseAfter,exportedRecords:lines.length-1,checks:['injected incomplete proof automatically recovers, completes the same ties, and stop/export retains the new preview with revoked proof','objective proof precedes tie collection, collection-stop preserves proven maximum and incomplete ties','real application and Worker','completed archive reuse','320/390/834/1440 responsive widths','OPFS disk paging beyond 64 groups','compact family catalog export','constrained alternative display','other legal teams','complete JSONL export','soft cancellation preserves readable results','stopped results retain plans and export with incomplete status','stop before first result preserves worker and shows honest empty state','non-AI first checkpoint survives stop and export before any archived group','live conditions and results progress without a preview or any new teams','Grand account with own Grand pinned at 1 and movable friend returns a legal team and retains it on stop','background enumeration preserves the comparison editor','desktop and mobile rendering','simultaneous NPCs, fixed multi-CE settlement, phase COST override and export','phase NPC and owned starting-member requirements, exact phase switch, no persistent pins','pinning an account Grand at back seat auto-links UI and Worker, unpinning releases the seat without changing designation'],errors}
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



