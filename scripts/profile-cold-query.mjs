import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const output = process.env.FGO_PERFORMANCE_OUTPUT || '/tmp/fgo-cold-query'
mkdirSync(output, { recursive: true })
const server = spawn('python3', ['-m', 'http.server', '5189', '--bind', '127.0.0.1'], { stdio: 'ignore' })
let browser
const report = { startedAt: new Date().toISOString(), versions: {}, passed: false }
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:5189/glossary.html')).ok) break } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  browser = await chromium.launch()
  for (const [version, prefix] of [['2.0.0', 'baseline-release/'], ['2.0.5', 'baseline-current/'], ['optimized', '']]) {
    const trials = []
    for (let trial = 0; trial < 3; trial++) {
      const context = await browser.newContext(), page = await context.newPage()
      await page.goto('http://127.0.0.1:5189/glossary.html')
      try {
        trials.push(await page.evaluate(async ({ prefix, version, trial }) => {
          const { isPlayableServant, ceHasBondGain } = await import('./src/game-data.js')
          const [servants, ces] = await Promise.all(['servants', 'ces'].map(async n => (await fetch('./src/data/' + n + '.json')).json()))
          const fixture = { servants: servants.filter(isPlayableServant).slice(0, 30), ces: ces.filter(ceHasBondGain).slice(0, 36),
            mode: 'free', costLimit: 95, useInventoryCurveSolver: true }
          const productionUrl = new URL(prefix + 'src/recommend-worker.js', location.href)
          let source = await (await fetch(productionUrl)).text()
          // Instrument the actual source with phase timestamps only. Module
          // URLs still point at each version's unmodified production code.
          source = source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g, (_, q, path) => 'from ' + JSON.stringify(new URL(path, productionUrl).href))
          const traceInit = "const trace = {}; let traceAt=performance.now(); const traceMark = phase => {trace[phase]=(trace[phase]||0)+performance.now()-traceAt;traceAt=performance.now()}"
          const inject = (needle, replacement) => {
            if (!source.includes(needle)) throw Error('Trace source marker missing: ' + needle)
            source = source.replace(needle, replacement)
          }
          inject('const opts = msg.opts || {}', 'const opts = msg.opts || {}\n' + traceInit)
          if (version === '2.0.0') {
            inject('await restoreSolverCache()', "await restoreSolverCache(); traceMark('restore')")
            inject('await flushSolverCache()', "traceMark('solve'); await flushSolverCache(); traceMark('flush')")
            inject("self.postMessage({ id, ok: true, type: 'result', result: { kind, value: cloneResult(value) } })",
              "self.postMessage({ id, ok: true, type: 'result', result: { kind, value: cloneResult(value) } }); traceMark('cloneTransport'); self.postMessage({id,type:'profile-trace',trace})")
          } else {
            inject('await migrateLegacyQueries()', "await migrateLegacyQueries(); traceMark('migration')")
            inject('const cached = description', "traceMark('describe'); const cached = description")
            inject('if (cached) {', "traceMark('read'); if (cached) {")
            inject('const reusePlans =', "traceMark('related'); const reusePlans =")
            inject('collector = opts.solverAudit', "traceMark('sharedPlans'); collector = opts.solverAudit")
            inject('const queryOpts =', "traceMark('journalOpen'); const queryOpts =")
            inject('await flushSolverCache()', "traceMark('solve'); await flushSolverCache(); traceMark('flush')")
            inject('const candidates = collector', "traceMark('clone'); const candidates = collector")
            inject('collector = null', "traceMark('archive'); trace.captured=collector?.stats?.().records; collector = null")
            inject('copy.localResult =', "traceMark('save'); copy.localResult =")
            source = source.replace(/^([ \t]*await postWorkerMessage\(self,.*\))[ \t]*$/gm,
              "$1\ntraceMark('transport'); self.postMessage({id,type:'profile-trace',trace})")
          }
          const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
          const transport = version === '2.0.0' ? null : await import('./' + prefix + 'src/worker-transport.js')
          const worker = transport ? transport.createBoundedWorker(url, { type: 'module' }) : new Worker(url, { type: 'module' })
          const samples = []
          let coldLibrary
          const exportLibrary = async () => {
            const module = await import('./' + prefix + 'src/solver/query-library.js')
            const rows = await module.listQueries(), backup = await module.exportQueries()
            return { count: rows.length, candidates: rows.filter(r => r.kind === 'computed-candidate').length,
              shared: rows.filter(r => r.kind === 'shared-plan').length, backupText: await backup.blob.text() }
          }
          try {
            for (let i = 0; i < 4; i++) {
              const opts = { ...fixture, base: 800 + 2 * trial + Math.min(i, 1), accountProfileId: i === 3 ? 'other' : 'initial' }
              const start = performance.now()
              samples.push(await new Promise((resolve, reject) => {
                let response, trace, archivedRecords=0
                const timer = setTimeout(() => reject(Error('Cold benchmark timed out')), 180000)
                const finish = () => { if (response && trace) { clearTimeout(timer); resolve({ ...response, trace }) } }
                worker.onerror = e => { clearTimeout(timer); reject(Error(e.message)) }
                worker.onmessage = ({ data }) => {
                  if (data.type === 'progress') {
                    if (data.progress?.phase === 'archive-results' && data.progress.records) archivedRecords=data.progress.records
                    return
                  }
                  if (data.type === 'profile-trace') { trace = data.trace; finish(); return }
                  if (!data.ok || !data.result?.value?.ok) { clearTimeout(timer); reject(Error(data.error || 'Invalid result')); return }
                  const value = data.result.value
                  if (transport && !value.localResult?.saved) { clearTimeout(timer); reject(Error(value.localResult?.error || 'Archive not saved')); return }
                  response = { stage: ['cold', 'changed', 'repeat', 'crossProfile'][i], elapsedMs: performance.now() - start,
                    archivedRecords,
                    total: value.total, candidatesAdded: value.localResult?.candidatesAdded ?? null,
                    cacheHit: Boolean(value.localResult?.hit || value.queryStats?.cacheHit) }; finish()
                }
                const msg = { id: i + 1, opts }
                if (transport) transport.postWorkerMessage(worker, msg).catch(reject); else worker.postMessage(msg)
              }))
              if (i === 0 && transport) coldLibrary=await exportLibrary()
            }
          } finally { worker.terminate(); URL.revokeObjectURL(url) }
          let library
          if (version !== '2.0.0') {
            library=await exportLibrary()
          }
          return { samples, library, coldLibrary }
        }, { prefix, version, trial }))
      } finally { await context.close() }
    }
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
    report.versions[version] = { trials, mediansMs: Object.fromEntries(['cold', 'changed', 'repeat', 'crossProfile'].map((stage, i) =>
      [stage, median(trials.map(t => t.samples[i].elapsedMs))])) }
  }
  const original = report.versions['2.0.0'].trials
  const before = report.versions['2.0.5'].trials, after = report.versions.optimized.trials
  const totals = trials => trials.map(t => t.samples.map(s => s.total))
  assert.deepEqual(totals(original), totals(before)); assert.deepEqual(totals(before), totals(after))
  // Every candidate and physical-plan record must match, including checksums.
  // Completed query timing diagnostics naturally differ between executions;
  // their scores above and all record checksums during export are checked.
  const normalized = text => text.trim().split('\n').slice(1).map(JSON.parse)
    .filter(r => ['computed-candidate', 'shared-plan'].includes(r.kind)).map(r => {
    const { createdAt, updatedAt, bytes, ...record } = r; return JSON.stringify(record)
  }).sort()
  for (let i = 0; i < before.length; i++) {
    // Warm-start plan recency has millisecond ties even in unchanged releases;
    // compare all empty-library observations exactly, and check every warm
    // request's observed-versus-consumed record count independently.
    assert.equal(before[i].coldLibrary.candidates, after[i].coldLibrary.candidates)
    assert.equal(before[i].coldLibrary.count, after[i].coldLibrary.count)
    assert.deepEqual(normalized(before[i].coldLibrary.backupText), normalized(after[i].coldLibrary.backupText))
    for (const trial of [before[i], after[i]]) for (const sample of trial.samples) {
      if (!sample.cacheHit) assert.equal(sample.trace.captured, sample.archivedRecords)
    }
  }
  for (const version of Object.values(report.versions)) for (const trial of version.trials) {
    if (trial.library) delete trial.library.backupText
    if (trial.coldLibrary) delete trial.coldLibrary.backupText
  }
  report.archivePhases={}
  for (const [version,prefix] of [['2.0.5','baseline-current/'],['optimized','']]) {
    const context=await browser.newContext(),page=await context.newPage()
    await page.goto('http://127.0.0.1:5189/glossary.html')
    try {
      report.archivePhases[version]=await page.evaluate(async prefix=>{
        const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
        const [servants,ces]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
        const opts={servants:servants.filter(isPlayableServant).slice(0,30),ces:ces.filter(ceHasBondGain).slice(0,36),mode:'free',costLimit:95,base:800,useInventoryCurveSolver:true}
        const worker=new Worker('./scripts/profile-candidate-write-worker.mjs',{type:'module'})
        try{return await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(Error('Archive phases timed out')),180000)
          worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))}
          worker.onmessage=({data})=>{clearTimeout(timer);data.ok?resolve(data):reject(Error(data.error))}
          worker.postMessage({prefix,opts})
        })}finally{worker.terminate()}
      },prefix)
    }finally{await context.close()}
  }
  report.passed = true; report.endedAt = new Date().toISOString()
  writeFileSync(output + '/performance.json', JSON.stringify(report, null, 2))
  console.log('COLD_QUERY_REPORT', JSON.stringify(report))
} finally { await browser?.close(); server.kill() }
