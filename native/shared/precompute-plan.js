export const formatEstimate = estimate => {
  if (!estimate) return '读取候选数据后估算；下载时间另计。'
  const seconds = ms => Math.max(1, Math.ceil(ms / 1000))
  const a = seconds(estimate.lowMs), b = seconds(estimate.highMs)
  return `预计预计算 ${a}–${b} 秒（${estimate.calibrated ? '依据本机历史记录' : '初步估算'}；下载时间另计）`
}
export function estimatePrecompute(units, history = []) {
  if (!units) return { lowMs: 0, highMs: 0, calibrated: true }
  const samples = history.filter(r => r.units > 0 && r.durationMs > 0).slice(-12).map(r => r.durationMs / r.units).sort((a,b) => a-b)
  const rate = samples.length ? samples[Math.floor(samples.length / 2)] : 0.08
  return { lowMs: Math.max(1000, units * rate * (samples.length ? 0.6 : 0.25)), highMs: Math.max(3000, units * rate * (samples.length ? 2 : 4)), calibrated: !!samples.length }
}
export function precomputeUnits(bundle, { baseNeeded = true, jointNeeded = true, accounts = 0 } = {}) {
  const members = (bundle.servants || []).length * 3
  return (baseNeeded ? members * (bundle.ces || []).filter(c => c.bondGain).length * 4 + members * 100 : 0) +
    (jointNeeded ? members * Math.max(1, (bundle.bondBonuses?.events || []).length) : 0) + accounts * members
}
