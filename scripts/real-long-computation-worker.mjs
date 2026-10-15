import { installWorkerTransport, postWorkerMessage } from '../src/worker-transport.js'
import { candidateCollector } from '../src/solver/query-candidate-collector.js'
import { recommendTeam } from '../src/recommend.js'
import { compileBondCurve, evaluateBondCurve } from '../src/solver/bond-curve.js'
import { solverResultWire } from '../src/solver/cache.js'
import { calcParty } from '../src/bond.js'
import { describeQuery,stageCompletedQuery } from '../src/solver/query-library.js'

const check = (condition, message) => { if (!condition) throw Error(message) }
installWorkerTransport(self, async ({ data }) => {
  let collector
  try {
    const { seconds, fixture } = data
    const clock = Date.now, startedAt = clock(), started = performance.now()
    let rounds = 0, observed = 0, curveChecks = 0, settledChecks = 0, archived = 0
    let archiveRecords = 0, archiveBytes = 0, computeMs = 0, solverMs = 0, oracleMs = 0, oracleChecks = 0, peakBufferedBytes = 0
    let lastBeat = 0, lastOpts, lastResult
    const open = () => candidateCollector()
    collector = await open()
    const stats = () => {
      const current = collector.stats()
      peakBufferedBytes = Math.max(peakBufferedBytes, current.peakBufferedBytes || 0)
      return { rounds, observed, curveChecks, settledChecks, archived, archiveRecords,
        archiveBytes, computeMs, solverMs, oracleMs, oracleChecks, peakBufferedBytes, current, elapsedMs: performance.now() - started }
    }
    for (;;) {
      check(Date.now === clock, 'Wall clock was replaced')
      const opts = { ...fixture, base: 800 + rounds % 16, costLimit: 70 + 10 * (Math.floor(rounds / 16) % 3),
        teapot: Boolean(Math.floor(rounds / 48) % 2), allowSupport: Boolean(Math.floor(rounds / 96) % 2),
        useInventoryCurveSolver: true, skipResultCache: true }
      let bestProgress = 0
      const t0 = performance.now()
      const result = recommendTeam({ ...opts,
        onSolverProgress: p => { bestProgress = Math.max(bestProgress, p.bestScore || 0); collector.checkpoint() },
        onComputedCandidate: value => {
          if (value.curve) {
            check(evaluateBondCurve(value.curve, opts.base, { teapot: opts.teapot }).total === value.total,
              'Stored candidate curve does not reproduce its observed score')
            curveChecks++
          }
          collector.capture(value); observed++
        } })
      solverMs += performance.now() - t0
      check(result.ok, result.error || 'Solver failed')
      check(result.solverStats.bestScore === result.total, 'Displayed and incumbent scores differ')
      check(bestProgress <= result.total, 'Progress exceeds the settled optimum')
      const curve = compileBondCurve(result.slots)
      check(evaluateBondCurve(curve, opts.base, { teapot: opts.teapot }).total === result.total,
        'Final team curve does not reproduce the displayed score')
      // Real independent arithmetic, not a delay loop: every returned physical
      // team is checked throughout the unsigned 17-bit base-bond range against
      // the original per-slot settlement engine, including both floor stages.
      const oracleStart = performance.now()
      for (let base = 0; base < 131072; base++) {
        const direct = calcParty(base, opts.teapot, result.slots)
        check(direct.ok, direct.error)
        const total = direct.results.reduce((sum, slot) => sum + slot.final, 0)
        check(evaluateBondCurve(curve, base, { teapot: opts.teapot }).total === total,
          'Curve and independent literal settlement differ at B=' + base)
        oracleChecks++
      }
      oracleMs += performance.now() - oracleStart; computeMs = solverMs + oracleMs
      rounds++; settledChecks++; lastOpts = opts; lastResult = solverResultWire(result)
      collector.checkpoint()
      const sample = stats()
      check(!collector.error && sample.current.records !== undefined, 'Disk journal is unavailable')
      check(archiveRecords + sample.current.records === observed, 'An observed candidate was not journaled')
      check(sample.current.queuedWorkerMessages === 0, 'Candidate messages accumulated')
      check(sample.peakBufferedBytes <= 256 * 1024, 'Candidate buffer exceeded its limit')
      if (sample.elapsedMs - lastBeat >= 10000) {
        lastBeat = sample.elapsedMs
        self.postMessage({ type: 'progress', stats: sample })
      }
      if (sample.elapsedMs >= seconds * 1000) { collector.checkpoint(true); break }
      // Preserve every observation, promote bounded disk segments, and keep the
      // same Worker alive. No sleeps are used to manufacture a long duration.
      if (sample.current.bytes >= 64 * 1024 * 1024) {
        const saved = await collector.retain()
        check(saved.temporary, saved.error || 'Temporary segment flush failed')
        archiveRecords += sample.current.records; archiveBytes += sample.current.bytes; archived++
        collector = await open()
      }
      // Yield to acknowledgements and OS events between actual computations.
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    const description=await describeQuery('bond',lastOpts,'Real computation temporary result')
    const completion=collector.prepareCompletion()
    const staged=await stageCompletedQuery(description,lastResult,completion)
    check(staged.saved,staged.error||'Temporary exact result staging failed')
    const final = stats()
    check(Math.abs((clock() - startedAt) - final.elapsedMs) < 3000, 'Real and monotonic clocks disagree')
    check(final.current.records > 0 && final.current.bufferedBytes === 0, 'Final durable prefix is empty or unflushed')
    await postWorkerMessage(self, { type: 'finished', stats: final, startedAt, endedAt: clock(), lastOpts, lastResult })
    // Keep the real exclusive journal handle open until the parent terminates
    // this Worker, so the recovery test exercises abrupt process teardown.
    await new Promise(() => {})
  } catch (error) {
    collector?.cancel()
    self.postMessage({ type: 'failure', error: String(error.stack || error) })
  }
})
