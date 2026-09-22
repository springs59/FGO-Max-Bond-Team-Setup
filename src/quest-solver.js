import { recommendFarm } from './farming.js'

export function solveQuest(opts = {}) {
  const farm = recommendFarm({
    ...opts,
    pref: 'stable_script',
    runs: opts.runs || 30,
    seed: opts.seed || 7,
  })
  if (!farm.ok) {
    return {
      ok: false,
      error: farm.error === '没有可用周回编队' ? '没有可行通关编队' : farm.error || '没有可行通关编队',
      questId: (opts.quest && (opts.quest.id || opts.quest.questId)) || 0,
    }
  }
  const evidence = farm.evidence || {}
  const strategy = farm.strategy || {}
  return {
    ok: true,
    error: '',
    questId: strategy.questId,
    team: farm.bond,
    strategy,
    evidence,
    stability: farm.stability,
    confidence: strategy.confidence,
    candidates: farm.candidates,
    note: evidence.highStability
      ? '当前简化模型 + 当前样本未出现失败'
      : `失败分支：${(evidence.failReasons || []).join('、') || '未清零'}`,
  }
}
