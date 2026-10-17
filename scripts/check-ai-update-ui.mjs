import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { SEARCH_MODEL } from '../src/solver/ai-model.js'
import { AI_STORAGE_KEY, AI_FEED, AI_ROOT } from '../src/ai-update.js'

const server = spawn('python3', ['-m', 'http.server', '5196', '--bind', '127.0.0.1'], { stdio: 'ignore' })
const model = { ...structuredClone(SEARCH_MODEL), version: 'ui-qualified-fixture' }, raw = JSON.stringify(model)
const manifest = { ...JSON.parse(await readFile('ai/manifest.json')), sequence: 2, version: model.version,
  qualification: 'passed', validation: { passed: true, sealedTestPassed: true }, size: Buffer.byteLength(raw),
  sha256: createHash('sha256').update(raw).digest('hex') }
let browser, corrupt = false, rejectCandidate = false
const errors = []
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5196/index.html')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ executablePath: process.env.FGO_BROWSER_EXECUTABLE || undefined })
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    window.sentModels = []; window.sentModes = []
    window.Worker = class extends NativeWorker {
      postMessage(message, ...args) {
        if (message.opts?.aiMode) window.sentModes.push(message.opts.aiMode)
        const model = message.catalogUpdate?.aiModel || message.opts?.aiModel
        if (model) window.sentModels.push(model.version)
        return super.postMessage(message, ...args)
      }
    }
  })
  await page.route(/https?:\/\/(?!127\.0\.0\.1)/, async route => {
    const url = route.request().url()
    if (url === AI_FEED) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...manifest, sequence: corrupt ? 3 : 2, ...(rejectCandidate ? { qualification: 'candidate' } : {}) }) })
    if (url === AI_ROOT + 'baseline.json') return route.fulfill({ contentType: 'application/json', body: corrupt ? raw.slice(1) : raw })
    return route.abort()
  })
  await page.goto('http://127.0.0.1:5196/index.html')
  const panel = page.locator('#ai-updates')
  await panel.locator('summary').click()
  const check = panel.getByRole('button', { name: '通过 GitHub 更新 AI' })
  const toggle = panel.getByRole('checkbox', { name: '使用 AI 辅助搜索（可随时关闭）' })
  assert.equal(await toggle.isChecked(), false)
  await check.click()
  await panel.getByRole('status').filter({ hasText: '更新已保存' }).waitFor()
  assert.equal(await toggle.isChecked(), false, 'installing weights never enables AI')
  assert.match(await panel.innerText(), /ui-qualified-fixture/)
  await page.reload()
  await panel.locator('summary').click()
  await panel.getByRole('status').filter({ hasText: 'ui-qualified-fixture' }).waitFor()
  assert.equal(await toggle.isChecked(), false)
  // Verify the installed model reaches the real recommendation Worker.
  await page.locator('#accountFile').setInputFiles({ name: 'synthetic-login.php', mimeType: 'application/octet-stream',
    buffer: Buffer.from("<?php return array('cache'=>array('replaced'=>array('userSvtCollection'=>array(array('svtId'=>100100,'status'=>2,'friendshipRank'=>1),array('svtId'=>100200,'status'=>2,'friendshipRank'=>1))))));") })
  await page.locator('#modeAccount.active').waitFor()
  await page.locator('#base').fill('815'); await page.locator('#base').blur()
  await page.locator('#costLimit').fill('32'); await page.locator('#costLimit').blur()
  await page.locator('#recommendNow').click()
  await page.waitForFunction(() => window.sentModes.includes('off'))
  await page.waitForFunction(() => !document.querySelector('#recBusyHint'))
  assert.deepEqual(await page.evaluate(() => window.sentModels), [], 'off never sends weights')
  await toggle.check()
  await page.locator('#work-tab-conditions').click()
  await page.locator('#recommendNow').click()
  await page.waitForFunction(() => window.sentModes.includes('on') && window.sentModels.includes('ui-qualified-fixture'))
  await page.waitForFunction(() => !document.querySelector('#recBusyHint'))
  assert.match(await page.locator('.recommend').innerText(), /初始可行下界 \d+ · 下界剪枝 \d+ · 已核实起点复用 \d+ 次/)
  await page.reload(); await panel.locator('summary').click()
  assert.equal(await toggle.isChecked(), true, 'explicit opt-in survives reload')
  // Reject corrupted downloads and unqualified candidates without losing a
  // previously installed usable model.
  corrupt = true
  await check.click()
  await panel.getByRole('status').filter({ hasText: '摘要校验失败' }).waitFor()
  assert.match(await panel.innerText(), /ui-qualified-fixture/)
  corrupt = false; rejectCandidate = true
  await check.click()
  await panel.getByRole('status').filter({ hasText: '尚未通过验收' }).waitFor()
  assert.match(await panel.innerText(), /ui-qualified-fixture/)
  await panel.getByRole('button', { name: '恢复内置模型' }).click()
  await panel.getByRole('status').filter({ hasText: SEARCH_MODEL.version }).waitFor()
  assert.equal(await page.evaluate(key => localStorage.getItem(key), AI_STORAGE_KEY), null)
  assert.equal(await toggle.isChecked(), true, 'restoring weights preserves user choice')
  await toggle.uncheck()
  await page.evaluate(key => localStorage.setItem(key, '{broken'), AI_STORAGE_KEY)
  await page.reload(); await panel.locator('summary').click()
  await panel.getByRole('status').filter({ hasText: '回退到内置模型' }).waitFor()
  assert.equal(await toggle.isChecked(), false, 'fallback preserves disabled choice')
  for (const width of [320, 390, 834, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`)
  }
  await mkdir('ui-checks', { recursive: true })
  await page.screenshot({ path: 'ui-checks/ai-update-212.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('AI update browser: download, reload persistence, Worker delivery, corrupt/candidate rejection, reset, fallback and responsive layout passed')
} finally { await browser?.close(); server.kill() }
