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
  await frame.locator('#actual-status').filter({ hasText: '完成并保存本地结果' }).waitFor({ timeout: 180000 })
  assert.match(await frame.locator('#actual-result').innerText(), /自由图鉴范围最优/)
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
  assert.deepEqual(errors, [])
  console.log('Formation UI: linked tabs, invalid counts, complete effects, pagination, base changes, exact checks, persistent local reuse, region switch and 320–1440px layouts passed')
} finally { await browser?.close(); server.kill() }
