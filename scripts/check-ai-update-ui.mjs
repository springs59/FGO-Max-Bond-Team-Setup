import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { SEARCH_MODEL } from '../src/solver/ai-model.js'
import { AI_CHOICES, selectQueryModel } from '../src/solver/query-models.js'
import { AI_STORAGE_KEY, AI_FEED, AI_ROOT } from '../src/ai-update.js'

const server = spawn('python3', ['-m', 'http.server', '5196', '--bind', '127.0.0.1'], { stdio: 'ignore', cwd: process.env.FGO_UI_ROOT || '.' })
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
  const choice = panel.locator('#ai-query-model')
  assert.deepEqual(await choice.locator('option').allTextContents(), AI_CHOICES.map(m => m.label))
  assert.equal(await choice.inputValue(), 'off')
  for (const { label, description } of AI_CHOICES) {
    assert.ok((await panel.locator('#ai-model-descriptions').innerText()).includes(label))
    assert.ok((await panel.locator('#ai-model-descriptions').innerText()).includes(description))
  }
  await check.click()
  await panel.getByRole('status').filter({ hasText: '更新已保存' }).waitFor()
  assert.equal(await choice.inputValue(), 'off', 'installing weights never enables AI')
  const activeVersion = () => page.evaluate(async () => (await import('/src/ai-update-ui.js')).aiUpdater.model.version)
  assert.equal(await activeVersion(), model.version)
  await page.reload(); await panel.locator('summary').click()
  await check.waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.querySelector('#ai-updates button').disabled)
  assert.equal(await activeVersion(), model.version)
  assert.equal(await choice.inputValue(), 'off')
  await page.locator('#accountFile').setInputFiles({ name: 'synthetic-login.php', mimeType: 'application/octet-stream',
    buffer: Buffer.from("<?php return array('cache'=>array('replaced'=>array('userSvtCollection'=>array(array('svtId'=>100100,'status'=>2,'friendshipRank'=>1),array('svtId'=>100200,'status'=>2,'friendshipRank'=>1))))));") })
  await page.locator('#modeAccount.active').waitFor()
  await page.locator('#costLimit').fill('32'); await page.locator('#costLimit').blur()
  let base = 815
  for (const id of ['off', 'baseline', 'teacher', 'neural-large', 'off']) {
    await choice.selectOption(id)
    assert.equal(await choice.inputValue(), id)
    assert.equal(await panel.locator('#ai-choice-description').innerText(), AI_CHOICES.find(m => m.id === id).description)
    await page.waitForFunction(() => !document.querySelector('#recBusyHint'))
    await page.evaluate(() => { window.sentModes = []; window.sentModels = [] })
    await page.locator('#work-tab-conditions').click()
    await page.locator('#base').fill(String(base++)); await page.locator('#base').blur()
    await page.locator('#recommendNow').click()
    const expected = id === 'off' ? 'off' : 'on'
    await page.waitForFunction(mode => window.sentModes.includes(mode), expected)
    await page.waitForFunction(() => !document.querySelector('#recBusyHint'))
    if (id === 'off') assert.deepEqual(await page.evaluate(() => window.sentModels), [], 'off clears the previously delivered model')
    else {
      const version = selectQueryModel(model, id).version
      assert.ok((await page.evaluate(() => window.sentModels)).includes(version), `selected ${id} reaches the real Worker`)
      assert.match(await page.locator('.recommend').innerText(), /本次 AI 调用 1 次/)
    }
  }
  await page.reload(); await panel.locator('summary').click()
  assert.equal(await choice.inputValue(), 'off', 'disabled choice survives reload')
  await choice.selectOption('teacher')
  await page.reload(); await panel.locator('summary').click()
  assert.equal(await choice.inputValue(), 'teacher', 'explicit model choice survives reload')
  corrupt = true
  await check.click()
  await panel.getByRole('status').filter({ hasText: '摘要校验失败' }).waitFor()
  assert.equal(await activeVersion(), model.version)
  assert.equal(await choice.inputValue(), 'teacher')
  corrupt = false; rejectCandidate = true
  await check.click()
  await panel.getByRole('status').filter({ hasText: '尚未通过验收' }).waitFor()
  assert.equal(await activeVersion(), model.version)
  await panel.getByRole('button', { name: '恢复内置模型' }).click()
  await panel.getByRole('status').filter({ hasText: '已恢复内置模型' }).waitFor()
  assert.equal(await activeVersion(), SEARCH_MODEL.version)
  assert.equal(await choice.inputValue(), 'teacher', 'reset preserves the selected AI')
  assert.equal(await page.evaluate(key => localStorage.getItem(key), AI_STORAGE_KEY), null)
  await choice.selectOption('off')
  await page.evaluate(key => localStorage.setItem(key, '{broken'), AI_STORAGE_KEY)
  await page.reload(); await panel.locator('summary').click()
  await panel.getByRole('status').filter({ hasText: '回退到内置模型' }).waitFor()
  assert.equal(await choice.inputValue(), 'off', 'fallback preserves disabled choice')
  for (const width of [320, 390, 834, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`)
  }
  await mkdir('ui-checks', { recursive: true })
  await page.screenshot({ path: 'ui-checks/ai-three-choices.png', fullPage: true })
  await panel.screenshot({ path: 'ui-checks/ai-three-choices-panel.png' })
  assert.deepEqual(errors, [])
  console.log('AI browser: all four named choices/descriptions, real Worker delivery, reload/off/reset/update behavior and four responsive widths passed')
} finally { await browser?.close(); server.kill() }
