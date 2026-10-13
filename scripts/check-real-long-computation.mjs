import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, appendFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { chromium } from 'playwright'

const seconds = Number(process.env.FGO_SOAK_SECONDS || 7500)
const calibration = process.env.FGO_SOAK_CALIBRATION === '1'
assert.ok(Number.isFinite(seconds) && seconds > 0)
if (!calibration) assert.ok(seconds > 7200, 'A qualified run must exceed two real hours')
const output = process.env.FGO_SOAK_OUTPUT || '/tmp/fgo-real-soak'
mkdirSync(output, { recursive: true })
const report = { calibration, requestedSeconds: seconds, startedAt: new Date().toISOString(), passed: false,
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), samples: [] }
const server = spawn('python3', ['-m', 'http.server', '5187', '--bind', '127.0.0.1'], { stdio: 'ignore' })
let browserServer, browser, sampling, result
const persist = () => writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2))
function rss(root) {
  const rows = execFileSync('ps', ['-e', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n')
    .map(line => line.trim().split(/\s+/).map(Number))
  const descendants = new Set([root])
  for (let change = true; change;) {
    change = false
    for (const [pid, parent] of rows) if (descendants.has(parent) && !descendants.has(pid)) { descendants.add(pid); change = true }
  }
  return rows.filter(([pid]) => descendants.has(pid)).reduce((sum, [, , kib]) => sum + kib, 0) / 1024
}
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:5187/glossary.html')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browserServer = await chromium.launchServer({ headless: true, args: ['--js-flags=--max-old-space-size=512'] })
  browser = await chromium.connect(browserServer.wsEndpoint())
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5187/glossary.html')
  let latest = null
  const sample = () => {
    const row = { at: new Date().toISOString(), rssMiB: rss(browserServer.process().pid), worker: latest }
    report.samples.push(row); persist()
    console.log('REAL_SOAK_SAMPLE', JSON.stringify(row))
  }
  await page.exposeFunction('soakProgress', stats => { latest = stats })
  const archiveHash = createHash('sha256')
  const archivePath = join(output, 'whole-library.jsonl')
  writeFileSync(archivePath, '')
  await page.exposeFunction('soakArchiveChunk', base64 => {
    const chunk = Buffer.from(base64, 'base64')
    assert.ok(chunk.length <= 64 * 1024)
    appendFileSync(archivePath, chunk); archiveHash.update(chunk)
  })
  sample(); sampling = setInterval(sample, 30000)
  result = await page.evaluate(async ({ seconds }) => {
    const check = (condition, message) => { if (!condition) throw Error(message) }
    const root = location.origin + '/'
    const { isPlayableServant, ceHasBondGain } = await import(root + 'src/game-data.js')
    const [servants, ces] = await Promise.all(['servants', 'ces'].map(async name =>
      (await fetch(root + `src/data/${name}.json`)).json()))
    const fixture = { servants: servants.filter(isPlayableServant).slice(0, 120), ces: ces.filter(ceHasBondGain).slice(0, 24), mode: 'free' }
    const transport = await import(root + 'src/worker-transport.js')
    const worker = transport.createBoundedWorker(root + 'scripts/real-long-computation-worker.mjs', { type: 'module' })
    const outcome = await new Promise((resolve, reject) => {
      worker.onerror = event => reject(Error(event.message))
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') { window.soakProgress(data.stats); return }
        if (data.type === 'failure') reject(Error(data.error))
        else if (data.type === 'finished') resolve(data)
      }
      transport.postWorkerMessage(worker, { seconds, fixture }).catch(reject)
    })
    await window.soakProgress(outcome.stats)
    const { recoverArchivedCandidates } = await import(root + 'src/ui/query-recovery.js')
    const live = await recoverArchivedCandidates()
    check(live.ok && live.busy === 1, 'An active journal lock was stolen')
    worker.terminate()
    let recovery = await recoverArchivedCandidates()
    for (let i = 0; recovery.busy && i < 100; i++) {
      await new Promise(resolve => setTimeout(resolve, 50))
      recovery = await recoverArchivedCandidates()
    }
    check(recovery.ok && !recovery.busy, recovery.error || 'Journal teardown failed')
    check(recovery.records === outcome.stats.current.records, 'Recovery lost a flushed candidate')
    const again = await recoverArchivedCandidates()
    check(again.ok && again.recovered === 0, 'Recovery was not idempotent')
    const library = await import(root + 'src/solver/query-library.js')
    const description = await library.describeQuery('bond', outcome.lastOpts, 'Real two-hour computation')
    const saved = await library.saveQuery(description, outcome.lastResult)
    check(saved.saved, saved.error || 'Exact result save failed')
    const cached = transport.createBoundedWorker(root + 'src/recommend-worker.js', { type: 'module' })
    const reused = await new Promise((resolve, reject) => {
      cached.onerror = e => reject(Error(e.message))
      cached.onmessage = ({ data }) => {
        if (data.type === 'progress') return
        if (!data.ok) reject(Error(data.error)); else resolve(data.result.value)
      }
      transport.postWorkerMessage(cached, { id: 1, opts: { ...outcome.lastOpts, accountProfileId: 'another-account' } }).catch(reject)
    })
    cached.terminate()
    check(reused.localResult.hit && reused.total === outcome.lastResult.total, 'Restart or cross-profile reuse failed')
    const rows = await library.listQueries()
    const candidates = rows.filter(row => row.kind === 'computed-candidate').length
    const archive = await library.exportQueryStream()
    check(archive.name.endsWith('.jsonl') && archive.count === rows.length, 'Export did not include the whole plain library')
    const reader = archive.stream.getReader()
    let bytes = 0, lines = 0, pending = [], pendingBytes = 0
    const flush = async () => {
      if (!pendingBytes) return
      const chunk = new Uint8Array(pendingBytes); let offset = 0
      for (const part of pending) { chunk.set(part, offset); offset += part.length }
      await window.soakArchiveChunk(btoa(String.fromCharCode(...chunk)))
      pending = []; pendingBytes = 0
    }
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      bytes += value.length
      for (const byte of value) if (byte === 10) lines++
      for (let at = 0; at < value.length;) {
        const part = value.subarray(at, at + Math.min(value.length - at, 64 * 1024 - pendingBytes))
        pending.push(part); pendingBytes += part.length; at += part.length
        if (pendingBytes === 64 * 1024) await flush()
      }
    }
    await flush()
    check(lines === archive.count + 1, 'Export record count differs from library count')
    return { ...outcome, lastOpts: undefined, lastResult: undefined, live, recovery, again,
      reuse: { hit: reused.localResult.hit, total: reused.total }, candidates,
      export: { name: archive.name, count: archive.count, bytes, lines } }
  }, { seconds })
  sample()
  const stats = result.stats
  assert.ok(stats.elapsedMs >= seconds * 1000)
  assert.equal(stats.observed, stats.archiveRecords + stats.current.records)
  assert.equal(stats.rounds, stats.settledChecks)
  assert.ok(stats.curveChecks > 0 && result.candidates > 0)
  assert.ok(stats.computeMs / stats.elapsedMs > 0.25, 'The run spent too little time in real solver, journal and independent curve arithmetic')
  assert.ok(stats.peakBufferedBytes <= 256 * 1024)
  if (!calibration) {
    assert.ok(stats.elapsedMs > 7200000)
    assert.ok(stats.rounds >= 1000 && stats.observed >= 100000)
    assert.ok(stats.oracleChecks >= 10000000)
  }
  const liveSamples = report.samples.filter(s => s.worker && s.worker.elapsedMs < stats.elapsedMs)
  const peakRssMiB = Math.max(...report.samples.map(s => s.rssMiB))
  assert.ok(peakRssMiB < 1536, 'Browser process tree exceeded the 1.5 GiB RSS budget')
  const average = rows => rows.reduce((sum, r) => sum + r.rssMiB, 0) / Math.max(rows.length, 1)
  const window = Math.min(10, Math.floor(liveSamples.length / 3))
  const growthMiB = window ? average(liveSamples.slice(-window)) - average(liveSamples.slice(window, 2 * window)) : 0
  assert.ok(growthMiB < 256, 'RSS continued growing after warm-up')
  Object.assign(report, { passed: true, endedAt: new Date().toISOString(), result, peakRssMiB, growthMiB,
    archiveSha256: archiveHash.digest('hex') })
  persist(); console.log('REAL_SOAK_PASSED', JSON.stringify({ ...report, samples: undefined }))
} catch (error) {
  Object.assign(report, { error: String(error.stack || error), endedAt: new Date().toISOString(), result })
  persist(); throw error
} finally {
  clearInterval(sampling)
  await browser?.close(); await browserServer?.close(); server.kill()
}
