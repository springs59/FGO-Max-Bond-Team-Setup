import assert from 'node:assert/strict'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { recommendTeam as optimized } from '../src/recommend.js'
import { recommendTeam as released } from '../baseline-current/src/recommend.js'
import { recommendTeam as original } from '../baseline-release/src/recommend.js'
import { ceHasBondGain, isPlayableServant } from '../src/game-data.js'
import { workerPackets as newPackets, workerDecoder } from '../src/worker-transport.js'
import { workerPackets as oldPackets } from '../baseline-current/src/worker-transport.js'

const output = process.env.FGO_PERFORMANCE_OUTPUT || '/tmp/fgo-performance'
mkdirSync(output, { recursive: true })
const median = samples => samples.slice().sort((a, b) => a - b)[Math.floor(samples.length / 2)]
const report = { startedAt: new Date().toISOString() }
const read = name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)))
const fixture = { servants: read('servants').filter(isPlayableServant).slice(0, 30),
  ces: read('ces').filter(ceHasBondGain).slice(0, 36), mode: 'free', costLimit: 95,
  useInventoryCurveSolver: true, skipResultCache: true }
const observations = []
const totals = []
report.solver = {}
for (const [name, solve] of [['2.0.0', original], ['2.0.4', released], ['optimized', optimized]]) {
  const samples = [], scores = []
  for (let run = 0; run < 4; run++) {
    const start = performance.now(); let total = 0
    for (let i = 0; i < 20; i++) {
      const result = solve({ ...fixture, base: 800 + i % 16,
        onComputedCandidate: name === 'optimized' && run === 0 && i < 4 ? value => observations.push(value) : null })
      assert.ok(result.ok, result.error); total += result.total
      if (run === 0) scores.push(result.total)
    }
    if (run) samples.push(performance.now() - start)
  }
  totals.push(scores); report.solver[name] = { samplesMs: samples, medianMs: median(samples) }
}
assert.deepEqual(totals[0], totals[1]); assert.deepEqual(totals[1], totals[2])
const payload = { rows: Array.from({ length: 25000 }, (_, i) => ({ id: i, text: '长消息😀'.repeat(40) + i })) }
payload.alias = payload.rows; payload.self = payload
report.transport = {}
for (const [name, packets] of [['2.0.4', oldPackets], ['optimized', newPackets]]) {
  const samples = []; let totalBytes, count
  for (let run = 0; run < 4; run++) {
    const start = performance.now(), graph = workerDecoder(); totalBytes = 0; count = 0
    for (const buffer of packets(payload)) {
      assert.ok(buffer.byteLength <= 64 * 1024); totalBytes += buffer.byteLength; count++
      graph.accept(JSON.parse(new TextDecoder().decode(buffer)))
    }
    const decoded = graph.finish()
    assert.equal(decoded.self, decoded); assert.equal(decoded.alias, decoded.rows)
    assert.equal(decoded.rows.at(-1).text, payload.rows.at(-1).text)
    if (run) samples.push(performance.now() - start)
  }
  report.transport[name] = { samplesMs: samples, medianMs: median(samples), totalBytes, count }
}
assert.equal(report.transport['2.0.4'].totalBytes, report.transport.optimized.totalBytes)
const server = spawn('python3', ['-m', 'http.server', '5188', '--bind', '127.0.0.1'], { stdio: 'ignore' })
let browser
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:5188/glossary.html')).ok) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  browser = await chromium.launch()
  const page = await browser.newPage(); await page.goto('http://127.0.0.1:5188/glossary.html')
  report.browser = await page.evaluate(async ({ observations, fixture }) => {
    const check = (condition, message) => { if (!condition) throw Error(message) }
    const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const library = await import('./src/solver/query-library.js')
    const before = await import('./baseline-current/src/solver/query-library.js')
    await library.saveComputedCandidates(observations.slice(0, 64))
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('fgo-local-query-results-v1', 1)
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    })
    // Disposable benchmark profile: unrelated candidate metadata models a
    // populated library; real physical plans above remain independently valid.
    const seedCount = 100000
    await new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite'), store = tx.objectStore('meta')
      for (let i = 0; i < seedCount; i++) store.put({ id: 'computed-candidate:r1:profile-' + i,
        kind: 'computed-candidate', family: 'computed-candidate:r1:profile', updatedAt: i, summary: 'unrelated candidate', bytes: 1500 })
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
    })
    let cloned = []
    const getAll = IDBObjectStore.prototype.getAll
    IDBObjectStore.prototype.getAll = function (...args) {
      const request = getAll.apply(this, args)
      if (this.name === 'meta') request.addEventListener('success', () => cloned.push(request.result.length))
      return request
    }
    const lookups = {}, planIds = []
    try {
      for (const [name, module] of [['2.0.4', before], ['optimized', library]]) {
        const samples = []; cloned = []; let plans
        for (let i = 0; i < 5; i++) {
          const start = performance.now(); plans = await module.sharedPlans(fixture); samples.push(performance.now() - start)
        }
        planIds.push(plans.map(plan => JSON.stringify(plan)))
        lookups[name] = { samplesMs: samples, medianMs: median(samples), clonedMetadata: cloned }
      }
    } finally { IDBObjectStore.prototype.getAll = getAll; db.close() }
    check(JSON.stringify(planIds[0]) === JSON.stringify(planIds[1]), 'Public plan selection changed')
    check(lookups['2.0.4'].clonedMetadata.every(n => n >= seedCount), 'Baseline did not exercise the populated library')
    check(lookups.optimized.clonedMetadata.every(n => n < 1000), 'Optimized lookup still cloned unrelated candidates')
    const journal = {}
    for (const [name, prefix] of [['2.0.4', './baseline-current'], ['optimized', '.']]) {
      const source = `import {createDiskJournal,consumeDiskJournal} from '${new URL(prefix + '/src/solver/query-candidate-journal.js', location.href)}';
        self.onmessage=async({data})=>{try{const root=await navigator.storage.getDirectory(),file=await root.getFileHandle('profile-'+data.name+'.jsonl',{create:true}),handle=await file.createSyncAccessHandle();handle.truncate(0);let flushes=0,writes=0;const proxy={getSize:()=>handle.getSize(),write:(bytes,options)=>{writes++;return handle.write(bytes,options)},read:(bytes,options)=>handle.read(bytes,options),truncate:n=>handle.truncate(n),flush:()=>{flushes++;handle.flush()},close:()=>handle.close()};const journal=createDiskJournal(proxy),start=performance.now(),N=60000;for(let i=0;i<N;i++)journal.capture(data.values[i%data.values.length]);journal.seal();const ms=performance.now()-start;let read=0;const restored=await consumeDiskJournal(proxy,async values=>{for(const value of values){if(JSON.stringify(value)!==JSON.stringify(data.values[read%data.values.length]))throw Error('Candidate changed');read++}return {added:0}});if(read!==N)throw Error('Candidate lost');const stats=journal.stats();journal.close();await root.removeEntry('profile-'+data.name+'.jsonl');self.postMessage({ok:true,ms,flushes,writes,stats,restored})}catch(error){self.postMessage({ok:false,error:String(error.stack||error)})}}`
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' })), worker = new Worker(url, { type: 'module' })
      const result = await new Promise((resolve, reject) => {
        worker.onerror = event => reject(Error(event.message)); worker.onmessage = ({ data }) => data.ok ? resolve(data) : reject(Error(data.error))
        worker.postMessage({ name, values: observations })
      })
      worker.terminate(); URL.revokeObjectURL(url); journal[name] = result
    }
    check(journal.optimized.stats.records === journal['2.0.4'].stats.records, 'Observation coverage changed')
    check(journal.optimized.stats.bytes === journal['2.0.4'].stats.bytes, 'Journal content size changed')
    check(journal.optimized.flushes < journal['2.0.4'].flushes, 'Per-batch durability synchronizations were not reduced')
    check(journal.optimized.stats.peakBufferedBytes <= 256 * 1024, 'Journal memory bound changed')
    const duplicateArchive = {}
    for (const [name, module] of [['2.0.4', before], ['optimized', library]]) {
      const samples = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now(), saved = await module.saveComputedCandidates(observations.slice(0, 64))
        check(saved.added === 0, 'Duplicate observations changed archive coverage')
        samples.push(performance.now() - start)
      }
      duplicateArchive[name] = { samplesMs: samples, medianMs: median(samples) }
    }
    return { seedCount, lookups, journal, duplicateArchive }
  }, { observations, fixture })

  // Measure the production Worker path with all normal persistence enabled.
  // Each trial/version gets a separate empty browser profile. Changed input
  // must compute; the third request repeats it to measure automatic reuse.
  report.worker = {}
  const workerScores = []
  for (const [name, prefix] of [['2.0.0', 'baseline-release/'], ['optimized', '']]) {
    const trials = []
    for (let trial = 0; trial < 3; trial++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto('http://127.0.0.1:5188/glossary.html')
      try {
        trials.push(await page.evaluate(async ({ prefix, fixture, trial }) => {
          const transport = prefix ? null : await import('./src/worker-transport.js')
          const url = new URL(prefix + 'src/recommend-worker.js', location.href).href
          const worker = transport ? transport.createBoundedWorker(url, { type: 'module' }) : new Worker(url, { type: 'module' })
          const samples = []
          try {
            for (let i = 0; i < 3; i++) {
              const opts = { ...fixture, base: 800 + trial * 2 + Math.min(i, 1),
                accountProfileId: i === 2 ? 'other-profile' : 'initial-profile' }
              const started = performance.now()
              const value = await new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(Error('Production Worker benchmark timed out')), 180000)
                worker.onerror = event => { clearTimeout(timer); reject(Error(event.message)) }
                worker.onmessage = ({ data }) => {
                  if (data.type === 'progress') return
                  clearTimeout(timer)
                  if (!data.ok || !data.result?.value?.ok) reject(Error(data.error || data.result?.value?.error || 'Invalid worker result'))
                  else resolve(data.result.value)
                }
                const msg = { id: i + 1, opts }
                if (transport) transport.postWorkerMessage(worker, msg).catch(error => { clearTimeout(timer); reject(error) })
                else worker.postMessage(msg)
              })
              const elapsedMs = performance.now() - started
              if (transport) {
                if (i < 2 && value.localResult?.hit) throw Error('Changed input incorrectly skipped computation')
                if (i === 2 && !value.localResult?.hit) throw Error('Cross-profile identical input missed the exact cache')
                if (!value.localResult?.saved) throw Error('Candidate or query persistence failed')
              }
              samples.push({ stage: ['cold', 'changed', 'repeat'][i], elapsedMs,
                total: value.total, solverMs: value.solverStats?.elapsed,
                cacheHit: Boolean(value.localResult?.hit), candidatesAdded: value.localResult?.candidatesAdded ?? null })
            }
          } finally { worker.terminate() }
          return samples
        }, { prefix, fixture, trial }))
      } finally { await context.close() }
    }
    workerScores.push(trials.map(rows => rows.map(row => row.total)))
    report.worker[name] = { trials, mediansMs: Object.fromEntries(['cold', 'changed', 'repeat'].map((stage, i) =>
      [stage, median(trials.map(rows => rows[i].elapsedMs))])) }
  }
  assert.deepEqual(workerScores[0], workerScores[1], 'Production Worker optima differ from 2.0.0')

  report.passed = true; report.endedAt = new Date().toISOString()
  writeFileSync(output + '/performance.json', JSON.stringify(report, null, 2))
  console.log('PERFORMANCE_REPORT', JSON.stringify(report))
} finally { await browser?.close(); server.kill() }
