import { installWorkerTransport,postWorkerMessage } from './worker-transport.js'
import { candidateCollector } from './solver/query-candidate-collector.js'
import { recommendTeam } from './recommend.js'
import { recommendFarm } from './farming.js'
import { solveQuest } from './quest-solver.js'
import { solverResultWire, flushSolverCache } from './solver/cache.js'
import { describeQuery, createCatalogQueryDescriber, readQuery, migrateLegacyQueries, stageCompletedQuery } from './solver/query-library.js'
import { compileBondCurve } from './solver/bond-curve.js'
import { matchedCurveSeeds } from './solver/account-plan-matches.js'
import { createCatalogReceiver } from './worker-catalog.js'
const receiveCatalog=createCatalogReceiver()
let catalogId,describeCatalog

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
  let opts
  let collector, lastProgress={},progressAt=-Infinity,progressPhase
  const progressMessage=progress=>{
    const now=performance.now()
    if(progress.phase!==progressPhase||now-progressAt>=100){progressAt=now;progressPhase=progress.phase;self.postMessage({id,type:'progress',progress})}
  }
  try {
    const received=receiveCatalog(msg)
    opts=received.opts
    if(received.catalog&&received.id!==catalogId){catalogId=received.id;describeCatalog=createCatalogQueryDescriber(received.catalog)}
    await migrateLegacyQueries()
    let kind = ['farm','quest'].includes(msg.solverMode) ? msg.solverMode : 'bond'
    const started = Date.now()
    const description = opts.solverAudit || opts.reuseOnly ? null : await (received.catalog?describeCatalog:describeQuery)(kind, opts,
      `${opts.region || opts.game?.version?.region || 'CN'} · B ${opts.base} · COST ${opts.costLimit ?? '不限'}`)
    const cached = description && await readQuery(description)
    if (cached) {
      const plan = kind === 'farm' ? cached.bond : kind === 'quest' ? cached.team : cached
      if (plan) plan.libraryCurve={exactCache:true,base:opts.base,costLimit:opts.costLimit}
      if (plan) plan.queryStats = { ...plan.queryStats, cacheHit: true, search:{nodes:0,pruned:0,memoHits:0,memoMisses:0}, timing: { totalMs: Date.now()-started } }
      if (plan) plan.solverStats = {...plan.solverStats,nodes:0,pruned:0,elapsed:Date.now()-started}
      cached.localResult = { hit: true, saved: true }
      await postWorkerMessage(self,{ id, ok: true, type: 'result', result: { kind, value: cloneResult(cached) } })
      return
    }
    if(opts.reuseOnly&&!opts.reusePlans?.length){
      const fitting=await matchedCurveSeeds(opts)
      opts={...opts,reusePlans:fitting.plans||[]}
    }
    collector = opts.solverAudit ? null : await candidateCollector({summary:description?.summary||'本地方案核算'})
    let lastRecorded=''
    const capturePlan = plan => {
      if(!collector||!plan?.ok||!Array.isArray(plan.slots))return
      const slots=plan.slots.map(s=>({position:s.position,filled:s.filled,isSupport:s.isSupport,isGrand:s.isGrand,
        svtId:s.svtId,svtArtKey:s.svtArtKey||'default',ceId:s.ceId,ceMlb:s.ceMlb,
        ceBondId:s.ceBondId,ceBondMlb:s.ceBondMlb,ceRewardId:s.ceRewardId,ceRewardMlb:s.ceRewardMlb}))
      const key=JSON.stringify([plan.total,slots]);if(key===lastRecorded)return;lastRecorded=key
      collector.capture({engine:'2.0.0-checkpoint',base:opts.base,teapot:!!opts.teapot,total:plan.total,
        cost:plan.costUsed,plan:{ok:true,slots},curve:compileBondCurve(plan.slots,{bond15Aura:opts.bond15Aura!==false})})
      collector.checkpoint(true)
    }
    // Only explicit library actions settle library candidates. Ordinary queries
    // use 2.0.0 directly, with no account curve fit or per-loadout disk journal.
    const queryOpts = { ...opts, reusePlans:opts.reuseOnly?opts.reusePlans||[]:[],
      skipResultCache:true,onComputedCandidate:null,onCheckpointPlan:capturePlan }
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
          progressMessage(progress)
        },
      })
    }
    await flushSolverCache()
    const settled=value?.bond||value?.team||value
    for(const plan of settled?.allPlans||settled?.plans||[settled])capturePlan(plan)
    if(settled?.resultStatus)settled.resultStatus.engine='2.0.0'
    const copy = cloneResult(value)
    const completion = collector?.prepareCompletion?.()
    const staged = value?.ok && ['search-complete','default-query-complete'].includes(settled?.resultStatus?.optimality)
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
