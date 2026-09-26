import { ceMatchesServant } from '../atlas.js'
import { servantBondForms } from '../recommend.js'

const TRAIT_CN = {
  1: '男性',
  2: '女性',
  100: '剑阶',
  101: '弓阶',
  102: '枪阶',
  103: '骑阶',
  104: '术阶',
  105: '杀阶',
  106: '狂阶',
  107: '盾阶',
  108: '裁定者',
  109: '复仇者',
  110: '复仇者',
  200: '天属性',
  201: '地属性',
  202: '人属性',
  203: '星属性',
  204: '兽属性',
  300: '秩序',
  301: '混沌',
  302: '中庸',
  303: '善',
  304: '恶',
  305: '中立',
  400: '人型',
  1000: '从者',
  2654: '活人',
  2780: '灵衣',
  2821: '兽科',
  2883: 'FSN从者',
}

const TRAIT_EN = {
  genderMale: '男性',
  genderFemale: '女性',
  classSaber: '剑阶',
  classArcher: '弓阶',
  classLancer: '枪阶',
  classRider: '骑阶',
  classCaster: '术阶',
  classAssassin: '杀阶',
  classBerserker: '狂阶',
  classShielder: '盾阶',
  classRuler: '裁定者',
  classAvenger: '复仇者',
  attributeSky: '天属性',
  attributeEarth: '地属性',
  attributeHuman: '人属性',
  attributeMan: '人属性',
  attributeStar: '星属性',
  attributeBeast: '兽属性',
  alignmentLawful: '秩序',
  alignmentChaotic: '混沌',
  alignmentNeutral: '中庸',
  alignmentGood: '善',
  alignmentEvil: '恶',
  alignmentBalanced: '中立',
  livingHuman: '活人',
  hasCostume: '灵衣',
  havingAnimalsCharacteristics: '兽科',
  FSNServant: 'FSN从者',
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function traitId(trait) {
  if (trait == null) return 0
  return Number(typeof trait === 'object' ? trait.id : trait) || 0
}

export function traitLabel(trait) {
  const id = traitId(trait)
  const name = typeof trait === 'object' ? String(trait.name || '') : ''
  return TRAIT_CN[id] || TRAIT_EN[name] || (name && TRAIT_CN[name]) || (name ? name : `特性 ${id}`)
}

function joinCn(list) {
  const items = (list || []).filter(Boolean)
  if (items.length <= 1) return items[0] || ''
  return `${items.slice(0, -1).join('、')}和${items[items.length - 1]}`
}

export function formatTraitCondition(fn) {
  const andGroups = (fn && fn.andTvals) || []
  const tvals = (fn && fn.tvals) || []
  if (andGroups.length) {
    const groups = andGroups
      .map((group) => joinCn((group || []).map(traitLabel)))
      .filter(Boolean)
    if (groups.length === 1) return `同时具备${groups[0]}`
    if (groups.length) return `满足以下任一组合：${groups.join('；')}`
  }
  if (tvals.length) {
    const labels = tvals.map(traitLabel)
    if (labels.length === 1) return `具备「${labels[0]}」特性`
    return `具备以下任一特性：${labels.map((name) => `「${name}」`).join('、')}`
  }
  return '无特性限制，任意灵基、灵衣都可吃到'
}

export function formatLimitLabel(condLimitCount) {
  return Number(condLimitCount) >= 4 ? '满破' : '未满破'
}

function pctText(rate) {
  const n = Math.round((Number(rate) || 0) * 1000) / 10
  if (!n) return ''
  return `+${n}%`
}

export function formatEffectValue(fn, { isSupport = false } = {}) {
  const add = Number(fn && (fn.add || 0)) || 0
  const own = Number(fn && (fn.ownRate != null ? fn.ownRate : (Number(fn.rate) || 0) / 1000)) || 0
  const support =
    fn && fn.supportRate != null
      ? Number(fn.supportRate) || 0
      : fn && fn.followerRate != null
        ? (Number(fn.followerRate) || 0) / 1000
        : own
  if (add) return `通关羁绊固定 ${add > 0 ? '+' : ''}${add}（加在百分比之后，不吃倍率）`
  if (own !== support) {
    return `自己装备全体 ${pctText(own)}，助战装备全体 ${pctText(support)}`
  }
  const target = fn && fn.target === 'self' ? '仅装备者' : '己方全体'
  return `${target}通关羁绊 ${pctText(isSupport ? support : own)}`
}

export function formatTargetScope(fn) {
  if (fn && fn.target === 'self') {
    return '只给装备这张卡的从者。装备者是助战时，没有人拿到羁绊。'
  }
  return '给己方全体可获得羁绊的从者。助战本人不拿羁绊。'
}

export function formStateLabel(form) {
  const key = (form && form.key) || 'default'
  const name = (form && form.name) || ''
  if (key === 'default') return '默认灵基'
  if (key === 'a1' || key === 'ascension_1') return '第1阶段灵基'
  if (key === 'a3' || key === 'a2' || key === 'ascension_2') return '第3阶段灵基'
  if (key.startsWith('c')) return `灵衣「${name || key}」`
  return name || key
}

export function matchingForms(fn, svt) {
  if (!svt) return []
  return servantBondForms(svt).filter((form) => ceMatchesServant(fn, form.traitIds || []))
}

export function formatFormCondition(fn, servants = []) {
  const cond = formatTraitCondition(fn)
  const catalog = (servants || []).slice(0, 80)
  if (!catalog.length) return cond
  const onlyCostume = []
  const anyForm = []
  for (const svt of catalog) {
    const forms = servantBondForms(svt)
    const hits = forms.filter((form) => ceMatchesServant(fn, form.traitIds || []))
    if (!hits.length) continue
    const defaultHit = hits.some((form) => form.key === 'default' || form.key === 'a3')
    if (defaultHit) {
      if (anyForm.length < 4) anyForm.push(svt.name)
    } else {
      const clothes = hits.filter((form) => String(form.key || '').startsWith('c'))
      if (clothes.length && onlyCostume.length < 4) {
        onlyCostume.push(`${svt.name}（${clothes.map(formStateLabel).join('、')}）`)
      }
    }
  }
  const bits = [cond]
  if (anyForm.length) bits.push(`默认灵基即可吃到，例如${joinCn(anyForm)}`)
  if (onlyCostume.length) bits.push(`需要换成指定灵衣：${onlyCostume.join('；')}`)
  return bits.join('。')
}

export function formatPartyHits(fn, { slots = [], servants = [] } = {}) {
  const rows = []
  for (const slot of slots || []) {
    if (!slot || !slot.filled || !slot.svtId) continue
    const svt = (servants || []).find((item) => Number(item.id) === Number(slot.svtId))
    const traits = slot.traitIds && slot.traitIds.length ? slot.traitIds : (svt && svt.traitIds) || []
    const hit = ceMatchesServant(fn, traits)
    const formName = slot.formLabel || '默认灵基'
    const name = slot.label || (svt && svt.name) || `从者${slot.svtId}`
    if (slot.isSupport) {
      rows.push(`${slot.position}号助战 ${name}（${formName}）不拿羁绊`)
      continue
    }
    if (slot.bondMaxed) {
      rows.push(`${slot.position}号 ${name} 已满绊`)
      continue
    }
    rows.push(`${slot.position}号 ${name}（${formName}）${hit ? '可吃到' : '条件未对上'}`)
  }
  if (!rows.length) return '当前队伍还没有编入从者。'
  return `当前队伍：${rows.join('；')}。`
}

export function renderCeEffectArticle(effect, { slots = [], servants = [], isSupport = false } = {}) {
  const limit = formatLimitLabel(effect.condLimitCount)
  const value = formatEffectValue(effect, { isSupport })
  const cond = formatFormCondition(effect, servants)
  const scope = formatTargetScope(effect)
  const party = formatPartyHits(effect, { slots, servants })
  return `<article class="ce-fx" data-limit="${esc(limit)}">
    <h4>${esc(limit)} · ${esc(effect.name || '通关羁绊')}</h4>
    <p>${esc(value)}</p>
    <p>条件：${esc(cond)}</p>
    <p>作用对象：${esc(scope)}</p>
    <p class="ce-fx-mute">${esc(party)}</p>
  </article>`
}

export function renderCeEffectDetails(effects, opts = {}) {
  const rows = (effects || []).map((effect) => renderCeEffectArticle(effect, opts))
  if (!rows.length) {
    return `<section class="bonus-list"><p class="bonus-empty">快照里没有通关羁绊技能。从者羁绊礼装不提供编队羁绊。</p></section>`
  }
  return `<section class="ce-fx-list">${rows.join('')}</section>`
}
