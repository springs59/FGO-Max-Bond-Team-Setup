export function aiBoundText(ai) {
  if(!ai?.enabled||!Number.isFinite(ai.initialLowerBound))return ''
  const multiplier=ai.scoreMultiplier===2?2:1
  const interval=Number.isFinite(ai.initialUpperBound)?` · 初始安全上界 ${ai.initialUpperBound*multiplier}`:''
  const shortcut=ai.seedCertifiedStops?` · 起点达界提前结束 ${ai.seedCertifiedStops} 次` : ''
  const calls=Number.isInteger(ai.inferenceCalls)?` · 本次 AI 调用 ${ai.inferenceCalls} 次`:''
  return `初始可行下界 ${ai.initialLowerBound*multiplier} · 下界剪枝 ${ai.lowerBoundPruned||0} · 已核实起点复用 ${ai.seedReused||0} 次${interval} · DP 状态跳过 ${ai.dpStatePruned||0}${shortcut}${calls}`
}
