function compareOp(left, op, right) {
  if (op === '>=') return left >= right
  if (op === '<=') return left <= right
  if (op === '>') return left > right
  if (op === '<') return left < right
  if (op === '!=') return left !== right
  return left === right
}

export function ruleMatches(servant, rule) {
  if (!servant || !rule) return false
  const traits = servant.traitIds || servant.traits || []
  switch (rule.type) {
    case 'rarity':
      return compareOp(Number(servant.rarity) || 0, rule.operator || '>=', Number(rule.value) || 0)
    case 'trait': {
      const hit = traits.includes(rule.value) || traits.includes(Number(rule.value))
      return rule.operator === 'excludes' ? !hit : hit
    }
    case 'className':
      return servant.className === rule.value
    case 'attribute':
      return servant.attribute === rule.value
    case 'gender':
      if (servant.gender) return servant.gender === rule.value
      if (rule.value === 'female') return traits.includes(2)
      if (rule.value === 'male') return traits.includes(1)
      return false
    case 'bond_level':
      return compareOp(Number(servant.bondLevel) || 0, rule.operator || '>=', Number(rule.value) || 0)
    case 'bond_cap':
      return compareOp(Number(servant.bondCap) || 0, rule.operator || '>=', Number(rule.value) || 0)
    case 'cost':
      return compareOp(Number(servant.cost) || 0, rule.operator || '<=', Number(rule.value) || 0)
    case 'custom_list':
      return Array.isArray(rule.value) && rule.value.includes(servant.id)
    case 'has_costume':
      return (servant.forms || servant.battleSprites || []).some(
        (item) => item.type === 'costume' || (item.key && String(item.key).startsWith('c')),
      )
    default:
      return false
  }
}

export function priorityScore(team, priorities) {
  let score = 0
  for (const servant of team || []) {
    for (const rule of priorities || []) {
      if (rule.enabled === false) continue
      if (ruleMatches(servant, rule)) score += Number(rule.weight) || 0
    }
  }
  return score
}

export function mainBondOf(plan, optimizeBy = 'total') {
  if (optimizeBy === 'prefer') return (plan.preferBond || 0) + (plan.lockBond || 0)
  return plan.total || 0
}

export const PRIORITY_PRESETS = [
  { id: 'star5', type: 'rarity', operator: '>=', value: 5, weight: 10, label: '5星优先' },
  { id: 'cost7', type: 'cost', operator: '<=', value: 7, weight: 8, label: '低COST优先' },
  { id: 'living', type: 'trait', operator: 'includes', value: 2654, weight: 8, label: '活人优先' },
  { id: 'costume', type: 'has_costume', weight: 6, label: '有灵衣优先' },
]

export function samePriorityRule(left, right) {
  if (!left || !right) return false
  return left.type === right.type && left.operator === right.operator && String(left.value ?? '') === String(right.value ?? '')
}

export function addPriorityPreset(list, preset) {
  const cur = Array.isArray(list) ? list.slice() : []
  if (!preset) return cur
  if (cur.some((rule) => samePriorityRule(rule, preset))) return cur
  cur.push({
    id: `rule_${cur.length + 1}_${preset.id || preset.type}`,
    type: preset.type,
    operator: preset.operator,
    value: preset.value,
    weight: Number(preset.weight) || 0,
    enabled: true,
    label: preset.label || preset.type,
  })
  return cur
}
