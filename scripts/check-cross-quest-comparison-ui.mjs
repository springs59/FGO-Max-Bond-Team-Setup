import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,readFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const origin='http://127.0.0.1:5211',out='ui-checks/cross-quest'
const server=spawn('python3',['-m','http.server','5211','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
 await mkdir(out,{recursive:true})
 for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
 await page.route(/\/src\/app\.js(?:\?.*)?$/,async route=>{
  const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__cross={state,render,runRecommend,refreshScorePayload};'})
 })
 // Hold the real collector after its proof message, so this test inspects the
 // live display rather than accidentally passing only on the final result.
 await page.route(/\/src\/solver\/score-team-worker\.js(?:\?.*)?$/,async route=>{
  const r=await route.fetch(),body=await r.text(),needle="if(event.recovery||timestamp-lastYield>=16||event.type==='tick'){"
  assert.ok(body.includes(needle))
  await route.fulfill({response:r,body:body.replace(needle,"if(event.type==='phase'&&event.phase==='collecting')await new Promise(resolve=>setTimeout(resolve,3000));"+needle)})
 })
 await page.goto(origin);await page.waitForFunction(()=>window.__cross?.state.data.regionReady)
 await page.evaluate(async()=>{
  const {state:s,render}=window.__cross,{createGameData}=await import('/src/data-layer.js'),{importAccountProfile}=await import('/src/account-profiles.js'),{aiSettings}=await import('/src/ai-update-ui.js')
  aiSettings.setSelection('off')
  const servants=[{id:1,name:'剑队从者',className:'saber',rarity:5,cost:1,traitIds:[1]},
   {id:2,name:'弓队从者',className:'archer',rarity:4,cost:1,traitIds:[2]}]
  const profile=importAccountProfile({ok:true,region:'CN',servants:servants.map(v=>({id:v.id,bondLv:5,bondCap:10,isGrand:v.id===1})),ces:[]})
  Object.assign(s,{mode:'account',account:profile.account,accountProfileId:profile.id,accountSavedAt:profile.savedAt,
   base:'1000',costLimit:'116',teapot:false,allowSupport:false,solverMode:'bond',questType:'grand',questId:'11',questPhase:'1',questName:'冠位剑',questClass:'saber',
   preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],grandPosition:0,
   slotPins:[{position:1,svtId:1},...[2,3,4,5,6].map(position=>({position,empty:true}))],
   slots:s.slots.map(v=>({...v,filled:false,svtId:0,ceId:0,pinned:false,isGrand:false,isSupport:false})),
   filter:{svtClass:{options:[],invert:false},rarity:{options:[],invert:false},attribute:{options:[],invert:false},trait:{options:[],invert:false},banSvtIds:[],banCeIds:[]},
   comparisonTeams:[],comparisonEditing:-1,comparisonSearch:{},appearance:{...s.appearance,layout:'single'},workspaceView:'conditions'})
  Object.assign(s.data,{servants,ces:[],quests:[{id:11,phase:1,name:'冠位剑',noSupport:true},{id:22,phase:1,name:'冠位弓',noSupport:true}],
   game:createGameData({servants,craftEssences:[],version:{region:'CN',dataVersion:'cross-quest-test'}}),bondBonuses:null,solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
  render()
 })
 await page.locator('#recommendNow').click()
 await page.waitForFunction(()=>!window.__cross.state.recBusy&&window.__cross.state.recommend?.scoreTeamResults?.complete)
 assert.equal(await page.evaluate(()=>window.__cross.state.recommend.total),1200)
 await page.getByRole('button',{name:'将此推荐队伍加入对比',exact:true}).click()
 await page.locator('#work-tab-compare').click()
 const sword=await page.evaluate(()=>structuredClone(window.__cross.state.comparisonTeams[0]))
 assert.equal(sword.savedReport.total,1200)
 assert.equal(sword.savedReport.queryContext.quest,'冠位剑')
 await page.evaluate(()=>{
  const {state:s,render}=window.__cross
  Object.assign(s,{base:'2000',teapot:true,questId:'22',questName:'冠位弓',questClass:'archer',slotPins:[{position:1,svtId:2},...[2,3,4,5,6].map(position=>({position,empty:true}))],
    filter:{...s.filter,rarity:{options:[4,5],invert:false}},slots:s.slots.map(v=>({...v,pinned:false}))})
  render()
 })
 // Do not click the results tab: reproduce launching another query while the
 // single-page workspace still considers the comparison tab selected.
 await page.locator('#recommendNow').click()
 await page.waitForFunction(()=>window.__cross.state.recommend?.scoreTeamResults?.maximumProven&&!window.__cross.state.recommend.scoreTeamResults.complete)
 assert.equal(await page.locator('#work-results .recommend').count(),1,'A proven maximum must have a visible team before collection completes')
 assert.equal(await page.locator('#work-results .empty-state').count(),0,'The searching placeholder must be replaced without clicking results')
 assert.match(await page.locator('#work-results').innerText(),/总羁绊 4800/)
 assert.equal(await page.evaluate(()=>window.__cross.state.workspaceView),'compare')
 await page.locator('[data-comparison-edit="0"]').click()
 await page.locator('[data-comparison-name]').fill('尚未提交的队名')
 await page.evaluate(async()=>{
  const input=document.querySelector('[data-comparison-name]');input.setSelectionRange(2,4)
  await window.__cross.refreshScorePayload({kind:'bond',value:structuredClone(window.__cross.state.recommend)})
 })
 assert.equal(await page.locator('[data-comparison-name]').inputValue(),'尚未提交的队名')
 assert.deepEqual(await page.evaluate(()=>({active:document.activeElement?.hasAttribute('data-comparison-name'),start:document.activeElement?.selectionStart,end:document.activeElement?.selectionEnd})),{active:true,start:2,end:4})
 await page.locator('[data-comparison-name]').blur()
 await page.getByRole('button',{name:'将此推荐队伍加入对比',exact:true}).click()
 await page.waitForFunction(()=>!window.__cross.state.recBusy&&window.__cross.state.recommend?.scoreTeamResults?.complete)
 const captured=await page.evaluate(()=>window.__cross.state.comparisonTeams)
 assert.deepEqual(captured.map(p=>p.savedReport.total),[1200,4800])
 assert.equal(captured[1].savedReport.grandRecommendation.requiresSelection,true)
 assert.equal(captured[0].savedReport.queryContext.quest,'冠位剑')
 await page.screenshot({path:out+'/single-page-results.png',fullPage:true})
 // Switch all active conditions after both additions. Saved display/export
 // must continue using each team's original results and assumptions.
 await page.evaluate(()=>{
  const h=window.__cross,s=h.state
  Object.assign(s,{base:'9999',teapot:false,questId:'',questName:'',questType:'',questClass:'',slotPins:[]})
  s.account={...s.account,servants:s.account.servants.map(v=>({...v,bondLv:15,bondCap:15,isGrand:true}))}
  h.render()
 })
 assert.match(await page.locator('.team-comparison').innerText(),/1200/)
 assert.match(await page.locator('.team-comparison').innerText(),/4800/)
 assert.match(await page.locator('.team-comparison').innerText(),/冠位剑/)
 assert.match(await page.locator('.team-comparison').innerText(),/冠位弓/)
 for(const format of ['json','html','docx','pdf','png']){
  await page.locator('[data-team-export-format="comparison"]').selectOption(format)
  const downloading=page.waitForEvent('download');await page.locator('[data-team-export="comparison"]').click()
  const file=await downloading;await file.saveAs(out+'/mixed.'+format)
  const bytes=await readFile(out+'/mixed.'+format);assert.ok(bytes.length>100)
  if(format==='json'){
   const report=JSON.parse(bytes);assert.deepEqual(report.teams.map(t=>t.total),[1200,4800]);assert.deepEqual(report.teams.map(t=>t.queryContext.quest),['冠位剑','冠位弓'])
   assert.equal(report.teams[1].grandRecommendation.requiresSelection,true)
   assert.ok(report.teams.every(t=>t.total===t.slots.reduce((n,s)=>n+(s.gain||0),0)))
  }else if(format==='html'||format==='docx'){assert.ok(bytes.includes(Buffer.from('冠位剑')));assert.ok(bytes.includes(Buffer.from('冠位弓')))}
  else if(format==='png'){assert.equal(bytes.readUInt32BE(16),1240);assert.ok(bytes.readUInt32BE(20)>=3508,'Two saved teams export as one complete long PNG')}
 }
 await page.locator('#teamReportFile').setInputFiles(out+'/mixed.json')
 await page.locator('.team-report-dialog').waitFor();assert.match(await page.locator('.team-report-dialog').innerText(),/冠位剑/);assert.match(await page.locator('.team-report-dialog').innerText(),/冠位弓/)
 await page.locator('[data-report-close]').click()
 await page.reload();await page.waitForFunction(()=>window.__cross?.state.data.regionReady)
 await page.locator('#work-tab-compare').click()
 const restored=await page.evaluate(()=>window.__cross.state.comparisonTeams)
 assert.deepEqual(restored.map(p=>p.savedReport.total),[1200,4800]);assert.deepEqual(restored.map(p=>p.savedReport.queryContext.quest),['冠位剑','冠位弓'])
 for(const width of [320,390,834,1440]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,singlePageBackgroundResults:true,uncommittedEditorPreserved:true,independentSwordAndArcherConditions:true,conditionalGrandPreserved:true,formats:['json','html','docx','pdf','png'],reload:true}))
}finally{await browser?.close();server.kill()}
