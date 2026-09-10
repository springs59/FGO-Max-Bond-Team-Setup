import { ceMatchesServant, pickCeSkill } from './atlas.js'

export const CLASS_OPTIONS = [
  ['saber', '剑'],
  ['archer', '弓'],
  ['lancer', '枪'],
  ['rider', '骑'],
  ['caster', '术'],
  ['assassin', '杀'],
  ['berserker', '狂'],
  ['extra', 'Extra'],
]

export const EXTRA_CLASSES = [
  'ruler',
  'avenger',
  'moonCancer',
  'alterEgo',
  'foreigner',
  'pretender',
  'beast',
  'unBeast',
  'shielder',
  'beastEresh',
  'unBeastOlgaMarie',
]

export const RARITY_OPTIONS = [5, 4, 3, 2, 1, 0]

export const ATTR_OPTIONS = [
  ['man', '人'],
  ['sky', '天'],
  ['earth', '地'],
  ['star', '星'],
  ['beast', '兽'],
]

export const TRAIT_OPTIONS = [
  { id: 1, name: '男性' },
  { id: 2, name: '女性' },
  { id: 300, name: '秩序' },
  { id: 301, name: '混沌' },
  { id: 302, name: '中庸' },
  { id: 303, name: '善' },
  { id: 304, name: '恶' },
  { id: 203, name: '星' },
  { id: 103, name: '骑阶' },
  { id: 104, name: '术阶' },
  { id: 2654, name: '活人' },
  { id: 2780, name: '灵衣' },
  { id: 2821, name: '兽科' },
  { id: 2883, name: 'FSN' },
]

export function emptyRosterFilter() {
  return {
    svtClass: { options: [], invert: false },
    rarity: { options: [], invert: false },
    attribute: { options: [], invert: false },
    trait: { options: [], invert: false, matchAll: false },
  }
}

export function rosterFilterActive(filter) {
  if (!filter) return false
  return ['svtClass', 'rarity', 'attribute', 'trait'].some((key) => {
    const options = (filter[key] && filter[key].options) || []
    return options.length > 0
  })
}

function groupOk(group, hit) {
  if (!group || !(group.options || []).length) return true
  return group.invert ? !hit : hit
}

function asNum(value) {
  if (value === '' || value == null) return NaN
  return Number(value)
}

function numericIn(options, value) {
  const n = asNum(value)
  if (!Number.isFinite(n)) return false
  return (options || []).some((item) => asNum(item) === n)
}

function classHit(svt, options) {
  return (options || []).some((cls) => {
    if (cls === 'extra') return EXTRA_CLASSES.includes(svt.className)
    return svt.className === cls
  })
}

export function attrKey(attribute) {
  return attribute === 'human' ? 'man' : attribute
}

export function traitBag(svt) {
  const ids = new Set()
  for (const id of (svt && svt.traitIds) || []) {
    const n = asNum(id)
    if (Number.isFinite(n)) ids.add(n)
    else ids.add(id)
  }
  for (const form of (svt && svt.forms) || []) {
    for (const id of form.traitIds || []) {
      const n = asNum(id)
      if (Number.isFinite(n)) ids.add(n)
      else ids.add(id)
    }
  }
  return ids
}

function traitHitOn(ids, group) {
  const options = (group.options || []).map((id) => asNum(id)).filter((id) => Number.isFinite(id))
  if (group.matchAll) return options.every((id) => ids.has(id))
  return options.some((id) => ids.has(id))
}

function idsSet(list) {
  const ids = new Set()
  for (const id of list || []) {
    const n = asNum(id)
    if (Number.isFinite(n)) ids.add(n)
    else ids.add(id)
  }
  return ids
}

function rosterViews(svt) {
  const base = svt.traitIds || []
  const views = [
    {
      rarity: svt.rarity,
      attribute: svt.attribute,
      traitIds: base,
      className: svt.className,
    },
  ]
  for (const form of svt.forms || []) {
    views.push({
      rarity: form.rarity != null ? form.rarity : svt.rarity,
      attribute: form.attribute || svt.attribute,
      traitIds: form.traitIds && form.traitIds.length ? form.traitIds : base,
      className: form.className || svt.className,
    })
  }
  return views
}

function matchRosterView(view, filter) {
  const f = filter || emptyRosterFilter()
  if (!groupOk(f.svtClass, classHit({ className: view.className }, f.svtClass.options))) return false
  if (!groupOk(f.rarity, numericIn(f.rarity.options, view.rarity))) return false
  if (!groupOk(f.attribute, f.attribute.options.includes(attrKey(view.attribute)))) return false
  if (!groupOk(f.trait, traitHitOn(idsSet(view.traitIds), f.trait))) return false
  return true
}

export function matchRosterForm(svt, form, filter) {
  if (!svt) return false
  if (!rosterFilterActive(filter)) return true
  return matchRosterView(
    {
      rarity: form && form.rarity != null ? form.rarity : svt.rarity,
      attribute: (form && form.attribute) || svt.attribute,
      traitIds: form && form.traitIds && form.traitIds.length ? form.traitIds : svt.traitIds || [],
      className: (form && form.className) || svt.className,
    },
    filter,
  )
}

export function matchRosterServant(svt, filter) {
  if (!svt) return false
  if (!rosterFilterActive(filter)) return true
  return rosterViews(svt).some((view) => matchRosterView(view, filter))
}

export function filterServants(list, filter) {
  return (list || []).filter((svt) => matchRosterServant(svt, filter))
}

export function toggleFilterValue(group, value) {
  const options = group.options
  const index = options.findIndex((item) => item === value || String(item) === String(value))
  if (index >= 0) options.splice(index, 1)
  else options.push(value)
}

export function ceMlbRate(ce) {
  const skill = pickCeSkill(ce, true)
  const fn = skill && skill.funcs && skill.funcs[0]
  return fn && fn.rate ? Number(fn.rate) : 0
}

export function servantBonusRate(svt, ces) {
  let best = 0
  const bags = [svt.traitIds || []]
  for (const form of svt.forms || []) {
    if (form.traitIds && form.traitIds.length) bags.push(form.traitIds)
  }
  for (const ce of ces || []) {
    const rate = ceMlbRate(ce)
    if (rate <= best) continue
    const skill = pickCeSkill(ce, true)
    const fn = skill && skill.funcs && skill.funcs[0]
    if (!fn) continue
    if (bags.some((traits) => ceMatchesServant(fn, traits))) best = rate
  }
  return best
}

export function rankServantsByBonus(list, ces) {
  return (list || []).slice().sort(
    (a, b) => servantBonusRate(b, ces) - servantBonusRate(a, ces) || a.collectionNo - b.collectionNo,
  )
}

export function rankCesByBonus(list) {
  return (list || []).slice().sort((a, b) => ceMlbRate(b) - ceMlbRate(a) || a.collectionNo - b.collectionNo)
}

export function rateLabel(milli) {
  if (!milli) return ''
  return `${milli / 10}%`
}
