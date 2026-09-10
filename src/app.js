import { calcParty } from './bond.js'
import {
  applyCraftEssences,
  attrLabel,
  classLabel,
  artsFromNiceWithForms,
  fetchServantNice,
  loadCes,
  passivesFromNice,
  loadServants,
  loadQuests,
  pickArt,
  searchByName,
  searchServantForms,
} from './atlas.js'
import { accountCeOf, accountServantOf, isBond15, isBondMaxed, parseAccountFile } from './account.js'
import { explainFormBonuses, recommendTeam } from './recommend.js'
import { costLimitFromMasterLv } from './master-cost.js'
import {
  availableDiffs,
  availableTrainClasses,
  findCascadeQuest,
  freeWars,
  GRAND_QUEST_CLASSES,
  QUEST_KINDS,
  questLimits,
  questDiffOf,
  questKindOf,
  questsInWar,
  questsOfKind,
  questSelectKey,
} from './game-data.js'
import {
  ATTR_OPTIONS,
  CLASS_OPTIONS,
  RARITY_OPTIONS,
  TRAIT_OPTIONS,
  ceMlbRate,
  emptyRosterFilter,
  filterServants,
  rankCesByBonus,
  rateLabel,
  rosterFilterActive,
  servantBonusRate,
  toggleFilterValue,
} from './filter.js'

const LUNCH = [
  { v: 0, t: '关' },
  { v: 0.02, t: '2%' },
  { v: 0.1, t: '满破 10%' },
]
const TEA_SELF = [
  { v: 0, t: '关' },
  { v: 0.01, t: '1%' },
  { v: 0.02, t: '2%' },
  { v: 0.03, t: '3%' },
  { v: 0.04, t: '4%' },
  { v: 0.05, t: '5%' },
]
const TEA_SUPPORT = [
  { v: 0, t: '关' },
  { v: 0.03, t: '3%' },
  { v: 0.06, t: '6%' },
  { v: 0.09, t: '9%' },
  { v: 0.12, t: '12%' },
  { v: 0.15, t: '15%' },
]
const HOLMES = [
  { v: 0, t: '关' },
  { v: 0.01, t: '1%' },
  { v: 0.05, t: '满破 5%' },
]
const COND = [
  { v: 0, t: '关' },
  { v: 0.04, t: '4%' },
  { v: 0.2, t: '满破 20%' },
]
const EVENT = [
  { v: 0, t: '关' },
  { v: 0.2, t: '+20%' },
  { v: 0.5, t: '+50%' },
]

function blankSlot(position, filled) {
  return {
    position,
    filled,
    isSupport: false,
    bond15: false,
    bondMaxed: false,
    lunch: 0,
    teaSelf: 0,
    supportTea: 0,
    holmes: 0,
    condCe: 0,
    eventPassive: 0,
    customPercent: 0,
    portrait: false,
    label: '',
    svtId: 0,
    face: '',
    className: '',
    attribute: '',
    traitIds: [],
    ceId: 0,
    ceMlb: true,
    isGrand: false,
    ceBondId: 0,
    ceRewardId: 0,
    ceBondMlb: true,
    ceRewardMlb: true,
    ceLines: [],
    ceMiss: '',
    svtQuery: '',
    ceQuery: '',
    svtArts: [],
    svtArtKey: '',
    svtImgOk: true,
    ceImgOk: true,
    formLabel: '默认灵基',
    ceBondQuery: '',
    ceRewardQuery: '',
    ceBondImgOk: true,
    ceRewardImgOk: true,
  }
}

const state = {
  base: '815',
  teapot: false,
  questId: '',
  questPhase: '1',
  questName: '',
  questAp: 0,
  questKind: '',
  questDiff: '',
  questWar: '',
  slots: [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position <= 3)),
  mode: 'free',
  account: null,
  data: {
    servants: [],
    ces: [],
    quests: [],
    status: '正在载入国服快照…',
    error: '',
  },
  recommend: null,
  allowSupport: true,
  bond15Aura: true,
  preferIds: [],
  lockIds: [],
  preferQuery: '',
  lockQuery: '',
  questType: 'normal',
  questClass: '',
  costLimit: '',
  costLocked: false,
  accountCost: 0,
  filter: emptyRosterFilter(),
}

function pct(n) {
  return `${Math.round(n * 1000) / 10}%`
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function caretPos(el) {
  try {
    if (typeof el.selectionStart === 'number') return el.selectionStart
  } catch {}
  return String(el.value || '').length
}

function restoreCaret(el, pos) {
  if (!el) return
  el.focus()
  const value = String(el.value || '')
  const next = Math.max(0, Math.min(typeof pos === 'number' ? pos : value.length, value.length))
  try {
    el.setSelectionRange(next, next)
  } catch {}
}

function options(list, current) {
  return list
    .map((item) => `<option value="${item.v}" ${Number(current) === item.v ? 'selected' : ''}>${item.t}</option>`)
    .join('')
}

function resultOf(position, output) {
  return output.results.find((item) => item.position === position)
}

function selectedSvt(slot) {
  return state.data.servants.find((svt) => svt.id === slot.svtId)
}

function selectedCe(slot) {
  return state.data.ces.find((ce) => ce.id === slot.ceId)
}

function ceById(id) {
  return state.data.ces.find((ce) => ce.id === id)
}

function slotSvtArt(slot, svt) {
  const hit = (slot.svtArts || []).find((item) => item.key === slot.svtArtKey)
  return (hit && hit.url) || (svt && svt.face) || slot.face || ''
}

function selectedArt(slot) {
  return (slot.svtArts || []).find((item) => item.key === slot.svtArtKey) || null
}

function applyArtToSlot(slot, svt, art) {
  if (art) {
    slot.svtArtKey = art.key
    if (art.traitIds && art.traitIds.length) slot.traitIds = art.traitIds
    else if (svt) slot.traitIds = svt.traitIds
    if (art.kind === 'costume') slot.formLabel = `灵衣 ${art.label}`
    else slot.formLabel = art.label || '默认灵基'
  } else if (svt) {
    slot.svtArtKey = ''
    slot.traitIds = svt.traitIds
    slot.formLabel = '默认灵基'
  }
  slot.svtImgOk = true
}

function renderArt(slot, svt, ce) {
  const bond = slot.isGrand && !slot.isSupport ? ceById(slot.ceBondId) : null
  const reward = slot.isGrand ? ceById(slot.ceRewardId) : null
  if (!svt && !ce && !bond && !reward) {
    return slot.isSupport ? `<div class="art"><div class="art-fallback">助战</div></div>` : ''
  }
  const svtUrl = svt && slot.svtImgOk !== false ? slotSvtArt(slot, svt) : ''
  const svtNode = svt
    ? svtUrl
      ? `<img class="portrait" src="${esc(svtUrl)}" alt="${esc(svt.name)}" data-img="svt" />`
      : `<div class="art-fallback">${esc(svt.name)}</div>`
    : slot.isSupport
      ? `<div class="art-fallback">助战</div>`
      : ''
  const arts = slot.svtArts || []
  const picker =
    svt && arts.length > 1
      ? `<label class="art-pick">灵基 / 灵衣<select data-art="1">${arts
          .map(
            (item) =>
              `<option value="${esc(item.key)}" ${item.key === slot.svtArtKey ? 'selected' : ''}>${esc(item.label)}</option>`,
          )
          .join('')}</select></label>`
      : ''
  return `<div class="art">${svtNode}${ceThumb(ce, slot.ceImgOk, 'ce')}${ceThumb(bond, slot.ceBondImgOk, 'ce-bond')}${ceThumb(reward, slot.ceRewardImgOk, 'ce-reward')}</div>${picker}`
}

function ceThumb(ce, ok, kind) {
  if (!ce) return ''
  const url = ok !== false ? ce.face : ''
  if (url) return `<img class="ce-art ${kind}" src="${esc(url)}" alt="${esc(ce.name)}" data-img="${kind}" />`
  return `<span class="ce-fallback ${kind}">${esc(ce.name)}</span>`
}

function ownedServants() {
  if (!state.account) return []
  const ids = new Set(state.account.servants.map((item) => item.id))
  return state.data.servants.filter((svt) => ids.has(svt.id))
}

function ownedCes() {
  if (!state.account) return []
  const ids = new Set(state.account.ces.map((item) => item.id))
  return state.data.ces.filter((ce) => ids.has(ce.id))
}

function servantPool(slot) {
  if (state.mode === 'account' && !slot.isSupport) return ownedServants()
  return state.data.servants
}

function cePool(slot) {
  if (state.mode === 'account' && !slot.isSupport) return ownedCes()
  return state.data.ces
}

function suggestSvt(slot) {
  const pool = filterServants(servantPool(slot), state.filter)
  const hits = searchServantForms(pool, slot.svtQuery)
  return hits.slice().sort(
    (a, b) =>
      (b.score || 0) - (a.score || 0) ||
      servantBonusRate(b, state.data.ces) - servantBonusRate(a, state.data.ces) ||
      a.collectionNo - b.collectionNo,
  )
}

function suggestCe(slot, query) {
  return rankCesByBonus(searchByName(cePool(slot), query, (ce) => `${ce.collectionNo} ${ce.name}`)).slice(0, 12)
}

function aliasHint(item, query) {
  if (item.formLabel) return ` · 灵衣 ${esc(item.formLabel)}`
  const q = String(query || '').trim().toLowerCase()
  if (!q) return ''
  const hit = (item.aliases || []).find((name) => String(name).toLowerCase().includes(q))
  if (!hit) return ''
  if (String(item.name).toLowerCase().includes(q)) return ''
  return ` · ${esc(hit)}`
}

function bonusHint(item) {
  const rate = servantBonusRate(item, state.data.ces)
  const text = rateLabel(rate)
  return text ? ` · 最高 ${text}` : ''
}

function ceRateHint(ce) {
  const text = rateLabel(ceMlbRate(ce))
  return text ? ` · ${text}` : ''
}

function accountLine() {
  if (state.account) {
    const src = state.account.source === 'dump' ? '登录回包' : 'Chaldea'
    const lv = state.account.masterLv ? ` 御主 Lv.${state.account.masterLv}。` : ''
    return `已导入${src}：${state.account.servants.length} 名从者，${state.account.ces.length} 张礼装。${lv}`
  }
  if (state.mode === 'account') return '账号配队：请导入 Chaldea userdata.json 或登录回包 PHP。'
  return '自由配队：可从完整图鉴搜索。'
}

function recPool() {
  return state.mode === 'account' ? ownedServants() : state.data.servants
}

function recChips(kind, ids) {
  return ids
    .map((id) => state.data.servants.find((svt) => svt.id === id))
    .filter(Boolean)
    .map(
      (svt) =>
        `<button type="button" class="chip" data-rec-remove="${kind}" data-id="${svt.id}">${esc(svt.name)}</button>`,
    )
    .join('')
}

function recSuggest(kind, query, ids) {
  const q = String(query || '').trim()
  const pool = filterServants(recPool(), state.filter)
  if (!q) return ''
  const items = searchServantForms(pool, q)
    .filter((item) => !ids.includes(item.id))
    .slice(0, 24)
  if (!items.length) return ''
  return `<div class="suggest rec-suggest">${items
    .map(
      (item) =>
        `<button type="button" class="suggest-item" data-rec-add="${kind}" data-id="${item.id}"><img src="${esc(item.face)}" alt="${esc(item.name)}" data-img="suggest" /><span>${esc(item.collectionNo)}. ${esc(item.name)}${aliasHint(item, q)}${bonusHint(item)}</span></button>`,
    )
    .join('')}</div>`
}

function selectOptions(items, selected, empty) {
  return `<option value="">${esc(empty)}</option>${items
    .map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`)
    .join('')}`
}

function questOptionItems(quests) {
  return (quests || []).map((quest) => [
    questSelectKey(quest),
    `${quest.display || quest.name} · ${quest.ap}AP · 羁绊 ${quest.bond}`,
  ])
}

function questSelectHtml() {
  const kind = state.questKind
  const list = state.data.quests || []
  const parts = [`<select id="questKind">${selectOptions(QUEST_KINDS, kind, '选择种类')}</select>`]
  if (kind === 'train') {
    const classes = availableTrainClasses(list)
    const diffs = availableDiffs(list, 'train', state.questClass).map((diff) => [diff, diff])
    parts.push(`<select id="questClassPick">${selectOptions(classes, state.questClass, '职阶')}</select>`)
    parts.push(`<select id="questDiff">${selectOptions(diffs, state.questDiff, '难度')}</select>`)
  } else if (kind === 'vault') {
    const diffs = availableDiffs(list, 'vault').map((diff) => [diff, diff])
    parts.push(`<select id="questDiff">${selectOptions(diffs, state.questDiff, '难度')}</select>`)
  } else if (kind === 'grand') {
    parts.push(`<select id="questClassPick">${selectOptions(GRAND_QUEST_CLASSES, state.questClass, '职阶')}</select>`)
  } else if (kind === 'daily') {
    const selected = state.questId ? `${state.questId}:${state.questPhase}` : ''
    parts.push(`<select id="questPick">${selectOptions(questOptionItems(questsOfKind(list, 'daily')), selected, '关卡')}</select>`)
  } else if (kind === 'free') {
    const wars = freeWars(list).map((war) => [war, war])
    const selected = state.questId ? `${state.questId}:${state.questPhase}` : ''
    parts.push(`<select id="questWar">${selectOptions(wars, state.questWar, '章节')}</select>`)
    if (state.questWar) {
      parts.push(`<select id="questPick">${selectOptions(questOptionItems(questsInWar(list, state.questWar)), selected, '关卡')}</select>`)
    }
  }
  return `<div class="quest-cascade">${parts.join('')}</div>`
}

function applyPickedQuest(quest) {
  const limits = questLimits(quest)
  state.questId = String(quest.id)
  state.questPhase = String(quest.phase)
  state.questName = quest.display || quest.name
  state.questAp = Number(quest.ap) || 0
  state.base = String(quest.bond || 0)
  state.questType = limits.questType
  state.questClass = limits.questClass
  state.questKind = questKindOf(quest)
  state.questDiff = questDiffOf(quest)
  state.questWar = state.questKind === 'free' ? String(quest.war || '自由本').replace(/\s+/g, ' ') : ''
  state.recommend = null
  state.data.error = ''
}

function tryApplyCascade() {
  const quest = findCascadeQuest(state.data.quests, {
    kind: state.questKind,
    questClass: state.questClass,
    diff: state.questDiff,
  })
  if (quest) {
    applyPickedQuest(quest)
    return
  }
  state.questId = ''
  state.questName = ''
  state.questAp = 0
}

function questPickedLine() {
  if (!state.questName) return '先选种类，再选职阶或难度；羁绊和职阶限制跟着关卡走'
  const type = state.questType === 'grand' ? '冠位战' : '普通本'
  const cls = state.questClass ? classLabel(state.questClass) : '全部职阶'
  const ap = state.questAp ? ` · ${state.questAp}AP` : ''
  return `${state.questName}${ap} · ${type} · ${cls}`
}

function costLockLabel() {
  if (state.accountCost) {
    const lv = state.account && state.account.masterLv ? `御主 Lv.${state.account.masterLv}，` : ''
    return `按账号锁定（${lv}COST ${state.accountCost}）`
  }
  return '按账号锁定（导入登录回包后可用）'
}

function applyAccountCost(parsed) {
  if (parsed && parsed.masterLv) {
    state.accountCost = costLimitFromMasterLv(parsed.masterLv)
    state.costLocked = true
    state.costLimit = String(state.accountCost)
    return
  }
  state.accountCost = 0
  state.costLocked = false
}

function costInputBad() {
  return Boolean(state.recommend && !state.recommend.ok && /COST/.test(state.recommend.error || ''))
}

function recAltList(rec) {
  const plans = rec.plans || []
  if (plans.length < 2) return ''
  return recAltButtons(plans, Number.isInteger(rec.chosen) ? rec.chosen : 0)
}

function planCeNames(plan) {
  const names = []
  for (const slot of plan.slots || []) {
    if (!slot.filled) continue
    for (const id of [slot.ceId, slot.ceBondId, slot.ceRewardId]) {
      const ce = ceById(id)
      if (ce) names.push(slot.isSupport ? `${ce.name}（助战）` : ce.name)
    }
  }
  return names.join('、')
}

function slotNameWithForm(slot) {
  const name = slot.label || ''
  const form = slot.formLabel || ''
  if (!form || form === '默认灵基') return name
  return `${name}（${form}）`
}

function recAltButtons(plans, chosen) {
  return `<div class="rec-alts"><p>共 ${plans.length} 套解，点选切换。已按总羁绊从高到低。</p>${plans
    .map((plan, index) => {
      const own = (plan.slots || []).filter((slot) => slot.filled && !slot.isSupport)
      const empty = (plan.slots || []).filter((slot) => !slot.filled).length
      const prefer = plan.preferBond ? `练度 ${plan.preferBond} · ` : ''
      const names = own.map((slot) => slotNameWithForm(slot)).join('、')
      const grand = (plan.slots || []).find((slot) => slot.isGrand && slot.filled && !slot.isSupport)
      const grandText = grand ? ` · 冠位 ${grand.label || ''}` : ''
      const ceNames = planCeNames(plan)
      return `<button type="button" class="rec-alt ${index === chosen ? 'active' : ''}" data-rec-plan="${index}">
        <strong>${own.length}人 · COST ${plan.costUsed} · ${prefer}总羁绊 ${plan.total}${empty ? ` · 空槽 ${empty}` : ''}${plan.useSupport ? ' · 助战' : ''}${grandText}</strong>
        <span>${esc(names)}${ceNames ? ` · ${ceNames}` : ''}</span>
      </button>`
    })
    .join('')}</div>`
}

function parseFilterValue(key, raw) {
  if (key === 'rarity' || key === 'trait') return Number(raw)
  return raw
}

function filterChip(group, key, value, label) {
  const on =
    key === 'rarity' || key === 'trait'
      ? (group.options || []).some((item) => Number(item) === Number(value))
      : group.options.includes(value)
  return `<button type="button" class="chip ${on ? 'active' : ''}" data-filter="${key}" data-value="${esc(value)}">${esc(label)}</button>`
}

function filterRow(title, key, items, group, extra) {
  return `<div class="filter-row">
    <span class="filter-label">${title}</span>
    <button type="button" class="chip ${group.invert ? '' : 'active'}" data-filter-invert="${key}" data-on="0">显示</button>
    <button type="button" class="chip ${group.invert ? 'active' : ''}" data-filter-invert="${key}" data-on="1">屏蔽</button>
    ${extra || ''}
    ${items.map(([value, label]) => filterChip(group, key, value, label)).join('')}
  </div>`
}

function filterNowLine() {
  const f = state.filter
  if (!rosterFilterActive(f)) return ''
  const classMap = Object.fromEntries(CLASS_OPTIONS)
  const attrMap = Object.fromEntries(ATTR_OPTIONS)
  const traitMap = Object.fromEntries(TRAIT_OPTIONS.map((item) => [item.id, item.name]))
  const parts = []
  const tag = (group) => (group.invert ? '屏蔽' : '只看')
  if (f.svtClass.options.length) {
    parts.push(`${tag(f.svtClass)}职阶 ${f.svtClass.options.map((cls) => classMap[cls] || cls).join(' ')}`)
  }
  if (f.rarity.options.length) {
    const stars = f.rarity.options.map(Number).sort((a, b) => a - b).map((n) => `${n}星`)
    parts.push(`${tag(f.rarity)} ${stars.join(' ')}`)
  }
  if (f.attribute.options.length) {
    parts.push(`${tag(f.attribute)}属性 ${f.attribute.options.map((key) => attrMap[key] || key).join(' ')}`)
  }
  if (f.trait.options.length) {
    parts.push(`${tag(f.trait)}特性 ${f.trait.options.map((id) => traitMap[id] || traitMap[Number(id)] || id).join(' ')}`)
  }
  if (!parts.length) return ''
  return `<p class="filter-now">当前：${esc(parts.join('；'))}。改完请再点一键推荐。</p>`
}

function filterPanel() {
  const f = state.filter
  const allChip = `<button type="button" class="chip ${f.trait.matchAll ? 'active' : ''}" data-filter-all="trait">全中</button>`
  return `<section class="filter-panel">
    <div class="filter-head">
      <strong>筛选</strong>
      <span>显示=只看命中的人；屏蔽=去掉命中的人。搜索和一键推荐都生效。</span>
      <button type="button" id="filterReset">清空</button>
    </div>
    ${filterRow('职阶', 'svtClass', CLASS_OPTIONS, f.svtClass)}
    ${filterRow('星级', 'rarity', RARITY_OPTIONS.map((n) => [n, `${n}星`]), f.rarity)}
    ${filterRow('属性', 'attribute', ATTR_OPTIONS, f.attribute)}
    ${filterRow('特性', 'trait', TRAIT_OPTIONS.map((item) => [item.id, item.name]), f.trait, allChip)}
    ${filterNowLine()}
  </section>`
}

function recSetup() {
  return `<section class="rec-setup">
    ${filterPanel()}
    <div class="rec-quest">
      <div>
        <label>关卡</label>
        ${questSelectHtml()}
        <p class="quest-picked">${esc(questPickedLine())}</p>
      </div>
      <div>
        <label>关卡基础羁绊</label>
        <input id="base" class="num" inputmode="numeric" pattern="[0-9]*" value="${esc(state.base)}" />
      </div>
      <div>
        <label>COST（选填，只在该值以内取羁绊最高）</label>
        <div class="quest-row cost-row">
          <input id="costLimit" class="num${costInputBad() ? ' bad' : ''}" inputmode="numeric" pattern="[0-9]*" value="${esc(state.costLimit)}" placeholder="空=不设上限" ${state.costLocked ? 'disabled' : ''} />
          <label class="check">
            <input id="costLocked" type="checkbox" ${state.costLocked ? 'checked' : ''} ${state.accountCost ? '' : 'disabled'} />
            <span>${esc(costLockLabel())}</span>
          </label>
        </div>
        <button id="recommendNow" type="button" class="rec-now">一键推荐配队</button>
      </div>
    </div>
    <label class="check"><input id="allowSupport" type="checkbox" ${state.allowSupport ? 'checked' : ''} /><span>留助战位（后排只给礼装，不算助战从者）</span></label>
    <label class="check"><input id="bond15Aura" type="checkbox" ${state.bond15Aura ? 'checked' : ''} /><span>15绊光环（梦火之导，可叠 +25%）</span></label>
    <div class="rec-picker">
      <label>练度从者（总羁绊拉满后再尽量拿满，可多名）</label>
      <div class="chips">${recChips('prefer', state.preferIds)}</div>
      <input id="preferQuery" type="text" value="${esc(state.preferQuery)}" placeholder="搜外号 / 名字，如 呆毛、C狐" />
      ${recSuggest('prefer', state.preferQuery, state.preferIds)}
    </div>
    <div class="rec-picker">
      <label>锁定从者（必须上场，其余仍按总羁绊拉满）</label>
      <div class="chips">${recChips('lock', state.lockIds)}</div>
      <input id="lockQuery" type="text" value="${esc(state.lockQuery)}" placeholder="搜外号 / 名字" />
      ${recSuggest('lock', state.lockQuery, state.lockIds)}
    </div>
  </section>`
}

function recommendPanel(slots, output) {
  const rec = state.recommend
  if (!rec) return ''
  if (!rec.ok) return `<div class="case error">${esc(rec.error)}</div>`
  const rows = slots
    .filter((slot) => slot.filled)
    .map((slot) => {
      const result = output.results.find((item) => item.position === slot.position)
      return explainFormBonuses(slot, slots, state.data.ces, result)
    })
  const alts = recAltList(rec)
  return `<section class="recommend">${alts}<p>${esc(rec.summary)}</p><div class="explain-grid">${rows
    .map((row) => {
      const hits = row.hits.map((line) => `${esc(line.label)} +${pct(line.pct)}`).join(' · ')
      const miss = row.misses.map((text) => `<div class="reason">${esc(text)}</div>`).join('')
      const score = row.final ? String(row.final) : '不拿羁绊'
      return `<article class="explain-card"><strong>${esc(row.title)}</strong><div class="final">${esc(score)}</div><div>${hits || '无百分比加成'}</div>${miss}</article>`
    })
    .join('')}</div></section>`
}

function renderSuggest(items, kind, slot, ceField) {
  if (!items.length) return ''
  return `<div class="suggest" data-kind="${kind}">${items
    .map((item) => {
      if (kind === 'svt') {
        const rec = accountServantOf(state.account, item.id)
        const bond = rec ? (rec.bondLv >= 15 ? ' · 15绊' : ` · 绊${rec.bondLv}`) : ''
        return `<button type="button" class="suggest-item" data-svt="${item.id}" data-art="${esc(item.artKey || '')}">
          <img src="${esc(item.face)}" alt="${esc(item.name)}" data-img="suggest" />
          <span>${esc(item.collectionNo)}. ${esc(item.name)} · ${classLabel(item.className)}${attrLabel(item.attribute)}${bond}${aliasHint(item, slot.svtQuery)}${bonusHint(item)}</span>
        </button>`
      }
      return `<button type="button" class="suggest-item" data-ce="${item.id}" data-ce-field="${esc(ceField || 'ceId')}">
        <img src="${esc(item.face || '')}" alt="${esc(item.name)}" data-img="suggest" />
        <span>${esc(item.collectionNo)}. ${esc(item.name)}${ceRateHint(item)}</span>
      </button>`
    })
    .join('')}</div>`
}

function ceSearchBox(slot, field, queryKey, label, placeholder, current) {
  const query = slot[queryKey] || ''
  return `<div class="search">
        <label>${label}</label>
        <input data-q="${queryKey}" type="text" placeholder="${placeholder}" value="${esc(query || (current ? current.name : ''))}" />
        ${query ? renderSuggest(suggestCe(slot, query), 'ce', slot, field) : ''}
      </div>`
}

function renderCard(slot, output) {
  const res = resultOf(slot.position, output)
  const teaList = slot.isSupport ? TEA_SUPPORT : TEA_SELF
  const teaValue = slot.isSupport ? slot.supportTea : slot.teaSelf
  const teaField = slot.isSupport ? 'supportTea' : 'teaSelf'
  const finalText = !slot.filled ? '—' : output.ok && res ? String(res.final) : '—'
  const svt = selectedSvt(slot)
  const ce = selectedCe(slot)
  const lines =
    slot.filled && res && res.eligible
      ? res.lines.map((line) => `<div><span>${esc(line.label)}</span><span>+${pct(line.pct)}</span></div>`).join('') +
        `<div><span>两段乘算</span><span>前排后 ${res.afterFront} / 第二层后 ${res.afterRate} / 肖像 ${res.flat} / 乘茶壶前 ${res.beforeTeapot}</span></div>`
      : ''

  return `
    <article class="card ${slot.filled ? '' : 'off'}${slot.isGrand ? ' grand' : ''}" data-pos="${slot.position}">
      <div class="card-head">
        <div class="identity">
          <div class="pos">0${slot.position}</div>
          ${slot.isGrand ? '<span class="grand-tag">冠位</span>' : ''}
        </div>
        <div class="final"><small>最终羁绊</small>${finalText}</div>
      </div>
      ${renderArt(slot, svt, ce)}
      ${
        slot.isSupport
          ? `<div class="meta">助战位 · 只给助战礼装，不拿羁绊</div>`
          : `<div class="search">
        <label>从者（Atlas）</label>
        <input data-q="svtQuery" type="text" placeholder="${state.mode === 'account' ? '搜持有从者：编号 / 名字 / 外号' : '搜编号、名字或外号'}" value="${esc(slot.svtQuery || (svt ? svt.name : ''))}" />
        ${slot.svtQuery ? renderSuggest(suggestSvt(slot), 'svt', slot) : ''}
      </div>`
      }
      ${ceSearchBox(
        slot,
        'ceId',
        'ceQuery',
        slot.isSupport
          ? slot.isGrand
            ? '助战普通礼装'
            : '助战礼装'
          : slot.isGrand || state.questType === 'grand'
            ? '普通礼装（占 COST）'
            : '羁绊礼装（Atlas）',
        '搜午餐 / 午茶 / 职阶礼装',
        ce,
      )}
      ${slot.isGrand && !slot.isSupport ? ceSearchBox(slot, 'ceBondId', 'ceBondQuery', '羁绊礼装（该从者10绊礼装，通关羁绊不加）', '搜该从者羁绊礼装', ceById(slot.ceBondId)) : ''}
      ${slot.isGrand ? ceSearchBox(slot, 'ceRewardId', 'ceRewardQuery', slot.isSupport ? '助战报酬礼装（免费）' : '报酬礼装（午餐/午茶/20%，免费）', '搜报酬礼装', ceById(slot.ceRewardId)) : ''}
      <div class="toggles">
        <label class="check"><input data-k="filled" type="checkbox" ${slot.filled ? 'checked' : ''} /><span>上场</span></label>
        <label class="check"><input data-k="isSupport" type="checkbox" ${slot.isSupport ? 'checked' : ''} /><span>助战</span></label>
        ${slot.isSupport ? '' : `<label class="check"><input data-k="bond15" type="checkbox" ${slot.bond15 ? 'checked' : ''} /><span>15绊</span></label>`}
        <label class="check"><input data-k="ceMlb" type="checkbox" ${slot.ceMlb ? 'checked' : ''} /><span>礼装满破</span></label>
        ${slot.isSupport ? '' : `<label class="check"><input data-k="portrait" type="checkbox" ${slot.portrait ? 'checked' : ''} /><span>肖像 +50</span></label>`}
      </div>
      ${!slot.isSupport && svt ? `<div class="meta">${classLabel(svt.className)} · ${attrLabel(svt.attribute)} · ${svt.rarity}星${selectedArt(slot) && selectedArt(slot).kind === 'costume' ? ` · 灵衣 ${esc(selectedArt(slot).label)}` : selectedArt(slot) && selectedArt(slot).kind === 'ascension' ? ` · ${esc(selectedArt(slot).label)}` : ''}</div>` : ''}
      ${slot.ceMiss ? `<div class="reason">${esc(slot.ceMiss)}</div>` : ''}
      <details class="manual">
        <summary>手填加成</summary>
        <div class="grid">
          <div><label>午餐</label><select data-k="lunch">${options(LUNCH, slot.lunch)}</select></div>
          <div><label>午茶</label><select data-k="${teaField}">${options(teaList, teaValue)}</select></div>
          <div><label>芙尔摩斯</label><select data-k="holmes">${options(HOLMES, slot.holmes)}</select></div>
          <div><label>条件礼装</label><select data-k="condCe">${options(COND, slot.condCe)}</select></div>
          <div><label>活动被动</label><select data-k="eventPassive">${options(EVENT, slot.eventPassive)}</select></div>
          <div><label>自定义 %</label><input data-k="customPercent" class="num" inputmode="numeric" pattern="[0-9]*" value="${Math.round((Number(slot.customPercent) || 0) * 100)}" /></div>
        </div>
      </details>
      ${res && !res.eligible && slot.filled ? `<div class="reason">${res.reasonText}</div>` : ''}
      ${lines ? `<div class="lines">${lines}</div>` : ''}
    </article>
  `
}

function parseBase(raw) {
  if (raw === '' || raw === null) return NaN
  if (!/^\d+$/.test(String(raw))) return Number(raw)
  return Number(raw)
}

function preparedSlots() {
  const slots = state.slots.map((slot) => ({ ...slot, ceLines: [] }))
  applyCraftEssences(slots, state.data.ces)
  return slots
}

function syncGrandSlots() {
  for (const slot of state.slots) slot.isGrand = false
  if (state.questType !== 'grand') return
  const hit =
    state.slots.find((slot) => slot.filled && !slot.isSupport && slot.position <= 3) ||
    state.slots.find((slot) => !slot.isSupport && slot.position <= 3)
  if (hit) hit.isGrand = true
  const support = state.slots.find((slot) => slot.isSupport)
  if (support) support.isGrand = true
}

async function runRecommend() {
  const plan = recommendTeam({
    base: parseBase(state.base),
    teapot: state.teapot,
    servants: state.data.servants,
    ces: state.data.ces,
    account: state.account,
    mode: state.mode,
    allowSupport: state.allowSupport,
    preferSvtIds: state.preferIds,
    lockSvtIds: state.lockIds,
    questType: state.questType,
    questClass: state.questClass,
    costLimit: parseBase(state.costLimit),
    filter: state.filter,
    bond15Aura: state.bond15Aura,
  })
  state.recommend = plan
  if (!plan.ok) {
    render()
    const costEl = document.getElementById('costLimit')
    if (costEl && /COST/.test(plan.error || '')) costEl.focus()
    return
  }
  await applyRecommendPlan(plan, plan.plans || [plan], plan.chosen || 0)
}

async function applyRecommendPlan(plan, plans, chosen) {
  state.recommend = { ...plan, ok: true, plans, chosen }
  state.slots = plan.slots.map((slot, index) => ({
    ...blankSlot(index + 1, slot.filled),
    ...slot,
  }))
  render()
  const panel = document.querySelector('.recommend')
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  await Promise.all(
    state.slots.map(async (slot) => {
      if (!slot.svtId) return
      const svt = state.data.servants.find((item) => item.id === slot.svtId)
      if (!svt) return
      const nice = await fetchServantNice(svt.id)
      if (!nice || slot.svtId !== svt.id) return
      slot.svtArts = artsFromNiceWithForms(nice, svt.forms)
      applyArtToSlot(slot, svt, pickArt(slot.svtArts, slot.svtArtKey || ''))
    }),
  )
  render()
}

function render() {
  syncGrandSlots()
  const slots = preparedSlots()
  const base = parseBase(state.base)
  const output = calcParty(base, state.teapot, slots, { bond15Aura: state.bond15Aura })
  const app = document.getElementById('app')
  const front = slots.filter((s) => s.position <= 3)
  const back = slots.filter((s) => s.position > 3)
  const dataLine = state.data.error || state.data.status
  const recError = state.recommend && !state.recommend.ok ? state.recommend.error : ''

  app.innerHTML = `
    <header>
      <div>
        <h1>通关羁绊</h1>
        <p class="sub">前排先乘 · 礼装活动15绊再乘 · 肖像最后加 · 茶壶 ×2</p>
      </div>
      <div class="seal">公式<br />已锁定</div>
    </header>
    <section class="controls">
      <div class="toggles">
        <button class="teapot ${state.teapot ? 'active' : ''}" id="teapot">${state.teapot ? '茶壶 ×2 开' : '茶壶关闭'}</button>
        <button id="sample" type="button">填入手算样例 1320</button>
        <button id="reset" type="button">重置编队</button>
        <button id="recommend" type="button">一键推荐</button>
      </div>
    </section>
    <section class="mode">
        <button type="button" id="modeFree" class="${state.mode === 'free' ? 'active' : ''}">自由配队</button>
        <button type="button" id="modeAccount" class="${state.mode === 'account' ? 'active' : ''}">账号配队</button>
        <label class="file">导入 Chaldea JSON / 登录回包 PHP<input id="accountFile" type="file" accept=".json,.php,.txt,application/json,application/octet-stream,text/plain" /></label>
      </section>
    ${recSetup()}
    <div class="case ${output.ok && !state.data.error && !recError ? '' : 'error'}">${esc(recError || output.caseText)} ${esc(accountLine())} ${esc(dataLine)}${state.questName ? ` 关卡：${esc(state.questName)}` : ''}</div>
    ${recommendPanel(slots, output)}
    <p class="row-title">前排</p>
    <section class="row">${front.map((slot) => renderCard(slot, output)).join('')}</section>
    <p class="row-title">后排</p>
    <section class="row back">${back.map((slot) => renderCard(slot, output)).join('')}</section>
    <p class="formula">
      最终羁绊 = (floor(floor(基础 × (1 + 前排)) × (1 + Σ礼装活动15绊)) + 固定值) × 茶壶<br />
      图鉴用仓库国服快照；单从者形态图仍向 Atlas 请求。账号文件只留在浏览器。推荐列出帕累托方案，总羁绊最高的放最上面；填了 COST 只在该值以内取羁绊最高。午餐/午茶/福尔摩斯按数据是全队光环。前排单独先乘一层；礼装、活动被动、15绊在第二层加算后乘。
      <br />冠位战冠位槽 3 礼装，后两格免费不占 COST；Extra I/II 冠位栏只上 1 骑。
    </p>
  `

  bind(app)
}

function bindFilter(app) {
  const reset = document.getElementById('filterReset')
  if (reset) {
    reset.addEventListener('click', () => {
      state.filter = emptyRosterFilter()
      render()
    })
  }
  app.querySelectorAll('[data-filter]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.filter
      const group = state.filter[key]
      if (!group) return
      toggleFilterValue(group, parseFilterValue(key, el.dataset.value))
      render()
    })
  })
  app.querySelectorAll('[data-filter-invert]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.filterInvert
      const group = state.filter[key]
      if (!group) return
      group.invert = el.dataset.on === '1'
      render()
    })
  })
  app.querySelectorAll('[data-filter-all]').forEach((el) => {
    el.addEventListener('click', () => {
      const key = el.dataset.filterAll
      const group = state.filter[key]
      if (!group) return
      group.matchAll = !group.matchAll
      render()
    })
  })
}

function bind(app) {
  bindFilter(app)
  const allowEl = document.getElementById('allowSupport')
  if (allowEl) {
    allowEl.addEventListener('change', () => {
      state.allowSupport = allowEl.checked
    })
  }
  const auraEl = document.getElementById('bond15Aura')
  if (auraEl) {
    auraEl.addEventListener('change', () => {
      state.bond15Aura = auraEl.checked
      render()
    })
  }
  const costEl = document.getElementById('costLimit')
  if (costEl) {
    costEl.addEventListener('input', (event) => {
      const start = caretPos(event.target)
      state.costLimit = event.target.value
      render()
      restoreCaret(document.getElementById('costLimit'), start)
    })
  }
  const costLockEl = document.getElementById('costLocked')
  if (costLockEl) {
    costLockEl.addEventListener('change', () => {
      if (!state.accountCost) {
        state.costLocked = false
        render()
        return
      }
      state.costLocked = costLockEl.checked
      if (state.costLocked) state.costLimit = String(state.accountCost)
      render()
    })
  }
  ;['prefer', 'lock'].forEach((kind) => {
    const key = `${kind}Query`
    const input = document.getElementById(key)
    if (input) {
      input.addEventListener('input', (event) => {
        const start = caretPos(event.target)
        state[key] = event.target.value
        render()
        restoreCaret(document.getElementById(key), start)
      })
    }
  })
  app.querySelectorAll('[data-rec-add]').forEach((el) => {
    el.addEventListener('click', () => {
      const kind = el.dataset.recAdd
      const id = Number(el.dataset.id)
      const ids = kind === 'prefer' ? state.preferIds : state.lockIds
      if (ids.includes(id) || ids.length >= 5) return
      ids.push(id)
      if (kind === 'prefer') state.preferQuery = ''
      else state.lockQuery = ''
      render()
    })
  })
  app.querySelectorAll('[data-rec-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      const kind = el.dataset.recRemove
      const id = Number(el.dataset.id)
      if (kind === 'prefer') state.preferIds = state.preferIds.filter((item) => item !== id)
      else state.lockIds = state.lockIds.filter((item) => item !== id)
      render()
    })
  })
  app.querySelectorAll('[data-rec-plan]').forEach((el) => {
    el.addEventListener('click', () => {
      const rec = state.recommend
      if (!rec || !rec.ok || !rec.plans) return
      const index = Number(el.dataset.recPlan)
      const plan = rec.plans[index]
      if (!plan) return
      applyRecommendPlan(plan, rec.plans, index)
    })
  })
  document.getElementById('modeFree').addEventListener('click', () => {
    state.mode = 'free'
    render()
  })
  document.getElementById('modeAccount').addEventListener('click', () => {
    state.mode = 'account'
    render()
  })
  document.getElementById('accountFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    const parsed = await parseAccountFile(new Uint8Array(await file.arrayBuffer()))
    if (!parsed.ok) {
      state.account = null
      state.accountCost = 0
      state.costLocked = false
      state.data.error = parsed.error
    } else {
      state.account = parsed
      state.mode = 'account'
      state.data.error = ''
      applyAccountCost(parsed)
    }
    render()
  })
  const baseEl = document.getElementById('base')
  if (baseEl) {
    baseEl.addEventListener('input', (event) => {
      const start = caretPos(event.target)
      state.base = event.target.value
      render()
      restoreCaret(document.getElementById('base'), start)
    })
  }
  document.getElementById('teapot').addEventListener('click', () => {
    state.teapot = !state.teapot
    render()
  })
  document.getElementById('sample').addEventListener('click', () => {
    state.base = '815'
    state.teapot = false
    state.slots = [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position === 1))
    state.slots[0].lunch = 0.1
    state.slots[0].teaSelf = 0.05
    state.slots[0].condCe = 0.2
    render()
  })
  document.getElementById('reset').addEventListener('click', () => {
    state.slots = [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position <= 3))
    state.recommend = null
    render()
  })
  document.getElementById('recommend').addEventListener('click', async () => {
    runRecommend()
  })
  const recNow = document.getElementById('recommendNow')
  if (recNow) recNow.addEventListener('click', () => runRecommend())
  const questKindEl = document.getElementById('questKind')
  if (questKindEl) {
    questKindEl.addEventListener('change', () => {
      state.questKind = questKindEl.value
      state.questClass = ''
      state.questDiff = ''
      state.questWar = ''
      state.questId = ''
      state.questName = ''
      state.questAp = 0
      state.questType = state.questKind === 'grand' ? 'grand' : 'normal'
      state.recommend = null
      render()
    })
  }
  const questClassPickEl = document.getElementById('questClassPick')
  if (questClassPickEl) {
    questClassPickEl.addEventListener('change', () => {
      state.questClass = questClassPickEl.value
      if (state.questKind === 'train') {
        const diffs = availableDiffs(state.data.quests, 'train', state.questClass)
        if (!diffs.includes(state.questDiff)) state.questDiff = ''
      }
      tryApplyCascade()
      render()
    })
  }
  const questDiffEl = document.getElementById('questDiff')
  if (questDiffEl) {
    questDiffEl.addEventListener('change', () => {
      state.questDiff = questDiffEl.value
      tryApplyCascade()
      render()
    })
  }
  const questWarEl = document.getElementById('questWar')
  if (questWarEl) {
    questWarEl.addEventListener('change', () => {
      state.questWar = questWarEl.value
      state.questId = ''
      state.questName = ''
      state.questAp = 0
      render()
    })
  }
  const questPickEl = document.getElementById('questPick')
  if (questPickEl) {
    questPickEl.addEventListener('change', () => {
      const key = questPickEl.value
      if (!key) {
        state.questId = ''
        state.questName = ''
        state.questAp = 0
        render()
        return
      }
      const quest = findCascadeQuest(state.data.quests, { kind: state.questKind, key })
      if (!quest) return
      applyPickedQuest(quest)
      render()
    })
  }

  app.querySelectorAll('.card').forEach((card) => {
    const pos = Number(card.dataset.pos)
    const slot = state.slots[pos - 1]

    card.querySelectorAll('[data-q]').forEach((el) => {
      el.addEventListener('input', (event) => {
        const start = caretPos(event.target)
        slot[el.dataset.q] = event.target.value
        if (el.dataset.q === 'svtQuery') {
          slot.svtId = 0
          slot.svtArts = []
          slot.svtArtKey = ''
        }
        if (el.dataset.q === 'ceQuery') slot.ceId = 0
        if (el.dataset.q === 'ceBondQuery') slot.ceBondId = 0
        if (el.dataset.q === 'ceRewardQuery') slot.ceRewardId = 0
        render()
        restoreCaret(document.querySelector(`.card[data-pos="${pos}"] [data-q="${el.dataset.q}"]`), start)
      })
    })

    card.querySelectorAll('[data-svt]').forEach((el) => {
      el.addEventListener('click', async () => {
        const svt = state.data.servants.find((item) => item.id === Number(el.dataset.svt))
        if (!svt) return
        slot.svtId = svt.id
        slot.label = svt.name
        slot.svtQuery = ''
        slot.face = svt.face
        slot.className = svt.className
        slot.attribute = svt.attribute
        slot.traitIds = svt.traitIds
        slot.filled = true
        slot.svtArts = []
        slot.svtArtKey = el.dataset.art || ''
        slot.svtImgOk = true
        if (state.mode === 'account' && !slot.isSupport) {
          const rec = accountServantOf(state.account, svt.id)
          slot.bond15 = isBond15(rec)
          slot.bondMaxed = isBondMaxed(rec)
        }
        render()
        const nice = await fetchServantNice(svt.id)
        if (slot.svtId !== svt.id) return
        if (nice) {
          slot.svtArts = artsFromNiceWithForms(nice, svt.forms)
          applyArtToSlot(slot, svt, pickArt(slot.svtArts, slot.svtArtKey))
          slot.eventPassive = passivesFromNice(nice)
            .filter((passive) => passive.target !== 'ptFull')
            .reduce((sum, passive) => sum + passive.rate, 0)
        }
        render()
      })
    })

    card.querySelectorAll('[data-ce]').forEach((el) => {
      el.addEventListener('click', () => {
        const ce = state.data.ces.find((item) => item.id === Number(el.dataset.ce))
        if (!ce) return
        const field = el.dataset.ceField || 'ceId'
        slot[field] = ce.id
        if (field === 'ceId') {
          slot.ceQuery = ''
          slot.lunch = 0
          slot.teaSelf = 0
          slot.supportTea = 0
          slot.holmes = 0
          slot.condCe = 0
        } else if (field === 'ceBondId') slot.ceBondQuery = ''
        else slot.ceRewardQuery = ''
        slot.filled = true
        if (state.mode === 'account' && !slot.isSupport) {
          const rec = accountCeOf(state.account, ce.id)
          if (rec) slot.ceMlb = rec.mlb
        }
        slot.ceImgOk = true
        if (field === 'ceBondId') slot.ceBondImgOk = true
        if (field === 'ceRewardId') slot.ceRewardImgOk = true
        render()
      })
    })

    card.querySelectorAll('[data-k]').forEach((el) => {
      el.addEventListener('change', () => {
        if (el.type === 'checkbox') {
          slot[el.dataset.k] = el.checked
          if (el.dataset.k === 'isSupport' && el.checked) {
            state.slots.forEach((other) => {
              if (other.position !== slot.position) other.isSupport = false
            })
            slot.teaSelf = 0
            slot.svtId = 0
            slot.label = '助战'
            slot.face = ''
            slot.traitIds = []
            slot.svtQuery = ''
            slot.svtArts = []
            slot.svtArtKey = ''
            slot.formLabel = ''
            slot.bond15 = false
            slot.bondMaxed = false
            slot.portrait = false
            slot.ceBondId = 0
          }
          if (el.dataset.k === 'isSupport' && !el.checked) slot.supportTea = 0
        } else if (el.dataset.k === 'customPercent') {
          slot.customPercent = (Number(el.value) || 0) / 100
        } else {
          slot[el.dataset.k] = Number(el.value)
        }
        render()
      })
    })

    card.querySelectorAll('[data-art]').forEach((el) => {
      el.addEventListener('change', () => {
        const svt = selectedSvt(slot)
        applyArtToSlot(slot, svt, pickArt(slot.svtArts, el.value))
        render()
      })
    })

    card.querySelectorAll('[data-img]').forEach((el) => {
      el.addEventListener('error', () => {
        if (el.dataset.img === 'svt') {
          slot.svtImgOk = false
          render()
        } else if (el.dataset.img === 'ce') {
          slot.ceImgOk = false
          render()
        } else if (el.dataset.img === 'ce-bond') {
          slot.ceBondImgOk = false
          render()
        } else if (el.dataset.img === 'ce-reward') {
          slot.ceRewardImgOk = false
          render()
        } else {
          el.style.display = 'none'
        }
      })
    })
  })
}

async function boot() {
  render()
  try {
    const [servants, ces, quests] = await Promise.all([
      loadServants(),
      loadCes(),
      loadQuests().catch(() => []),
    ])
    state.data.servants = servants
    state.data.ces = ces
    state.data.quests = quests
    state.data.status = `已载入国服快照：${servants.length} 名从者，${ces.length} 张羁绊礼装，${quests.length} 个关卡。`
    state.data.error = ''
  } catch (err) {
    state.data.error = '图鉴快照载入失败，仍可手填加成。'
  }
  render()
}

boot()
