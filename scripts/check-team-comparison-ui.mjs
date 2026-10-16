import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
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
  await page.goto('http://127.0.0.1:5193/index.html')
  await page.locator('#recommendNow').waitFor()
  await page.locator('[data-quest-category="free"]').click()
  await page.locator('[data-quest-result]').first().click()
  assert.notEqual(await page.evaluate(()=>document.activeElement?.id),'base','quest selection must not open a numeric keyboard')
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
  const labels=await page.locator('[aria-label="按总羁绊分组"] [role=tab]').allTextContents()
  assert.equal(new Set(labels.map(t=>t.split('羁绊')[0].trim())).size,labels.length,'same total belongs to a single group')
  assert.equal(await page.locator('[aria-label="按总羁绊分组"] [aria-selected=true]').count(),1)
  assert.ok(await page.locator('[aria-label="同羁绊配队"] [role=tab]').count())
  await page.locator('.bond-plan-groups [data-compare-current]').click()
  if(await page.locator('[data-rec-step="1"]').isEnabled()) {
    await page.locator('[data-rec-step="1"]').click()
    await page.locator('.bond-plan-groups [data-compare-current]').click()
  } else {
    // A complete exact query may legitimately return one representative.
    // Compare another physical team through the retained equivalent-member UI.
    await page.locator('#work-tab-team').click()
    while(await page.locator('.slot-explanation:not([open]) summary').count())await page.locator('.slot-explanation:not([open]) summary').first().click()
    await page.locator('[data-alt-apply]').first().click()
    await page.locator('.team-comparison [data-compare-current]').click()
  }
  assert.equal(await page.locator('.team-comparison thead th').count(),3,'two different physical teams compare side by side')
  assert.ok(await page.locator('.comparison-different').count(),'team differences must be highlighted')
  assert.match(await page.locator('.team-comparison').innerText(),/对其他队员贡献/)
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
  await page.locator('#work-tab-team').click()
  for(const width of [320,390,834,1440]){
    await page.setViewportSize({width,height:1000})
    const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}))
    assert.ok(size.content<=size.width+1,`comparison overflows at ${width}`)
  }
  await mkdir('ui-checks',{recursive:true})
  await page.screenshot({path:'ui-checks/team-comparison-1440.png',fullPage:true})
  await page.locator('[data-compare-clear]').click()
  assert.equal(await page.locator('.team-comparison table').count(),0)
  assert.deepEqual(errors,[])
  console.log('Team comparison UI: quest focus, grouped tabs, physical differences, servant details, live swaps and responsive layout passed')
}catch(error){if(browser){const p=browser.contexts()[0]?.pages()[0];if(p)console.log((await p.locator('body').innerText()).slice(-4500))}throw error}finally{await browser?.close();server.kill()}
