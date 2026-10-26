import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const out = 'ui-checks'
await mkdir(out, { recursive: true })
const server = spawn('python3', ['-m', 'http.server', '5178', '--bind', '127.0.0.1'], { stdio: 'ignore' })
let browser, page
const errors = []
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:5178/native/tasks.html')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch({ executablePath: process.env.FGO_BROWSER_EXECUTABLE || undefined })
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, bypassCSP:true })
  page.on('pageerror', error => errors.push(error.message))
  // Test the real task view against its persisted status. Record native IPC
  // commands here; the platform jobs separately test the background worker.
  await page.addInitScript(() => {
    window.taskCommands = []
    window.softwareCommands=[]
    window.software={state:'idle',currentVersion:'0.1.9',auto:true,supported:true}
    window.fgoDesktop = { command: value => window.taskCommands.push(value), auto: value => window.taskCommands.push({auto:value}), apply: () => window.taskCommands.push({apply:true}), softwareStatus:async()=>window.software,softwareCommand:async action=>{window.softwareCommands.push(action);Object.assign(window.software,action==='check'?{state:'available',latestVersion:'0.1.10',notes:'说明 <script>文本显示</script>',total:104857600}:action==='download'?{state:'ready',done:104857600}:action==='pause'?{state:'paused'}:{state:'installing'});return window.software},softwareAuto:async value=>{window.software.auto=value} }
  })
  await page.goto('http://127.0.0.1:5178/native/tasks.html')
  await page.waitForFunction(() => document.getElementById('state').textContent === '等待更新')
  assert.equal(await page.locator('#pause').isVisible(), false)
  assert.equal(await page.locator('#apply').isDisabled(), true)
  assert.equal(await page.locator('#task-records').getAttribute('open'), null)
  assert.equal(await page.locator('.more-settings').getAttribute('open'), null)
  await page.waitForFunction(()=>!document.getElementById('software-update').hidden)
  await page.locator('#software-check').click()
  await page.waitForFunction(()=>document.getElementById('software-state').textContent==='发现新版本')
  assert.equal(await page.locator('#software-install').isVisible(),false)
  await page.locator('#software-notes-box > summary').click()
  assert.equal(await page.locator('#software-notes').innerText(),'说明 <script>文本显示</script>')
  await page.locator('#software-download').click()
  await page.waitForFunction(()=>document.getElementById('software-state').textContent==='可升级')
  await page.locator('#software-auto').uncheck()
  await page.locator('#software-install').click()
  assert.deepEqual(await page.evaluate(()=>window.softwareCommands),['check','download','install'])
  assert.equal(await page.evaluate(()=>window.software.auto),false)
  for(const state of ['downloading','paused','error','ready']){
    await page.evaluate(state=>Object.assign(window.software,{state,done:52428800,error:state==='error'?'更新服务 HTTP 503':''}),state)
    await page.waitForFunction(state=>document.getElementById('software-state').dataset.state===state,state)
    assert.equal(await page.locator('#software-install').isVisible(),state==='ready')
    assert.equal(await page.locator('#software-pause').isVisible(),state==='downloading')
  }
  async function status(task, active = null) {
    await page.evaluate(async ({task, active}) => {
      const { put } = await import('/native/shared/store.js')
      await put('meta','status',task)
      await put('meta','active',active)
      const channel = new BroadcastChannel('fgo-native-tasks')
      channel.postMessage(task); channel.close()
    }, { task, active })
    await page.waitForFunction(value => document.getElementById('state').dataset.state === value, task.state)
  }
  const active = { id: 'abcdef0123456789', generatedAt: '2026-10-07T00:00:00Z' }
  const log = { at: Date.now(), text: '校验成功' }
  await status({ state:'running', phase:'下载与校验：src/data/servants.json', total:40, done:12, changed:3, logs:[log], precomputeNeeded:true, accountCount:2, estimate:{lowMs:2000,highMs:7000,calibrated:true} }, active)
  assert.match(await page.locator('#precompute-needed').innerText(),/2 个本机账号/)
  assert.match(await page.locator('#estimate').innerText(),/2–7 秒.*本机历史/)
  assert.equal(await page.locator('#start').isDisabled(), true)
  assert.equal(await page.locator('#pause').isVisible(), true)
  assert.equal(await page.locator('#phase').innerText(), '下载并校验数据')
  assert.equal(await page.locator('#progress').getAttribute('value'), '12')
  await page.locator('#pause').click()
  await status({ state:'paused', phase:'已暂停，已完成步骤可继续', total:40, done:12, logs:[log] }, active)
  await page.locator('#start').click()
  assert.equal(await page.locator('#start').innerText(), '继续任务')
  await status({ state:'error', phase:'任务失败', error:'Failed to fetch', logs:[log] }, active)
  assert.match(await page.locator('#error').innerText(), /网络/)
  assert.equal(await page.locator('#error-detail').isVisible(), false)
  assert.equal(await page.locator('#task-records').getAttribute('open'), null)
  await page.locator('#start').click()
  assert.equal(await page.locator('#start').innerText(), '重试更新')
  for (const width of [320,390,640,834,1024,1440]) {
    await page.setViewportSize({ width, height:900 })
    const size = await page.evaluate(() => ({ content:document.documentElement.scrollWidth, viewport:innerWidth }))
    assert.ok(size.content <= size.viewport + 1, `Task view overflows at ${width}px: ${JSON.stringify(size)}`)
    if ([390,1440].includes(width)) await page.screenshot({ path:`${out}/tasks-error-${width}.png`, fullPage:true })
  }
  await status({ state:'done', phase:'数据更新与本地预计算完成', total:40, done:40, logs:[log], precomputeNeeded:false }, active)
  assert.match(await page.locator('#precompute-needed').innerText(),/无需预计算/)
  assert.match(await page.locator('#estimate').innerText(),/0 秒/)
  assert.equal(await page.locator('#error-box').isVisible(), false)
  assert.equal(await page.locator('#apply').isDisabled(), false)
  await page.locator('#apply').click()
  await page.locator('.more-settings > summary').click()
  await page.locator('#auto').uncheck()
  await page.locator('#rebuild').click()
  assert.deepEqual(await page.evaluate(() => window.taskCommands), [{action:'pause'},{action:'start'},{action:'start'},{apply:true},{auto:false},{action:'start',force:true}])
  assert.equal(await page.evaluate(() => localStorage.getItem('nativeAutoUpdate')), '0')
  await page.locator('#task-records > summary').click()
  assert.equal(await page.locator('#logs li').count(), 1)
  await page.evaluate(() => { window.fgoDesktop.command = () => { throw new Error('HTTP 503') } })
  await page.locator('#start').click()
  await page.waitForTimeout(2000)
  assert.equal(await page.locator('#error-box').isVisible(), true, 'action errors must remain visible across the next status poll')
  assert.match(await page.locator('#error').innerText(), /服务/)
  // A persistent IndexedDB failure must produce one readable state, without
  // unhandled promise rejections or rebuilding the alert on every poll.
  await page.addInitScript(() => { IDBFactory.prototype.open = () => { throw new DOMException('Storage unavailable','SecurityError') } })
  await page.reload()
  await page.waitForFunction(() => document.getElementById('state').textContent === '状态暂不可用')
  assert.equal(await page.locator('#start').isDisabled(), false)
  assert.match(await page.locator('#error').innerText(), /存储/)
  await page.waitForTimeout(3200)
  assert.deepEqual(errors, [])
  await writeFile(`${out}/task-result.json`, JSON.stringify({ok:true, checks:['idle/running/paused/error/done states','resume/retry/pause/rebuild/apply routing','saved update setting','collapsed diagnostics','six responsive widths','persistent storage failure without unhandled errors'],errors},null,2))
  console.log('Task UI: state transitions, native commands, layout and storage-error recovery passed')
} catch (error) {
  if (page) { await page.screenshot({path:`${out}/task-failure.png`,fullPage:true}); await writeFile(`${out}/task-failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText()}\n\n${JSON.stringify(errors)}`) }
  throw error
} finally { await browser?.close(); server.kill() }
