import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const out = 'ui-checks'
await mkdir(out, { recursive: true })
const server = spawn('python3', ['-m', 'http.server', '5177', '--bind', '127.0.0.1'], { stdio: 'ignore' })
let browser
const errors = []
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5177/index.html')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', error => errors.push(error.message))
  // The application and worker use the real bundled catalogs. Remote portraits
  // are excluded so third-party image availability cannot break this smoke test.
  await page.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort())
  await page.goto('http://127.0.0.1:5177/index.html')
  await page.locator('#recommendNow').waitFor()
  async function view(name) {
    await page.locator('#work-tab-' + name).click()
    assert.equal(await page.locator('#work-' + name).isVisible(), true)
    assert.equal(await page.locator('.workspace-panel:visible').count(), 1)
  }
  async function noOverflow(width, name) {
    await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(120)
    const measurements = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))
    assert.ok(measurements.content <= measurements.width + 1, `${name} at ${width}px overflows: ${JSON.stringify(measurements)}`)
  }
  assert.equal(await page.locator('#work-conditions').isVisible(), true)
  assert.equal(await page.locator('.card:visible').count(), 0)
  await page.locator('#base').fill('815')
  await page.locator('#base').blur()
  await view('results')
  assert.equal(await page.locator('#work-results .empty-state').count(), 1)
  await view('team')
  assert.equal(await page.locator('.card:visible').count(), 6)
  await view('conditions')
  assert.equal(await page.locator('#base').inputValue(), '815')
  for (const width of [320, 390, 640, 834, 1024, 1440]) {
    await noOverflow(width, 'conditions')
    if ([390, 1440].includes(width)) await page.screenshot({ path: `${out}/conditions-${width}.png`, fullPage: true })
  }
  await page.locator('#recommendNow').click()
  await page.waitForFunction(() => !document.querySelector('#work-results').hidden && document.querySelector('#work-results .recommend'), null, { timeout: 180000 })
  assert.match(await page.locator('#work-results').innerText(), /总羁绊/)
  for (const width of [320, 390, 834, 1440]) await noOverflow(width, 'results')
  await page.screenshot({ path: `${out}/results-1440.png`, fullPage: true })
  await view('team')
  for (const width of [320, 390, 834, 1440]) await noOverflow(width, 'team')
  await page.screenshot({ path: `${out}/team-1440.png`, fullPage: true })
  await page.locator('.card [data-open-detail="ce"]').first().click()
  await page.locator('.detail-panel[data-open="1"]').waitFor()
  await page.locator('button[data-detail-close]').click()
  assert.equal(await page.locator('.detail-panel[data-open="1"]').count(), 0)
  await page.locator('.slot-explanation').first().locator('summary').click()
  assert.equal(await page.locator('.slot-explanation').first().getAttribute('open'), '')
  await view('conditions')
  await page.locator('#base').fill('1000')
  await page.locator('#base').blur()
  await view('results')
  assert.equal(await page.locator('#work-results .empty-state').count(), 1, 'changed conditions must invalidate the old recommendation')
  await view('conditions')
  const fixture = "<?php return array('cache'=>array('replaced'=>array('userSvtCollection'=>array(array('svtId'=>100100,'status'=>2,'friendshipRank'=>12)))));"
  await page.locator('#accountFile').setInputFiles({ name: 'login.php', mimeType: 'application/octet-stream', buffer: Buffer.from(fixture) })
  await page.waitForFunction(() => localStorage.getItem('fgo_bond_account_v1'))
  const account = await page.evaluate(() => JSON.parse(localStorage.getItem('fgo_bond_account_v1')).account)
  assert.equal(account.ok, true)
  assert.equal(account.servants[0].id, 100100)
  assert.equal(account.servants[0].bondLv, 12)
  const importedAt = await page.evaluate(() => Date.now())
  await page.clock.install({ time: importedAt })
  await page.clock.fastForward(11 * 60 * 1000)
  await view('team')
  await view('conditions')
  assert.match(await page.locator('.account-caption').innerText(), /账号保存在本机/)
  assert.doesNotMatch(await page.locator('.account-caption').innerText(), /缓存剩余/)
  assert.equal(await page.locator('#modeAccount').getAttribute('class'), 'active')
  await page.reload()
  await page.locator('#recommendNow').waitFor()
  await page.locator('#modeAccount.active').waitFor()
  assert.match(await page.locator('.account-caption').innerText(), /1 名从者/)
  await page.clock.fastForward(24 * 60 * 60 * 1000)
  await page.reload()
  await page.locator('#recommendNow').waitFor()
  await page.locator('#modeAccount.active').waitFor()
  assert.equal(await page.locator('#modeAccount').getAttribute('class'), 'active')
  assert.match(await page.locator('.account-caption').innerText(), /1 名从者/)
  await page.locator('#regionJp').click()
  await page.waitForFunction(() => document.querySelector('#regionJp.active'))
  await page.locator('#regionCn').click()
  await page.waitForFunction(() => document.querySelector('#regionCn.active'))
  assert.equal(await page.locator('#modeAccount').getAttribute('class'), 'active')
  await page.locator('#accountClear').click()
  assert.equal(await page.locator('#modeFree').getAttribute('class'), 'active')
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('fgo_bond_account_v1'))), false)
  await page.reload()
  await page.locator('#recommendNow').waitFor()
  assert.equal(await page.locator('#modeFree').getAttribute('class'), 'active')
  assert.equal(await page.locator('[data-solver]').count(), 0)
  assert.deepEqual(errors, [])
  await writeFile(`${out}/result.json`, JSON.stringify({ ok: true, widths: [320,390,640,834,1024,1440], checks: ['tab isolation', 'condition persistence', 'real recommendation worker', 'result invalidation', 'PHP account parsing', 'account survives 11 minutes and a day with reload', 'region switching', 'manual account clearing persists after reload', 'horizontal overflow'], errors }, null, 2))
  console.log('Workspace UI: navigation, recommendation, PHP import, persistent accounts, manual clearing and six responsive sizes passed')
} catch (error) {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0]
    if (page) { await page.screenshot({ path: `${out}/failure.png`, fullPage: true }); await writeFile(`${out}/failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText()}\n\n${JSON.stringify(errors)}`) }
  }
  throw error
} finally {
  await browser?.close()
  server.kill()
}
