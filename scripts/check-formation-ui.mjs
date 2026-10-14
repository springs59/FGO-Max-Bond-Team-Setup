import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
const server = spawn('python3', ['-m', 'http.server', '5178', '--bind', '127.0.0.1'], { stdio: 'ignore' })
let browser
const errors = []
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5178/index.html')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ executablePath: process.env.FGO_BROWSER_EXECUTABLE || undefined })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort())
  await page.goto('http://127.0.0.1:5178/index.html')
  await page.locator('#formationReview:enabled').waitFor()
  async function open() {
    await page.locator('#formationReview').click()
    const frame = page.frameLocator('.formation-review-dialog iframe')
    await frame.locator('#summary').filter({ hasText: '基本编队' }).waitFor()
    return frame
  }
  let frame = await open()
  assert.equal(await frame.locator('#cancel').isDisabled(), true, 'opening never starts an expensive search')
  await frame.locator('#own').selectOption('5')
  assert.equal(await frame.locator('#helpers option[value="0"]').count(), 0)
  await frame.locator('#cost').fill('12')
  await frame.locator('#cost').dispatchEvent('change')
  await frame.locator('#capped').selectOption('0')
  await frame.locator('#tab-activity').click()
  await frame.locator('#activity-mode').selectOption('custom')
  await frame.locator('[data-key="own"]').selectOption('6')
  assert.match(await frame.locator('#summary').innerText(), /超过/)
  await frame.locator('#activity-mode').selectOption('none')
  await frame.locator('#tab-curves').click()
  await frame.locator('#calculate').click()
  await frame.locator('#effect-status').filter({ hasText: '已精确核算' }).waitFor({ timeout: 180000 })
  assert.ok(await frame.locator('#plot path').count())
  await frame.locator('[data-temp-save]').first().waitFor({timeout:120000})
  await frame.locator('[data-temp-save]').first().click()
  await frame.locator('#temporaryQueries [role=status]').filter({hasText:'已保存到方案库'}).waitFor({timeout:180000})
  const initial = await frame.locator('#point').innerText()
  await frame.locator('#base').fill('1001')
  assert.notEqual(await frame.locator('#point').innerText(), initial)
  await frame.locator('#calculate').click()
  await frame.locator('#effect-status').filter({ hasText: '已使用本地计算结果' }).waitFor()
  await frame.locator('#all-results summary').first().click()
  await frame.locator('#all-start').click()
  assert.match(await frame.locator('#page-status').innerText(), /第1页/)
  await frame.locator('#actual-panel summary').click()
  await frame.locator('#actual-solve').click()
  await frame.locator('#actual-status').filter({ hasText: '临时缓存等待您选择' }).waitFor({ timeout: 180000 })
  assert.match(await frame.locator('#actual-result').innerText(), /自由图鉴范围最优/)
  await frame.locator('[data-temp-save]').first().waitFor({timeout:120000})
  await frame.locator('[data-temp-save]').first().click()
  await frame.locator('#temporaryQueries [role=status]').filter({hasText:'已保存到方案库'}).waitFor({timeout:180000})
  await frame.locator('#base').fill('700')
  assert.match(await frame.locator('#actual-result').innerText(), /B=700/)
  await frame.locator('#actual-solve').click()
  await frame.locator('#actual-status').filter({ hasText: '已使用本地精确核实结果' }).waitFor()
  for (const width of [320, 390, 834, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const child = page.frames().find(f => f.url().endsWith('/formation.html'))
    const size = await child.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
    assert.ok(size.content <= size.width + 1, `review overflow at ${width}: ${JSON.stringify(size)}`)
  }
  await frame.locator('#close-review').click()
  await page.locator('.formation-review-dialog').waitFor({state:'detached'})
  assert.equal(await page.locator('.formation-review-dialog').count(), 0)
  // A fresh iframe must read persistent results, not the old worker or memory.
  frame = await open()
  await frame.locator('#own').selectOption('5')
  await frame.locator('#cost').fill('12'); await frame.locator('#cost').dispatchEvent('change')
  await frame.locator('#capped').selectOption('0')
  await frame.locator('#tab-curves').click(); await frame.locator('#calculate').click()
  await frame.locator('#effect-status').filter({ hasText: '已使用本地计算结果' }).waitFor()
  await frame.locator('#tab-formation').click()
  await frame.locator('#region').selectOption('JP')
  await frame.locator('#summary').filter({ hasText: '基本编队' }).waitFor()
  assert.equal(await frame.locator('#cancel').isDisabled(), true)
  // Refresh the frame with phase metadata supplied by the updater. This checks
  // multi-guest controls against real physical seats, not a normal friend shape.
  await page.evaluate(() => {
    const q = {id:999999991,phase:1,type:'free',bond:100,partyMetadataDetailed:true,partyScript:{},
      flags:['noSupportList','supportSvtMultipleSet'],supportServants:[1,5].map((position,i)=>({
        id:900+i,svtId:900+i,name:'固定客将'+i,traitIds:[],required:true,followerFlags:['fixedNpc'],
        script:{eventDeckIndex:position},equips:[],releaseConditions:[],
      }))}
    window.fgoFormationReviewContext.bundles.CN.quests.push(q)
  })
  await page.frames().find(f=>f.url().endsWith('/formation.html')).goto('http://127.0.0.1:5178/formation.html')
  await frame.locator('#summary').filter({hasText:'基本编队'}).waitFor()
  await frame.locator('#family').selectOption('special')
  // Live catalogs can contain many multi-guest templates. Select the injected
  // phase by identity, rather than whichever matching caption appears first.
  const specialTag=await page.frames().find(f=>f.url().endsWith('/formation.html')).evaluate(()=>window.FgoFormationRuntime.catalog.profiles.find(p=>p.specialQuest?.id===999999991)?.tag)
  assert.ok(specialTag)
  await frame.locator('#template').selectOption(specialTag)
  await frame.locator('#summary').filter({hasText:'特殊编队'}).waitFor()
  assert.equal(await frame.locator('#helpers option[value="2"]').count(),1)
  assert.equal(await frame.locator('#own option[value="5"]').count(),0)
  await frame.locator('#own').selectOption('1');await frame.locator('#capped').selectOption('0')
  await frame.locator('#cost').fill('0');await frame.locator('#cost').dispatchEvent('change')
  await frame.locator('#tab-curves').click();await frame.locator('#actual-panel summary').click()
  await frame.locator('#actual-solve').click()
  await frame.locator('#actual-status').filter({hasText:'临时缓存等待您选择'}).waitFor({timeout:180000})
  assert.match(await frame.locator('#actual-result').innerText(),/自由图鉴范围最优/)
  await page.evaluate(()=>{window.fgoFormationReviewContext.bundles.CN.quests.find(q=>q.id===999999991).closedAt=Math.floor(Date.now()/1000)-1})
  await frame.locator('#summary').filter({hasText:'有效状态已变化'}).waitFor()
  assert.equal(await frame.locator('#actual-result').innerText(),'','expired conditions clear already displayed results')
  assert.deepEqual(errors, [])
  console.log('Formation UI: linked tabs, invalid counts, complete effects, pagination, base changes, exact checks, persistent local reuse, region switch, fixed multi-guest rules and 320–1440px layouts passed')
} finally { await browser?.close(); server.kill() }
