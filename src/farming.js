import { recommendTeam } from './recommend.js'
import { planBattle, withSimWaves } from './battle-planner.js'
import { simulateBattle, stabilityLabel } from './battle-sim.js'

export const FARM_PREFS = ['fastest', 'bond_first', 'stable_script', 'balanced']

export function farmScore(evidence, bondTotal, pref = 'balanced') {
  const clearable = evidence && evidence.theoreticalClear ? 1 : 0
  const scriptable = evidence && evidence.reproducible ? 1 : 0
  const failRate = evidence && Number.isFinite(Number(evidence.failRate)) ? Number(evidence.failRate) : 1
  const stability = 1 - failRate
  const efficiency = evidence ? -(evidence.avgTurns || 99) : -99
  const bond = Number(bondTotal) || 0
  const lex = [clearable, scriptable, stability, efficiency, bond]
  if (pref === 'fastest') return [clearable, efficiency, scriptable, stability, bond]
  if (pref === 'bond_first') return [clearable, bond, stability, scriptable, efficiency]
  if (pref === 'stable_script') return [clearable, scriptable, stability, efficiency, bond]
  return lex
}

export function compareFarmScore(a, b) {
  const left = a || []
  const right = b || []
  const n = Math.max(left.length, right.length)
  for (let i = 0; i < n; i++) {
    const lv = left[i] || 0
    const rv = right[i] || 0
    if (lv !== rv) return rv - lv
  }
  return 0
}

export function farmPlanKey(plan) {
  return (plan && plan.slots ? plan.slots : [])
    .map((slot) => `${slot.svtId || 0}:${slot.ceId || 0}:${slot.isSupport ? 1 : 0}:${slot.svtArtKey || ''}`)
    .join('|')
}

export function uniqueFarmPlans(plans) {
  const seen = new Set()
  const out = []
  for (const plan of plans || []) {
    const key = farmPlanKey(plan)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(plan)
  }
  return out
}

export function recommendFarm(opts = {}) {
  const pref = FARM_PREFS.includes(opts.pref) ? opts.pref : 'balanced'
  const bond = recommendTeam(opts)
  if (!bond || !bond.ok) {
    return {
      ok: false,
      error: (bond && bond.error) || '没有可用周回编队',
      pref,
    }
  }
  const plans = uniqueFarmPlans(
    bond.allPlans && bond.allPlans.length ? bond.allPlans : bond.plans && bond.plans.length ? bond.plans : [bond],
  )
  const scored = scoreBondPlans(plans, opts, pref)
  const best = scored[0]
  const strategy = best.strategy
  const evidence = best.evidence
  const score = best.score
  const key = farmPlanKey(best.plan)
  let chosen = (bond.plans || []).indexOf(best.plan)
  if (chosen < 0) chosen = (bond.plans || []).findIndex((plan) => farmPlanKey(plan) === key)
  return {
    ok: true,
    error: '',
    pref,
    bond: {
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
    score,
    stability: stabilityLabel(evidence),
    candidates: scored,
    claim: evidence.highStability
      ? '随机模拟失败率为 0（当前简化模型 + 当前样本）'
      : `随机模拟失败率 ${(evidence.failRate * 100).toFixed(1)}%，存在失败分支`,
  }
}

export function scoreBondPlans(plans, opts = {}, pref = 'balanced') {
  const scored = []
  for (const plan of plans || []) {
    const strategy = planBattle({ quest: opts.quest, bondPlan: plan, game: opts.game })
    const evidence = simulateBattle({
      quest: withSimWaves(opts.quest, strategy),
      team: strategy.team,
      strategy,
      runs: opts.runs || 20,
      seed: opts.seed || 1,
      cardRandom: opts.cardRandom !== false,
      targetRandom: Boolean(opts.targetRandom),
    })
    scored.push({
      plan,
      strategy,
      evidence,
      score: farmScore(evidence, plan.total, pref),
      stability: stabilityLabel(evidence),
    })
  }
  scored.sort((a, b) => compareFarmScore(a.score, b.score))
  return scored
}
