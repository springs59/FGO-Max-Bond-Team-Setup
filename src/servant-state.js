import { servantCost } from './servant-cost.js'
import { traitIdsForForm } from './atlas.js'
import { attributeTraits } from './game-data.js'

export function resolveServantState(svt, key = '', nice = null) {
  if (!svt) return null
  const form = (svt.forms || []).find(f => f.key === key) || {}
  const kind = key.startsWith('c') ? 'costume' : 'ascension'
  const rawId = key.slice(1)
  const costumes = nice?.profile?.costume || nice?.costume || {}
  const costumeId = form.costumeId ?? costumes[rawId]?.id
  const add = nice?.ascensionAdd || {}
  const value = (field, fallback) => {
    const bag = add[field]?.[kind] || {}
    const id = kind === 'costume' && field.startsWith('overwrite') ? costumeId : rawId
    return id != null && bag[id] != null ? bag[id] : fallback
  }
  const attribute = value('attribute', form.attribute || svt.attribute)
  const rarity = value('overwriteRarity', value('rarity', form.rarity ?? svt.rarity))
  const cost = value('overwriteCost', servantCost(svt, form))
  const traits = form.traitIds || (nice && key ? traitIdsForForm(nice, kind, rawId) : svt.traitIds) || []
  return { ...svt, ...form, key, formLabel: form.name || '第3阶段',
    className: form.className || svt.className, attribute, rarity, cost,
    costumeId, traitIds: attributeTraits(traits, attribute),
    atk: value('overwriteAtkMax', form.atk ?? svt.atk), hp: value('overwriteHpMax', form.hp ?? svt.hp),
    passiveIds: value('overwriteClassPassive', form.passiveIds) }
}

function conditionsMatch(conditions, state) {
  // Form conditions are evaluated here; story/strengthening remains the latest
  // available version for this form, since a free party has no story history.
  return (conditions || []).every(c => {
    if (c.condType === 'equipWithTargetCostume') return Number(state.costumeId) === Number(c.condNum)
    if (c.condType === 'notEquipWithTargetCostume') return Number(state.costumeId) !== Number(c.condNum)
    if (c.condType === 'svtLimit') return !state.key.startsWith('a') || Number(state.key.slice(1)) >= Number(c.condNum)
    return true
  })
}

export function abilitiesForState(nice, state, extraSkills = []) {
  if (!state) return []
  if (!nice) nice = { id: state.id, skills: (state.abilities || []).filter(s => s.group === '主动技能'),
    classPassive: (state.abilities || []).filter(s => s.group === '职阶技能'),
    noblePhantasms: (state.abilities || []).filter(s => s.group === '宝具') }
  const stored = state.abilities || []
  const choose = (list, field, label) => {
    const out = new Map()
    for (const ability of list || []) {
      const bindings = (ability[field] || []).filter(r => Number(r.svtId) === Number(nice.id))
      for (const binding of bindings.length ? bindings : [ability]) {
        if (!conditionsMatch(binding.releaseConditions, state)) continue
        if (state.key.startsWith('a') && Number(binding.condLimitCount) > Number(state.key.slice(1))) continue
        const key = Number(binding.num || ability.num) || ability.id
        const prior = out.get(key)
        if (!prior || Number(binding.priority || 0) > prior.priority)
          out.set(key, { ...ability, priority: Number(binding.priority || 0), group: label })
      }
    }
    return [...out.values()]
  }
  const passives = state.passiveIds == null ? (nice.classPassive || []) : state.passiveIds.map(id =>
    [...(nice.classPassive || []), ...extraSkills, ...stored].find(s => Number(s.id) === Number(id)) ||
    { id, name: '职阶技能', detail: '该形态技能资料正在加载' })
  const selectedNps = choose(nice.noblePhantasms, 'npSvts', '宝具')
  const primaryNames = new Set(selectedNps.filter(a => Number(a.num || 1) === 1).map(a => a.name))
  const alternateIds = new Set((nice.noblePhantasms || []).filter(a =>
    Number(a.num || 1) === 1 && primaryNames.has(a.name)).flatMap(a => a.script?.tdTypeChangeIDs || []))
  const nps = selectedNps.filter(a => Number(a.num || 1) === 1 || alternateIds.has(a.id))
  return [...choose(nice.skills, 'skillSvts', '主动技能'),
    ...passives.map(s => ({ ...s, group: '职阶技能' })),
    ...nps]
}
