import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,readFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const server=spawn('python3',['-m','http.server','5193','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
const errors=[]
try{
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5193/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  page.on('pageerror',e=>errors.push(e.message))
  await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
  // Deterministic public artwork fixtures exercise real image decoding and
  // asynchronous selected-form hydration without external network access.
  const catalog=JSON.parse(await readFile('src/data/servants.json','utf8'))
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="120" height="180" fill="#e8c587"/><circle cx="60" cy="55" r="28" fill="#796b98"/><path d="M25 170 L35 95 L85 95 L95 170" fill="#527f9d"/></svg>'
  await page.route(/https?:\/\/static\.atlasacademy\.io\/.*\.png/,r=>r.fulfill({contentType:'image/svg+xml',body:svg}))
  await page.route('**/__comparison-art/**',r=>r.fulfill({contentType:'image/svg+xml',body:svg}))
  await page.route(/https?:\/\/api\.atlasacademy\.io\/nice\/(CN|JP)\/servant\/\d+/,async r=>{
    const id=Number(new URL(r.request().url()).pathname.split('/').at(-1)),svt=catalog.find(s=>s.id===id)||{id}
    const url=(kind,key)=>`http://127.0.0.1:5193/__comparison-art/${id}/${kind}/${key}.svg`
    const ascension=Object.fromEntries([0,1,2,3,4].map(n=>[n,url('ascension',n)]))
    const costume=Object.fromEntries((svt.forms||[]).filter(f=>f.key.startsWith('c')).map(f=>[f.key.slice(1),url('costume',f.key.slice(1))]))
    await r.fulfill({contentType:'application/json',body:JSON.stringify({...svt,traits:(svt.traitIds||[]).map(id=>({id})),extraAssets:{faces:{ascension,costume},charaGraph:{ascension,costume}}})})
  })
  await page.goto('http://127.0.0.1:5193/index.html')
  await page.locator('#recommendNow').waitFor()
  await page.locator('[data-quest-category="free"]').click()
  await page.locator('[data-quest-result]').first().click()
  assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'base','quest selection must not open a numeric keyboard')
  // The swap test below uses a manual base and a two-servant COST budget.
  // Clear the selected quest through the UI so daily catalog ordering cannot
  // accidentally impose six own members, fixed guests or class restrictions.
  await page.locator('#questPickerChange').click()
  await page.locator('#questCascadeBox summary').click()
  await page.locator('#questKind').selectOption('')
  const ids=await page.evaluate(async()=>{
    const servants=await(await fetch('./src/data/servants.json')).json(),ces=await(await fetch('./src/data/ces.json')).json()
    const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
    const {ceMilliLive}=await import('./src/solver/solver-index.js')
    const {servantBondForms}=await import('./src/recommend.js')
    const groups=new Map(),support=ces.filter(ceHasBondGain)
    for(const svt of servants.filter(s=>isPlayableServant(s)&&s.cost===3)) {
      const key=support.map(c=>ceMilliLive(c,servantBondForms(svt)[0],true,true)).join(',')
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(svt.id)
    }
    return [...groups.values()].sort((a,b)=>b.length-a.length)[0]
  })
  assert.ok(ids.length>=4)
  const records=ids.map(id=>`array('svtId'=>${id},'status'=>2,'friendshipRank'=>1)`).join(',')
  const fixture=`<?php return array('cache'=>array('replaced'=>array('userSvtCollection'=>array(${records}))));`
  await page.locator('#accountFile').setInputFiles({name:'login.php',mimeType:'application/octet-stream',buffer:Buffer.from(fixture)})
  await page.locator('#modeAccount.active').waitFor()
  await page.locator('#base').fill('815');await page.locator('#base').blur()
  await page.locator('#costLimit').fill('6');await page.locator('#costLimit').blur()
  await page.locator('#recommendNow').click()
  await page.locator('.bond-plan-groups').waitFor({timeout:30000})
  await page.locator('[data-score-export]:not([disabled])').waitFor({timeout:30000})
  assert.equal(await page.locator('#score-tab-status').innerText(),'全部完成')
  assert.ok(await page.locator('[data-assist-ce]').count()>1,'Support selector includes CEs absent from the one representative/page')
  const beforeDifferent=await page.locator('.rec-now-names').innerText()
  const beforeScore=await page.locator('.rec-now-top strong').innerText()
  await page.locator('#scoreDifferentMembers').click()
  await page.waitForFunction(previous=>document.querySelector('.rec-now-names')?.textContent!==previous,beforeDifferent)
  assert.equal(await page.locator('.rec-now-top strong').innerText(),beforeScore,'Different members retain the exact score')
  assert.notEqual(await page.locator('.rec-now-names').innerText(),beforeDifferent,'A member composition changes, rather than seats only')
  const labels=await page.locator('[aria-label="按总羁绊分组"] [role=tab]').allTextContents()
  assert.equal(new Set(labels.map(t=>t.split('羁绊')[0].trim())).size,labels.length,'same total belongs to a single group')
  assert.equal(await page.locator('[aria-label="按总羁绊分组"] [aria-selected=true]').count(),1)
  assert.ok(await page.locator('[aria-label="同羁绊配队"] [role=tab]').count())
  await page.locator('.bond-plan-groups [data-compare-plan]').last().click()
  assert.equal(await page.locator('#work-tab-results').getAttribute('aria-selected'),'true','adding a recommendation does not navigate away')
  assert.ok(await page.locator('.bond-plan-groups').count(),'adding a recommendation preserves its result list')
  if(await page.locator('[data-rec-step="1"]').isEnabled()) {
    await page.locator('[data-rec-step="1"]').click()
    await page.locator('.bond-plan-groups [data-compare-plan]').last().click()
    await page.locator('#work-tab-compare').click()
  } else {
    // A complete exact query may legitimately return one representative.
    // Compare another physical team through the retained equivalent-member UI.
    await page.locator('#work-tab-team').click()
    while(await page.locator('.slot-explanation:not([open]) summary').count())await page.locator('.slot-explanation:not([open]) summary').first().click()
    await page.locator('[data-alt-apply]').first().click()
    await page.locator('#work-team [data-compare-current]').click()
  }
  assert.equal(await page.locator('.team-comparison thead th').count(),3,'two different physical teams compare side by side')
  assert.ok(await page.locator('.comparison-different').count(),'team differences must be highlighted')
  assert.match(await page.locator('.team-comparison').innerText(),/对其他队员贡献/)
  await page.locator('#work-tab-compare').click()
  await page.waitForFunction(()=>[...document.querySelectorAll('.team-comparison [data-comparison-svt]')].some(img=>img.complete&&img.naturalWidth>0))
  assert.ok(await page.locator('.team-comparison .comparison-servant figcaption').count(),'Selected identity/form stays visible beside the illustration')
  const originalColumn=await page.locator('.team-comparison tbody tr').evaluateAll(rows=>rows.map(r=>r.querySelector('td')?.textContent))
  await page.locator('[data-comparison-copy="0"]').click()
  assert.equal(await page.locator('.team-comparison thead th').count(),4,'copy creates a separate third team')
  await page.locator('[data-comparison-name]').fill('我的自选队伍')
  await page.locator('[data-comparison-name]').blur()
  // Complete-score search also keeps optimal front-row support layouts. Edit
  // an actual owned slot rather than assuming physical position 1 is owned.
  const editPosition=await page.locator('[data-comparison-query][data-field="svtId"]').first().getAttribute('data-comparison-query')
  await page.locator(`[data-comparison-field="${editPosition}"][data-field="filled"]`).uncheck()
  assert.deepEqual(await page.locator('.team-comparison tbody tr').evaluateAll(rows=>rows.map(r=>r.querySelector('td')?.textContent)),originalColumn,'editing the copy cannot alter the source')
  await page.locator(`[data-comparison-query="${editPosition}"][data-field="svtId"]`).fill(String(ids.at(-1)))
  await page.locator(`[data-comparison-pick="${editPosition}"][data-field="svtId"]`).first().click()
  await page.locator(`[data-comparison-field="${editPosition}"][data-field="svtArtKey"]`).selectOption('a1')
  await page.waitForFunction(({position,id})=>{
    const img=document.querySelector(`.comparison-slot[data-comparison-position="${position}"] [data-comparison-svt]`)
    return img?.dataset.comparisonSvt===String(id)&&img.dataset.comparisonForm==='a1'&&img.src.endsWith('/ascension/1.svg')&&img.naturalWidth>0
  },{position:editPosition,id:ids.at(-1)})
  const friend=page.locator('.comparison-slot:has([data-field="isSupport"]:checked)')
  if(await friend.count()){
    const position=await friend.first().getAttribute('data-comparison-position')
    await page.locator(`[data-comparison-query="${position}"][data-field="ceId"]`).fill('9401970')
    await page.locator(`[data-comparison-pick="${position}"][data-field="ceId"]`).first().click()
    await page.waitForFunction(()=>[...document.querySelectorAll('.comparison-editor [data-comparison-ce="9401970"] img')].some(img=>img.complete&&img.naturalWidth>0))
    assert.match(await page.locator('.comparison-editor [data-comparison-ce="9401970"]').innerText(),/普通.*满破/s)
  }
  await page.locator(`[data-comparison-swap="${editPosition}"]`).selectOption('4')
  await page.locator('[data-comparison-swap="4"]').selectOption(editPosition)
  assert.match(await page.locator('.team-comparison thead').innerText(),/我的自选队伍/)
  for(const width of [320,390,834,1440]){
    await page.setViewportSize({width,height:1000})
    const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}))
    assert.ok(size.content<=size.width+1,`comparison editor overflows at ${width}`)
  }
  await mkdir('ui-checks',{recursive:true})
  await page.screenshot({path:'ui-checks/comparison-workspace-1440.png',fullPage:true})
  await page.locator('[data-comparison-done]').click()
  await page.locator('#work-tab-team').click()
  while(await page.locator('.slot-explanation:not([open]) summary').count())await page.locator('.slot-explanation:not([open]) summary').first().click()
  const detail=page.locator('.any-member [data-open-detail=svt]').first()
  await detail.waitFor()
  const servantId=await detail.getAttribute('data-id')
  await detail.click()
  await page.locator('.detail-panel[data-open="1"]').waitFor()
  assert.match(await page.locator('.detail-panel').innerText(),new RegExp(servantId+'|灵基|从者'))
  await page.locator('button[data-detail-close]').click()
  const swap=page.locator('[data-alt-apply]').first()
  await swap.waitFor()
  const target=await swap.getAttribute('data-alt-apply')
  await swap.click()
  assert.ok(await page.locator(`.card [data-open-detail=svt][data-id="${target}"]`).count(),'swap updates the physical team immediately')
  const targetEntries=page.locator(`.any-member:has([data-id="${target}"])`)
  for(let i=0;i<await targetEntries.count();i++)assert.match(await targetEntries.nth(i).innerText(),/已上场/)
  // Every remaining swap must refer to a servant who is not already fielded.
  const fielded=await page.locator('.card .art [data-open-detail=svt]').evaluateAll(els=>els.map(e=>e.dataset.id))
  for(const id of await page.locator('[data-alt-apply]').evaluateAll(els=>els.map(e=>e.dataset.altApply)))assert.ok(!fielded.includes(id))
  await page.locator('#work-tab-results').click()
  assert.equal(await page.locator('.bond-plan-groups').count(),0,'physical edits invalidate obsolete recommendations')
  await page.locator('#work-tab-compare').click()
  for(const width of [320,390,834,1440]){
    await page.setViewportSize({width,height:1000})
    const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}))
    assert.ok(size.content<=size.width+1,`comparison overflows at ${width}`)
  }
  await mkdir('ui-checks',{recursive:true})
  await page.screenshot({path:'ui-checks/team-comparison-1440.png',fullPage:true})
  await page.reload()
  await page.locator('#modeAccount.active').waitFor()
  await page.locator('#work-tab-compare').click()
  assert.equal(await page.locator('.team-comparison thead th').count(),4,'user-selected comparison teams survive reload')
  assert.match(await page.locator('.team-comparison thead').innerText(),/我的自选队伍/)
  await page.locator('[data-comparison-new]').click()
  assert.equal(await page.locator('.team-comparison thead th').count(),5)
  assert.match(await page.locator('.comparison-issues').innerText(),/人数不足/)
  await page.locator('[data-comparison-query="1"][data-field="svtId"]').fill(String(ids[0]))
  await page.locator('[data-comparison-pick="1"][data-field="svtId"]').first().click()
  assert.equal(await page.locator('[data-comparison-use="3"]').isEnabled(),true,'a new legal team can become the current team')
  await page.locator('[data-comparison-use="3"]').click()
  assert.equal(await page.locator('#work-tab-team').getAttribute('aria-selected'),'true')
  await page.locator('#work-tab-compare').click()
  await page.locator('[data-compare-clear]').click()
  assert.equal(await page.locator('.team-comparison table').count(),0)
  assert.deepEqual(errors,[])
  console.log('Team comparison UI: independent entry, direct recommendation add, isolated copies, live edit/form/position changes, new team/apply, persistence, quest focus, details, swaps and responsive layout passed')
}catch(error){if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)console.log((await p.locator('body').innerText()).slice(-4500))}throw error}finally{await browser?.close();server.kill()}
