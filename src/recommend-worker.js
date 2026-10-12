import { candidateCollector } from './solver/query-candidate-collector.js'
import { recommendTeam } from './recommend.js'
import { recommendFarm } from './farming.js'
import { solveQuest } from './quest-solver.js'
import { cloneSolverResult, restoreSolverCache, flushSolverCache } from './solver/cache.js'
import { describeQuery, readQuery, saveQuery, relatedQueries, migrateLegacyQueries, sharedPlans } from './solver/query-library.js'

function cloneResult(value) {
  if (!value || typeof value !== 'object') return value
  if (value.bond || value.team) {
    return {
      ...value,
      bond: value.bond ? cloneSolverResult(value.bond) : value.bond,
      team: value.team ? cloneSolverResult(value.team) : value.team,
      candidates: value.candidates?.map(item => ({ ...item, plan: item.plan ? cloneSolverResult(item.plan) : item.plan })),
    }
  }
  return cloneSolverResult(value)
}

self.onmessage = async (event) => {
  const msg = event.data || {}
  const id = msg.id
  const opts = msg.opts || {}
  let collector
  try {
    await restoreSolverCache()
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
      self.postMessage({ id, ok: true, type: 'result', result: { kind, value: cloneResult(cached) } })
      return
    }
    const previous = description ? await relatedQueries(description) : []
    const reusePlans = opts.reuseOnly ? opts.reusePlans || [] : [...previous.flatMap(v => {
      const p = v.bond || v.team || v
      return p.allPlans || p.plans || (p.ok ? [p] : [])
    }).slice(0,40), ...await sharedPlans(opts)]
    collector = description ? candidateCollector() : null
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
          self.postMessage({ id, type: 'progress', progress })
        },
      })
    }
    await flushSolverCache()
    const copy = cloneResult(value)
    const candidates = collector ? await collector.finish() : {saved:true,added:0}
    collector = null
    // Never commit an exact hit for an archive whose candidate writes failed;
    // the next identical query must be allowed to fill the missing observations.
    const saved = description && candidates.saved ? await saveQuery(description, copy) : { saved: false }
    copy.localResult = { hit: false, ...saved, candidatesSaved:candidates.saved, candidatesAdded:candidates.added,
      ...(candidates.error?{error:candidates.error,saved:false}:{}) }
    self.postMessage({ id, ok: true, type: 'result', result: { kind, value: copy } })
  } catch (err) {
    collector?.cancel()
    self.postMessage({ id, ok: false, type: 'error', error: String((err && err.message) || err || '求解失败') })
  }
}
