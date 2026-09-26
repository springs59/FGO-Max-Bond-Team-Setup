import { calcParty } from './bond.js'
import {
  applyCraftEssences,
  attrLabel,
  classLabel,
  artsFromNiceWithForms,
  fetchServantNice,
  loadCes,
  loadServants,
  loadQuests,
  loadMetadata,
  loadVersion,
  loadEnemies,
  loadSkills,
  loadNoblePhantasms,
  loadTraits,
  pickArt,
  loadSolverIndex,
  loadBondBonuses,
  loadCurrentActivity,
  loadActivityBondIndex,
  loadSolutionIndex,
  loadImageIndex,
  searchByName,
  searchServantForms,
  loadJpExtras,
} from './atlas.js'
import { BOND15_LV, accountCeOf, accountServantOf, defaultBondCap, parseAccountFile, resolvedBondCap } from './account.js'
import {
  accountRemainingMs,
  applyPlanner,
  loadImportedAccount,
  loadPlanner,
  loadRecSwitchMode,
  plannerFromState,
  saveImportedAccount,
  savePlanner,
  saveRecSwitchMode,
} from './user-data.js'
import { assistCandidates, filterRecommendBySupportCe, formUnlocked, recommendTeam, servantBondForms } from './recommend.js'
import { renderDetailPanel } from './ui/detail-panel.js'
import { layoutMode, shellClass } from './ui/responsive-layout.js'
import { buildAssetIndex } from './assets/asset-index.js'
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
  validateSnapshot,
  composeRegionCatalog,
  ceHasBondGain,
  isSvtBondCe,
} from './game-data.js'
import {
  ATTR_OPTIONS,
  CLASS_OPTIONS,
  RARITY_OPTIONS,
  TRAIT_OPTIONS,
  ceEffectTags,
  ceMlbRate,
  emptyRosterFilter,
  filterServants,
  filterCes,
  rankCesByBonus,
  rateLabel,
  rosterFilterActive,
  servantBonusRate,
  toggleFilterValue,
} from './filter.js'
import { PRIORITY_PRESETS, addPriorityPreset } from './priority.js'
import { createGameData, dataVersionLine, formatChinaDateTime } from './data-layer.js'
import { DEFAULT_REGION, REGION_CN, REGION_JP, normalizeRegion, regionLabel } from './region.js'

import { extractExtraPassives } from './bond/activity.js'
import { groupEventBonusSources, resolveSlotEventPassives } from './bond/bonus.js'

const SOLVER_MODES = [
  { v: 'bond', t: '最大羁绊' },
  { v: 'farm', t: '周回' },
  { v: 'quest', t: '关卡通关' },
]

const FARM_PREF_OPTS = [
  { v: 'balanced', t: '均衡' },
  { v: 'fastest', t: '最快' },
  { v: 'bond_first', t: '羁绊优先' },
  { v: 'stable_script', t: '稳定脚本' },
]

function blankSlot(position, filled) {
  return {
    position,
    filled,
    isSupport: false,
    bond15: false,
    bondMaxed: false,
    lunch: 0,
    bondLv: 0,
    bondCap: 10,
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
    pinned: false,
  }
}

function syncBondFlags(slot) {
  if (!slot || slot.isSupport) return slot
  const lv = Math.max(0, Number(slot.bondLv) || 0)
  let cap = Number(slot.bondCap)
  if (!Number.isFinite(cap) || cap < 1) cap = defaultBondCap(slot.svtId)
  slot.bondLv = lv
  slot.bondCap = cap
  slot.bond15 = lv >= BOND15_LV
  slot.bondMaxed = lv >= cap
  return slot
}

function bondHint(rec) {
  if (!rec) return ''
  const lv = Number(rec.bondLv) || 0
  const cap = resolvedBondCap(rec, rec.id)
  const tags = []
  if (lv >= cap) tags.push('满')
  if (lv >= BOND15_LV) tags.push('光环')
  if (rec.isGrand) tags.push('冠位')
  return ` · ${lv}/${cap}${tags.length ? ` ${tags.join(' ')}` : ''}`
}

function applyModeBonds() {
  for (const slot of state.slots) {
    if (slot.isSupport) continue
    if (state.mode === 'account') {
      const rec = slot.svtId ? accountServantOf(state.account, slot.svtId) : null
      slot.bondLv = rec ? Number(rec.bondLv) || 0 : 0
      slot.bondCap = rec ? resolvedBondCap(rec, slot.svtId) : defaultBondCap(slot.svtId)
    } else {
      slot.bondLv = 0
      slot.bondCap = defaultBondCap(slot.svtId)
    }
    syncBondFlags(slot)
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
  region: DEFAULT_REGION,
  data: {
    servants: [],
    ces: [],
    quests: [],
    enemies: [],
    skills: [],
    noblePhantasms: [],
    traits: [],
    game: null,
    status: '正在载入图鉴快照…',
    error: '',
    versionLine: '',
    baseServants: [],
    baseCes: [],
    baseQuests: [],
    jpExtras: { servants: [], ces: [], quests: [] },
    meta: null,
    solverIndex: null,
    bondBonuses: { extraPassives: [], questFriendships: [], events: [] },
    currentActivity: { activities: [] },
    activityBondIndex: null,
    solutionIndex: null,
    imageIndex: null,
  },
  detail: null,
  recommend: null,
  solverMode: 'bond',
  farmPref: 'balanced',
  battle: null,
  recBusy: false,
  solverProgress: null,
  allowSupport: true,
  pasteOpen: false,
  bond15Aura: true,
  preferIds: [],
  filterOpen: false,
  lockIds: [],
  preferQuery: '',
  lockQuery: '',
  questType: 'normal',
  questClass: '',
  costLimit: '',
  costLocked: false,
  accountCost: 0,
  accountSavedAt: 0,
  optimizeBy: 'total',
  filter: emptyRosterFilter(),
  frontIds: [0, 0, 0],
  slotPins: [],
  slotQuery: ['', '', '', '', '', ''],
  pinCes: [],
  pinSvtId: 0,
  pinSvtQuery: '',
  pinCeQuery: '',
  pinSprites: [],
  pinSpriteSvtId: 0,
  pinSpriteQuery: '',
  spriteMode: 'bond_first',
  priorities: [],
  advancedOpen: false,
  recSwitch: loadRecSwitchMode(),
  recUiOpen: false,
  recSheetOpen: false,
  recSheetQuery: '',
  banSvtQuery: '',
  banCeQuery: '',
  grandPosition: 0,
}

applyPlanner(state, loadPlanner())

function refreshCatalogStatus(check) {
  const meta = state.data.meta
  const version = state.data.game && state.data.game.version
  const extraN = ((state.data.jpExtras && state.data.jpExtras.servants) || []).length
  const extraLine = state.region === REGION_JP && extraN ? ` 含日服未实装 ${extraN} 名从者。` : ''
  const jpLine = meta && meta.jpServantCount && state.region === REGION_CN ? ` JP 图鉴 ${meta.jpServantCount}。` : ''
  const updated = meta && meta.lastUpdated ? ` ${formatChinaDateTime(meta.lastUpdated)}。` : ''
  state.data.versionLine = dataVersionLine(version)
  const ver = state.data.versionLine ? ` ${state.data.versionLine}。` : updated
  const living = check && check.living != null ? `活人 ${check.living}。` : ''
  state.data.status = `已载入${regionLabel(state.region)}快照：${state.data.servants.length} 名从者，${state.data.ces.length} 张礼装，${state.data.quests.length} 个关卡。${living}${extraLine}${jpLine}${ver}`
}

function applyCatalog() {
  const composed = composeRegionCatalog({
    region: state.region,
    servants: state.data.baseServants || [],
    ces: state.data.baseCes || [],
    quests: state.data.baseQuests || [],
    extras: state.data.jpExtras || {},
  })
  state.data.servants = composed.servants
  state.data.ces = composed.ces
  state.data.quests = composed.quests
  if (state.data.game) {
    state.data.game = {
      ...state.data.game,
      servants: composed.servants,
      craftEssences: composed.ces,
      quests: composed.quests,
      version: state.data.game.version
        ? { ...state.data.game.version, region: composed.region }
        : { region: composed.region },
    }
  }
  const check = validateSnapshot(composed.servants, composed.ces)
  state.data.error = check.ok ? '' : check.errors.join('；')
  refreshCatalogStatus(check)
}

function setRegion(next) {
  const region = normalizeRegion(next)
  if (region === state.region && state.data.servants.length) return
  state.region = region
  applyCatalog()
  state.recommend = null
  state.solverProgress = null
  stopRecWorker()
}

let pasteDraft = ''

let recWorker = null
let recJobId = 0

function inAppBrowser() {
  const ua = navigator.userAgent || ''
  return /QQ\/|MicroMessenger|Weibo|DingTalk|AlipayClient|BytedanceWebview|Aweme|baiduboxapp|FBAN|FBAV|Instagram|Line\//i.test(ua)
}

function looksLikeAccountDump(text) {
  const t = String(text || '')
    .replace(/^\uFEFF/, '')
    .trim()
  if (t.length < 20) return false
  return (
    t.startsWith('{') ||
    t.startsWith('[') ||
    t.startsWith('<?') ||
    t.startsWith('ey') ||
    /^HTTP\//i.test(t) ||
    t.startsWith('return array') ||
    t.includes('userSvtCollection') ||
    t.includes('svtStatus') ||
    t.includes('craftEssenceStatus') ||
    t.includes('userGame')
  )
}

function isBlockedPickerFile(file) {
  if (!file) return false
  const type = String(file.type || '')
  const name = String(file.name || '')
  if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) return true
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp|mp4|mov|m4a|mp3)$/i.test(name)
}

async function importAccountFile(file) {
  if (!file) return
  if (isBlockedPickerFile(file)) {
    state.data.error = inAppBrowser()
      ? '内置页打开了相册。请点右上角 ··· 用系统浏览器打开，或把 login.php / userdata.json 全文粘贴进来'
      : '这是图片或音视频。请选择 login.php、toplogin 或 userdata.json'
    state.pasteOpen = inAppBrowser()
    render()
    return
  }
  let parsed
  try {
    parsed = await parseAccountFile(new Uint8Array(await file.arrayBuffer()))
  } catch {
    parsed = await parseAccountFile(await file.text())
  }
  applyImportedAccount(parsed)
  if (!parsed.ok && inAppBrowser()) {
    state.data.error = `${parsed.error}。请点右上角用系统浏览器打开，或改用粘贴`
    state.pasteOpen = true
  }
  if (parsed.ok) {
    state.pasteOpen = false
    pasteDraft = ''
  }
  render()
}

async function importAccountText(text) {
  const raw = String(text || '').trim()
  if (!raw) {
    state.data.error = '先粘贴 login.php、toplogin 或 userdata.json 全文'
    state.pasteOpen = true
    render()
    return
  }
  const parsed = await parseAccountFile(raw)
  applyImportedAccount(parsed)
  if (parsed.ok) {
    state.pasteOpen = false
    pasteDraft = ''
  } else if (inAppBrowser()) {
    state.data.error = `${parsed.error}。请贴文件全文，不要截图`
  }
  render()
}

function syncFrontIds() {
  state.frontIds = [1, 2, 3].map((position) => {
    const pin = (state.slotPins || []).find((item) => item.position === position && item.svtId)
    return pin ? pin.svtId : 0
  })
}

function upsertSlotPin(pin) {
  const rest = (state.slotPins || []).filter((item) => item.position !== pin.position)
  state.slotPins = [...rest, pin]
  syncFrontIds()
}

function removeSlotPin(position) {
  state.slotPins = (state.slotPins || []).filter((item) => item.position !== position)
  const slot = state.slots[position - 1]
  if (slot) slot.pinned = false
  syncFrontIds()
}

function pinFromSlot(slot) {
  return {
    position: slot.position,
    svtId: slot.isSupport ? 0 : Number(slot.svtId) || 0,
    ceId: Number(slot.ceId) || 0,
    formKey: String(slot.svtArtKey || ''),
    ceBondId: Number(slot.ceBondId) || 0,
    ceRewardId: Number(slot.ceRewardId) || 0,
  }
}

function collectSlotPins() {
  const byPos = new Map((state.slotPins || []).map((pin) => [pin.position, { ...pin }]))
  for (const slot of state.slots) {
    if (!slot.pinned) continue
    const prev = byPos.get(slot.position) || {}
    byPos.set(slot.position, {
      position: slot.position,
      svtId: slot.isSupport ? 0 : Number(slot.svtId) || prev.svtId || 0,
      ceId: Number(prev.ceId) || 0,
      formKey: String(slot.svtArtKey || prev.formKey || ''),
      ceBondId: Number(prev.ceBondId) || 0,
      ceRewardId: Number(prev.ceRewardId) || 0,
    })
  }
  return [...byPos.values()]
}

function pinSlotServant(pos, svtId) {
  const position = pos + 1
  if (state.allowSupport && position === 6) return false
  if ((state.slotPins || []).some((pin) => pin.svtId === svtId && pin.position !== position)) {
    state.recommend = { ok: false, error: '站位钉住不能重复从者' }
    return false
  }
  const slot = state.slots[pos]
  const svt = (state.data.servants || []).find((item) => item.id === svtId)
  if (!svt || !slot) return false
  slot.svtId = svt.id
  slot.label = svt.name
  slot.face = svt.face
  slot.className = svt.className
  slot.attribute = svt.attribute
  slot.traitIds = svt.traitIds
  slot.filled = true
  slot.pinned = true
  slot.isSupport = false
  slot.svtQuery = ''
  slot.svtImgOk = true
  upsertSlotPin({
    position,
    svtId,
    ceId: Number(slot.ceId) || 0,
    formKey: String(slot.svtArtKey || ''),
    ceBondId: Number(slot.ceBondId) || 0,
    ceRewardId: Number(slot.ceRewardId) || 0,
  })
  return true
}

function clearSlotPin(pos) {
  const slot = state.slots[pos]
  removeSlotPin(pos + 1)
  if (!slot || slot.isSupport) return
  slot.svtId = 0
  slot.label = ''
  slot.face = ''
  slot.filled = false
  slot.svtQuery = ''
  slot.svtArts = []
  slot.svtArtKey = ''
  slot.formLabel = ''
}

function applySlotPinsToCards() {
  for (const pin of state.slotPins || []) {
    const slot = state.slots[pin.position - 1]
    if (!slot) continue
    slot.pinned = true
    if (pin.svtId) {
      const svt = (state.data.servants || []).find((item) => item.id === pin.svtId)
      if (svt) {
        slot.svtId = svt.id
        slot.label = svt.name
        slot.face = svt.face
        slot.className = svt.className
        slot.attribute = svt.attribute
        slot.traitIds = svt.traitIds
        slot.filled = true
      }
    }
    if (pin.ceId) slot.ceId = pin.ceId
    if (pin.formKey) slot.svtArtKey = pin.formKey
    if (pin.ceBondId) slot.ceBondId = pin.ceBondId
    if (pin.ceRewardId) slot.ceRewardId = pin.ceRewardId
  }
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

function isImeComposing(event) {
  return Boolean(event.isComposing || event.inputType === 'insertCompositionText')
}

function bindLiveInput(el, onChange) {
  if (!el) return
  let composing = false
  let skipInput = false
  el.addEventListener('compositionstart', () => {
    composing = true
  })
  el.addEventListener('compositionend', (event) => {
    composing = false
    const target = event.target
    skipInput = true
    queueMicrotask(() => {
      skipInput = false
      onChange({ target })
    })
  })
  el.addEventListener('input', (event) => {
    if (composing || skipInput || isImeComposing(event)) return
    onChange(event)
  })
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

function ceArtUrls(ce) {
  const id = Number(ce && ce.id) || 0
  const urls = []
  if (id) urls.push(`./src/data/ce-img/${id}.png`)
  if (ce && ce.face) urls.push(ce.face)
  if (id) {
    urls.push(`https://static.atlasacademy.io/JP/EquipFaces/f_${id}.png`)
    urls.push(`https://static.atlasacademy.io/JP/Equip/${id}.png`)
    urls.push(`https://static.atlasacademy.io/JP/Faces/f_${id}0.png`)
  }
  return [...new Set(urls.filter(Boolean))]
}

function ceImgTag(ce, cls = '', kind = 'kit') {
  if (!ce) return ''
  const urls = ceArtUrls(ce)
  if (!urls.length) {
    return `<div class="ce-kit-ph">${esc(String(ce.name || '?').slice(0, 1))}</div>`
  }
  const [src, ...rest] = urls
  return `<img class="${esc(cls)}" src="${esc(src)}" alt="${esc(ce.name)}" referrerpolicy="no-referrer" data-img="${esc(kind)}" data-fallbacks="${esc(rest.join('|'))}" data-open-detail="ce" data-id="${esc(ce.id)}" />`
}

function uniqueUrls(urls) {
  return [...new Set((urls || []).filter(Boolean))]
}

function atlasFaceUrls(svt, extra = []) {
  const id = Number((svt && svt.id) || 0)
  const regions = state.region === REGION_JP ? [REGION_JP, REGION_CN] : [REGION_CN, REGION_JP]
  const urls = [...extra, svt && svt.face]
  if (id) {
    for (const region of regions) urls.push(`https://static.atlasacademy.io/${region}/Faces/f_${id}0.png`)
  }
  return uniqueUrls(urls)
}

function imgWithFallbacks(src, alt, { cls = '', kind = 'suggest', extra = [], detailKind = '', detailId = 0 } = {}) {
  const urls = uniqueUrls([src, ...extra])
  if (!urls.length) return ''
  const [first, ...rest] = urls
  const classAttr = cls ? ` class="${esc(cls)}"` : ''
  const open = detailKind && detailId ? ` data-open-detail="${esc(detailKind)}" data-id="${esc(detailId)}"` : ''
  return `<img${classAttr} src="${esc(first)}" alt="${esc(alt)}" referrerpolicy="no-referrer" data-img="${esc(kind)}" data-fallbacks="${esc(rest.join('|'))}"${open} />`
}

function faceImg(svt, kind = 'suggest') {
  const urls = atlasFaceUrls(svt)
  if (!urls.length) return ''
  return imgWithFallbacks(urls[0], svt.name, { kind, extra: urls.slice(1) })
}

function consumeImgFallback(el) {
  const next = String(el.dataset.fallbacks || '')
    .split('|')
    .filter(Boolean)
  if (!next.length) return false
  el.dataset.fallbacks = next.slice(1).join('|')
  el.src = next[0]
  return true
}

function svtArtUrls(slot, svt) {
  const art = pickArt(slot.svtArts, slot.svtArtKey)
  return atlasFaceUrls(svt, [art && art.url, slot.face])
}

function selectedArt(slot) {
  return (slot.svtArts || []).find((item) => item.key === slot.svtArtKey) || null
}

function applyArtToSlot(slot, svt, art) {
  if (art) {
    const fallback = !slot.svtArtKey || slot.svtArtKey === 'default'
    if (!fallback) slot.svtArtKey = art.key
    if (!fallback) {
      if (art.traitIds && art.traitIds.length) slot.traitIds = art.traitIds
      else if (svt) slot.traitIds = svt.traitIds
    }
    if (art.kind === 'costume') slot.formLabel = `灵衣 ${art.label}`
    else slot.formLabel = art.label || (fallback ? '第3阶段' : '默认灵基')
  } else if (svt) {
    slot.svtArtKey = ''
    slot.traitIds = svt.traitIds
    slot.formLabel = '第3阶段'
  }
  slot.svtImgOk = true
}

function renderArt(slot, svt, ce) {
  const bond = slot.isGrand && !slot.isSupport ? ceById(slot.ceBondId) : null
  const reward = slot.isGrand ? ceById(slot.ceRewardId) : null
  if (!svt && !ce && !bond && !reward) {
    return slot.isSupport ? `<div class="art"><div class="art-fallback">助战</div></div>` : ''
  }
  const urls = svt && slot.svtImgOk !== false ? svtArtUrls(slot, svt) : []
  const svtNode = svt
    ? urls.length
      ? imgWithFallbacks(urls[0], svt.name, { cls: 'portrait', kind: 'svt', extra: urls.slice(1), detailKind: 'svt', detailId: svt.id })
      : `<div class="art-fallback">${esc(svt.name)}</div>`
    : slot.isSupport
      ? `<div class="art-fallback">助战</div>`
      : ''
  const arts = slot.svtArts || []
  const selectedArtKey = (pickArt(arts, slot.svtArtKey) || {}).key || slot.svtArtKey
  const picker =
    svt && arts.length > 1
      ? `<label class="art-pick">灵基 / 灵衣<select data-art="1">${arts
          .map(
            (item) =>
              `<option value="${esc(item.key)}" ${item.key === selectedArtKey ? 'selected' : ''}>${esc(item.label)}</option>`,
          )
          .join('')}</select></label>`
      : ''
  return `<div class="art">${svtNode}${ceThumb(ce, slot.ceImgOk, 'ce')}${ceThumb(bond, slot.ceBondImgOk, 'ce-bond')}${ceThumb(reward, slot.ceRewardImgOk, 'ce-reward')}</div>${picker}`
}

function ceThumb(ce, ok, kind) {
  if (!ce) return ''
  if (ok === false) return `<span class="ce-fallback ${kind}">${esc(ce.name)}</span>`
  return ceImgTag(ce, `ce-art ${kind}`, kind)
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

function suggestCe(slot, query, field = 'ceId') {
  let pool = cePool(slot)
  if (field === 'ceRewardId') {
    pool = pool.filter(ceHasBondGain)
    return rankCesByBonus(searchByName(pool, query, (ce) => `${ce.collectionNo} ${ce.name}`)).slice(0, 12)
  }
  if (field === 'ceBondId') {
    const bonded = pool.filter(isSvtBondCe)
    if (bonded.length) pool = bonded
    const owner = Number(slot.svtId) || 0
    if (owner) {
      const mine = pool.filter((ce) => Number(ce.bondEquipOwner) === owner)
      if (mine.length) pool = mine
    }
  }
  return searchByName(pool, query, (ce) => `${ce.collectionNo} ${ce.name}`)
    .sort((a, b) => a.collectionNo - b.collectionNo)
    .slice(0, 12)
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
  const tags = ceEffectTags(ce)
  return [text, ...tags].filter(Boolean).map((item) => ` · ${item}`).join('')
}

function activityLine() {
  const rows = (state.data.currentActivity && state.data.currentActivity.activities) || []
  if (!rows.length) return ''
  const names = rows.slice(0, 2).map((row) => row.name || row.eventId).join(' / ')
  return `当前活动 ${names}`
}

function accountLine() {
  if (state.account) {
    const src = state.account.source === 'dump' ? '登录回包' : 'Chaldea'
    const lv = state.account.masterLv ? ` 御主 Lv.${state.account.masterLv}。` : ''
    const left = accountRemainingMs(state.accountSavedAt)
    const ttl = left ? ` 缓存剩余 ${Math.ceil(left / 60000)} 分钟。` : ''
    const grands = (state.account.servants || []).filter((item) => item && item.isGrand)
    const grandText = grands.length
      ? ` 冠位 ${grands
          .map((item) => (state.data.servants.find((svt) => svt.id === item.id) || {}).name || item.id)
          .join('、')}。`
      : ''
    const regionText = state.account.region ? ` ${regionLabel(state.account.region)}。` : ''
    return `已导入${src}：${state.account.servants.length} 名从者，${state.account.ces.length} 张礼装。${regionText}${lv}${grandText}${ttl}`
  }
  if (state.mode === 'account') return '账号配队：请导入 Chaldea userdata.json 或登录回包 PHP。'
  return `自由配队：可从${regionLabel(state.region)}完整图鉴搜索。`
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
        `<button type="button" class="suggest-item" data-rec-add="${kind}" data-id="${item.id}">${faceImg(item)}<span>${esc(item.collectionNo)}. ${esc(item.name)}${aliasHint(item, q)}${bonusHint(item)}</span></button>`,
    )
    .join('')}</div>`
}

function grandCheckHtml(position, isSupport) {
  if (state.questType !== 'grand' || isSupport) return ''
  if (state.allowSupport && position === 6) return ''
  const chosen = Number(state.grandPosition) || 0
  if (chosen && chosen !== position) return ''
  return `<label class="check"><input data-grand-pos="${position}" type="checkbox" ${chosen === position ? 'checked' : ''} /><span>冠位</span></label>`
}

function frontSuggest(pos) {
  const q = String(state.slotQuery[pos] || '').trim()
  if (!q) return ''
  const taken = (state.slotPins || []).map((pin) => pin.svtId).filter(Boolean)
  const items = searchServantForms(filterServants(recPool(), state.filter), q)
    .filter((item) => !taken.includes(item.id))
    .slice(0, 12)
  if (!items.length) return ''
  return `<div class="suggest rec-suggest">${items
    .map(
      (item) =>
        `<button type="button" class="suggest-item" data-slot-set="${pos}" data-id="${item.id}">${faceImg(item)}<span>${esc(item.collectionNo)}. ${esc(item.name)}${aliasHint(item, q)}</span></button>`,
    )
    .join('')}</div>`
}

function frontPinHtml() {
  return [0, 1, 2, 3, 4, 5]
    .map((pos) => {
      const position = pos + 1
      const supportSlot = state.allowSupport && position === 6
      const pin = (state.slotPins || []).find((item) => item.position === position)
      const id = pin && pin.svtId ? pin.svtId : 0
      const svt = id ? state.data.servants.find((item) => item.id === id) : null
      const row = position <= 3 ? '前排' : '后排'
      if (supportSlot) {
        return `<div class="rec-picker">
        <label>位置 ${position} · 助战槽</label>
        <div class="chips"><span class="chip">不上从者，只钉助战礼装</span></div>
      </div>`
      }
      return `<div class="rec-picker">
      <label>位置 ${position} · ${row}</label>
      <div class="chips">${svt ? `<button type="button" class="chip" data-slot-clear="${pos}">${esc(svt.name)}</button>` : ''}</div>
      <input id="slotQuery${pos}" type="text" value="${esc(state.slotQuery[pos] || '')}" placeholder="搜外号 / 名字" />
      ${frontSuggest(pos)}
      ${grandCheckHtml(position, false)}
    </div>`
    })
    .join('')
}

function pinSvtSuggest() {
  const q = String(state.pinSvtQuery || '').trim()
  if (!q) return ''
  const items = searchServantForms(filterServants(recPool(), state.filter), q).slice(0, 12)
  if (!items.length) return ''
  return `<div class="suggest rec-suggest">${items
    .map(
      (item) =>
        `<button type="button" class="suggest-item" data-pin-svt="${item.id}">${faceImg(item)}<span>${esc(item.collectionNo)}. ${esc(item.name)}${aliasHint(item, q)}</span></button>`,
    )
    .join('')}</div>`
}

function pinCeSuggest() {
  const q = String(state.pinCeQuery || '').trim()
  if (!q || !state.pinSvtId) return ''
  const items = searchByName(filterCes(state.data.ces || [], state.filter), q, (ce) => ce.name).slice(0, 12)
  if (!items.length) return ''
  return `<div class="suggest rec-suggest">${items
    .map(
      (item) =>
        `<button type="button" class="suggest-item" data-pin-ce="${item.id}">${imgWithFallbacks(item.face || item.icon || '', item.name)}<span>${esc(item.name)}</span></button>`,
    )
    .join('')}</div>`
}

function pinCeHtml() {
  const chips = (state.pinCes || [])
    .map((pin, index) => {
      const svt = state.data.servants.find((item) => item.id === pin.svtId)
      const ce = state.data.ces.find((item) => item.id === pin.ceId)
      if (!svt || !ce) return ''
      return `<button type="button" class="chip" data-pin-remove="${index}">${esc(svt.name)} · ${esc(ce.name)}</button>`
    })
    .join('')
  const pending = state.pinSvtId ? state.data.servants.find((item) => item.id === state.pinSvtId) : null
  return `<div class="rec-picker">
    <label>从者礼装</label>
    <div class="chips">${chips}${pending ? `<span class="chip">${esc(pending.name)} 再选礼装</span>` : ''}</div>
    <input id="pinSvtQuery" type="text" value="${esc(state.pinSvtQuery)}" placeholder="先搜从者" />
    ${pinSvtSuggest()}
    <input id="pinCeQuery" type="text" value="${esc(state.pinCeQuery)}" placeholder="再搜礼装" ${state.pinSvtId ? '' : 'disabled'} />
    ${pinCeSuggest()}
  </div>`
}

function pinSpriteSvtSuggest() {
  const q = String(state.pinSpriteQuery || '').trim()
  if (!q) return ''
  const items = searchServantForms(filterServants(recPool(), state.filter), q).slice(0, 12)
  if (!items.length) return ''
  return `<div class="suggest rec-suggest">${items
    .map(
      (item) =>
        `<button type="button" class="suggest-item" data-pin-sprite-svt="${item.id}">${faceImg(item)}<span>${esc(item.collectionNo)}. ${esc(item.name)}${aliasHint(item, q)}</span></button>`,
    )
    .join('')}</div>`
}

function pinSpriteHtml() {
  const chips = (state.pinSprites || [])
    .map((pin, index) => {
      const svt = state.data.servants.find((item) => item.id === pin.svtId)
      if (!svt) return ''
      const form = servantBondForms(svt).find((item) => item.key === pin.formKey)
      return `<button type="button" class="chip" data-pin-sprite-remove="${index}">${esc(svt.name)} · ${esc((form && form.name) || pin.formKey)}</button>`
    })
    .join('')
  const pending = state.pinSpriteSvtId ? state.data.servants.find((item) => item.id === state.pinSpriteSvtId) : null
  const rec = pending && state.mode === 'account' ? accountServantOf(state.account, pending.id) : null
  const formChips = pending
    ? servantBondForms(pending)
        .filter((form) => formUnlocked(form, rec, state.mode))
        .map((form) => `<button type="button" class="chip" data-pin-sprite-form="${esc(form.key)}">${esc(form.name)}</button>`)
        .join('')
    : ''
  return `<div class="rec-picker">
    <label>形象钉选</label>
    <div class="chips">${chips}${pending ? `<span class="chip">${esc(pending.name)} 再选形象</span>` : ''}</div>
    <input id="pinSpriteQuery" type="text" value="${esc(state.pinSpriteQuery)}" placeholder="先搜从者" />
    ${pinSpriteSvtSuggest()}
    ${formChips ? `<div class="chips">${formChips}</div>` : ''}
  </div>`
}

function priorityHtml() {
  const presets = PRIORITY_PRESETS.map(
    (item) => `<button type="button" class="chip" data-prio-preset="${esc(item.id)}">${esc(item.label)}</button>`,
  ).join('')
  const rules = (state.priorities || [])
    .map(
      (rule, index) => `<div class="prio-rule">
      <label class="check"><input type="checkbox" data-prio-on="${index}" ${rule.enabled === false ? '' : 'checked'} /><span>${esc(rule.label || rule.type)}</span></label>
      <input class="num" data-prio-weight="${index}" inputmode="numeric" value="${esc(rule.weight)}" />
      <button type="button" class="chip" data-prio-remove="${index}">删</button>
    </div>`,
    )
    .join('')
  return `<div class="prio-box">
    <span class="filter-label">从者优先级</span>
    <div class="chips">${presets}</div>
    ${rules}
  </div>`
}

function advancedPanel() {
  return `<details class="filter-panel" id="advancedBox" ${state.advancedOpen ? 'open' : ''}>
    <summary>进阶预设<span>站位 1-6 / 礼装钉 / 形象 / 优先级，羁绊相同才用优先级</span></summary>
    <label class="opt-by">形象
      <select id="spriteMode">
        <option value="bond_first" ${state.spriteMode !== 'strict_order' ? 'selected' : ''}>羁绊优先</option>
        <option value="strict_order" ${state.spriteMode === 'strict_order' ? 'selected' : ''}>严格顺序（3破 > 灵衣 > 1破 > 初始）</option>
      </select>
    </label>
    <div class="rec-pickers front-pins slot-pins">${frontPinHtml()}</div>
    ${pinCeHtml()}
    ${pinSpriteHtml()}
    ${priorityHtml()}
  </details>`
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
  if (state.questType !== 'grand') state.grandPosition = 0
  state.questClass = limits.questClass
  state.questKind = questKindOf(quest)
  state.questDiff = questDiffOf(quest)
  state.questWar = state.questKind === 'free' ? String(quest.war || '自由本').replace(/\s+/g, ' ') : ''
  state.recommend = null
  state.battle = null
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

function currentQuestPayload() {
  const quest =
    findCascadeQuest(state.data.quests, {
      kind: state.questKind,
      questClass: state.questClass,
      diff: state.questDiff,
      key: state.questId ? `${state.questId}:${state.questPhase}` : '',
    }) || (state.data.quests || []).find((item) => String(item.id) === String(state.questId))
  return {
    id: (quest && quest.id) || Number(state.questId) || 0,
    name: state.questName || (quest && (quest.display || quest.name)) || '',
    questClass: state.questClass,
    ap: state.questAp,
    bond: parseBase(state.base),
    waves: quest && Array.isArray(quest.waves) ? quest.waves : [],
    eventId: Number(quest && (quest.eventId || quest.event_id)) || 0,
  }

}

function solverModeLabel() {
  if (state.solverMode === 'farm') return '推荐周回'
  if (state.solverMode === 'quest') return '求解关卡'
  return '一键推荐'
}

function busyHint() {
  const progress = state.solverProgress
  if (!progress) return '正在后台穷举，页面可继续点选。自由模式全图鉴会较久。'
  const sec = Math.max(0, Math.round((progress.elapsed || 0) / 1000))
  return `已搜索 ${progress.nodes || 0} 节点，剪枝 ${progress.pruned || 0}，当前最优 ${progress.bestScore || 0}，用时 ${sec}s`
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

function applyImportedAccount(parsed) {
  if (!parsed || !parsed.ok) {
    state.account = null
    state.accountCost = 0
    state.costLocked = false
    state.data.error = (parsed && parsed.error) || '文件格式无法识别'
    return
  }
  state.account = parsed
  state.mode = 'account'
  state.data.error = ''
  applyAccountCost(parsed)
  state.accountSavedAt = Date.now()
  saveImportedAccount(parsed, state.accountSavedAt)
  if (parsed.region) setRegion(parsed.region)
  applyModeBonds()
}

function costInputBad() {
  return Boolean(state.recommend && !state.recommend.ok && /COST/.test(state.recommend.error || ''))
}

function recAltList(rec) {
  const plans = rec.plans || []
  if (!plans.length) return ''
  const chosen = Number.isInteger(rec.chosen) ? rec.chosen : 0
  const current = plans[chosen] || plans[0]
  const head = recSwitchHead()
  if (plans.length === 1) return `${head}${recNowBox(current)}`
  if (state.recSwitch === 'cards') return `${head}${recCards(plans, chosen)}`
  if (state.recSwitch === 'sheet') return `${head}${recSheet(plans, chosen, current)}`
  return `${head}${recPager(plans, chosen, current)}`
}

function recSwitchHead() {
  const modes = [
    ['pager', '左右翻页'],
    ['cards', '横向滑卡片'],
    ['sheet', '弹出列表'],
  ]
  const pop = state.recUiOpen
    ? `<div class="rec-ui-pop">${modes
        .map(([id, label]) => `<button type="button" class="chip ${state.recSwitch === id ? 'active' : ''}" data-rec-mode="${id}">${label}</button>`)
        .join('')}</div>`
    : ''
  return `<div class="rec-switch"><strong>推荐队伍</strong><button type="button" id="recUiToggle">${state.recUiOpen ? '收起设置' : '设置'}</button></div>${pop}`
}

function recPager(plans, chosen, current) {
  return `<div class="rec-pager">
    ${recNowBox(current, `<span class="rec-now-idx">${chosen + 1} / ${plans.length}</span>`)}
    <div class="rec-pager-nav">
      <button type="button" data-rec-step="-1" ${chosen <= 0 ? 'disabled' : ''}>上一套</button>
      <button type="button" data-rec-step="1" ${chosen >= plans.length - 1 ? 'disabled' : ''}>下一套</button>
    </div>
  </div>`
}

function recCards(plans, chosen) {
  return `<div class="rec-cards">${plans
    .map((plan, index) => {
      const bits = planBits(plan)
      return `<button type="button" class="rec-card ${index === chosen ? 'active' : ''}" data-rec-plan="${index}"><strong>${esc(bits.short)}</strong><span>${esc(bits.names)}</span></button>`
    })
    .join('')}</div>`
}

function recSheet(plans, chosen, current) {
  const list = plans
    .map((plan, index) => ({ plan, index }))
    .filter((item) => planHitsQuery(item.plan, state.recSheetQuery))
    .map(({ plan, index }) => {
      const bits = planBits(plan)
      return `<button type="button" class="rec-sheet-item ${index === chosen ? 'active' : ''}" data-rec-plan="${index}"><strong>${esc(bits.short)}</strong><span>${esc(bits.names)}</span></button>`
    })
    .join('')
  const sheet = state.recSheetOpen
    ? `<div class="rec-sheet"><button type="button" class="rec-sheet-back" data-rec-sheet="0" aria-label="关闭"></button><div class="rec-sheet-panel"><div class="rec-switch"><strong>换一套</strong><button type="button" data-rec-sheet="0">关闭</button></div><input id="recSheetQuery" type="text" value="${esc(state.recSheetQuery)}" placeholder="搜从者 / COST / 羁绊" />${list || '<p class="rec-line">没有匹配的方案</p>'}</div></div>`
    : ''
  return `<button type="button" class="rec-plan rec-sheet-btn" id="recSheetOpen">${recNowInner(current, '<span class="rec-sheet-hint">点这里换一套</span>')}</button>${sheet}`
}

function recNowBox(plan, extra) {
  return `<div class="rec-plan">${recNowInner(plan, extra)}</div>`
}

function recNowInner(plan, extra = '') {
  const bits = planBits(plan)
  return `<div class="rec-now-top"><strong>总羁绊 ${plan.total}</strong><span>${esc(bits.meta)}</span></div><p class="rec-now-names">${esc(bits.names || '空队')}</p>${extra}`
}

function planHitsQuery(plan, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const bits = planBits(plan)
  return `${bits.line} ${plan.total} ${plan.costUsed}`.toLowerCase().includes(q)
}

function planBits(plan) {
  const own = (plan.slots || []).filter((slot) => slot.filled && !slot.isSupport)
  const empty = (plan.slots || []).filter((slot) => !slot.filled).length
  const prefer =
    state.optimizeBy === 'prefer' && (plan.preferBond || plan.lockBond)
      ? `主练 ${(plan.preferBond || 0) + (plan.lockBond || 0)} · `
      : plan.preferBond
        ? `练度 ${plan.preferBond} · `
        : ''
  const names = own.map((slot) => slotNameWithForm(slot)).join('、')
  const grand = (plan.slots || []).find((slot) => slot.isGrand && slot.filled && !slot.isSupport)
  const grandText = grand ? ` · 冠位 ${grand.label || ''}` : ''
  const meta = `${own.length}人 · COST ${plan.costUsed}${prefer ? ` · ${prefer.replace(/ · $/, '')}` : ''}${empty ? ` · 空槽 ${empty}` : ''}${plan.useSupport ? ' · 助战' : ''}${grandText}`
  const short = `${meta} · 总羁绊 ${plan.total}`
  return { meta, short, names, line: names ? `${short} · ${names}` : short }
}

function recAssistList(rec) {
  const list = (rec.assist && rec.assist.length ? rec.assist : assistCandidates(rec.allPlans || rec.plans || [], state.data.ces))
  if (!list.length) return ''
  const locked = Number(rec.lockSupportCeId) || 0
  return `<div class="rec-assist">
    <h2>筛选助战礼装</h2>
    <div class="ce-kit-list">${list
      .map((item) => {
        const ce = ceById(item.id) || { id: item.id, name: item.name }
        return `<button type="button" class="ce-kit-card ${item.id === locked ? 'active' : ''}" data-assist-ce="${item.id}">${ceImgTag(ce, '', 'kit')}<figcaption><strong>${esc(item.name)}</strong><span>${item.total}</span></figcaption></button>`
      })
      .join('')}</div>
  </div>`
}

function slotNameWithForm(slot) {
  const name = slot.label || ''
  const form = slot.formLabel || ''
  if (!form || form === '默认灵基' || form === '第3阶段') return name
  return `${name}（${form}）`
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

function banPickHtml(kind) {
  const svt = kind === 'svt'
  const ids = svt ? state.filter.banSvtIds || [] : state.filter.banCeIds || []
  const query = svt ? state.banSvtQuery : state.banCeQuery
  const chips = ids
    .map((id) => {
      const item = svt
        ? state.data.servants.find((row) => row.id === id)
        : state.data.ces.find((row) => row.id === id)
      if (!item) return ''
      return `<button type="button" class="chip" data-ban-remove="${kind}" data-id="${item.id}">${esc(item.name)}</button>`
    })
    .join('')
  return `<div class="rec-picker">
    <label>${svt ? '屏蔽从者' : '屏蔽礼装'}</label>
    <div class="chips">${chips}</div>
    <input id="${svt ? 'banSvtQuery' : 'banCeQuery'}" type="text" value="${esc(query)}" placeholder="${svt ? '搜外号 / 名字' : '搜礼装名'}" />
    ${banSuggest(kind, query, ids)}
  </div>`
}

function banSuggest(kind, query, ids) {
  const q = String(query || '').trim()
  if (!q) return ''
  if (kind === 'svt') {
    const items = searchServantForms(recPool(), q)
      .filter((item) => !ids.includes(item.id))
      .slice(0, 12)
    if (!items.length) return ''
    return `<div class="suggest rec-suggest">${items
      .map(
        (item) =>
          `<button type="button" class="suggest-item" data-ban-add="svt" data-id="${item.id}">${faceImg(item)}<span>${esc(item.collectionNo)}. ${esc(item.name)}${aliasHint(item, q)}</span></button>`,
      )
      .join('')}</div>`
  }
  const items = searchByName(state.data.ces || [], q, (ce) => `${ce.collectionNo} ${ce.name}`)
    .filter((item) => !ids.includes(item.id))
    .slice(0, 12)
  if (!items.length) return ''
  return `<div class="suggest rec-suggest">${items
    .map(
      (item) =>
        `<button type="button" class="suggest-item" data-ban-add="ce" data-id="${item.id}">${imgWithFallbacks(item.face || item.icon || '', item.name)}<span>${esc(item.name)}</span></button>`,
    )
    .join('')}</div>`
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
  if ((f.banSvtIds || []).length) {
    const names = f.banSvtIds
      .map((id) => (state.data.servants.find((svt) => svt.id === id) || {}).name || id)
      .join(' ')
    parts.push(`屏蔽从者 ${names}`)
  }
  if ((f.banCeIds || []).length) {
    const names = f.banCeIds
      .map((id) => (state.data.ces.find((ce) => ce.id === id) || {}).name || id)
      .join(' ')
    parts.push(`屏蔽礼装 ${names}`)
  }
  if (!parts.length) return ''
  return `<p class="filter-now">当前：${esc(parts.join('；'))}。改完请再点一键推荐。</p>`
}

function filterPanel() {
  const f = state.filter
  const allChip = `<button type="button" class="chip ${f.trait.matchAll ? 'active' : ''}" data-filter-all="trait">全中</button>`
  return `<details class="filter-panel" id="filterBox" ${state.filterOpen ? 'open' : ''}>
    <summary>筛选从者<span>显示 / 屏蔽，搜索和推荐都生效</span></summary>
    <div class="filter-head">
      <button type="button" id="filterReset">清空筛选</button>
    </div>
    ${filterRow('职阶', 'svtClass', CLASS_OPTIONS, f.svtClass)}
    ${filterRow('星级', 'rarity', RARITY_OPTIONS.map((n) => [n, `${n}星`]), f.rarity)}
    ${filterRow('属性', 'attribute', ATTR_OPTIONS, f.attribute)}
    ${filterRow('特性', 'trait', TRAIT_OPTIONS.map((item) => [item.id, item.name]), f.trait, allChip)}
    ${banPickHtml('svt')}
    ${banPickHtml('ce')}
    ${filterNowLine()}
  </details>`
}

function recSetup() {
  return `<section class="rec-setup">
    <div class="planner-block solver-block">
      <span class="block-label">求解</span>
      <div class="solver-modes">
        ${SOLVER_MODES.map(
          (item) =>
            `<button type="button" data-solver="${item.v}" class="${state.solverMode === item.v ? 'active' : ''}">${item.t}</button>`,
        ).join('')}
      </div>
    </div>
    <div class="planner-block quest-block">
      <span class="block-label">关卡 / COST</span>
      <div class="rec-quest">
        <div class="quest-field">
          <label>关卡</label>
          ${questSelectHtml()}
          <p class="quest-picked">${esc(questPickedLine())}</p>
        </div>
        <div class="quest-field">
          <label>基础羁绊</label>
          <input id="base" class="num" inputmode="numeric" pattern="[0-9]*" value="${esc(state.base)}" />
        </div>
        <div class="quest-field">
          <label>COST 上限</label>
          <div class="quest-row cost-row">
            <input id="costLimit" class="num${costInputBad() ? ' bad' : ''}" inputmode="numeric" pattern="[0-9]*" value="${esc(state.costLimit)}" placeholder="空=不限" ${state.costLocked ? 'disabled' : ''} />
            <label class="check">
              <input id="costLocked" type="checkbox" ${state.costLocked ? 'checked' : ''} ${state.accountCost ? '' : 'disabled'} />
              <span>${esc(costLockLabel())}</span>
            </label>
          </div>
        </div>
        <div class="rec-go">
          <button id="recommendNow" type="button" class="rec-go-btn${state.recBusy ? ' busy' : ''}">${esc(state.recBusy ? '取消计算' : solverModeLabel())}</button>
          ${state.recBusy ? `<p class="rec-busy-hint" id="recBusyHint">${esc(busyHint())}</p>` : ''}
        </div>
      </div>
    </div>
    <div class="planner-block opt-block">
      <span class="block-label">约束</span>
      <div class="rec-opts">
        <label class="check"><input id="allowSupport" type="checkbox" ${state.allowSupport ? 'checked' : ''} /><span>留助战位</span></label>
        <label class="check"><input id="bond15Aura" type="checkbox" ${state.bond15Aura ? 'checked' : ''} /><span>梦火光环</span></label>
        ${
          state.solverMode !== 'farm'
            ? ''
            : `<label class="opt-by">周回偏好
          <select id="farmPref">
            ${FARM_PREF_OPTS.map((item) => `<option value="${item.v}" ${state.farmPref === item.v ? 'selected' : ''}>${item.t}</option>`).join('')}
          </select>
        </label>`
        }
        <label class="opt-by">比较顺序
          <select id="optimizeBy">
            <option value="total" ${state.optimizeBy === 'total' ? 'selected' : ''}>全队总羁绊优先</option>
            <option value="prefer" ${state.optimizeBy === 'prefer' ? 'selected' : ''}>主练羁绊优先</option>
          </select>
        </label>
      </div>
    </div>
    <div class="planner-block roster-block">
      <span class="block-label">必须上场</span>
      <div class="rec-pickers">
        <div class="rec-picker">
          <label>练度从者</label>
          <div class="chips">${recChips('prefer', state.preferIds)}</div>
          <input id="preferQuery" type="text" value="${esc(state.preferQuery)}" placeholder="搜外号 / 名字" />
          ${recSuggest('prefer', state.preferQuery, state.preferIds)}
        </div>
        <div class="rec-picker">
          <label>锁定上场</label>
          <div class="chips">${recChips('lock', state.lockIds)}</div>
          <input id="lockQuery" type="text" value="${esc(state.lockQuery)}" placeholder="搜外号 / 名字" />
          ${recSuggest('lock', state.lockQuery, state.lockIds)}
        </div>
      </div>
    </div>
    ${advancedPanel()}
    ${filterPanel()}
  </section>`
}

function slotCeEntries(slot) {
  const out = []
  if (!slot || !slot.filled) return out
  const add = (id, tag, mlb) => {
    const ce = ceById(id)
    if (!ce) return
    out.push({ ce, tag, mlb: mlb !== false, support: Boolean(slot.isSupport) })
  }
  if (slot.ceId) add(slot.ceId, slot.isGrand ? '普通' : '', slot.ceMlb)
  if (slot.isGrand && slot.ceRewardId) add(slot.ceRewardId, '报酬', slot.ceRewardMlb)
  return out
}

function ceKitItem(item) {
  const tags = [item.tag, item.mlb === false ? '未满破' : ''].filter(Boolean)
  return `<figure class="ce-kit-card">${ceImgTag(item.ce, '', 'kit')}<figcaption><strong>${esc(item.ce.name)}</strong>${tags.length ? `<span>${esc(tags.join(' · '))}</span>` : ''}</figcaption></figure>`
}

function ceKitBar(slots) {
  const own = []
  const borrow = []
  for (const slot of slots || []) {
    for (const item of slotCeEntries(slot)) {
      if (item.support) borrow.push(item)
      else own.push(item)
    }
  }
  if (!(state.recommend && state.recommend.ok)) return ''
  if (!own.length && !borrow.length) return ''
  const list = (items, empty) =>
    items.length ? items.map(ceKitItem).join('') : `<span class="ce-kit-empty">${empty}</span>`
  return `<section class="ce-kit">
    <div class="ce-kit-col">
      <h2>当前自出</h2>
      <div class="ce-kit-list">${list(own, '无')}</div>
    </div>
    <div class="ce-kit-col">
      <h2>当前助战</h2>
      <div class="ce-kit-list">${list(borrow, '无')}</div>
    </div>
  </section>`
}

function battlePanel() {
  const battle = state.battle
  if (!battle || !battle.ok) return ''
  const ev = battle.evidence || {}
  const st = battle.strategy || {}
  const title = state.solverMode === 'farm' ? '周回策略' : '通关策略'
  const waves = (st.waves || [])
    .map((wave) => {
      const enemies = (wave.enemies || []).map((enemy) => enemy.name || enemy.id).join('、') || '敌人数据待补'
      const skills = (wave.actions || [])
        .filter((action) => action.type === 'skill')
        .map((action) => `从者${action.svtId}技能${(action.skillIndex || 0) + 1}`)
        .join(' → ')
      const nps = (wave.npOrder || []).join(' → ')
      return `<li>第${wave.turn || ''}波 ${esc(enemies)} · ${esc(skills || '平A')} · 宝具 ${esc(nps || '无')}</li>`
    })
    .join('')
  const failRate = Number.isFinite(ev.failRate) ? `${(ev.failRate * 100).toFixed(1)}%` : '—'
  const avgTurns = Number.isFinite(ev.avgTurns) ? Number(ev.avgTurns).toFixed(1) : '—'
  const clear = ev.theoreticalClear ? '存在静态可清路径' : '无静态可清路径'
  const gaps = [
    st.dataNote || '',
    st.placeholderEnemies ? '敌人 HP / 职阶尚未入库，战斗计划只是结构模板' : '',
    st.assumedCombatStats ? '从者攻击/宝具数据未入库，不按假设数值开战' : '',
  ].filter(Boolean)
  return `<details class="battle-note" open>
    <summary>${esc(title)} · ${esc(battle.stability || '')}</summary>
    <p>${esc(battle.claim || battle.note || '')}</p>
    <p>${esc(clear)} · 失败率 ${esc(failRate)} · 平均回合 ${esc(avgTurns)}</p>
    ${gaps.length ? `<p class="battle-data-gap">${esc(gaps.join('。'))}</p>` : ''}
    ${waves ? `<ol class="battle-waves">${waves}</ol>` : ''}
  </details>`
}

function queryStatsLine(rec) {
  const q = rec && rec.queryStats
  if (!q) return ''
  const t = q.timing || {}
  const c = q.candidates || {}
  const s = q.search || {}
  const r = q.results || {}
  return `<p class="query-stats">检索 raw ${c.raw || 0} / 合法 ${c.legal || 0} · 节点 ${s.nodes || 0} · 组装 ${r.assembled || 0} · 去重 ${r.unique || 0} · 返回 ${r.returned || 0} · ${Math.round(t.totalMs || 0)}ms</p>`
}

function recommendPanel(slots) {
  const rec = state.recommend
  if (!rec) return ''
  if (!rec.ok) return `<div class="case error">${esc(rec.error)}</div>`
  const alts = recAltList(rec)
  return `<section class="recommend">
    ${alts}
    ${rec.summary ? `<details class="rec-note"><summary>怎么算的</summary><p>${esc(rec.summary)}</p></details>` : ''}
    ${queryStatsLine(rec)}
    ${battlePanel()}
    ${recAssistList(rec)}
    ${ceKitBar(slots)}
  </section>`
}

function renderSuggest(items, kind, slot, ceField) {
  if (!items.length) return ''
  return `<div class="suggest" data-kind="${kind}">${items
    .map((item) => {
      if (kind === 'svt') {
        const rec = accountServantOf(state.account, item.id)
        const bond = bondHint(rec)
        return `<button type="button" class="suggest-item" data-svt="${item.id}" data-art="${esc(item.artKey || '')}">
          ${faceImg(item)}
          <span>${esc(item.collectionNo)}. ${esc(item.name)} · ${classLabel(item.className)}${attrLabel(item.attribute)}${bond}${aliasHint(item, slot.svtQuery)}${bonusHint(item)}</span>
        </button>`
      }
      return `<button type="button" class="suggest-item" data-ce="${item.id}" data-ce-field="${esc(ceField || 'ceId')}">
        ${imgWithFallbacks(item.face || item.icon || '', item.name)}
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

function renderAnySvtNote(slot) {
  if (slot.isSupport || !slot.filled || !slot.anySvt) return ''
  const forms = slot.altSvtForms || []
  const entries = forms.length
    ? forms
    : (slot.altSvtIds || []).map((id) => ({ id, formKey: 'default', formLabel: '第3阶段' }))
  const seated = new Set(
    (state.slots || [])
      .filter((item) => item && item.filled && !item.isSupport && item.svtId && item.position !== slot.position)
      .map((item) => item.svtId),
  )
  const names = []
  for (const entry of entries) {
    const id = entry.id
    const svt = state.data.servants.find((item) => item.id === id)
    if (!svt || !svt.name) continue
    const label = `${svt.name}（${entry.formLabel || '第3阶段'}）`
    names.push(seated.has(id) ? `${esc(label)}<span class="in-party">已上场</span>` : esc(label))
  }
  const list = names.length ? names.join('、') : '其他同加成从者'
  return `<div class="any-svt"><strong>任意从者位</strong>：可换成 ${list}。这些形态与当前从者的礼装命中、羁绊状态和 COST 相同；上场时使用标注的战斗形象。</div>`
}

function eventSourceName(src, fallback) {
  const name = String((src && src.name) || '').trim()
  if (name) return name
  return fallback
}

function renderEventBonusPanel(slot) {
  if (!slot || !slot.filled || slot.isSupport) return ''
  const groups = groupEventBonusSources(slot.eventBonus)
  const rows = []
  for (const src of groups.self) {
    rows.push(
      `<div><span>自身 · ${esc(eventSourceName(src, '活动被动'))}</span><span>+${pct(src.rate)}</span></div>`,
    )
  }
  for (const src of groups.party) {
    rows.push(
      `<div><span>全队 · ${esc(eventSourceName(src, '活动光环'))}</span><span>+${pct(src.rate)}</span></div>`,
    )
  }
  for (const src of groups.quest) {
    rows.push(
      `<div><span>关卡 · ${esc(eventSourceName(src, '关卡活动'))}</span><span>+${pct(src.rate)}</span></div>`,
    )
  }
  if (!rows.length) return ''
  return `<div class="event-bonus"><div class="event-bonus-title">活动加成</div>${rows.join('')}</div>`
}

function renderCard(slot, output) {
  const res = resultOf(slot.position, output)
  const finalText = !slot.filled ? '—' : output.ok && res ? String(res.final) : '—'
  const svt = selectedSvt(slot)
  const ce = selectedCe(slot)
  const anySvtNote = renderAnySvtNote(slot)
  const lines =
    slot.filled && res && res.eligible
      ? res.lines
          .filter((line) => line.key !== 'event')
          .map((line) => `<div><span>${esc(line.label)}</span><span>+${pct(line.pct)}</span></div>`)
          .join('')
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
      <div class="card-fields">
      ${
        slot.isSupport
          ? `<div class="meta">助战位 · 只给助战礼装，不拿羁绊</div>`
          : `<div class="search">
        <label>从者</label>
        <input data-q="svtQuery" type="text" placeholder="${state.mode === 'account' ? '搜持有从者' : '搜编号 / 名字 / 外号'}" value="${esc(slot.svtQuery || (svt ? svt.name : ''))}" />
        ${slot.svtQuery ? renderSuggest(suggestSvt(slot), 'svt', slot) : ''}
      </div>`
      }
      ${ceSearchBox(
        slot,
        'ceId',
        'ceQuery',
        slot.isSupport
          ? slot.isGrand ? '助战普通礼装' : '助战礼装'
          : slot.isGrand || state.questType === 'grand' ? '普通礼装' : '礼装',
        '搜编号 / 名字',
        ce,
      )}
      ${slot.isGrand && !slot.isSupport ? ceSearchBox(slot, 'ceBondId', 'ceBondQuery', '羁绊礼装', '搜该从者10绊礼装', ceById(slot.ceBondId)) : ''}
      ${slot.isGrand ? ceSearchBox(slot, 'ceRewardId', 'ceRewardQuery', slot.isSupport ? '助战报酬' : '报酬礼装', '搜午餐 / 午茶 / 20%', ceById(slot.ceRewardId)) : ''}
      ${
        slot.isSupport
          ? ''
          : `<div class="bond-row${state.mode === 'account' ? ' locked' : ''}">
        <label>当前</label>
        <input data-k="bondLv" class="num" inputmode="numeric" pattern="[0-9]*" value="${slot.bondLv || 0}" ${state.mode === 'account' ? 'readonly disabled title="账号羁绊，不可改"' : ''} />
        <span class="bond-slash">/</span>
        <label>上限</label>
        <input data-k="bondCap" class="num" inputmode="numeric" pattern="[0-9]*" value="${slot.bondCap || 10}" ${state.mode === 'account' ? 'readonly disabled title="账号羁绊，不可改"' : ''} />
        <span class="bond-tag">${slot.bondMaxed ? '已满' : slot.bond15 ? '光环' : state.mode === 'account' ? '账号' : ''}</span>
      </div>`
      }
      </div>
      <div class="toggles">
        <label class="check"><input data-k="filled" type="checkbox" ${slot.filled ? 'checked' : ''} /><span>上场</span></label>
        <label class="check"><input data-k="isSupport" type="checkbox" ${slot.isSupport ? 'checked' : ''} /><span>助战</span></label>
        <label class="check"><input data-k="ceMlb" type="checkbox" ${slot.ceMlb ? 'checked' : ''} /><span>满破</span></label>
        ${slot.isSupport ? '' : `<label class="check"><input data-k="portrait" type="checkbox" ${slot.portrait ? 'checked' : ''} /><span>肖像</span></label>`}
        <label class="check"><input data-k="pinned" type="checkbox" ${slot.pinned ? 'checked' : ''} /><span>钉住此位</span></label>
        ${grandCheckHtml(slot.position, slot.isSupport)}
      </div>
      ${!slot.isSupport && svt ? `<div class="meta">${classLabel(svt.className)} · ${attrLabel(svt.attribute)} · ${svt.rarity}星${selectedArt(slot) && selectedArt(slot).kind === 'costume' ? ` · 灵衣 ${esc(selectedArt(slot).label)}` : selectedArt(slot) && selectedArt(slot).kind === 'ascension' ? ` · ${esc(selectedArt(slot).label)}` : ''}</div>` : ''}
      ${anySvtNote}
      ${slot.ceMiss ? `<div class="reason">${esc(slot.ceMiss)}</div>` : ''}
      ${slot.spriteReason ? `<div class="reason">${esc(slot.spriteReason)}</div>` : ''}
      ${renderEventBonusPanel(slot)}
      ${res && !res.eligible && slot.filled ? `<div class="reason">${res.reasonText}</div>` : ''}
      ${lines ? `<div class="lines">${lines}</div>` : ''}
      ${res && res.eligible ? `<div class="lines-sum">${res.afterFront} → ${res.afterRate}${res.flat ? ` +${res.flat}` : ''}${res.teapotMul === 2 ? ' ×2' : ''} = ${res.final}</div>` : ''}
    </article>
  `
}

function parseBase(raw) {
  if (raw === '' || raw === null) return NaN
  if (!/^\d+$/.test(String(raw))) return Number(raw)
  return Number(raw)
}

function preparedSlots() {
  const slots = state.slots.map((slot) =>
    syncBondFlags({
      ...slot,
      ceLines: [],
      eventPassive: 0,
      eventBonus: null,
      customPercent: 0,
    }),
  )
  applyCraftEssences(slots, state.data.ces)
  resolveSlotEventPassives(slots, { quest: currentQuestPayload(), catalog: state.data.bondBonuses })
  return slots
}

function syncGrandSlots() {
  const prevGrand = state.slots.find((slot) => slot.isGrand && !slot.isSupport)
  const bag = prevGrand
    ? {
        ceRewardId: prevGrand.ceRewardId,
        ceRewardMlb: prevGrand.ceRewardMlb,
        ceBondId: prevGrand.ceBondId,
        ceBondMlb: prevGrand.ceBondMlb,
      }
    : null
  for (const slot of state.slots) slot.isGrand = false
  if (state.questType !== 'grand') return
  const support = state.slots.find((slot) => slot.isSupport)
  if (support) support.isGrand = true
  const chosen = Number(state.grandPosition) || 0
  if (chosen) {
    const pinned = state.slots.find((slot) => slot.position === chosen && !slot.isSupport && slot.filled)
    if (pinned) {
      pinned.isGrand = true
      moveGrandExtraCes(prevGrand, pinned, bag)
      return
    }
  }
  const own = state.slots.filter((slot) => slot.filled && !slot.isSupport)
  const crowned = own.find((slot) => {
    const rec = accountServantOf(state.account, slot.svtId)
    return rec && rec.isGrand
  })
  const hit =
    crowned ||
    own.find((slot) => slot.position <= 3) ||
    state.slots.find((slot) => !slot.isSupport && slot.position <= 3)
  if (hit) hit.isGrand = true
  if (hit) moveGrandExtraCes(prevGrand, hit, bag)
}

function moveGrandExtraCes(from, to, bag) {
  if (!from || !to || from === to) return
  // The crowned slot must keep two bonus CEs (normal + reward). When the grand
  // moves to a slot that has no normal CE, carry the old grand's normal CE over
  // so the new grand is not left with only the reward CE.
  if (!to.ceId && from.ceId) {
    to.ceId = from.ceId
    to.ceMlb = from.ceMlb
    to.ceImgOk = from.ceImgOk
    from.ceId = 0
    from.ceMlb = true
  }
  if (to.ceRewardId) {
    from.ceRewardId = 0
  } else if (bag && bag.ceRewardId) {
    to.ceRewardId = bag.ceRewardId
    to.ceRewardMlb = bag.ceRewardMlb
    from.ceRewardId = 0
  }
  if (to.ceBondId) {
    from.ceBondId = 0
  } else if (bag && bag.ceBondId) {
    to.ceBondId = bag.ceBondId
    to.ceBondMlb = bag.ceBondMlb
    from.ceBondId = 0
  }
}

function recWorkerUrl() {
  const url = new URL('./recommend-worker.js', import.meta.url)
  url.searchParams.set('v', 'w11')
  return url
}

function stopRecWorker() {
  recJobId += 1
  if (!recWorker) return
  recWorker.terminate()
  recWorker = null
}

function cancelRecommend() {
  stopRecWorker()
  state.recBusy = false
  state.solverProgress = null
  state.recommend = { ok: false, error: '已取消计算' }
  render()
}

async function applySolverPayload(payload) {
  const kind = payload && payload.kind
  const value = payload && payload.value
  let plan
  state.battle = null
  if (kind === 'farm') {
    state.battle = value && value.ok ? value : null
    plan = value && value.ok ? value.bond : value
  } else if (kind === 'quest') {
    state.battle = value && value.ok ? value : null
    plan = value && value.ok ? value.team : value
  } else {
    plan = value
  }
  state.recommend = plan
  if (!plan || !plan.ok) {
    render()
    const costEl = document.getElementById('costLimit')
    if (costEl && /COST/.test((plan && plan.error) || '')) costEl.focus()
    return
  }
  await applyRecommendPlan(plan, plan.plans || [plan], plan.chosen || 0)
}

function onRecWorkerMessage(event) {
  const msg = event.data || {}
  if (msg.id !== recJobId || !state.recBusy) return
  if (msg.type === 'progress') {
    state.solverProgress = msg.progress || null
    const hint = document.getElementById('recBusyHint')
    if (hint) hint.textContent = busyHint()
    return
  }
  state.recBusy = false
  state.solverProgress = null
  if (!msg.ok) {
    state.recommend = { ok: false, error: msg.error || '求解失败' }
    render()
    return
  }
  applySolverPayload(msg.result).catch((err) => {
    state.recommend = { ok: false, error: String((err && err.message) || err || '求解失败') }
    render()
  })
}

function ensureRecWorker() {
  if (recWorker) return recWorker
  recWorker = new Worker(recWorkerUrl(), { type: 'module' })
  recWorker.onmessage = onRecWorkerMessage
  recWorker.onmessageerror = () => {
    if (!state.recBusy) return
    stopRecWorker()
    state.recBusy = false
    state.recommend = { ok: false, error: '后台计算结果无法读取，请用系统浏览器打开' }
    render()
  }
  recWorker.onerror = () => {
    if (!state.recBusy) return
    stopRecWorker()
    state.recBusy = false
    state.recommend = { ok: false, error: '后台计算失败，请用系统浏览器打开' }
    render()
  }
  return recWorker
}

async function runRecommend() {
  if (state.recBusy) {
    cancelRecommend()
    return
  }
  state.recBusy = true
  state.solverProgress = null
  state.battle = null
  render()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  if (!state.recBusy) return
  const opts = {
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
    optimizeBy: state.optimizeBy,
    priorities: state.priorities,
    frontIds: state.frontIds,
    pinCes: state.pinCes,
    spriteMode: state.spriteMode,
    pinSprites: state.pinSprites,
    slotPins: collectSlotPins(),
    grandPosition: state.grandPosition || 0,
    quest: currentQuestPayload(),
    bondBonuses: state.data.bondBonuses || null,
    pref: state.farmPref,
    solverIndex: state.data.solverIndex || null,
    solutionIndex: state.data.solutionIndex || null,
    region: state.region,
    game:
      state.data.game ||
      createGameData({
        servants: state.data.servants,
        craftEssences: state.data.ces,
        quests: state.data.quests,
        enemies: state.data.enemies || [],
        traits: state.data.traits || [],
        skills: state.data.skills || [],
        noblePhantasms: state.data.noblePhantasms || [],
      }),
    runs: state.solverMode === 'quest' ? 12 : 8,
    seed: 1,
  }
  const id = recJobId + 1
  recJobId = id
  try {
    ensureRecWorker().postMessage({ id, solverMode: state.solverMode, opts })
  } catch (err) {
    stopRecWorker()
    state.recBusy = false
    state.recommend = {
      ok: false,
      error: '当前浏览器无法后台计算，请用系统浏览器打开',
    }
    render()
  }
}

function pickRecommend(index) {
  const rec = state.recommend
  if (!rec || !rec.ok || !rec.plans) return
  const plan = rec.plans[index]
  if (!plan) return
  state.recSheetOpen = false
  applyRecommendPlan(plan, rec.plans, index)
}

async function applyRecommendPlan(plan, plans, chosen) {
  const prev = state.recommend || {}
  state.recommend = {
    ...plan,
    ok: true,
    plans,
    chosen,
    assist: plan.assist || prev.assist,
    allPlans: plan.allPlans || prev.allPlans,
    lockSupportCeId: plan.lockSupportCeId != null ? plan.lockSupportCeId : prev.lockSupportCeId,
  }
  const pinnedPos = new Set((state.slotPins || []).map((pin) => pin.position))
  for (const slot of state.slots) {
    if (slot.pinned) pinnedPos.add(slot.position)
  }
  state.slots = plan.slots.map((slot, index) => ({
    ...blankSlot(index + 1, slot.filled),
    ...slot,
    pinned: pinnedPos.has(slot.position || index + 1),
  }))
  render()
  const panel = document.querySelector('.recommend')
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  await Promise.all(
    state.slots.map(async (slot) => {
      if (!slot.svtId) return
      const svt = state.data.servants.find((item) => item.id === slot.svtId)
      if (!svt) return
      let nice = null
      try {
        nice = await fetchServantNice(svt.id, state.region)
      } catch {
        nice = null
      }
      if (!nice || slot.svtId !== svt.id) return
      slot.svtArts = artsFromNiceWithForms(nice, svt.forms)
      applyArtToSlot(slot, svt, pickArt(slot.svtArts, slot.svtArtKey || ''))
      slot.extraPassives = extractExtraPassives(nice)
    }),
  )
  render()
}

function expireAccountIfNeeded() {
  if (!state.account || !state.accountSavedAt) return
  if (accountRemainingMs(state.accountSavedAt) > 0) return
  state.account = null
  state.accountSavedAt = 0
  state.accountCost = 0
  state.costLocked = false
  if (state.mode === 'account') {
    state.mode = 'free'
    applyModeBonds()
  }
}

function render() {
  expireAccountIfNeeded()
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
        <p class="sub">最大羁绊 / 周回 / 关卡通关 · 当前羁绊小于上限就能拿 · 梦火 ≥15 给队友光环</p>
        ${state.data.versionLine ? `<p class="data-ver">${esc(state.data.versionLine)}</p>` : ''}
      </div>
      <div class="top-actions">
        <button id="reset" type="button">重置</button>
        <button id="sample" type="button">样例</button>
        <a class="glossary-link" href="./glossary.html">名词</a>
      </div>
    </header>
    <section class="account-bar">
      <span class="block-label">区服</span>
      <div class="account-bar-actions tight">
        <button type="button" id="regionCn" class="${state.region === REGION_CN ? 'active' : ''}">国服</button>
        <button type="button" id="regionJp" class="${state.region === REGION_JP ? 'active' : ''}">日服</button>
      </div>
      <span class="block-label">配队</span>
      <div class="account-bar-actions">
        <button type="button" id="modeFree" class="${state.mode === 'free' ? 'active' : ''}">自由</button>
        <button type="button" id="modeAccount" class="${state.mode === 'account' ? 'active' : ''}">账号</button>
        <label class="file">导入<input id="accountFile" type="file" /></label>
        <button type="button" id="accountPaste">${state.pasteOpen ? '收起粘贴' : '粘贴'}</button>
        <button class="teapot ${state.teapot ? 'active' : ''}" id="teapot">${state.teapot ? '茶壶开' : '茶壶'}</button>
      </div>
    </section>
    ${inAppBrowser() ? '<p class="import-hint">当前是 App 内置页，选不了 php/json。请点右上角 ··· → 在浏览器中打开；或点「粘贴」贴全文。</p>' : ''}
    ${
      state.pasteOpen
        ? `<div class="paste-box">
      <p class="paste-note">支持 login.php、toplogin、userdata.json，以及把文件拖进页面。截图无效。</p>
      <textarea id="accountPasteText" rows="8" placeholder="在此粘贴文件全文"></textarea>
      <div class="paste-actions">
        <button type="button" id="accountPasteGo">导入这段文本</button>
        <button type="button" id="accountPasteCancel">取消</button>
      </div>
    </div>`
        : ''
    }
    <div class="${shellClass(layoutMode(window.innerWidth, window.innerHeight))}">
    <div class="shell-filters">${recSetup()}</div>
    <div class="shell-results">
    <div class="case ${output.ok && !state.data.error && !recError ? '' : 'error'}">${esc([recError || output.caseText, accountLine(), state.questName, activityLine(), state.data.error].filter(Boolean).join(' · '))}</div>
    ${recommendPanel(slots)}
    <section class="party">
      <p class="row-title">前排</p>
      <section class="row">${front.map((slot) => renderCard(slot, output)).join('')}</section>
      <p class="row-title">后排</p>
      <section class="row back">${back.map((slot) => renderCard(slot, output)).join('')}</section>
    </section>
    <details class="formula">
      <summary>公式</summary>
      <p>最终羁绊 = (floor(floor(基础 × (1 + 前排)) × (1 + Σ第二层)) + 肖像) × 茶壶</p>
      <p>己方前排 +20%；助战占前排时己方全体再叠 +4%。助战在后排时第一层不加这 4%。</p>
      <p>活动加成按从者和关卡自动识别，自身、全队、关卡来源分开计入第二层。</p>
      <p>${esc(dataLine)}</p>
    </details>
    </div>
    ${renderDetailPanel({
      detail: state.detail,
      servants: state.data.servants,
      ces: state.data.ces,
      catalog: state.data.bondBonuses,
      quest: currentQuestPayload(),
      assetIndex: state.data.imageIndex,
      layout: layoutMode(window.innerWidth, window.innerHeight).startsWith('phone') ? 'phone' : 'pc',
    })}
    </div>
  `

  bind(app)
  savePlanner(plannerFromState(state))
}

function bindFilter(app) {
  const reset = document.getElementById('filterReset')
  if (reset) {
    reset.addEventListener('click', () => {
      state.filter = emptyRosterFilter()
      state.banSvtQuery = ''
      state.banCeQuery = ''
      render()
    })
  }
  const filterBox = document.getElementById('filterBox')
  if (filterBox) {
    filterBox.addEventListener('toggle', () => {
      state.filterOpen = filterBox.open
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
  ;['banSvtQuery', 'banCeQuery'].forEach((key) => {
    const input = document.getElementById(key)
    if (!input) return
    bindLiveInput(input, (event) => {
      const start = caretPos(event.target)
      state[key] = event.target.value
      render()
      restoreCaret(document.getElementById(key), start)
    })
  })
  app.querySelectorAll('[data-ban-add]').forEach((el) => {
    el.addEventListener('click', () => {
      const kind = el.dataset.banAdd
      const id = Number(el.dataset.id)
      if (!id) return
      const list = kind === 'ce' ? state.filter.banCeIds : state.filter.banSvtIds
      if (!list || list.includes(id)) return
      list.push(id)
      if (kind === 'ce') state.banCeQuery = ''
      else state.banSvtQuery = ''
      render()
    })
  })
  app.querySelectorAll('[data-ban-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      const kind = el.dataset.banRemove
      const id = Number(el.dataset.id)
      if (kind === 'ce') state.filter.banCeIds = (state.filter.banCeIds || []).filter((item) => item !== id)
      else state.filter.banSvtIds = (state.filter.banSvtIds || []).filter((item) => item !== id)
      render()
    })
  })
}

function bind(app) {
  bindFilter(app)
  app.addEventListener('click', (event) => {
    if (event.target.closest('[data-detail-close]')) {
      state.detail = null
      render()
      return
    }
    const hit = event.target.closest('[data-open-detail]')
    if (!hit) return
    const kind = hit.dataset.openDetail === 'ce' ? 'ce' : 'svt'
    const id = Number(hit.dataset.id) || 0
    if (!id) return
    const card = hit.closest('.card')
    const slot = card ? state.slots[Number(card.dataset.pos) - 1] : null
    state.detail = {
      kind,
      id,
      mlb: slot ? slot.ceMlb !== false : true,
      isSupport: Boolean(slot && slot.isSupport),
    }
    render()
  })
  app.querySelectorAll('img[data-img]').forEach((el) => {
    el.addEventListener('error', () => {
      if (consumeImgFallback(el)) return
      const card = el.closest('.card')
      const slot = card ? state.slots[Number(card.dataset.pos) - 1] : null
      if (slot && el.dataset.img === 'svt') {
        slot.svtImgOk = false
        render()
        return
      }
      if (slot && el.dataset.img === 'ce') {
        slot.ceImgOk = false
        render()
        return
      }
      if (slot && el.dataset.img === 'ce-bond') {
        slot.ceBondImgOk = false
        render()
        return
      }
      if (slot && el.dataset.img === 'ce-reward') {
        slot.ceRewardImgOk = false
        render()
        return
      }
      el.style.display = 'none'
    })
  })
  const optEl = document.getElementById('optimizeBy')
  if (optEl) {
    optEl.addEventListener('change', () => {
      state.optimizeBy = optEl.value === 'prefer' ? 'prefer' : 'total'
    })
  }
  const allowEl = document.getElementById('allowSupport')
  if (allowEl) {
    allowEl.addEventListener('change', () => {
      state.allowSupport = allowEl.checked
      if (allowEl.checked && state.grandPosition === 6) state.grandPosition = 0
      if (allowEl.checked) {
        const sixth = (state.slotPins || []).find((pin) => pin.position === 6)
        if (sixth && sixth.svtId) {
          upsertSlotPin({ ...sixth, svtId: 0, formKey: '', ceBondId: 0 })
          const slot = state.slots[5]
          if (slot) {
            slot.svtId = 0
            slot.pinned = Boolean(sixth.ceId || sixth.ceRewardId)
          }
        }
      }
      render()
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
    bindLiveInput(costEl, (event) => {
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
      bindLiveInput(input, (event) => {
        const start = caretPos(event.target)
        state[key] = event.target.value
        render()
        restoreCaret(document.getElementById(key), start)
      })
    }
  })
  const advancedBox = document.getElementById('advancedBox')
  if (advancedBox) {
    advancedBox.addEventListener('toggle', () => {
      state.advancedOpen = advancedBox.open
    })
  }
  const spriteEl = document.getElementById('spriteMode')
  if (spriteEl) {
    spriteEl.addEventListener('change', () => {
      state.spriteMode = spriteEl.value === 'strict_order' ? 'strict_order' : 'bond_first'
    })
  }
  ;[0, 1, 2, 3, 4, 5].forEach((pos) => {
    const input = document.getElementById(`slotQuery${pos}`)
    if (!input) return
    bindLiveInput(input, (event) => {
      const start = caretPos(event.target)
      state.slotQuery[pos] = event.target.value
      render()
      restoreCaret(document.getElementById(`slotQuery${pos}`), start)
    })
  })
  app.querySelectorAll('[data-slot-set]').forEach((el) => {
    el.addEventListener('click', () => {
      const pos = Number(el.dataset.slotSet)
      const id = Number(el.dataset.id)
      if (!Number.isInteger(pos) || pos < 0 || pos > 5 || !id) return
      pinSlotServant(pos, id)
      state.slotQuery[pos] = ''
      render()
    })
  })
  app.querySelectorAll('[data-slot-clear]').forEach((el) => {
    el.addEventListener('click', () => {
      const pos = Number(el.dataset.slotClear)
      if (!Number.isInteger(pos) || pos < 0 || pos > 5) return
      clearSlotPin(pos)
      render()
    })
  })
  app.querySelectorAll('[data-grand-pos]').forEach((el) => {
    el.addEventListener('change', () => {
      const pos = Number(el.dataset.grandPos) || 0
      state.grandPosition = el.checked ? pos : 0
      render()
    })
  })
  const pinSvtInput = document.getElementById('pinSvtQuery')
  if (pinSvtInput) {
    bindLiveInput(pinSvtInput, (event) => {
      const start = caretPos(event.target)
      state.pinSvtQuery = event.target.value
      render()
      restoreCaret(document.getElementById('pinSvtQuery'), start)
    })
  }
  const pinCeInput = document.getElementById('pinCeQuery')
  if (pinCeInput) {
    bindLiveInput(pinCeInput, (event) => {
      const start = caretPos(event.target)
      state.pinCeQuery = event.target.value
      render()
      restoreCaret(document.getElementById('pinCeQuery'), start)
    })
  }
  app.querySelectorAll('[data-pin-svt]').forEach((el) => {
    el.addEventListener('click', () => {
      state.pinSvtId = Number(el.dataset.pinSvt) || 0
      state.pinSvtQuery = ''
      render()
    })
  })
  app.querySelectorAll('[data-pin-ce]').forEach((el) => {
    el.addEventListener('click', () => {
      const ceId = Number(el.dataset.pinCe) || 0
      if (!state.pinSvtId || !ceId) return
      if (state.pinCes.length >= 3) return
      if (state.pinCes.some((pin) => pin.svtId === state.pinSvtId && pin.ceId === ceId)) {
        state.pinSvtId = 0
        state.pinCeQuery = ''
        render()
        return
      }
      state.pinCes.push({ svtId: state.pinSvtId, ceId })
      state.pinSvtId = 0
      state.pinCeQuery = ''
      render()
    })
  })
  app.querySelectorAll('[data-pin-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      const index = Number(el.dataset.pinRemove)
      state.pinCes = state.pinCes.filter((_, i) => i !== index)
      render()
    })
  })
  const pinSpriteInput = document.getElementById('pinSpriteQuery')
  if (pinSpriteInput) {
    bindLiveInput(pinSpriteInput, (event) => {
      const start = caretPos(event.target)
      state.pinSpriteQuery = event.target.value
      render()
      restoreCaret(document.getElementById('pinSpriteQuery'), start)
    })
  }
  app.querySelectorAll('[data-pin-sprite-svt]').forEach((el) => {
    el.addEventListener('click', () => {
      state.pinSpriteSvtId = Number(el.dataset.pinSpriteSvt) || 0
      state.pinSpriteQuery = ''
      render()
    })
  })
  app.querySelectorAll('[data-pin-sprite-form]').forEach((el) => {
    el.addEventListener('click', () => {
      const formKey = String(el.dataset.pinSpriteForm || '')
      if (!state.pinSpriteSvtId || !formKey) return
      const next = { svtId: state.pinSpriteSvtId, formKey }
      const rest = (state.pinSprites || []).filter((pin) => pin.svtId !== next.svtId)
      if (rest.length >= 5) return
      state.pinSprites = [...rest, next]
      state.pinSpriteSvtId = 0
      state.pinSpriteQuery = ''
      render()
    })
  })
  app.querySelectorAll('[data-pin-sprite-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      const index = Number(el.dataset.pinSpriteRemove)
      state.pinSprites = state.pinSprites.filter((_, i) => i !== index)
      render()
    })
  })
  app.querySelectorAll('[data-prio-preset]').forEach((el) => {
    el.addEventListener('click', () => {
      const preset = PRIORITY_PRESETS.find((item) => item.id === el.dataset.prioPreset)
      state.priorities = addPriorityPreset(state.priorities, preset)
      render()
    })
  })
  app.querySelectorAll('[data-prio-on]').forEach((el) => {
    el.addEventListener('change', () => {
      const index = Number(el.dataset.prioOn)
      if (!state.priorities[index]) return
      state.priorities[index].enabled = el.checked
    })
  })
  app.querySelectorAll('[data-prio-weight]').forEach((el) => {
    bindLiveInput(el, (event) => {
      const index = Number(el.dataset.prioWeight)
      if (!state.priorities[index]) return
      const start = caretPos(event.target)
      state.priorities[index].weight = Number(event.target.value) || 0
      render()
      restoreCaret(document.querySelector(`[data-prio-weight="${index}"]`), start)
    })
  })
  app.querySelectorAll('[data-prio-remove]').forEach((el) => {
    el.addEventListener('click', () => {
      const index = Number(el.dataset.prioRemove)
      state.priorities = state.priorities.filter((_, i) => i !== index)
      render()
    })
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
  const recUiToggle = document.getElementById('recUiToggle')
  if (recUiToggle) {
    recUiToggle.addEventListener('click', () => {
      state.recUiOpen = !state.recUiOpen
      state.recSheetOpen = false
      render()
    })
  }
  app.querySelectorAll('[data-rec-mode]').forEach((el) => {
    el.addEventListener('click', () => {
      const mode = el.dataset.recMode
      if (mode !== 'pager' && mode !== 'cards' && mode !== 'sheet') return
      saveRecSwitchMode(mode)
      state.recSwitch = mode
      state.recUiOpen = false
      state.recSheetOpen = false
      render()
    })
  })
  app.querySelectorAll('[data-rec-step]').forEach((el) => {
    el.addEventListener('click', () => {
      const rec = state.recommend
      if (!rec || !rec.ok || !rec.plans) return
      const chosen = Number.isInteger(rec.chosen) ? rec.chosen : 0
      pickRecommend(chosen + Number(el.dataset.recStep))
    })
  })
  app.querySelectorAll('[data-rec-plan]').forEach((el) => {
    el.addEventListener('click', () => {
      pickRecommend(Number(el.dataset.recPlan))
    })
  })
  const recSheetOpen = document.getElementById('recSheetOpen')
  if (recSheetOpen) {
    recSheetOpen.addEventListener('click', () => {
      state.recSheetOpen = true
      state.recUiOpen = false
      render()
    })
  }
  const recSheetQuery = document.getElementById('recSheetQuery')
  if (recSheetQuery) {
    bindLiveInput(recSheetQuery, (event) => {
      const start = caretPos(event.target)
      state.recSheetQuery = event.target.value
      render()
      restoreCaret(document.getElementById('recSheetQuery'), start)
    })
  }
  app.querySelectorAll('[data-rec-sheet]').forEach((el) => {
    el.addEventListener('click', () => {
      state.recSheetOpen = false
      render()
    })
  })
  const recCard = app.querySelector('.rec-card.active')
  if (recCard) recCard.scrollIntoView({ inline: 'center', block: 'nearest' })
  app.querySelectorAll('[data-assist-ce]').forEach((el) => {
    el.addEventListener('click', () => {
      const rec = state.recommend
      if (!rec || !rec.allPlans) return
      const id = Number(el.dataset.assistCe) || 0
      const current = Number(rec.lockSupportCeId) || 0
      const next = filterRecommendBySupportCe({ ...rec, ok: true }, id && id === current ? 0 : id)
      if (!next || !next.ok) {
        state.recommend = next
        render()
        return
      }
      applyRecommendPlan(next, next.plans, next.chosen || 0)
    })
  })
  const regionCn = document.getElementById('regionCn')
  if (regionCn) {
    regionCn.addEventListener('click', () => {
      setRegion(REGION_CN)
      render()
    })
  }
  const regionJp = document.getElementById('regionJp')
  if (regionJp) {
    regionJp.addEventListener('click', () => {
      setRegion(REGION_JP)
      render()
    })
  }
  document.getElementById('modeFree').addEventListener('click', () => {
    state.mode = 'free'
    applyModeBonds()
    render()
  })
  document.getElementById('modeAccount').addEventListener('click', () => {
    state.mode = 'account'
    applyModeBonds()
    render()
  })
  document.getElementById('accountFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    await importAccountFile(file)
    event.target.value = ''
  })
  const pasteBtn = document.getElementById('accountPaste')
  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      if (state.pasteOpen) {
        state.pasteOpen = false
        render()
        return
      }
      try {
        const clip = await navigator.clipboard.readText()
        if (looksLikeAccountDump(clip)) {
          await importAccountText(clip)
          return
        }
        if (clip && clip.trim()) pasteDraft = clip
      } catch {
        /* QQ/WeChat block clipboard.readText; fall through to the paste box */
      }
      state.pasteOpen = true
      render()
    })
  }
  const pasteText = document.getElementById('accountPasteText')
  if (pasteText) {
    pasteText.value = pasteDraft
    pasteText.addEventListener('input', () => {
      pasteDraft = pasteText.value
    })
  }
  const pasteGo = document.getElementById('accountPasteGo')
  if (pasteGo) {
    pasteGo.addEventListener('click', async () => {
      await importAccountText(pasteDraft)
    })
  }
  const pasteCancel = document.getElementById('accountPasteCancel')
  if (pasteCancel) {
    pasteCancel.addEventListener('click', () => {
      state.pasteOpen = false
      render()
    })
  }
  const baseEl = document.getElementById('base')
  if (baseEl) {
    bindLiveInput(baseEl, (event) => {
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
    state.battle = null
    state.grandPosition = 0
    render()
  })
  const recBtn = document.getElementById('recommend')
  if (recBtn) recBtn.addEventListener('click', () => runRecommend())
  const recNow = document.getElementById('recommendNow')
  if (recNow) recNow.addEventListener('click', () => runRecommend())
  app.querySelectorAll('[data-solver]').forEach((el) => {
    el.addEventListener('click', () => {
      state.solverMode = el.dataset.solver
      state.battle = null
      render()
    })
  })
  const farmPrefEl = document.getElementById('farmPref')
  if (farmPrefEl) {
    farmPrefEl.addEventListener('change', () => {
      state.farmPref = farmPrefEl.value
      render()
    })
  }
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
      if (state.questType !== 'grand') state.grandPosition = 0
      state.recommend = null
      state.battle = null
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
      bindLiveInput(el, (event) => {
        const start = caretPos(event.target)
        slot[el.dataset.q] = event.target.value
        if (el.dataset.q === 'svtQuery') {
          slot.svtId = 0
          slot.svtArts = []
          slot.svtArtKey = ''
          slot.pinned = false
          removeSlotPin(slot.position)
        }
        if (el.dataset.q === 'ceQuery') slot.ceId = 0
        if (el.dataset.q === 'ceBondQuery') slot.ceBondId = 0
        if (el.dataset.q === 'ceRewardQuery') slot.ceRewardId = 0
        if (slot.pinned && el.dataset.q !== 'svtQuery') upsertSlotPin(pinFromSlot(slot))
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
        if (!slot.isSupport) {
          if (state.mode === 'account') {
            const rec = accountServantOf(state.account, svt.id)
            slot.bondLv = rec ? Number(rec.bondLv) || 0 : 0
            slot.bondCap = rec ? resolvedBondCap(rec, svt.id) : defaultBondCap(svt.id)
          } else {
            slot.bondLv = 0
            slot.bondCap = defaultBondCap(svt.id)
          }
          syncBondFlags(slot)
        }
        render()
        let nice = null
        try {
          nice = await fetchServantNice(svt.id, state.region)
        } catch {
          nice = null
        }
        if (slot.svtId !== svt.id) return
        if (nice) {
          slot.svtArts = artsFromNiceWithForms(nice, svt.forms)
          applyArtToSlot(slot, svt, pickArt(slot.svtArts, slot.svtArtKey))
          slot.extraPassives = extractExtraPassives(nice)
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
        if (slot.pinned) upsertSlotPin(pinFromSlot(slot))
        render()
      })
    })

    card.querySelectorAll('[data-k]').forEach((el) => {
      el.addEventListener('change', () => {
        if ((el.dataset.k === 'bondLv' || el.dataset.k === 'bondCap') && state.mode === 'account') return
        if (el.type === 'checkbox') {
          slot[el.dataset.k] = el.checked
          if (el.dataset.k === 'pinned') {
            if (el.checked) {
              if (slot.isSupport) {
                if (!slot.ceId && !slot.ceRewardId) slot.pinned = false
                else upsertSlotPin(pinFromSlot(slot))
              } else if (!slot.svtId) {
                slot.pinned = false
              } else if ((state.slotPins || []).some((pin) => pin.svtId === slot.svtId && pin.position !== slot.position)) {
                slot.pinned = false
                state.recommend = { ok: false, error: '站位钉住不能重复从者' }
              } else {
                upsertSlotPin(pinFromSlot(slot))
              }
            } else {
              removeSlotPin(slot.position)
              slot.pinned = false
            }
          }
          if (el.dataset.k === 'filled' && !el.checked) {
            slot.pinned = false
            removeSlotPin(slot.position)
          }
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
            slot.bondLv = 0
            slot.bondCap = defaultBondCap(slot.svtId)
            slot.portrait = false
            slot.ceBondId = 0
          }
          if (el.dataset.k === 'isSupport' && !el.checked) slot.supportTea = 0
        } else {
          slot[el.dataset.k] = Number(el.value)
          if (el.dataset.k === 'bondLv' || el.dataset.k === 'bondCap') syncBondFlags(slot)
        }
        render()
      })
    })

    card.querySelectorAll('[data-art]').forEach((el) => {
      el.addEventListener('change', () => {
        const svt = selectedSvt(slot)
        slot.svtArtKey = el.value
        applyArtToSlot(slot, svt, pickArt(slot.svtArts, el.value))
        if (slot.pinned) upsertSlotPin(pinFromSlot(slot))
        render()
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
    const jpExtras = await loadJpExtras().catch(() => ({ servants: [], ces: [], quests: [] }))
    state.data.baseServants = servants
    state.data.baseCes = ces
    state.data.baseQuests = quests
    state.data.jpExtras = jpExtras
    const extras = await Promise.all([
      loadEnemies().catch(() => []),
      loadSkills().catch(() => []),
      loadNoblePhantasms().catch(() => []),
      loadTraits().catch(() => []),
      loadSolverIndex().catch(() => null),
      loadBondBonuses().catch(() => null),
      loadCurrentActivity().catch(() => ({ activities: [] })),
      loadActivityBondIndex().catch(() => null),
      loadSolutionIndex().catch(() => null),
      loadImageIndex().catch(() => null),
    ])
    state.data.enemies = extras[0]
    state.data.skills = extras[1]
    state.data.noblePhantasms = extras[2]
    state.data.traits = extras[3]
    state.data.solverIndex = extras[4]
    state.data.bondBonuses = extras[5] || { extraPassives: [], questFriendships: [], events: [] }
    state.data.currentActivity = extras[6] || { activities: [] }
    state.data.activityBondIndex = extras[7]
    state.data.solutionIndex = extras[8]
    state.data.imageIndex = extras[9] || buildAssetIndex({ servants, ces, region: state.region })
    const meta = await loadMetadata().catch(() => null)
    const version = await loadVersion().catch(() => null)
    state.data.meta = meta
    state.data.game = createGameData({
      servants,
      craftEssences: ces,
      quests,
      enemies: extras[0],
      traits: extras[3],
      skills: extras[1],
      noblePhantasms: extras[2],
      version,
    })
    applyCatalog()
  } catch (err) {
    state.data.error = '图鉴快照载入失败，仍可手填加成。'
  }
  const cached = loadImportedAccount()
  if (cached && cached.account && cached.account.ok) {
    state.account = cached.account
    state.accountSavedAt = cached.savedAt
    state.mode = 'account'
    applyAccountCost(cached.account)
    if (cached.account.region) setRegion(cached.account.region)
  }
  applySlotPinsToCards()
  render()
}

function bindAccountImportHooks() {
  document.addEventListener('dragover', (event) => {
    const types = event.dataTransfer && event.dataTransfer.types
    if (!types || ![...types].includes('Files')) return
    event.preventDefault()
  })
  document.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    if (!file) return
    event.preventDefault()
    importAccountFile(file)
  })
  document.addEventListener('paste', (event) => {
    const target = event.target
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
    const text = event.clipboardData && event.clipboardData.getData('text/plain')
    if (!looksLikeAccountDump(text)) return
    event.preventDefault()
    importAccountText(text)
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !state.detail) return
    state.detail = null
    render()
  })
}

bindAccountImportHooks()
boot()
