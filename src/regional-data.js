import { normalizeRegion } from './region.js'

// Never substitute the other server's content for an unavailable snapshot.
export function regionalBundle(catalogs, region) {
  const key = normalizeRegion(region)
  const bundle = catalogs?.[key]
  return bundle?.region === key && bundle?.version?.region === key ? bundle : null
}

export function validateRegionalSnapshot(bundle, region = bundle?.region) {
  const errors = [], key = normalizeRegion(region)
  if (!bundle || bundle.region !== key || bundle.version?.region !== key) errors.push('区服标记不一致')
  for (const field of ['servants', 'ces', 'quests', 'traits']) {
    const rows = bundle?.[field]
    if (!Array.isArray(rows)) { errors.push(field + ' 缺失'); continue }
    if (field !== 'traits' && !rows.length) errors.push(field + ' 为空')
    if (field !== 'quests' && new Set(rows.map(r => r.id)).size !== rows.length) errors.push(field + ' 身份重复')
  }
  if ((bundle?.servants || []).some(s => !Number.isInteger(s.cost) || s.cost < 0)) errors.push('从者 COST 缺失')
  if ((bundle?.quests || []).some(q => !Number.isFinite(q.bond) || q.bond <= 0)) errors.push('关卡羁绊无权威来源')
  if (bundle?.version?.questBondSource !== 'mstQuestPhase.friendshipExp') errors.push('关卡来源未验证')
  if (bundle?.bondBonuses?.region !== key) errors.push('活动区服不一致')
  return { ok: !errors.length, errors }
}
