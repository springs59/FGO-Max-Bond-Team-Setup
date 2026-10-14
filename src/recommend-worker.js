import { installWorkerTransport,postWorkerMessage } from './worker-transport.js'
import { candidateCollector } from './solver/query-candidate-collector.js'
import { recommendTeam } from './recommend.js'
import { recommendFarm } from './farming.js'
import { solveQuest } from './quest-solver.js'
import { solverResultWire, flushSolverCache } from './solver/cache.js'
import { describeQuery, readQuery, relatedQueries, migrateLegacyQueries, sharedPlans, stageCompletedQuery } from './solver/query-library.js'

function cloneResult(value) {
  if (!value || typeof value !== 'object') return value
  if (value.bond || value.team) {
    return {
      ...value,
      bond: value.bond ? solverResultWire(value.bond) : value.bond,
      team: value.team ? solverResultWire(value.team) : value.team,
      candidates: value.candidates?.map(item => ({ ...item, plan: item.plan ? solverResultWire(item.plan) : item.plan })),
    }
  }
  return solverResultWire(value)
}

installWorkerTransport(self, async (event) => {
  const msg = event.data || {}
  const id = msg.id
  const opts = msg.opts || {}
  let collector, lastProgress={}
  try {
    await migrateLegacyQueries()
    let kind = ['farm','quest'].includes(msg.solverMode) ? msg.solverMode : 'bond'
    const started = Date.now()
    const description = opts.solverAudit || opts.reuseOnly ? null : await describeQuery(kind, opts,
      `${opts.region || opts.game?.version?.region || 'CN'} · B ${opts.base} · COST ${opts.costLimit ?? '不限'}`)
    const cached = description && await readQuery(description)
    if (cached) {
      const plan = kind === 'farm' ? cached.bond : kind === 'quest' ? cached.team : cached
      if (plan) plan.queryStats = { ...plan.queryStats, cacheHit: true, search:{nodes:0,pruned:0,memoHits:0,memoMisses:0}, timing: { totalMs: Date.now()-started } }
      if (plan) plan.solverStats = {...plan.solverStats,nodes:0,pruned:0,elapsed:Date.now()-started}
      cached.localResult = { hit: true, saved: true }
      await postWorkerMessage(self,{ id, ok: true, type: 'result', result: { kind, value: cloneResult(cached) } })
      return
    }
    const previous = description ? await relatedQueries(description) : []
    const reusePlans = opts.reuseOnly ? (opts.reusePlans?.length?opts.reusePlans:await sharedPlans(opts)) : [...previous.flatMap(v => {
      const p = v.bond || v.team || v
      return p.allPlans || p.plans || (p.ok ? [p] : [])
    }).slice(0,40), ...await sharedPlans(opts,64,{maxRows:8192})]
    collector = opts.solverAudit ? null : await candidateCollector({summary:description?.summary||'本地方案核算',onProgress:stats=>self.postMessage({id,type:'progress',progress:{...lastProgress,bestScore:lastProgress.bestScore??0,phase:'archive-results',...stats}})})
    // Manual library calls also preserve their newly settled observations,
    // while retaining no exact-answer key that could imply a global optimum.
    const queryOpts = { ...opts, reusePlans, skipResultCache:true, onComputedCandidate:collector?.capture }
    let value
    if (msg.solverMode === 'farm') {
      kind = 'farm'
      value = recommendFarm(queryOpts)
    } else if (msg.solverMode === 'quest') {
      kind = 'quest'
      value = solveQuest(queryOpts)
    } else {
      value = recommendTeam({
        ...queryOpts,
        onSolverProgress: (progress) => {
          lastProgress=progress
          collector?.checkpoint?.()
          self.postMessage({ id, type: 'progress', progress })
        },
      })
    }
    await flushSolverCache()
    const copy = cloneResult(value)
    const completion = collector?.prepareCompletion?.()
    const settled=value?.bond||value?.team||value
    const staged = value?.ok && settled?.resultStatus?.optimality==='search-complete'
      ? await stageCompletedQuery(description, copy, completion) : {saved:false}
    const temporary = collector ? await collector.retain() : {temporary:false}
    collector = null
    copy.localResult = { hit:false, saved:false, temporary:temporary.temporary,
      name:temporary.name, records:temporary.records,
      ...((temporary.error || (description && !staged.saved && staged.error)) ? {error:temporary.error || staged.error} : {}) }
    await postWorkerMessage(self,{ id, ok:true, type:'result', result:{kind,value:copy} })
  } catch (err) {
    collector?.cancel()
    self.postMessage({ id, ok: false, type: 'error', error: String((err && err.message) || err || '求解失败') })
  }
})
