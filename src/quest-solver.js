import { recommendTeam } from './recommend.js'
import { farmPlanKey, scoreBondPlans, uniqueFarmPlans } from './farming.js'
import { stabilityLabel } from './battle-sim.js'

export function solveQuest(opts = {}) {
  const bond = recommendTeam(opts)
  if (!bond || !bond.ok) {
    return {
      ok: false,
      error: (bond && bond.error) || '没有可行通关编队',
      questId: opts.quest && (opts.quest.id || opts.quest.questId) || 0,
    }
  }
  const plans = uniqueFarmPlans(
    bond.allPlans && bond.allPlans.length ? bond.allPlans : bond.plans && bond.plans.length ? bond.plans : [bond],
  )
  const scored = scoreBondPlans(plans, { ...opts, runs: opts.runs || 30, seed: opts.seed || 7 }, 'stable_script')
  const best = scored[0]
  const strategy = best.strategy
  const evidence = best.evidence
  const key = farmPlanKey(best.plan)
  let chosen = (bond.plans || []).indexOf(best.plan)
  if (chosen < 0) {
    chosen = (bond.plans || []).findIndex((plan) => farmPlanKey(plan) === key)
  }
  return {
    ok: true,
    error: '',
    questId: strategy.questId,
    team: {
      ...best.plan,
      plans: bond.plans,
      chosen: chosen >= 0 ? chosen : 0,
      assist: bond.assist,
      allPlans: bond.allPlans,
      lockSupportCeId: bond.lockSupportCeId,
      focusCost: bond.focusCost,
    },
    strategy,
    evidence,
    stability: stabilityLabel(evidence),
    confidence: strategy.confidence,
    candidates: scored,
    note: evidence.highStability
      ? '当前样本未出现失败'
      : `失败分支：${(evidence.failReasons || []).join('、') || '未清零'}`,
  }
}
