import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
const origin='http://127.0.0.1:5198',out='ui-checks/score-variants',server=spawn('python3',['-m','http.server','5198','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
  await mkdir(out,{recursive:true})
  for(let i=0;i<60;i++){try{if((await fetch(origin+'/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];let workers=0
  page.on('pageerror',e=>errors.push(e.message));page.on('worker',()=>workers++)
  await page.route(/\/src\/app\.js(?:\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__variantsTest={state,runRecommend,render};'})})
  // Delay one archive read in the test response to exercise the real cancel
  // binding and late-result guard; no delay/fault switch ships in the app.
  await page.route(/\/src\/solver\/score-team-variant-browser\.js(?:\?.*)?$/,async route=>{
    const r=await route.fetch(),body=await r.text();assert.ok(body.includes('cursor.next=async()=>{'))
    await route.fulfill({response:r,body:body.replace('cursor.next=async()=>{','cursor.next=async()=>{if(!globalThis.__variantReadDelayed){globalThis.__variantReadDelayed=true;await new Promise(r=>setTimeout(r,500))}')})
  })
  await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
  await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.__variantsTest?.state.data.regionReady)
  await page.evaluate(async()=>{
    const h=window.__variantsTest,s=h.state,{createGameData}=await import('/src/data-layer.js')
    const servants=[1,2,3].map(id=>({id,collectionNo:id,name:'测试从者'+id,className:'saber',cost:1,rarity:3,traitIds:[10]}))
    const ces=[101,102,103].map(id=>({id,name:'测试礼装'+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate:n?100:50,followerRate:n?100:50,add:0,tvals:[],andTvals:[]}]}))}))
    Object.assign(s,{mode:'account',account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4})),ces:ces.map(c=>({id:c.id,count:1,mlbCount:1}))},accountProfileId:'',accountSavedAt:0,
      base:'100',costLimit:'4',allowSupport:false,solverMode:'bond',questType:'',questId:'',questKind:'',questPhase:0,questClass:'',preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],grandPosition:0,
      slotPins:[3,4,5,6].map(position=>({position,empty:true})),slots:s.slots.map(x=>({...x,filled:false,pinned:false,svtId:0,ceId:0,isGrand:false,isSupport:false})),workspaceView:'results'})
    Object.assign(s.data,{servants,ces,quests:[],bondBonuses:null,game:createGameData({servants,craftEssences:ces,version:{region:'CN',dataVersion:'equipment-variants-browser'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
    h.render();await h.runRecommend()
  })
  await page.waitForFunction(()=>!window.__variantsTest.state.recBusy&&window.__variantsTest.state.recommend?.scoreTeamResults?.complete)
  const snapshot=()=>page.evaluate(async()=>{
    const p=window.__variantsTest.state.recommend,{physicalVariantKey,memberPlacementKey,memberCompositionKey}=await import('/src/solver/score-team-diversity.js')
    return {physical:physicalVariantKey(p),members:memberPlacementKey(p),composition:memberCompositionKey(p),total:p.total,cost:p.costUsed,ces:p.slots.map(s=>[s.ceId||0,s.ceMlb!==false]),stats:p.scoreTeamResults.stats}
  })
  const before=await snapshot()
  await page.locator('#scoreDifferentEquipment').click()
  await page.locator('#scoreVariantCancel').click()
  await page.waitForTimeout(650)
  assert.equal((await snapshot()).physical,before.physical,'Cancel keeps the selected team and rejects a late read')
  assert.equal(await page.evaluate(()=>window.__variantsTest.state.recBusy),false,'Cancelling variant browsing does not start/stop a main query')
  await page.locator('.bond-plan-groups [data-compare-plan]').last().click()
  await page.locator('#scoreDifferentEquipment').click()
  await page.waitForFunction(()=>window.__variantsTest.state.recommend?.variantNotice?.startsWith('已切换同分礼装'))
  const after=await snapshot()
  assert.equal(after.total,before.total);assert.equal(after.cost,before.cost);assert.equal(after.members,before.members);assert.notEqual(after.physical,before.physical)
  assert.deepEqual(after.stats,before.stats,'Switching equipment does not rerun the solver')
  await page.locator('.bond-plan-groups [data-compare-plan]').last().click()
  await page.locator('#work-tab-compare').click()
  assert.equal(await page.locator('.team-comparison thead th').count(),3)
  assert.ok(await page.locator('.team-comparison .comparison-different').count(),'Different CEs can be compared even with identical members')
  await page.locator('#work-tab-results').click()
  await page.locator('[data-team-export-format="recommend"]').selectOption('json')
  const wait=page.waitForEvent('download');await page.locator('[data-team-export="recommend"]').click()
  const saved=await wait;await saved.saveAs(out+'/selected.json')
  const report=JSON.parse(await readFile(out+'/selected.json','utf8'))
  assert.equal(report.teams[0].total,after.total)
  assert.deepEqual(report.teams[0].slots.map(s=>[s.equipment.find(e=>e.role==='普通')?.id||0,s.equipment.find(e=>e.role==='普通')?.mlb??true]),after.ces,'Report saves the displayed equipment, not the original representative')
  const archiveWait=page.waitForEvent('download');await page.locator('[data-score-export]').click()
  const archive=await archiveWait;await archive.saveAs(out+'/all.jsonl')
  // The full archive can unfold CE alternatives and export the selected one
  // without an account, a new query or a new Worker.
  const workerCount=workers
  await page.locator('#teamReportFile').setInputFiles(out+'/all.jsonl')
  await page.locator('[data-archive-variant="equipment"]').first().waitFor()
  const first=page.locator('[data-archive-entry]:has([data-archive-variant="equipment"])').first(),names=await first.locator('tbody tr td:nth-child(2)').allTextContents(),equipment=await first.locator('tbody tr td:nth-child(3)').allTextContents()
  const entryIndex=await first.getAttribute('data-archive-entry')
  await first.locator('[data-archive-variant="equipment"]').click()
  await page.waitForFunction(index=>document.querySelector(`[data-archive-entry="${index}"] [data-archive-variant-status]`)?.textContent.includes('已读取同分替换'),entryIndex)
  assert.deepEqual(await first.locator('tbody tr td:nth-child(2)').allTextContents(),names)
  assert.notDeepEqual(await first.locator('tbody tr td:nth-child(3)').allTextContents(),equipment)
  assert.equal(workers,workerCount,'Opening/browsing an archive does not start a query')
  const archivedWait=page.waitForEvent('download');await first.locator('[data-archive-save]').click()
  await(await archivedWait).saveAs(out+'/archived-selected.json')
  const archivedReport=JSON.parse(await readFile(out+'/archived-selected.json','utf8'))
  assert.equal(archivedReport.teams[0].total,after.total);assert.ok(archivedReport.teams[0].slots.every(s=>s.gain===null))
  await page.locator('[data-report-close]').click()
  let bothChanged=false
  for(let i=0;i<80;i++){
    const old=(await snapshot()).physical
    await page.locator('#scoreAnyVariant').click()
    await page.waitForFunction(()=>!document.querySelector('#scoreAnyVariant')?.disabled)
    const current=await snapshot();if(current.physical===old)break
    assert.equal(current.total,before.total)
    if(current.composition!==before.composition&&JSON.stringify(current.ces)!==JSON.stringify(before.ces)){bothChanged=true;break}
  }
  assert.ok(bothChanged,'Global browsing reaches a team with both different members and different equipment')
  await page.locator('#scoreVariantReset').click()
  for(const width of [320,390,834,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`Controls fit ${width}`)}
  await page.screenshot({path:out+'/variants-mobile.png',fullPage:true})
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,score:after.total,fixedMembersEquipment:true,bothChanged,comparison:true,selectedReport:true,offlineArchiveAlternatives:true,zeroAdditionalSearch:true}))
}finally{await browser?.close();server.kill()}
