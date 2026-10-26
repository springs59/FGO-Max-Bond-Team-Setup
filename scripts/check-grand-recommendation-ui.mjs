import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
const origin='http://127.0.0.1:5204',server=spawn('python3',['-m','http.server','5204','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
 await mkdir('ui-checks/grand-recommendation',{recursive:true})
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.route(/\/src\/app\.js(?:\?.*)?$/,async route=>{const response=await route.fetch(),body=(await response.text()).replace('bindAccountImportHooks()\nboot()','bindAccountImportHooks()\nboot().then(()=>window.__grandBootDone=true)').replace('if (renderedConditionKey !== null && conditionKey !== renderedConditionKey) {','if (renderedConditionKey !== null && conditionKey !== renderedConditionKey) { (window.__grandInvalidations||=[]).push({before:renderedConditionKey,after:conditionKey,stack:new Error().stack});');await route.fulfill({response,body:body+'\nwindow.__grandUI={state,render,runRecommend};'})})
 await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
 await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.__grandBootDone&&window.__grandUI?.state.data.regionReady)
 async function fixture(kind,designated=false){
  await page.evaluate(async({kind,designated})=>{
   const h=window.__grandUI,s=h.state,{createGameData}=await import('/src/data-layer.js'),servants=[1,2].map(id=>({id,collectionNo:id,name:'测试从者'+id,className:designated==='other-class'&&id===2?'archer':'saber',cost:1,rarity:3,traitIds:[id,id===1?107:108]}))
   const restrictions=kind==='required'?[{type:'myGrandSvt',rangeType:'equal',targetVals:[107]}]:kind==='optional'||kind==='rear-grand'?[{type:'activeGrandBoard',targetVals:kind==='rear-grand'?[4]:[1,4]}]:[{type:'mySvtNum',rangeType:'above',targetVals:[1]}]
   Object.assign(s,{mode:'account',account:{region:'CN',servants:servants.map(v=>({id:v.id,bondLv:5,bondCap:10,isGrand:designated&&(['ineligible','other-class'].includes(designated)?v.id===2:v.id===1)})),ces:[]},accountProfileId:'',accountSavedAt:0,
    base:'100',costLimit:'2',allowSupport:false,solverMode:'bond',questType:kind.endsWith('-grand')?'grand':'',questId:'77',questPhase:'1',questName:'合成冠位规则',questClass:kind.endsWith('-grand')?'saber':'',preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],grandPosition:0,
    slotPins:[{position:1,svtId:1},{position:4,svtId:2},...[2,3,5,6].map(position=>({position,empty:true}))],slots:s.slots.map(x=>({...x,filled:false,pinned:false,svtId:0,ceId:0,isGrand:false,isSupport:false})),workspaceView:'results'})
   Object.assign(s.data,{servants,ces:[],quests:[{id:77,phase:1,noSupport:true,restrictions}],game:createGameData({servants,craftEssences:[],version:{region:'CN',dataVersion:'grand-choice-ui'}}),bondBonuses:null,solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
   window.__grandAccount=JSON.stringify(s.account);h.render();await h.runRecommend()
  },{kind,designated})
  try{await page.waitForFunction(()=>!window.__grandUI.state.recBusy&&window.__grandUI.state.recommend,{},{timeout:10000})}
  catch(error){console.log(JSON.stringify(await page.evaluate(()=>({busy:window.__grandUI.state.recBusy,progress:window.__grandUI.state.solverProgress,recommend:window.__grandUI.state.recommend,invalidations:window.__grandInvalidations?.slice(-3)}))),errors);throw error}
  const result=await page.evaluate(()=>window.__grandUI.state.recommend)
  if(designated==='ineligible'&&kind==='required'){assert.equal(result.ok,false);assert.match(result.error,/对应职阶已有冠位/)}else assert.ok(result.ok,JSON.stringify(result));assert.equal(result.scoreTeamResults.complete,true)
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__grandUI.state.account)===window.__grandAccount),true)
  return page.evaluate(()=>window.__grandUI.state.recommend)
 }
 const required=await fixture('required')
 assert.equal(required.grandRecommendation.requiresSelection,true)
 assert.match(await page.locator('#work-results').innerText(),/需先选择冠位/)
 await page.locator('[data-team-export-format="recommend"]').selectOption('json')
 let downloading=page.waitForEvent('download');await page.locator('[data-team-export="recommend"]').click()
 const file=await downloading,report=JSON.parse(await readFile(await file.path(),'utf8'))
 assert.match(report.queryContext.冠位选择条件,/测试从者1/);assert.ok(report.teams[0].grandRecommendation)
 downloading=page.waitForEvent('download');await page.locator('[data-score-export]').click()
 const archive=await downloading,bytes=await readFile(await archive.path()),rows=bytes.toString().trim().split('\n').map(JSON.parse)
 assert.ok(rows[0].grandSearchScope.includesRecommendations);assert.ok(rows.slice(1).every(r=>r.grandRecommendation?.requiresSelection))
 await page.locator('#teamReportFile').setInputFiles({name:'grand.jsonl',mimeType:'application/x-ndjson',buffer:bytes})
 await page.locator('.team-report-dialog').waitFor();assert.match(await page.locator('.team-report-dialog').innerText(),/需先选择冠位/)
 await page.locator('[data-report-close]').click()
 assert.ok((await fixture('count-grand')).grandRecommendation)
 const rear=await fixture('rear-grand');assert.equal(rear.slots.find(s=>s.isGrand&&!s.isSupport).position,4)
 const actual=await fixture('required',true);assert.equal(actual.grandRecommendation,undefined);assert.equal(actual.scoreTeamResults.grandSearchScope.includesRecommendations,false)
 assert.match(await page.locator('#accountGrandInfo').innerText(),/账号冠位：1 名[\s\S]*测试从者1[\s\S]*按所需职阶判断/);
 const excluded=await fixture('required','ineligible');assert.equal(excluded.scoreTeamResults.grandSearchScope.includesRecommendations,false);assert.match(await page.locator('#accountGrandInfo').innerText(),/测试从者2/);
 const restricted=await fixture('optional','ineligible');assert.ok(restricted.plans.every(p=>!p.grandRecommendation));
 const missingClass=await fixture('required','other-class');assert.ok(missingClass.grandRecommendation.candidates.some(c=>c.svtId===1));assert.equal(missingClass.scoreTeamResults.grandSearchScope.includesRecommendations,true);
 assert.match(await page.locator('#accountGrandInfo').innerText(),/测试从者2[\s\S]*该职阶没有冠位时才推荐/);
 await page.locator('[data-team-export-format="recommend"]').selectOption('json');downloading=page.waitForEvent('download');await page.locator('[data-team-export="recommend"]').click();
 const missingReport=JSON.parse(await readFile(await(await downloading).path(),'utf8'));assert.ok(missingReport.teams[0].grandRecommendation);
 const optionalMissing=await fixture('optional','other-class');assert.ok(optionalMissing.plans.some(p=>p.grandRecommendation));assert.ok(optionalMissing.plans.some(p=>!p.slots.some(s=>s.isGrand)));
 const optional=await fixture('optional');assert.ok(optional.plans.some(p=>p.grandRecommendation));assert.ok(optional.plans.some(p=>!p.slots.some(s=>s.isGrand)))
 const ordinary=await fixture('ordinary');assert.ok(ordinary.plans.every(p=>!p.grandRecommendation&&!p.slots.some(s=>s.isGrand)))
 for(const width of [320,390,834,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 await page.screenshot({path:'ui-checks/grand-recommendation/result.png',fullPage:true});assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,scenarios:10,accountUnchanged:true,conditionalResult:true,rearGrandRetained:true,jsonAndArchive:true,offlineWarning:true,optionalOrdinary:true,responsive:true}))
}finally{await browser?.close();server.kill()}
