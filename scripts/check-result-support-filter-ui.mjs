import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFile,mkdir} from 'node:fs/promises'
import {chromium} from 'playwright'
const origin='http://127.0.0.1:5199',out='ui-checks/result-support-filter',server=spawn('python3',['-m','http.server','5199','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
 await mkdir(out,{recursive:true})
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']})
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.addInitScript(()=>{window.__supportCalls=[];const original=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){window.__supportCalls.push({id:m.id,type:m.type||'query',allScoreTeams:!!m.opts?.allScoreTeams,supportCeId:m.supportCeId});return original.call(this,m,...args)}})
 await page.route(/\/src\/app\.js(?:\?.*)?$/,async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__supportTest={state,runRecommend,render};'})})
 await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
 await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.__supportTest?.state.data.regionReady)
 await page.evaluate(async()=>{
  const h=window.__supportTest,s=h.state,{createGameData}=await import('/src/data-layer.js')
  const servants=[1,2,3].map(id=>({id,collectionNo:id,name:'测试从者'+id,className:'saber',cost:1,rarity:3,traitIds:[]}))
  const ces=[101,102,103,999].map(id=>({id,name:'测试礼装'+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate:id===103?50:id===999?10:100,followerRate:id===103?50:id===999?10:100,add:0,tvals:[],andTvals:[]}]}))}))
  Object.assign(s,{mode:'account',account:{region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4})),ces:[]},accountProfileId:'',accountSavedAt:0,
   base:'100',costLimit:'2',allowSupport:true,solverMode:'bond',questType:'',questId:'',questKind:'',questPhase:0,questClass:'',preferIds:[],lockIds:[],frontIds:[0,0,0],pinCes:[],pinSprites:[],grandPosition:0,
   slotPins:[2,3,4,5].map(position=>({position,empty:true})).concat({position:6,support:true}),slots:s.slots.map(x=>({...x,filled:false,pinned:false,svtId:0,ceId:0,isGrand:false,isSupport:false})),workspaceView:'results'})
  Object.assign(s.data,{servants,ces,quests:[],bondBonuses:null,game:createGameData({servants,craftEssences:ces,version:{region:'CN',dataVersion:'support-result-filter-ui'}}),solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null})
  h.render();await h.runRecommend()
 })
 await page.waitForFunction(()=>!window.__supportTest.state.recBusy&&window.__supportTest.state.recommend?.scoreTeamResults?.complete)
 const before=await page.evaluate(()=>({queries:window.__supportCalls.filter(c=>c.allScoreTeams).length,info:window.__supportTest.state.recommend.scoreTeamResults,stats:window.__supportTest.state.recommend.queryStats,slots:window.__supportTest.state.recommend.slots}))
 assert.equal(before.queries,1)
 const ids=(await page.locator('.rec-assist [data-assist-ce]').evaluateAll(els=>els.map(el=>el.dataset.assistCe))).filter(Boolean).map(Number)
 assert.deepEqual(new Set(ids),new Set(before.info.supportCeOptions.map(r=>r.id)))
 assert.ok(ids.includes(102),'The non-representative compact CE is visible')
 assert.ok(!ids.includes(999),'The available but unused CE is not in the results filter')
 assert.match(await page.locator('.rec-assist').innerText(),/已得到配队.*未翻页.*点击仅筛选/s)
 await page.locator('#assistCeQuery').fill('102')
 assert.equal(await page.locator('[data-assist-ce="101"]').isVisible(),false)
 assert.equal(await page.locator('[data-assist-ce=""]').isVisible(),true)
 await page.locator('[data-assist-ce="102"]').click()
 await page.waitForFunction(()=>window.__supportTest.state.recommend.slots.find(s=>s.isSupport)?.ceId===102&&window.__supportTest.state.recommend.scoreTeamResults.supportCeId===102)
 assert.equal(await page.locator('#assistCeQuery').inputValue(),'102','Name/ID search survives selection and rerender')
 assert.ok(await page.locator('[data-assist-ce="102"]').evaluate(el=>el.classList.contains('active')))
 await page.locator('#scoreAnyVariant').click();await page.waitForFunction(()=>!document.querySelector('#scoreAnyVariant')?.disabled)
 assert.equal(await page.evaluate(()=>window.__supportTest.state.recommend.slots.find(s=>s.isSupport)?.ceId),102)
 await page.locator('[data-team-export-format="recommend"]').selectOption('json')
 const saving=page.waitForEvent('download');await page.locator('[data-team-export="recommend"]').click();await(await saving).saveAs(out+'/selected.json')
 const report=JSON.parse(await readFile(out+'/selected.json','utf8'))
 assert.equal(report.teams[0].slots.find(s=>s.isSupport).equipment.find(e=>e.role==='普通').id,102)
 await page.locator('[data-assist-ce=""]').click();await page.waitForFunction(()=>window.__supportTest.state.recommend.scoreTeamResults.supportCeId===null)
 assert.equal(await page.evaluate(()=>window.__supportCalls.filter(c=>c.allScoreTeams).length),before.queries,'Clicks/clearing/variant/export do not start another solver query')
 assert.equal(await page.evaluate(()=>window.__supportTest.state.recommend.scoreTeamResults.bestCount),before.info.bestCount)
 await page.locator('#assistCeQuery').fill('')
 for(const width of [390,1280]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2))}
 await page.screenshot({path:out+'/support-filter.png',fullPage:true})
 assert.deepEqual(errors,[])
 console.log(JSON.stringify({passed:true,ids,oneQuery:before.queries,compactCeSelection:true,variantFilter:true,selectedExport:true,clearRestoresArchive:true}))
}finally{await browser?.close();server.kill()}
