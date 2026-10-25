import {scoreTeamResultsHtml,scoreTeamProgressText,scoreTeamFamilyHtml,scoreTeamTabLabel} from './ui/score-team-results.js'
import {memberCompositionKey,packedTeamOf,physicalVariantKey} from './solver/score-team-diversity.js'
import { aiUpdater, aiSettings, mountAiUpdates } from './ai-update-ui.js'
import { aiBoundText } from './ui/ai-bound.js'
const aiReady = mountAiUpdates()
import { postRecommendRequest } from './worker-catalog.js'
import { renderPlanGroups, renderTeamComparison, physicalPartyKey } from './ui/team-comparison.js'
import { hydrateComparisonArt } from './ui/comparison-art.js'
import { copyComparisonTeam, editComparisonSlot, swapComparisonSlots, renderComparisonEditor, comparisonIssues } from './ui/comparison-workspace.js'
import { settleParty, replacePartyMember, interchangeableMembers } from './party-state.js'
import { openEquipmentChart } from './ui/equipment-chart.js'
import { openFormationReview } from './ui/formation-dialog.js'
import { equipmentDomainForParty } from './recommend.js'
import { loadAppearance, saveAppearance, applyAppearance, appearancePalette, normalizeAppearance } from './ui/appearance.js'
import { questPartyRules } from './quest-party-rules.js'
import { resolveGrandSelection } from './grand-selection.js'
import { regionalBundle, validateRegionalSnapshot } from './regional-data.js'
import { resolveServantState } from './servant-state.js'
import { resolveCurrentActivity, nextActivityBoundary } from './rules/activity-rules.js'
import { calcParty } from './bond.js'
import {
  applyCraftEssences,
  attrLabel,
  battleAppearanceLabel,
  classLabel,
  artsFromNiceWithForms,
  fetchServantNice,
  loadCes,
  loadServants,
  loadQuests,
  loadMetadata,
  loadDataStatus,
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
  loadActivityScoreIndex,
  loadSolutionIndex,
  loadCombinationFactors,
  loadJoinedEffects,
  loadCurveIndex,
  loadQuestBrowserIndex,
  loadImageIndex,
  searchByName,
  searchServantForms,
  loadJpSnapshot,
} from './atlas.js'
import { BOND15_LV, accountCeOf, accountServantOf, defaultBondCap, parseAccountProfilesFile, resolvedBondCap } from './account.js'
import { loadAccountProfiles, currentAccountProfile, importAccountProfile, selectAccountProfile, updateAccountProfile, removeAccountProfile } from './account-profiles.js'
import { isNative, get as nativeGet, put as nativePut } from '../native/shared/store.js'
import { accountProjectionKey, regionCacheKey } from '../native/shared/precompute.js'
import {
  applyPlanner,
  loadPlanner,
  loadRecSwitchMode,
  plannerFromState,
  saveImportedAccount,
  savePlanner,
  saveRecSwitchMode,
} from './user-data.js?v=appearance-multi49'
import { assistCandidates, formUnlocked, servantBondForms } from './recommend.js'
import { renderDetailPanel } from './ui/detail-panel.js'
import { renderQuestBonusHtml } from './ui/quest-bonus.js'
import { queryConditionKey, queryContext, searchStatusLabel } from './ui/query-context.js'
import { layoutMode } from './ui/responsive-layout.js'
import { QUEST_CATEGORIES, decorateQuest, browseQuests, questTags, questWindow, rememberQuest, loadRecentQuests, saveRecentQuests } from './ui/quest-browser.js'
import { matchedAlias } from './search.js'
import { buildAssetIndex } from './assets/asset-index.js'
import { servantGraphUrls, servantImageUrls } from './assets/servant-images.js'
import { ceImageUrls } from './assets/ce-images.js'
import { handleImgError } from './ui/image-loader.js'
import { costLimitFromMasterLv } from './master-cost.js'
import {
  availableDiffs,
  availableTrainClasses,
  eventWars,
  findCascadeQuest,
  freeWars,
  GRAND_QUEST_CLASSES,
  questLimits,
  solverQuestClass,
  questDiffOf,
  questKindOf,
  questsInWar,
  questsOfKind,
  questSelectKey,
  visibleQuestKinds,
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
import { createGameData, dataVersionLine, formatChinaDateTime, pageBuildLine } from './data-layer.js'
import { DEFAULT_REGION, REGION_CN, REGION_JP, normalizeRegion, regionLabel } from './region.js'

import { extractExtraPassives } from './bond/activity.js'
import { groupEventBonusSources, liveBondBonusCatalog, resolveSlotEventPassives } from './bond/bonus.js'

if (typeof window !== 'undefined') window.handleAtlasImgError = handleImgError

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
  appearance: loadAppearance(),
  appearanceOpen: false,
  appearanceError: '',
  workspaceView: 'conditions',
  base: '',
  teapot: false,
  questId: '',
  questPhase: '1',
  questName: '',
  questAp: 0,
  questKind: '',
  questDiff: '',
  questWar: '',
  questBrowseCategory: 'event',
  questPickerOpen: true,
  questBrowseContent: '',
  questBrowseWar: '',
  questBrowseQuery: '',
  questBrowseScope: 'live',
  questBrowseLimit: 12,
  questCascadeOpen: false,
  questBonusOpen: false,
  constraintsOpen: false,
  slots: [1, 2, 3, 4, 5, 6].map((position) => blankSlot(position, position <= 3)),
  mode: 'free',
  account: null,
  accountProfileId: '',
  accountProjection: null,
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
    regionBundles: {},
    regionReady: false,
    meta: null,
    solverIndex: null,
    bondBonuses: { extraPassives: [], questFriendships: [], events: [] },
    currentActivity: { activities: [] },
    activityBondIndex: null,
    solutionIndex: null,
    imageIndex: null,
  },
  detail: null,
  detailTab: 'recv',
  recommend: null,
  comparisonTeams: [],
  comparisonEditing: -1,
  comparisonSearch: {},
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
state.solverMode = 'bond'

function refreshCatalogStatus(check) {
  const meta = state.data.meta
  const version = state.data.game && state.data.game.version
  const extraLine = state.region === REGION_JP ? ' 日服独立图鉴。' : ''
  const jpLine = meta && meta.jpServantCount && state.region === REGION_CN ? ` JP 图鉴 ${meta.jpServantCount}。` : ''
  const updated = meta && meta.lastUpdated ? ` ${formatChinaDateTime(meta.lastUpdated)}。` : ''
  const built = document.querySelector('meta[name="build-time"]')
  state.data.versionLine = [dataVersionLine(version), state.data.updateStatus?.fetchedAt ? `数据检查 ${formatChinaDateTime(state.data.updateStatus.fetchedAt)}` : '', pageBuildLine(built && built.getAttribute('content'))]
    .filter(Boolean)
    .join(' · ')
  const ver = state.data.versionLine ? ` ${state.data.versionLine}。` : updated
  const living = check && check.living != null ? `活人 ${check.living}。` : ''
  state.data.status = `已载入${regionLabel(state.region)}快照：${state.data.servants.length} 名从者，${state.data.ces.length} 张礼装，${state.data.quests.length} 个关卡。${living}${extraLine}${jpLine}${ver}`
}

function applyCatalog() {
  const bundle = regionalBundle(state.data.regionBundles, state.region)
  const composed = composeRegionCatalog({
    region: state.region, catalogs: state.data.regionBundles,
    servants: bundle?.servants || [], ces: bundle?.ces || [], quests: bundle?.quests || [],
  })
  state.data.regionReady = Boolean(bundle)
  state.data.servants = composed.servants
  state.data.ces = composed.ces
  state.data.quests = composed.quests
  for (const key of ['enemies', 'skills', 'noblePhantasms', 'traits']) state.data[key] = bundle?.[key] || []
  for (const key of ['solverIndex', 'solutionIndex', 'factorIndex', 'curveIndex', 'joinedEffectIndex', 'activityBondIndex', 'questBrowserIndex']) state.data[key] = bundle?.[key] || null
  state.data.bondBonuses = bundle?.bondBonuses || { extraPassives: [], questFriendships: [], events: [] }
  state.data.currentActivity = resolveCurrentActivity({ catalog: state.data.bondBonuses })
  state.data.meta = bundle?.meta || null
  state.data.updateStatus = bundle?.updateStatus || null
  state.data.imageIndex = bundle?.imageIndex || buildAssetIndex({ servants: composed.servants, ces: composed.ces, region: state.region })
  state.data.game = createGameData({ servants: composed.servants, craftEssences: composed.ces,
    quests: composed.quests, enemies: state.data.enemies, skills: state.data.skills,
    noblePhantasms: state.data.noblePhantasms, traits: state.data.traits, version: bundle?.version || null })
  if (!bundle) {
    state.data.error = regionLabel(state.region) + '独立快照尚未载入，请稍后重试；不会使用其他区服数据。'
    state.data.versionLine = ''
    return
  }
  const check = state.region === REGION_CN ? validateSnapshot(composed.servants, composed.ces) : validateRegionalSnapshot(bundle, state.region)
  state.data.regionReady = check.ok
  state.data.error = check.ok ? '' : check.errors.join('；')
  refreshCatalogStatus(check)
}

function setRegion(next) {
  const region = normalizeRegion(next)
  if (region === state.region) return
  saveCurrentPlanner()
  stopRecWorker()
  state.recBusy = false
  state.recommend = null
  state.solverProgress = null
  state.battle = null
  state.detail = null
  state.region = region
  state.comparisonTeams=[]
  state.comparisonEditing=-1
  state.comparisonSearch={}
  Object.assign(state, { base: '', questId: '', questPhase: '1', questName: '', questAp: 0,
    questKind: '', questDiff: '', questWar: '', questType: 'normal', questClass: '',
    questBrowseWar: '', questBrowseQuery: '', questBrowseContent: '', questBrowseScope: 'live',
    questBrowseLimit: 12, questPickerOpen: true, questBrowseCategory: 'event',
    slots: [1,2,3,4,5,6].map(position => blankSlot(position, position <= 3)),
    preferIds: [], lockIds: [], frontIds: [0,0,0], slotPins: [], pinCes: [], pinSprites: [],
    priorities: [], filter: emptyRosterFilter(), grandPosition: 0, optimizeBy: 'total',
    pinSvtId: 0, pinSpriteSvtId: 0, preferQuery: '', lockQuery: '', pinSvtQuery: '',
    pinCeQuery: '', pinSpriteQuery: '', banSvtQuery: '', banCeQuery: '',
    costLimit: '', costLocked: false, accountCost: 0,
    account: null, accountSavedAt: 0, accountProfileId: '', accountProjection: null, mode: 'free' })
  applyPlanner(state, loadPlanner(undefined, region))
  state.solverMode = 'bond'
  state.region = region
  const cached = currentAccountProfile(region)
  if (cached?.account?.ok) {
    state.account = cached.account
    state.accountSavedAt = cached.savedAt
    state.accountProfileId = cached.id
    state.mode = 'account'
    applyAccountCost(cached.account)
    restoreProfilePlanner(cached)
  }
  applyCatalog()
  applySlotPinsToCards()
  applyModeBonds()
  if (!browseQuests(browserQuestList(), { category: 'event' }).length) state.questBrowseCategory = 'all'
  currentActivityKey = null
  refreshActivityClock()
  if (region === REGION_JP && !state.data.regionBundles.JP) {
    loadJpSnapshot().then(bundle => {
      state.data.regionBundles.JP = bundle
      if (state.region !== REGION_JP) return
      applyCatalog()
      applySlotPinsToCards()
      applyModeBonds()
      if (!browseQuests(browserQuestList(), { category: 'event' }).length) state.questBrowseCategory = 'all'
      refreshActivityClock()
      render()
    }).catch(() => {
      if (state.region === REGION_JP) {
        state.data.error = '日服独立快照载入失败，请重新加载页面；国服数据不会代替日服。'
        render()
      }
    })
  }
}

let pasteDraft = ''

let recWorker = null
let recJobId = 0
let recPostedJobId = null
let recStopRequestedId = null

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

async function importAccountFile(file, profileId = '') {
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
    parsed = await parseAccountProfilesFile(new Uint8Array(await file.arrayBuffer()))
  } catch {
    parsed = await parseAccountProfilesFile(await file.text())
  }
  try { applyImportedAccount(parsed, profileId) } catch (error) { parsed.ok = false; parsed.error = error.message; state.data.error = error.message }
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
  const parsed = await parseAccountProfilesFile(raw)
  try { applyImportedAccount(parsed) } catch (error) { parsed.ok = false; parsed.error = error.message; state.data.error = error.message }
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
    ...(!slot.filled && !slot.isSupport ? { empty: true } : {}),
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
      ...(prev.empty || (!slot.filled && !slot.isSupport) ? { empty: true } : {}),
    })
  }
  return [...byPos.values()]
}

function pinSlotServant(pos, svtId) {
  const position = pos + 1
  if (state.allowSupport && position === questPartyRules(currentQuestPayload()).supportPosition) return false
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
    if (pin.empty) {
      slot.filled = false
      slot.svtId = 0
      slot.ceId = 0
      slot.ceBondId = 0
      slot.ceRewardId = 0
      continue
    }
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
  return ceImageUrls(ce)
}

function ceImgTag(ce, cls = '', kind = 'kit') {
  if (!ce) return ''
  const urls = ceArtUrls(ce)
  if (!urls.length) {
    return `<div class="ce-kit-ph">${esc(String(ce.name || '?').slice(0, 1))}</div>`
  }
  const [src, ...rest] = urls
  return `<img class="${esc(cls)}" src="${esc(src)}" alt="${esc(ce.name)}" referrerpolicy="no-referrer" data-img="${esc(kind)}" data-fallbacks="${esc(rest.join('|'))}" data-open-detail="ce" data-id="${esc(ce.id)}" onerror="window.handleAtlasImgError&&window.handleAtlasImgError(this)" />`
}

function uniqueUrls(urls) {
  return [...new Set((urls || []).filter(Boolean))]
}

function atlasFaceUrls(svt, extra = []) {
  return uniqueUrls([...extra, ...servantImageUrls(svt, { region: state.region })])
}

function imgWithFallbacks(src, alt, { cls = '', kind = 'suggest', extra = [], detailKind = '', detailId = 0 } = {}) {
  const urls = uniqueUrls([src, ...extra])
  if (!urls.length) return ''
  const [first, ...rest] = urls
  const classAttr = cls ? ` class="${esc(cls)}"` : ''
  const open = detailKind && detailId ? ` data-open-detail="${esc(detailKind)}" data-id="${esc(detailId)}"` : ''
  return `<img${classAttr} src="${esc(first)}" alt="${esc(alt)}" referrerpolicy="no-referrer" data-img="${esc(kind)}" data-fallbacks="${esc(rest.join('|'))}"${open} onerror="window.handleAtlasImgError&&window.handleAtlasImgError(this)" />`
}

function faceImg(svt, kind = 'suggest') {
  const urls = atlasFaceUrls(svt)
  if (!urls.length) return ''
  return imgWithFallbacks(urls[0], svt.name, { kind, extra: urls.slice(1) })
}

function svtArtUrls(slot, svt) {
  const art = pickArt(slot.svtArts, slot.svtArtKey)
  return atlasFaceUrls(svt, [art && art.url, slot.face])
}

function selectedArt(slot) {
  return (slot.svtArts || []).find((item) => item.key === slot.svtArtKey) || null
}

function applyArtToSlot(slot, svt, art) {
  const key = slot.svtArtKey && slot.svtArtKey !== 'default' ? slot.svtArtKey : ''
  const current = resolveServantState(svt, key)
  if (!current) return
  slot.svtArtKey = key
  slot.traitIds = current.traitIds
  slot.className = current.className
  slot.attribute = current.attribute
  slot.rarity = current.rarity
  slot.formLabel = battleAppearanceLabel(current.formLabel, key)
  slot.svtImgOk = true
  if (state.detail?.kind === 'svt' && state.detail.id === svt.id &&
      state.detail.position === slot.position && state.detail.formKey !== key) {
    state.detail = { ...state.detail, formKey: key, artUrls: [] }
    hydrateServantArt(svt.id)
  }
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
    .slice(0, 12)
}

function aliasHint(item, query) {
  if (item.formLabel) return ` · 灵衣 ${esc(item.formLabel)}`
  const hit = matchedAlias(item, query)
  return hit ? ` · 外号：${esc(hit)}` : ''
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
  return currentQueryContext().bonus
}

function currentGrandSelection() {
  return resolveGrandSelection({questType:state.questType,mode:state.mode,account:state.account,
    grandPosition:state.grandPosition,allowSupport:state.allowSupport,quest:currentQuestPayload(),frontIds:state.frontIds,slotPins:collectSlotPins()})
}

function currentQueryContext() {
  const quest = currentQuestPayload()
  const context = queryContext({ region: state.region, mode: state.mode, quest,
    base: state.base, costLimit: quest?.partyScript?.isInfinityCost ? null : state.costLimit,
    live: liveBondBonusCatalog(state.data.bondBonuses, quest),
    version: state.data.versionLine || '', servants: state.data.servants })
  const grand=currentGrandSelection()
  if(grand.automatic){
    const name=state.data.servants.find(s=>Number(s.id)===grand.svtId)?.name||String(grand.svtId)
    context.deployment.push(`出战冠位：${name} · ${grand.position} 号位，已根据账号冠位状态与固定位置自动关联`)
  }
  return context
}

function queryContextHtml(context, title = '本次计算条件') {
  return `<section class="query-context" aria-label="${esc(title)}"><strong>${esc(title)}</strong>
    <div class="query-context-meta"><span>${esc(context.region)} · ${esc(context.pool)}</span><span>基础 ${context.base} · COST ${esc(context.cost)}</span></div>
    <p>${esc(context.quest)}</p><p class="query-context-bonus">${esc(context.bonus)}</p>
    ${(context.deployment || []).map(line => `<p>${esc(line)}</p>`).join('')}
  </section>`
}

function accountLine() {
  if (state.account) {
    const src = state.account.source === 'dump' ? '登录回包' : 'Chaldea'
    const lv = state.account.masterLv ? ` 御主 Lv.${state.account.masterLv}。` : ''
    const grands = (state.account.servants || []).filter((item) => item && item.isGrand)
    const grandText = grands.length
      ? ` 冠位 ${grands
          .map((item) => (state.data.servants.find((svt) => svt.id === item.id) || {}).name || item.id)
          .join('、')}。`
      : ''
    const regionText = state.account.region ? ` ${regionLabel(state.account.region)}。` : ''
    const parserText = state.account.source === 'dump' && state.account.parserVersion !== 2 ? ' 库存识别已更新，请重新导入抓包一次。' : ''
    return `已导入${src}：${state.account.servants.length} 名从者，${state.account.ces.length} 张礼装。${regionText}${lv}${grandText} 账号保存在本机，直到手动清除或重新导入。${parserText}特殊活动的“选定从者额外加成”尚未自动识别。`
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
        `<button type="button" class="suggest-item" data-rec-add="${kind}" data-id="${item.id}">${faceImg(item)}<span>${esc(item.name)}</span></button>`,
    )
    .join('')}</div>`
}

function grandCheckHtml(position, isSupport) {
  if (state.questType !== 'grand' || isSupport) return ''
  if (state.allowSupport && position === questPartyRules(currentQuestPayload()).supportPosition) return ''
  const selected=currentGrandSelection(),explicit=Number(state.grandPosition)||0
  if (explicit && explicit !== position) return ''
  const automatic=selected.automatic&&selected.position===position
  return `<label class="check"><input data-grand-pos="${position}" type="checkbox" ${selected.position === position ? 'checked' : ''} ${automatic?'disabled':''} /><span>${automatic?'冠位 · 随固定位置自动关联':'冠位'}</span></label>`
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
        `<button type="button" class="suggest-item" data-slot-set="${pos}" data-id="${item.id}">${faceImg(item)}<span>${esc(item.name)}</span></button>`,
    )
    .join('')}</div>`
}

function frontPinHtml() {
  return [0, 1, 2, 3, 4, 5]
    .map((pos) => {
      const position = pos + 1
      const supportSlot = state.allowSupport && position === questPartyRules(currentQuestPayload()).supportPosition
      const pin = (state.slotPins || []).find((item) => item.position === position)
      const id = pin && pin.svtId ? pin.svtId : 0
      const svt = id ? state.data.servants.find((item) => item.id === id) : null
      const row = position <= 3 ? '前排' : '后排'
      if (supportSlot) {
        return `<div class="rec-picker">
        <label>位置 ${position} · 助战槽</label>
        <div class="chips"><span class="chip">${questPartyRules(currentQuestPayload()).supportPolicy === 'system' ? '系统助战与装备由关卡指定' : '好友助战，可钉助战礼装'}</span></div>
      </div>`
      }
      return `<div class="rec-picker">
      <label>位置 ${position} · ${row}</label>
      <div class="chips">${svt ? `<button type="button" class="chip" data-slot-clear="${pos}">${esc(svt.name)}</button>${state.mode==='account'&&accountServantOf(state.account,svt.id)?.isGrand?'<span class="grand-tag">账号冠位</span>':''}` : ''}</div>
      <input id="slotQuery${pos}" type="text" value="${esc(state.slotQuery[pos] || '')}" placeholder="搜外号 / 名字" />
      <label class="check"><input data-slot-empty="${pos}" type="checkbox" ${pin?.empty ? 'checked' : ''} /><span>锁定为空</span></label>
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
        `<button type="button" class="suggest-item" data-pin-svt="${item.id}">${faceImg(item)}<span>${esc(item.name)}</span></button>`,
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
    <input id="pinCeQuery" type="text" value="${esc(state.pinCeQuery)}" placeholder="再搜礼装 / 外号" ${state.pinSvtId ? '' : 'disabled'} />
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
        `<button type="button" class="suggest-item" data-pin-sprite-svt="${item.id}">${faceImg(item)}<span>${esc(item.name)}</span></button>`,
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

function questCascadeHtml() {
  const kind = state.questKind
  const list = state.data.quests || []
  const parts = [`<select id="questKind">${selectOptions(visibleQuestKinds(list), kind, '选择种类')}</select>`]
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
  } else if (kind === 'event') {
    const wars = eventWars(list).map((war) => [war, war])
    const selected = state.questId ? `${state.questId}:${state.questPhase}` : ''
    parts.push(`<select id="questWar">${selectOptions(wars, state.questWar, '活动')}</select>`)
    if (state.questWar) {
      parts.push(`<select id="questPick">${selectOptions(questOptionItems(questsInWar(list, state.questWar, 'event')), selected, '关卡')}</select>`)
    }
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

function browserQuestList() {
  return (state.data.quests || []).map(quest => decorateQuest(quest, state.data.questBrowserIndex, state.region))
}

function questResultButton(quest, recent = false) {
  const key = questSelectKey(quest)
  const selected = key === `${state.questId}:${state.questPhase}`
  return `<button type="button" class="quest-result${selected ? ' selected' : ''}${recent ? ' recent' : ''}" data-quest-result="${esc(key)}" aria-pressed="${selected}">
    <span class="quest-result-name">${esc(quest.display || quest.name)}</span>
    <span class="quest-result-path">${esc(quest.war || '')}${quest.spot ? ` / ${esc(quest.spot)}` : ''}</span>
    <span class="quest-result-meta"><span>${Number(quest.ap) || 0} AP · 羁绊 ${Number(quest.bond) || 0}</span>${questTags(quest).map(tag => `<span class="quest-tag">${esc(tag)}</span>`).join('')}</span>
    ${selected ? '<span class="quest-selected-mark">已选择</span>' : ''}
  </button>`
}

function questSelectHtml() {
  const list = browserQuestList()
  const picked = list.find(q => questSelectKey(q) === `${state.questId}:${state.questPhase}`)
  if (!state.questPickerOpen && picked) return `<div class="quest-compact"><div class="quest-browser-heading"><strong>当前关卡</strong><button type="button" id="questPickerChange">更换关卡</button></div><span class="quest-result-path">${esc(picked.war || '')}${picked.spot ? ` / ${esc(picked.spot)}` : ''}</span></div>`
  const options = { category: state.questBrowseCategory, content: state.questBrowseContent,
    war: state.questBrowseWar, query: state.questBrowseQuery, scope: state.questBrowseScope }
  const scopePool = browseQuests(list, { category: options.category, scope: options.scope })
  const wars = [...new Set(scopePool.map(q => q.war).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'))
  const result = browseQuests(list, options)
  const recentKeys = loadRecentQuests(state.region)
  const recent = recentKeys.map(key => list.find(q => questSelectKey(q) === key)).filter(q => q && questWindow(q)[0] !== 'expired' && questWindow(q)[0] !== 'future')
  return `<div class="quest-browser">
    <div class="quest-browser-heading"><strong>选择关卡</strong><span>搜名字，或先选类别</span></div>
    <div class="quest-categories" role="group" aria-label="副本分类">${QUEST_CATEGORIES.map(([key, label]) => `<button type="button" data-quest-category="${key}" class="${key === options.category ? 'active' : ''}" aria-pressed="${key === options.category}">${label}</button>`).join('')}</div>
    <div class="quest-search-row"><label class="sr-only" for="questBrowseQuery">搜索关卡</label><input type="search" id="questBrowseQuery" value="${esc(options.query)}" placeholder="搜关卡、章节、地点、羁绊值" autocomplete="off" />${options.query ? '<button type="button" id="questSearchClear" aria-label="清空关卡搜索">清空</button>' : ''}</div>
    <div class="quest-browse-filters">
      <label>内容<select id="questBrowseContent">${selectOptions([['farm', '周回 / 可重复'], ['story', '主线剧情'], ['once', '其他一次通关'], ['other', '其他 / 未标注']], options.content, '全部内容')}</select></label>
      <label>${options.category === 'event' ? '活动' : '章节 / 地区'}<select id="questBrowseWar">${selectOptions(wars.map(war => [war, war]), options.war, '全部章节 / 活动')}</select></label>
      <label>开放时间<select id="questBrowseScope">${[['live', '时间范围内'], ['all', '含未开放 / 历史']].map(([key, label]) => `<option value="${key}" ${key === options.scope ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    ${!options.query && recent.length ? `<details class="quest-recent"><summary>最近选择 · ${recent.length} 个</summary><div class="quest-results">${recent.map(q => questResultButton(q, true)).join('')}</div></details>` : ''}
    <div class="quest-results-heading"><span role="status">找到 ${result.length} 个关卡${result.length > state.questBrowseLimit ? ` · 显示前 ${state.questBrowseLimit} 个` : ''}</span>${options.query || options.war || options.content || options.category !== 'all' || options.scope !== 'live' ? '<button type="button" id="questBrowseReset">查看全部开放关卡</button>' : ''}</div>
    <div class="quest-results">${result.slice(0, state.questBrowseLimit).map(q => questResultButton(q)).join('') || '<p class="quest-empty">没有符合条件的关卡。试试减少关键词、切换类别，或包含历史关卡。</p>'}</div>
    ${result.length > state.questBrowseLimit ? '<button type="button" id="questBrowseMore" class="quest-more">再显示 12 个</button>' : ''}
    <details class="quest-cascade-details" id="questCascadeBox" ${state.questCascadeOpen ? 'open' : ''}><summary>按职阶 / 难度逐级选择</summary>${questCascadeHtml()}</details>
    <p class="quest-browser-note">时间范围内包含常驻内容，不代表账号已解锁。购买 / 兑换、前置通关及剩余挑战次数，以游戏内为准。</p>
  </div>`
}

function applyPickedQuest(quest) {
  state.questPickerOpen = false
  if (state.recBusy) cancelRecommend()
  saveRecentQuests(rememberQuest(loadRecentQuests(state.region), quest), state.region)
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
  if (state.questKind === 'event') state.questWar = String(quest.war || '活动副本').replace(/\s+/g, ' ')
  else if (state.questKind === 'free') state.questWar = String(quest.war || '自由本').replace(/\s+/g, ' ')
  else state.questWar = ''
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
  state.questPhase = '1'
  state.questName = ''
  state.questAp = 0
  state.base = ''
  state.recommend = null
  state.battle = null
}

function questPickedLine() {
  if (!state.questName) return '关卡提供基础羁绊，以及该本生效的活动/关卡加成'
  const picked = browserQuestList().find(q => questSelectKey(q) === `${state.questId}:${state.questPhase}`)
  const type = picked ? questTags(picked).join(' · ') : state.questType === 'grand' ? '冠位战' : '普通本'
  const cls = state.questType === 'grand' && state.questClass
    ? `上场职阶 ${classLabel(state.questClass)}`
    : state.questKind === 'train' && state.questClass
      ? `敌方职阶 ${classLabel(state.questClass)} · 上场不限职阶`
      : '上场不限职阶'
  const ap = state.questAp ? ` · ${state.questAp}AP` : ''
  const base = parseBase(state.base)
  const baseText = base ? ` · 基础羁绊 ${base}` : ''
  const rules = picked ? questPartyRules(picked) : null
  const supportText = rules && (picked.partyMetadataComplete || picked.flags?.length)
    ? rules.noSupport ? ' · 无助战，己方最多六人，可锁定空位'
      : rules.supportPolicy === 'system' ? ' · 仅系统助战，固定成员与装备'
      : rules.supportPolicy === 'either' ? ' · 好友 / 可用系统助战'
      : ' · 好友助战'
    : ''
  return `${state.questName}${ap} · ${type} · ${cls}${baseText}${supportText}`
}

function currentQuestPayload() {
  // An explicitly selected phase owns its deployment rules. Category/default
  // lookup must never substitute another phase with the same quest id.
  const quest = state.questId
    ? (state.data.quests || []).find(item => questSelectKey(item) === `${state.questId}:${state.questPhase}`)
    : findCascadeQuest(state.data.quests, {
      kind: state.questKind,
      questClass: state.questClass,
      diff: state.questDiff,
      key: state.questId ? `${state.questId}:${state.questPhase}` : '',
    })
  return {
    region: state.region,
    id: (quest && quest.id) || Number(state.questId) || 0,
    phase: Number(quest && quest.phase) || Number(state.questPhase) || 1,
    type: quest?.type || '',
    noSupport: !!quest?.noSupport,
    supportPolicy: quest?.supportPolicy || '',
    name: state.questName || (quest && (quest.display || quest.name)) || '',
    questClass: state.questClass,
    openedAt: Number(quest && quest.openedAt) || 0,
    closedAt: Number(quest && quest.closedAt) || 0,
    ap: state.questAp,
    bond: parseBase(state.base),
    waves: quest && Array.isArray(quest.waves) ? quest.waves : [],
    eventId: Number(quest && (quest.eventId || quest.event_id)) || 0,
    flags: quest?.flags || [],
    restrictions: quest?.restrictions || [],
    npcSupportCount: quest?.npcSupportCount || 0,
    supportServants: quest?.supportServants || [],
    partyMetadataComplete: Boolean(quest?.partyMetadataComplete),
    partyMetadataDetailed: Boolean(quest?.partyMetadataDetailed),
    partyScript: quest?.partyScript || {},
    isNpcOnly: Boolean(quest?.isNpcOnly),
  }
}

function servantBonusName(id) {
  const sid = Number(id) || 0
  const own = (state.data.servants || []).find((item) => item.id === sid)
  if (own && own.name) return own.name
  return ''
}

function questBonusLine() {
  if (!state.questName) return ''
  const live = liveBondBonusCatalog(state.data.bondBonuses, currentQuestPayload())
  return `<details class="quest-bonus-details" id="questBonusBox" ${state.questBonusOpen ? 'open' : ''}><summary>查看该关卡的羁绊加成</summary>${renderQuestBonusHtml(live, servantBonusName)}</details>`
}

function solverModeLabel() {
  if (state.solverMode === 'farm') return '推荐周回'
  if (state.solverMode === 'quest') return '求解关卡'
  return '一键推荐'
}

function busyHint() {
  const progress = state.solverProgress
  if (!progress) return '正在计算当前条件下的最大羁绊，页面可继续点选。'
  if(progress.stats)return scoreTeamProgressText(progress)
  const sec = Math.max(0, Math.round((progress.elapsed || 0) / 1000))
  const score = progress.objective === 'prefer'
    ? `当前最优主练 ${progress.bestTarget || 0} · 对应总羁绊 ${progress.bestScore || 0}`
    : `当前最优 ${progress.bestScore || 0}`
  return `${progress.phase === 'curve-effects' ? '曲线效果组合' : '已搜索'} ${progress.nodes || 0}，剪枝 ${progress.pruned || 0}，${score}${Number.isFinite(progress.initialLowerBound)?` · 起点下界 ${progress.initialLowerBound}`:''}，用时 ${sec}s`
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

function applyImportedAccount(parsed, profileId = '') {
  if (parsed?.ok && parsed?.accounts) {
    if (profileId && parsed.accounts.length !== 1) { state.data.error = '更新当前账号时请选择只含一个账号的文件。'; return }
    for (const account of parsed.accounts) applyImportedAccount(account, profileId)
    syncProfilesForUpdate()
    return
  }
  stopRecWorker()
  state.recBusy = false
  state.recommend = null
  state.solverProgress = null
  if (!parsed || !parsed.ok) {
    state.data.error = (parsed && parsed.error) || '文件格式无法识别'
    return
  }
  parsed = { ...parsed, region: normalizeRegion(parsed.region || state.region) }
  if (profileId && currentAccountProfile(state.region)?.region !== parsed.region) { state.data.error = '更新账号的区服不一致。'; return }
  saveCurrentPlanner()
  if (parsed.region !== state.region) setRegion(parsed.region)
  const profile = importAccountProfile(parsed, { id: profileId })
  activateAccount(profile.id)
  state.data.error = ''
  saveImportedAccount(parsed, state.accountSavedAt)
  if (parsed.region) setRegion(parsed.region)
  applyModeBonds()
}

function saveCurrentPlanner() {
  const planner = { ...plannerFromState(state), filter: state.filter, teapot: state.teapot, solverMode: state.solverMode, farmPref: state.farmPref }
  try {
    if (state.accountProfileId && state.mode === 'account') updateAccountProfile(state.accountProfileId, { planner })
    else savePlanner(planner)
  } catch (error) { state.data.error = `账号设置保存失败：${error.message}` }
}
function restoreProfilePlanner(profile) {
  if (!profile.planner) return
  applyPlanner(state, profile.planner)
  state.filter = profile.planner.filter || emptyRosterFilter()
  state.teapot = profile.planner.teapot === true
  state.solverMode = ['bond','farm','quest'].includes(profile.planner.solverMode) ? profile.planner.solverMode : 'bond'
  state.farmPref = profile.planner.farmPref || 'balanced'
}
function syncProfilesForUpdate() {
  if (!isNative()) return
  try {
    nativePut('meta', 'accountProfiles', loadAccountProfiles()).then(() => {
      const command = { action: 'start', accountOnly: true }
      if (window.fgoDesktop) window.fgoDesktop.command(command)
      else if (window.FgoAndroid) window.FgoAndroid.command(JSON.stringify(command))
    }).catch(error => { state.data.error = `账号预计算未启动：${error.message}`; render() })
  } catch (error) { state.data.error = `账号列表保存失败：${error.message}` }
}
function activateAccount(id) {
  saveCurrentPlanner()
  const profile = selectAccountProfile(id)
  if (profile.region !== state.region) setRegion(profile.region)
  stopRecWorker(); state.recBusy = false; state.solverProgress = null; state.recommend = null; state.battle = null
  Object.assign(state, { account: profile.account, accountProfileId: profile.id, accountSavedAt: profile.savedAt, mode: 'account', accountProjection: null,
    comparisonTeams: [], comparisonEditing:-1, comparisonSearch:{}, lockIds: [], preferIds: [], frontIds: [0,0,0], slotPins: [], pinCes: [], pinSprites: [], priorities: [], filter: emptyRosterFilter(),
    teapot: false, allowSupport: true, bond15Aura: true, optimizeBy: 'total', spriteMode: 'bond_first', grandPosition: 0, solverMode: 'bond', farmPref: 'balanced',
    slots: [1,2,3,4,5,6].map(p => blankSlot(p, p <= 3)), costLimit: '', costLocked: false, accountCost: 0 })
  applyAccountCost(profile.account); restoreProfilePlanner(profile); applySlotPinsToCards(); applyModeBonds(); syncProfilesForUpdate()
}
async function currentAccountProjection() {
  if (!isNative() || !state.accountProfileId || !state.data.joinedEffectIndex) return null
  const profile = currentAccountProfile(state.region), bundle = state.data.regionBundles[state.region]
  if (!profile || !bundle) return null
  const publicKey = await regionCacheKey(bundle, state.region)
  return nativeGet('cache', await accountProjectionKey(publicKey, profile)).catch(() => null)
}

function costInputBad() {
  return Boolean(state.recommend && !state.recommend.ok && /COST/.test(state.recommend.error || ''))
}

function recAltList(rec) {
  return renderPlanGroups({ ...rec, plans: rec.plans || [rec] }, recNowBox)
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
  if(!state.allowSupport)return ''
  const seen=assistCandidates(rec.allPlans || rec.plans || [], state.data.ces)
  const fixed=(rec.slots||[]).find(s=>s.isSupport&&s.supportKind)
  const pool=equipmentDomainForParty({slots:rec.slots||[],ces:state.data.ces,mode:state.mode,account:state.account,filter:state.filter}).supportCes
  const list=(fixed?pool.filter(c=>c.id===fixed.ceId):pool).map(c=>({id:c.id,name:c.name,total:seen.find(s=>s.id===c.id)?.total}))
  if (!list.length) return ''
  const locked = Number(rec.lockSupportCeId) || 0
  return `<div class="rec-assist">
    <h2>筛选助战普通礼装（${list.length} 张）</h2>
    <p>列出当前筛选条件下全部可选羁绊礼装。${fixed?'本关助战礼装固定。':'点击后按该普通礼装重新求最高分；再次点击取消限制。冠位报酬礼装单独保留，不与普通栏混为一项。'}分数仅为当前已载入队伍中出现的分数，未出现不代表无解。</p>
    <label>查找礼装 <input id="assistCeQuery" placeholder="名称或 ID" /></label>
    <div class="ce-kit-list">${list
      .map((item) => {
        const ce = ceById(item.id) || { id: item.id, name: item.name }
        return `<button type="button" class="ce-kit-card ${item.id === locked ? 'active' : ''}" data-assist-ce="${item.id}" data-assist-name="${esc(item.name)}" ${fixed?'disabled':''}>${ceImgTag(ce, '', 'kit')}<figcaption><strong>${esc(item.name)}</strong><span>${item.total??'尚无本页结果'}</span></figcaption></button>`
      })
      .join('')}</div>
  </div>`
}

function slotNameWithForm(slot) {
  const name = slot.label || ''
  const form = slot.formLabel || ''
  if (!form || form === '默认灵基' || form === '第3阶段' || form === '默认战斗形象') return name
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
    <input id="${svt ? 'banSvtQuery' : 'banCeQuery'}" type="text" value="${esc(query)}" placeholder="${svt ? '搜外号 / 名字' : '搜礼装名 / 外号'}" />
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
          `<button type="button" class="suggest-item" data-ban-add="svt" data-id="${item.id}">${faceImg(item)}<span>${esc(item.name)}</span></button>`,
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
  const constraintCount = state.preferIds.length + state.lockIds.length + state.slotPins.length + state.pinCes.length + state.pinSprites.length + state.priorities.filter(rule => rule.enabled !== false).length + Number(rosterFilterActive(state.filter))
  return `<section class="rec-setup">
    <div class="planner-block quest-block">
      <h2 class="section-heading"><span>02</span> 关卡与消耗</h2>
      <div class="rec-quest">
        <div class="quest-field quest-picker-field">
          ${questSelectHtml()}
          <p class="quest-picked">${esc(questPickedLine())}</p>
          ${questBonusLine()}
        </div>
        <div class="quest-field">
          <label>基础羁绊</label>
          <input id="base" class="num" inputmode="numeric" pattern="[0-9]*" value="${esc(state.base)}" placeholder="选择关卡后填入基础羁绊" />
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

      </div>
    </div>
    <div class="planner-side"><div class="planner-block opt-block">
      <h2 class="section-heading"><span>03</span> 配队规则</h2>
      <div class="rec-opts">
        <label class="check"><input id="allowSupport" type="checkbox" ${state.allowSupport ? 'checked' : ''} ${(questPartyRules(currentQuestPayload()).noSupport || questPartyRules(currentQuestPayload()).requiresSupport) ? 'disabled' : ''} /><span>留助战位</span></label>
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
    <details class="team-constraints" id="teamConstraints" ${state.constraintsOpen ? 'open' : ''}><summary>更多条件：主练、锁定与筛选${constraintCount ? ` · 已启用 ${constraintCount} 项` : '（可选）'}</summary>
    <div class="planner-block roster-block">
      <span class="block-label">必须上场</span>
      <div class="rec-pickers">
        <div class="rec-picker">
          <label>优先培养的从者</label>
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
    </details>
    ${queryContextHtml(currentQueryContext(), '准备计算')}
    <div class="rec-go">
      <button id="recommendNow" type="button" class="rec-go-btn${state.recBusy ? ' busy' : ''}">${esc(state.recBusy ? '停止计算' : '开始推荐羁绊队伍')}</button>
      ${state.recBusy ? `<p class="rec-busy-hint" id="recBusyHint">${esc(busyHint())}</p>` : ''}
    </div></div>
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
  if(slot.fixedEquips?.length)return slot.fixedEquips.map(item=>({ce:ceById(item.id)||item.ce||{id:item.id,name:item.name},tag:'系统固定',mlb:item.mlb!==false,support:true}))
  if (slot.ceId) add(slot.ceId, slot.isGrand ? '普通' : '', slot.ceMlb)
  if (slot.isGrand && slot.ceRewardId) add(slot.ceRewardId, '报酬', slot.ceRewardMlb)
  return out
}

function ceKitItem(item) {
  const tags = [item.tag, item.mlb === false ? '未满破' : ''].filter(Boolean)
  return `<figure class="ce-kit-card" data-support="${item.support}" data-mlb="${item.mlb}">${ceImgTag(item.ce, '', 'kit')}<figcaption><strong>${esc(item.ce.name)}</strong>${tags.length ? `<span>${esc(tags.join(' · '))}</span>` : ''}</figcaption></figure>`
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
  const unassessable = Boolean(st.placeholderEnemies || st.assumedCombatStats)
  const gaps = [
    st.dataNote || '',
    st.placeholderEnemies ? '敌人 HP / 职阶尚未入库，战斗计划只是结构模板' : '',
    st.assumedCombatStats ? '从者攻击/宝具数据未入库，不按假设数值开战' : '',
  ].filter(Boolean)
  return `<details class="battle-note" open>
    <summary>${esc(title)} · ${unassessable ? '数据不足' : esc(battle.stability || '')}</summary>
    <p>${esc(battle.claim || battle.note || '')}</p>
    <p>${unassessable ? '无法评估通关、失败率和回合数' : `${esc(clear)} · 失败率 ${esc(failRate)} · 平均回合 ${esc(avgTurns)}`}</p>
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
  return `<p class="query-stats">${q.cacheHit ? '复用本机已完成结果 · ' : ''}检索 raw ${c.raw || 0} / 合法 ${c.legal || 0} · 节点 ${s.nodes || 0} · 组装 ${r.assembled || 0} · 去重 ${r.unique || 0} · 返回 ${r.returned || 0} · ${Math.round(t.totalMs || 0)}ms</p>`
}

const teamReportFormats={}
function teamExportControls(scope,label='导出队伍'){
  return `<div class="team-export-controls"><label>${label} <select data-team-export-format="${scope}">${[['html','单文件档案 HTML（离线直接看）'],['png','图片 PNG（当前一队）'],['pdf','PDF'],['docx','Word DOCX（可编辑）'],['json','队伍数据 JSON（可重新打开）']].map(([value,text])=>`<option value="${value}" ${value===(teamReportFormats[scope]||'html')?'selected':''}>${text}</option>`).join('')}</select></label><button type="button" data-team-export="${scope}">导出</button><span data-team-export-status="${scope}" role="status"></span></div>`
}
function recommendPanel(slots) {
  const rec = state.recommend
  if (!rec) return ''
  if (!rec.ok) return `<div class="case error">${esc(rec.error)}</div>${scoreTeamResultsHtml(rec.scoreTeamResults)}`
  const alts = recAltList(rec)
  return `<section class="recommend">
    ${rec.queryContext ? `<details class="rec-note"><summary>本方案使用的条件</summary>${queryContextHtml(rec.queryContext)}</details>` : ''}
    ${alts}
    ${teamExportControls('recommend','保存当前推荐队伍')}
    ${rec.resultStatus?.engine==='2.1'?`<p class="query-stats">2.1 · ${rec.resultStatus.ai?.enabled ? `AI 辅助已开启 · 候选起点已核实 ${rec.resultStatus.ai.seedFeasible||0} 个` : 'AI 辅助已关闭'} · 精确搜索${rec.resultStatus.optimality==='search-complete'?'完成':'中'}</p>`:''}
    ${aiBoundText(rec.resultStatus?.ai)?`<p class="query-stats">${esc(aiBoundText(rec.resultStatus.ai))}</p>`:''}
    ${scoreTeamResultsHtml(rec.scoreTeamResults)}
    ${rec.scoreFamilyRef?`<div class="score-variant-controls" aria-label="同分方案切换"><div class="account-bar-actions"><button type="button" id="scoreDifferentMembers" data-score-variant="members">换不同从者组合</button><button type="button" id="scoreDifferentEquipment" data-score-variant="equipment">从者不变，只换礼装</button><button type="button" id="scoreAnyVariant" data-score-variant="all">查看其他同分方案（从者／礼装／站位）</button><button type="button" id="scoreVariantCancel" ${scoreVariantRequest?'':'hidden'}>停止查找同分方案</button><button type="button" id="scoreVariantReset">从头浏览</button></div><p id="scoreVariantHint" role="status">${esc(scoreVariantRequest?.notice||rec.variantNotice||'固定从者时保留当前灵基、站位和冠位身份，切换礼装卡片、满破与栏位分配；浏览所有已收集方案组，不限于当前页。当前显示的实际队伍可加入对比或导出。')}</p></div>`:''}
    ${scoreTeamFamilyHtml(rec.equivalence,id=>state.data.servants.find(s=>s.id===id)?.name||id,id=>state.data.ces.find(c=>c.id===id)?.name||id)}
    ${rec.resultStatus ? `<p id="searchResultStatus" class="query-stats">${esc(searchStatusLabel(rec.resultStatus))}${rec.resultStatus.curveCoverage === 'candidate-only' ? ' · 曲线候选已精算，未覆盖部分已搜索补齐' : ''}</p>` : ''}
    ${rec.summary ? `<details class="rec-note"><summary>怎么算的</summary><p>${esc(rec.summary)}</p></details>` : ''}
    ${rec.queryStats ? `<details class="rec-note"><summary>计算诊断</summary>${queryStatsLine(rec)}${rec.queryContext?.version ? `<p class="query-stats">${esc(rec.queryContext.version)}</p>` : ''}</details>` : ''}
    ${recAssistList(rec)}
    ${ceKitBar(rec.slots || slots)}
    <button id="equipmentCurves" type="button">比较此队伍的礼装全组合曲线</button>
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
          <span>${esc(item.name)}${item.formLabel ? `（${esc(item.formLabel)}）` : ''}</span>
        </button>`
      }
      return `<button type="button" class="suggest-item" data-ce="${item.id}" data-ce-field="${esc(ceField || 'ceId')}">
        ${imgWithFallbacks(item.face || item.icon || '', item.name)}
        <span>${esc(item.name)}</span>
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

function battleFormKey(key) {
  const k = String(key || '')
  if (!k || k === 'default' || /^a\d+$/.test(k)) return 'default'
  return k
}

let alternativeCacheKey='', alternativeCache=new Map()
function partyOptions() {
  return { servants:state.data.servants,ces:state.data.ces,mode:state.mode,account:state.account,region:state.region,
    base:parseBase(state.base),teapot:state.teapot,bond15Aura:state.bond15Aura,
    quest:currentQuestPayload(),bondBonuses:state.data.bondBonuses,filter:state.filter,
    questType:state.questType,questClass:solverQuestClass(state.questType,state.questClass),costLimit:state.costLimit,allowSupport:state.allowSupport,
    requiredIds:[...state.lockIds,...state.preferIds],slotPins:[...state.slotPins,...state.frontIds.map((id,i)=>({position:i+1,svtId:id})).filter(p=>p.svtId)] }
}
function renderAnySvtNote(slot) {
  if(slot.isSupport||!slot.filled||!slot.anySvt)return ''
  const key=queryConditionKey(state)+String(state.data.currentActivity?.activityState||'')+JSON.stringify(state.slots.map(s=>s.extraPassives||null))
  if(key!==alternativeCacheKey){alternativeCacheKey=key;alternativeCache.clear()}
  if(!alternativeCache.has(slot.position)){
    const entries=slot.altSvtForms?.length?slot.altSvtForms:(slot.altSvtIds||[]).map(id=>({id,formKey:'default',formLabel:'第3阶段'}))
    alternativeCache.set(slot.position,interchangeableMembers(state.slots,slot.position,entries,partyOptions()))
  }
  const entries=alternativeCache.get(slot.position)
  const names=entries.filter(e=>e.sameEffect).map(entry=>{
    const svt=state.data.servants.find(s=>Number(s.id)===entry.id)
    const label=`${svt?.name||entry.id}（${battleAppearanceLabel(entry.formLabel,entry.formKey)}）`
    return `<span class="any-member"><button type="button" class="name-detail" data-open-detail="svt" data-id="${entry.id}" data-detail-form="${esc(entry.formKey||'')}" data-detail-scope="recommendations">${esc(label)}</button>${entry.onField?'<span class="in-party">已上场</span>':`<button type="button" data-alt-apply="${entry.id}" data-alt-form="${esc(entry.formKey||'')}" data-alt-position="${slot.position}">换用</button>`}</span>`
  })
  return `<div class="any-svt"><strong>任意从者位</strong>：${names.join('、')||'当前条件下暂无其他等效从者'}。已重新核对全队曲线、COST、羁绊状态、礼装命中和该从者提供的加成。${entries.some(e=>!e.sameEffect)?'<span>条件变化后不再等效的从者已排除。</span>':''}</div>`
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
        '搜编号 / 名字 / 外号',
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
      <details class="slot-explanation"><summary>加成与形态说明</summary>
      ${!slot.isSupport && svt ? `<div class="meta">${classLabel(slot.className || svt.className)} · ${attrLabel(slot.attribute || svt.attribute)} · ${slot.rarity ?? svt.rarity}星${selectedArt(slot) && selectedArt(slot).kind === 'costume' ? ` · 灵衣 ${esc(selectedArt(slot).label)}` : selectedArt(slot) && selectedArt(slot).kind === 'ascension' ? ` · ${esc(selectedArt(slot).label)}` : ''}</div>` : ''}
      ${anySvtNote}
      ${slot.ceMiss ? `<div class="reason">${esc(slot.ceMiss)}</div>` : ''}
      ${slot.spriteReason ? `<div class="reason">${esc(slot.spriteReason)}</div>` : ''}
      ${renderEventBonusPanel(slot)}
      ${res && !res.eligible && slot.filled ? `<div class="reason">${res.reasonText}</div>` : ''}
      ${lines ? `<div class="lines">${lines}</div>` : ''}
      ${res && res.eligible ? `<div class="lines-sum">${res.afterFront} → ${res.afterRate}${res.flat ? ` +${res.flat}` : ''}${res.teapotMul === 2 ? ' ×2' : ''} = ${res.final}</div>` : ''}
      </details>
    </article>
  `
}

function parseBase(raw) {
  if (raw === '' || raw === null) return NaN
  if (!/^\d+$/.test(String(raw))) return Number(raw)
  return Number(raw)
}

function preparedSlots() {
  return settleParty(state.slots,partyOptions()).slots
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
  const chosen = currentGrandSelection().position
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
  url.searchParams.set('v', 'all-score-teams-v9-score-recovery')
  return url
}

function stopRecWorker() {
  scoreVariantRequest=null
  recJobId += 1
  recPostedJobId = null
  recStopRequestedId = null
  if (!recWorker) return
  recWorker.terminate()
  recWorker = null
}

function cancelRecommend() {
  if(state.solverMode==='bond'&&recWorker&&recPostedJobId===recJobId){
    recStopRequestedId=recJobId
    recWorker.postMessage({id:recJobId,type:'score-cancel'});
    state.recBusy=false;state.solverProgress=null
    state.recommend??={ok:false,error:'正在停止计算并保留已得到的结果。',scoreTeamResults:{bestScore:null,bestCount:0,otherCount:0,grouped:true,complete:false,maximumProven:false}}
    state.recommend.scoreTeamResults={...state.recommend.scoreTeamResults,stopping:true}
    if(state.workspaceView==='conditions')state.workspaceView='results'
    render();return
  }
  stopRecWorker()
  state.recBusy = false
  state.solverProgress = null
  state.recommend = { ok: false, error: '已停止，尚未计算出可展示的合法配队；这不表示当前条件无解。' }
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
  state.workspaceView = 'results'
  if (plan?.ok) plan.queryContext = currentQueryContext()
  state.recommend = plan
  if (!plan || !plan.ok) {
    render()
    const costEl = document.getElementById('costLimit')
    if (costEl && /COST/.test((plan && plan.error) || '')) costEl.focus()
    return
  }
  await applyRecommendPlan(plan, plan.plans || [plan], plan.chosen || 0)
}

// Streaming updates refresh the result archive without taking focus from the
// comparison editor or replacing a manually selected physical team.
async function refreshScorePayload(payload){
  if(state.recommend?.variantSelected&&state.recommend?.scoreTeamResults?.bestScore===payload?.value?.scoreTeamResults?.bestScore)payload={...payload,value:{...state.recommend,scoreTeamResults:payload.value.scoreTeamResults,resultStatus:payload.value.resultStatus}}
  if(state.workspaceView==='results'||!state.recommend?.ok&&state.workspaceView==='conditions')return applySolverPayload(payload)
  const plan=payload?.value
  if(!plan)return
  state.recommend={...plan,queryContext:state.recommend?.queryContext||currentQueryContext()}
  const panel=document.getElementById('scoreTeamResults')
  if(panel){panel.outerHTML=scoreTeamResultsHtml(plan.scoreTeamResults);bindScoreTeamPages()}
  const button=document.getElementById('recommendNow')
  if(button){button.textContent=state.recBusy?'停止计算':'开始推荐羁绊队伍';button.classList.toggle('busy',state.recBusy)}
  const hint=document.getElementById('recBusyHint')
  if(hint){if(state.recBusy)hint.textContent=busyHint();else hint.remove()}
}
let scorePageRequest=0,scoreVariantRequest=null
function updateVariantBusy(){
  const busy=!!scoreVariantRequest
  for(const el of document.querySelectorAll('[data-score-variant]'))el.disabled=busy
  const cancel=document.getElementById('scoreVariantCancel');if(cancel)cancel.hidden=!busy
}
function stopVariantBrowse(reset=false){
  if(scoreVariantRequest||reset)recWorker?.postMessage({id:recJobId,type:'score-variant-cancel',request:scoreVariantRequest?.request,reset})
  scoreVariantRequest=null;++scorePageRequest;updateVariantBusy()
  const text=reset?'已回到同分方案开头，点击所需方式重新浏览。':'已停止查找同分方案；当前显示的队伍保持不变。'
  if(state.recommend)state.recommend.variantNotice=text
  const hint=document.getElementById('scoreVariantHint');if(hint)hint.textContent=text
}
function bindScoreTeamPages(){
  const badge=document.getElementById('score-tab-status');if(badge)badge.textContent=scoreTeamTabLabel(state.recommend?.scoreTeamResults,state.recBusy,state.recommend?.ok)
  updateVariantBusy()
  for(const button of document.querySelectorAll('[data-score-variant]'))button.onclick=()=>{
    const rec=state.recommend;if(!recWorker||!rec?.scoreFamilyRef)return
    const mode=button.dataset.scoreVariant,request=++scorePageRequest
    rec.variantSelected=true
    scoreVariantRequest={request,bestScore:rec.scoreTeamResults?.bestScore,notice:'正在逐套核对同分方案，可停止查找…'};updateVariantBusy()
    document.getElementById('scoreVariantHint').textContent=scoreVariantRequest.notice
    recWorker.postMessage({id:recJobId,type:'score-variant',request,mode,ref:rec.scoreFamilyRef,currentMembers:memberCompositionKey(rec),currentTeam:packedTeamOf(rec),page:{kind:rec.scoreTeamResults?.kind||'best',offset:rec.scoreTeamResults?.offset||0,length:rec.plans?.length||1}})
  }
  const cancel=document.getElementById('scoreVariantCancel');if(cancel)cancel.onclick=()=>stopVariantBrowse()
  const reset=document.getElementById('scoreVariantReset');if(reset)reset.onclick=()=>stopVariantBrowse(true)
  for(const button of document.querySelectorAll('[data-score-export]'))button.onclick=()=>{
    if(!recWorker)return;button.disabled=true;button.textContent='正在导出…';recWorker.postMessage({id:recJobId,type:'score-export',queryContext:state.recommend?.queryContext,selectedKey:physicalVariantKey(state.recommend||{})})
  }
  for(const button of document.querySelectorAll('[data-score-kind],[data-score-page]'))button.onclick=()=>{
    const info=state.recommend?.scoreTeamResults;if(!info||!recWorker)return
    if(scoreVariantRequest)stopVariantBrowse()
    const kind=button.dataset.scoreKind||info.kind||'best',offset=button.dataset.scoreKind?0:Number(button.dataset.scorePage)
    recWorker.postMessage({id:recJobId,type:'score-page',request:++scorePageRequest,kind,offset})
  }
}
function invalidateScoreTeamResult(info){
  if(!info||!state.recommend)return
  state.recBusy=false;state.solverProgress=null
  const button=document.getElementById('recommendNow');if(button){button.textContent='开始推荐羁绊队伍';button.classList.remove('busy')}
  state.recommend.scoreTeamResults={...state.recommend.scoreTeamResults,...info,complete:false,maximumProven:false,stopped:true}
  state.recommend.resultStatus={...state.recommend.resultStatus,optimality:'candidate'}
  const panel=document.getElementById('scoreTeamResults')
  if(panel){panel.outerHTML=scoreTeamResultsHtml(state.recommend.scoreTeamResults);bindScoreTeamPages()}
}
function showScoreTeamError(error){
  const text=document.getElementById('scoreTeamProgress');if(text)text.textContent=String(error.message||error)
}
function onRecWorkerMessage(event) {
  const msg = event.data || {}
  if(msg.id!==recJobId)return
  if(msg.type==='score-variant-progress'){
    if(scoreVariantRequest?.request===msg.request){scoreVariantRequest.notice=`正在查找同分方案，已核对 ${msg.checked} 套，可停止查找…`;const hint=document.getElementById('scoreVariantHint');if(hint)hint.textContent=scoreVariantRequest.notice}
    return
  }
  if(msg.type==='score-variant'){
    if(msg.request!==scorePageRequest)return
    scoreVariantRequest=null;updateVariantBusy()
    if(msg.ref&&JSON.stringify(msg.ref)!==JSON.stringify(state.recommend?.scoreFamilyRef)){const hint=document.getElementById('scoreVariantHint');if(hint)hint.textContent='当前方案已更新，请再次选择切换方式。';return}
    if(msg.ok&&msg.plan){
      const rec=state.recommend,source=msg.pageResult||rec,plans=[...source.plans],ref=msg.plan.scoreFamilyRef
      const absolute=(ref.offset||0)+(ref.index||0),offset=source.scoreTeamResults?.offset||0
      const chosen=msg.pageResult?source.chosen:!ref.preview&&absolute>=offset&&absolute<offset+plans.length?absolute-offset:rec.chosen||0
      plans[chosen]={...msg.plan,variantSelected:true,variantNotice:msg.mode==='equipment'?'已切换同分礼装：从者、灵基、站位与冠位身份保持不变。当前实际队伍可加入对比或导出。':'已切换到另一套经过精确结算的同分队伍，可加入对比或导出。'}
      if(msg.pageResult)applySolverPayload({kind:'bond',value:{...source,...plans[chosen],plans,allPlans:plans,chosen,scoreTeamResults:source.scoreTeamResults,resultStatus:source.resultStatus}}).catch(showScoreTeamError)
      else applyRecommendPlan(plans[chosen],plans,chosen).catch(showScoreTeamError)
    }else{
      const text=msg.ok?(msg.pending?'当前已收集方案中暂未找到下一套符合要求的队伍，同分补全仍在进行；稍后可继续查看。':state.recommend?.scoreTeamResults?.complete?'当前已收集方案已浏览完；可选择其他切换方式或从头浏览。':'已保存的部分方案已浏览完，全部同分尚未收齐；可从头浏览。'):msg.error
      if(state.recommend)state.recommend.variantNotice=text
      const hint=document.getElementById('scoreVariantHint');if(hint)hint.textContent=text
    }
    return
  }
  if(msg.type==='score-export'){
    if(msg.ok){const a=document.createElement('a');a.href=msg.url;a.download=msg.name;a.click();setTimeout(()=>URL.revokeObjectURL(msg.url),60000)}
    else{invalidateScoreTeamResult(msg.scoreTeamResults);showScoreTeamError(Error(msg.error))}
    const button=document.querySelector('[data-score-export]');if(button){button.disabled=false;button.textContent='导出全部已得到队伍（JSONL）'}
    return
  }
  if(msg.type==='score-page'){
    if(msg.request!==scorePageRequest)return
    if(msg.ok)applySolverPayload(msg.result).catch(showScoreTeamError)
    else{invalidateScoreTeamResult(msg.scoreTeamResults);showScoreTeamError(Error(msg.error))}
    return
  }
  if(msg.type==='score-window'){
    const info=state.recommend?.scoreTeamResults||{},next=msg.result?.value?.scoreTeamResults
    if((!info.kind||info.kind==='best')&&(!(info.offset>0)||info.pageScore!==next?.bestScore))refreshScorePayload(msg.result).catch(showScoreTeamError)
    return
  }
  if(['score-start','score-complete','score-stopped'].includes(msg.type)){
    state.recBusy=msg.type==='score-start'&&recStopRequestedId!==msg.id
    state.solverProgress=null
    const info=msg.result?.value?.scoreTeamResults
    if(info){
      if(msg.type==='score-stopped')Object.assign(info,{stopped:true,stopping:false})
      else if(msg.type==='score-start'&&recStopRequestedId===msg.id)info.stopping=true
    }
    refreshScorePayload(msg.result).catch(showScoreTeamError);return
  }
  if(msg.type==='score-progress'){
    if(scoreVariantRequest&&msg.progress.bestScore!==scoreVariantRequest.bestScore)stopVariantBrowse()
    const resultStatus={...state.recommend?.resultStatus,...msg.preview?.resultStatus,source:'all-score-teams',
      optimality:msg.progress.maximumProven&&state.recommend?.scoreTeamResults?.kind!=='other'?'maximum-proven':'candidate',
      maximumProven:Boolean(msg.progress.maximumProven),allScoreTeamsComplete:false}
    state.solverProgress=msg.progress
    for(const id of ['recBusyHint','scoreTeamPendingProgress']){
      const hint=document.getElementById(id);if(hint)hint.textContent=busyHint()
    }
    if(state.recommend?.ok){
      const prior=state.recommend.scoreTeamResults||{}
      state.recommend.resultStatus=resultStatus
      state.recommend.scoreTeamResults={...prior,...msg.progress,...(recStopRequestedId===msg.id?{stopping:true}:{})}
      if(msg.preview&&(!prior.kind||prior.kind==='best')&&!(prior.offset>0)){
        refreshScorePayload({kind:'bond',value:{...msg.preview,plans:[msg.preview],scoreTeamResults:state.recommend.scoreTeamResults,resultStatus}}).catch(showScoreTeamError)
      }else{
        const panel=document.getElementById('scoreTeamResults')
        if(panel){panel.outerHTML=scoreTeamResultsHtml(state.recommend.scoreTeamResults);bindScoreTeamPages()}
        const status=document.getElementById('searchResultStatus');if(status)status.textContent=searchStatusLabel(resultStatus)
      }
    }else if(msg.preview){
      refreshScorePayload({kind:'bond',value:{...msg.preview,plans:[msg.preview],scoreTeamResults:{...msg.progress,kind:'best',offset:0},resultStatus}}).catch(showScoreTeamError)
    }
    return
  }
  if(msg.partial&&state.recommend?.ok){
    state.recBusy=false;state.recommend.scoreTeamResults={...state.recommend.scoreTeamResults,...msg.scoreTeamResults,stopped:true};
    state.recommend.resultStatus={...state.recommend.resultStatus,optimality:'candidate'};
    render();showScoreTeamError(Error(msg.error));return
  }
  if(!state.recBusy)return
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

async function runRecommend({ supportCeId = 0,replaceRunning=false } = {}) {
  if (!state.data.regionReady) {
    state.recommend = { ok: false, error: '当前区服的独立快照尚未就绪，请稍后重试。' }
    render()
    return
  }
  if (state.recBusy) {
    if(replaceRunning){stopRecWorker();state.recBusy=false}
    else{cancelRecommend();return}
  }
  const id=++recJobId
  state.recBusy = true
  state.solverProgress = null
  state.battle = null
  state.recommend = null
  render()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  if (!state.recBusy || id!==recJobId) return
  await aiReady
  const accountProjection = await currentAccountProjection().catch(() => null)
  if (!state.recBusy || id!==recJobId) return
  const opts = {
    base: parseBase(state.base),
    teapot: state.teapot,
    servants: state.data.servants,
    ces: state.data.ces,
    account: state.account,
    mode: state.mode,
    allowSupport: state.allowSupport,
    lockSupportCeId: supportCeId,
    preferSvtIds: state.preferIds,
    lockSvtIds: state.lockIds,
    questType: state.questType,
    questClass: solverQuestClass(state.questType, state.questClass),
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
    grandPosition: currentGrandSelection().position,
    quest: currentQuestPayload(),
    bondBonuses: state.data.bondBonuses || null,
    pref: state.farmPref,
    solverIndex: state.data.solverIndex || null,
    solutionIndex: state.data.solutionIndex || null,
    factorIndex: state.data.factorIndex || null,
    joinedEffectIndex: state.data.joinedEffectIndex || null,
    accountProfileId: state.accountProfileId,
    accountProjection,
    curveIndex: state.data.curveIndex || null,
    useInventoryCurveSolver: true,
    allScoreTeams: state.solverMode==='bond',
    ...aiSettings.requestOptions(aiUpdater.model),
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
  try {
    recPostedJobId=id
    await postRecommendRequest(ensureRecWorker(),{ id, solverMode: state.solverMode, opts })
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
    queryContext: plan.queryContext || prev.queryContext,
    scoreTeamResults: plan.scoreTeamResults || prev.scoreTeamResults,
    equivalence: plan.equivalence || null,
    resultStatus: plan.resultStatus || prev.resultStatus,
    queryStats: plan.queryStats || prev.queryStats,
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
  // Applying this result replaces the editable party deliberately. Subsequent
  // user edits invalidate the recommendation like other calculation changes.
  renderedConditionKey = queryConditionKey(state)
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
      if (!nice || slot.svtId !== svt.id || state.slots[slot.position - 1] !== slot) return
      slot.svtArts = artsFromNiceWithForms(nice, svt.forms)
      applyArtToSlot(slot, svt, pickArt(slot.svtArts, slot.svtArtKey || ''))
      slot.extraPassives = extractExtraPassives(nice)
    }),
  )
  render()
}

function detailLayout() {
  return layoutMode(window.innerWidth, window.innerHeight).startsWith('phone') ? 'phone' : 'pc'
}

function detailPanelHtml() {
  return renderDetailPanel({
    detail: state.detail,
    servants: state.data.servants,
    ces: state.data.ces,
    catalog: state.data.bondBonuses,
    quest: currentQuestPayload(),
    assetIndex: state.data.imageIndex,
    layout: detailLayout(),
    region: state.region,
    tab: state.detailTab,
    slots: preparedSlots(),
    plans: state.recommend?.allPlans || state.recommend?.plans || [],
    traits: state.data.traits || [],
  })
}

function paintDetail() {
  const root = document.getElementById('detail-root')
  if (root) root.innerHTML = state.detail ? detailPanelHtml() : ''
}

function closeDetail() {
  if (!state.detail) return
  state.detail = null
  paintDetail()
}

function openDetail(detail) {
  const same =
    state.detail &&
    state.detail.kind === detail.kind &&
    Number(state.detail.id) === Number(detail.id) &&
    Boolean(state.detail.isSupport) === Boolean(detail.isSupport) &&
    state.detail.position === detail.position && state.detail.formKey === detail.formKey && state.detail.scope === detail.scope
  state.detail = same ? null : detail
  if (!same) state.detailTab = 'recv'
  paintDetail()
  if (state.detail && state.detail.kind === 'svt') hydrateServantArt(state.detail.id)
}

async function hydrateServantArt(id) {
  const requestedRegion = state.region
  let nice = null
  try {
    nice = await fetchServantNice(id, state.region)
  } catch {
    nice = null
  }
  if (state.region !== requestedRegion || !state.detail || state.detail.kind !== 'svt' || Number(state.detail.id) !== Number(id)) return
  if (!nice) return
  const kind = state.detail.formKey?.startsWith('c') ? 'costume' : 'ascension'
  const rawId = state.detail.formKey?.slice(1) || '3'
  const graph = nice.extraAssets?.charaGraph?.[kind]?.[rawId]
  const urls = graph ? [graph] : servantGraphUrls(nice, { region: state.region })
  state.detail = { ...state.detail, artUrls: urls, nice }
  const svt = state.data.servants.find(s => s.id === id)
  const current = resolveServantState(svt, state.detail.formKey, nice)
  const missing = (current?.passiveIds || []).filter(skillId =>
    !(nice.classPassive || []).some(s => s.id === skillId) && !(svt?.abilities || []).some(s => s.id === skillId))
  if (missing.length) {
    const skills = await Promise.all(missing.map(async skillId => {
      try { const res = await fetch(`https://api.atlasacademy.io/nice/${state.region}/skill/${skillId}`); return res.ok ? res.json() : null } catch { return null }
    }))
    if (state.region !== requestedRegion || !state.detail || state.detail.id !== id || state.detail.formKey !== current.key) return
    state.detail = { ...state.detail, extraSkills: skills.filter(Boolean) }
  }
  paintDetail()
}

function appearanceSettings() {
  if(!state.appearanceOpen)return ''
  const p=appearancePalette(state.appearance)
  const colors=[['background','页面背景',p.ink],['panel','面板颜色',p.panel],['text','文字颜色',p.cream],['accent','强调颜色',p.gold]]
  return `<section class="appearance-settings" aria-label="界面设置">
    <div class="appearance-heading"><h2>界面设置</h2><p>主题与页面布局可以自由组合，设置保存在本机。</p></div>
    <div class="appearance-fields">
      <label>主题<select id="appearanceTheme"><option value="white" ${state.appearance.theme==='white'?'selected':''}>白色版</option><option value="brown" ${state.appearance.theme==='brown'?'selected':''}>橙棕色版</option></select></label>
      <label>页面布局<select id="appearanceLayout"><option value="multi" ${state.appearance.layout==='multi'?'selected':''}>多页式 · 分区切换</option><option value="single" ${state.appearance.layout==='single'?'selected':''}>一页式 · 全部展开</option></select></label>
      ${colors.map(([key,label,value])=>`<label>${label}<input type="color" data-appearance-color="${key}" value="${value}" aria-label="${label}" /></label>`).join('')}
    </div>
    <div class="appearance-actions"><label class="file">上传背景图片<input id="appearanceImage" type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label><button id="appearanceImageClear" type="button" ${state.appearance.backgroundImage?'':'disabled'}>移除背景图片</button><button id="appearanceColorsReset" type="button">恢复主题颜色</button></div>
    <p class="sub">背景图片仅在本机使用。支持 PNG、JPG、WebP、GIF，最大 5 MB。</p>
    ${state.appearanceError?`<p class="error" role="status">${esc(state.appearanceError)}</p>`:''}
  </section>`
}

let renderedConditionKey = null
function render() {
  applyAppearance(state.appearance)
  const partyRules = questPartyRules(currentQuestPayload())
  if (partyRules.noSupport) state.allowSupport = false
  else if (partyRules.requiresSupport) state.allowSupport = true
  syncGrandSlots()
  const conditionKey = queryConditionKey(state)
  if (renderedConditionKey !== null && conditionKey !== renderedConditionKey) {
    if (state.recBusy || state.recommend?.scoreTeamResults) stopRecWorker()
    state.recBusy = false
    state.solverProgress = null
    state.recommend = null
    state.battle = null
  }
  renderedConditionKey = conditionKey
  if(state.detail?.scope==='team'&&state.detail.position&&state.detail.kind==='svt'){
    const current=state.slots.find(s=>s.position===state.detail.position)
    if(!current?.filled||!current.svtId)state.detail=null
    else if(current.svtId!==state.detail.id||current.svtArtKey!==state.detail.formKey)state.detail={kind:'svt',id:current.svtId,formKey:current.svtArtKey||'',position:current.position,scope:'team',isSupport:!!current.isSupport}
  }
  const slots = preparedSlots()
  const base = parseBase(state.base)
  const output = calcParty(base, state.teapot, slots, { bond15Aura: state.bond15Aura })
  const app = document.getElementById('app')
  const openExplanations=[...app.querySelectorAll('.card .slot-explanation[open]')].map(e=>e.closest('.card').dataset.pos)
  const front = slots.filter((s) => s.position <= 3)
  const back = slots.filter((s) => s.position > 3)
  const dataLine = state.data.error || state.data.status
  const recError = state.recommend && !state.recommend.ok ? state.recommend.error : ''
  
  app.innerHTML = `
    <header>
      <div>
        <p class="brand-kicker">FGO · BOND PLANNER · 2.1</p>
        <h1>羁绊配队</h1>
        <p class="sub">选关卡，按账号与配队条件推荐羁绊队伍。</p>

      </div>
      <div class="top-actions">
        <label class="file">打开队伍档案<input id="teamReportFile" type="file" accept=".html,.json,.jsonl" /></label>
        <button id="formationReview" type="button" ${state.data.regionReady ? '' : 'disabled'}>配队求解器与曲线</button>
        <button id="appearanceToggle" type="button" aria-expanded="${state.appearanceOpen}">界面设置</button>
        <button id="reset" type="button">重置</button>
        <button id="sample" type="button">样例</button>
        <a class="glossary-link" href="./glossary.html">名词</a>
      </div>
    </header>
    ${appearanceSettings()}
    <nav class="workspace-nav" ${state.appearance.layout==='multi'?'role="tablist"':''} aria-label="配队工作区">
      ${[['conditions','设置条件'],['results','推荐结果'],['team','编辑队伍'],['compare','队伍对比']].map(([view,label],index)=>`<button type="button" id="work-tab-${view}" ${state.appearance.layout==='multi'?`role="tab" aria-selected="${state.workspaceView===view}"`:''} aria-controls="work-${view}" data-workspace="${view}"><span>${index+1}</span>${label}${view==='results'?`<i id="score-tab-status">${esc(scoreTeamTabLabel(state.recommend?.scoreTeamResults,state.recBusy,state.recommend?.ok))}</i>`:''}${view==='compare'&&state.comparisonTeams.length?`<i>${state.comparisonTeams.length} 队</i>`:''}</button>`).join('')}
    </nav>
    ${state.data.error ? `<div class="case error" role="alert">${esc(state.data.error)}</div>` : ''}
    ${recError && state.workspaceView!=='results' ? `<div class="case error" role="alert">${esc(recError)}</div>` : ''}
    <section class="workspace-panel" id="work-conditions" role="tabpanel" aria-labelledby="work-tab-conditions" ${state.appearance.layout==='multi' && state.workspaceView!=='conditions'?'hidden':''}>
    <div class="account-section"><h2 class="section-heading"><span>01</span> 区服与账号</h2>
    <section class="account-bar">
      <span class="block-label">区服</span>
      <div class="account-bar-actions tight">
        <button type="button" id="regionCn" class="${state.region === REGION_CN ? 'active' : ''}">国服</button>
        <button type="button" id="regionJp" class="${state.region === REGION_JP ? 'active' : ''}">日服</button>
      </div>
      <span class="block-label">配队</span>
      <div class="account-bar-actions">
        <button type="button" id="modeFree" class="${state.mode === 'free' ? 'active' : ''}">自由配队</button>
        <button type="button" id="modeAccount" class="${state.mode === 'account' ? 'active' : ''}">账号库存</button>
        <label class="file">导入新账号<input id="accountFile" type="file" multiple /></label>
        <label class="file">更新当前账号<input id="accountRefreshFile" type="file" ${state.accountProfileId ? '' : 'disabled'} /></label>
        <button type="button" id="accountPaste">${state.pasteOpen ? '收起粘贴' : '粘贴'}</button>
        <button type="button" id="accountClear" ${state.accountProfileId ? '' : 'disabled'} title="只删除当前账号，其余账号继续保留">删除当前账号</button>
        <button class="teapot ${state.teapot ? 'active' : ''}" id="teapot">${state.teapot ? '茶壶开' : '茶壶'}</button>
      </div>
    </section><div class="account-bar-actions"><label>当前账号 <select id="accountSelect"><option value="">选择本机账号</option>${loadAccountProfiles().profiles.filter(p => p.region === state.region).map(p => `<option value="${esc(p.id)}" ${p.id === state.accountProfileId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>${state.accountProfileId ? `<label>名称 <input id="accountProfileName" maxlength="60" value="${esc(currentAccountProfile(state.region)?.name || '')}"></label><button id="accountRename">保存名称</button>` : ''}</div><p class="account-caption">${esc(accountLine())}</p></div>
    ${inAppBrowser() ? '<p class="import-hint">若当前内置浏览器只打开相册，可改用系统浏览器，或点「粘贴」导入文件全文。</p>' : ''}
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
    ${recSetup()}
    </section>
    <section class="workspace-panel" id="work-results" role="tabpanel" aria-labelledby="work-tab-results" ${state.appearance.layout==='multi' && state.workspaceView!=='results'?'hidden':''}>
      <div class="panel-heading"><div><h2>推荐结果</h2><p>先查看方案，再按需要编辑队伍。</p></div><button type="button" data-workspace="conditions">修改条件</button></div>
      ${state.recommend ? recommendPanel(slots) : `<div class="empty-state"><span>${state.recBusy?'正在搜索配队':'还没有推荐方案'}</span><p>${state.recBusy?'找到合法配队后会在这里显示；搜索节点增加表示计算仍在推进。':'设置关卡、基础羁绊和 COST 后，点击开始推荐。条件更改后需要重新计算。'}</p>${state.recBusy?`<p id="scoreTeamPendingProgress">${esc(busyHint())}</p>`:''}<button type="button" data-workspace="conditions">${state.recBusy?'返回条件页 / 停止计算':'去设置条件'}</button></div>`}
      ${state.recommend?.ok ? `<div class="result-next"><button type="button" data-rec-edit>查看与编辑这支队伍</button></div>` : ''}
    </section>
    <section class="workspace-panel" id="work-team" role="tabpanel" aria-labelledby="work-tab-team" ${state.appearance.layout==='multi' && state.workspaceView!=='team'?'hidden':''}>
      <div class="panel-heading"><div><h2>当前队伍</h2><p>编辑从者、灵基和礼装；钉住需要保留的位置。</p></div><button type="button" data-workspace="conditions">返回条件设置</button></div>
      ${teamExportControls('current','保存当前队伍')}
      <div class="case ${output.ok?'':'error'}">${esc(output.caseText)}</div>
      <section class="party">
        <h3 class="row-title">前排 <small>位置 1—3</small></h3>
        <section class="row">${front.map((slot)=>renderCard(slot,output)).join('')}</section>
        <h3 class="row-title">后排 <small>位置 4—6</small></h3>
        <section class="row back">${back.map((slot)=>renderCard(slot,output)).join('')}</section>
      </section>
      <div class="result-next"><button type="button" data-compare-current>将当前队伍加入对比</button><button type="button" data-workspace="compare">打开队伍对比</button></div>
      <details class="formula"><summary>结算说明与数据版本</summary>
        <p>最终羁绊 = (floor(floor(基础 × (1 + 前排)) × (1 + Σ第二层)) + 肖像) × 茶壶</p>
        <p>己方前排 +20%；助战占前排时己方全体再叠 +4%。</p>
        <p>活动加成按当前区服、所选关卡和从者结算。</p><p>${esc(state.data.versionLine || dataLine)}</p>
      </details>
    </section>
    <section class="workspace-panel" id="work-compare" role="tabpanel" aria-labelledby="work-tab-compare" ${state.appearance.layout==='multi' && state.workspaceView!=='compare'?'hidden':''}>
      ${state.comparisonTeams.length?teamExportControls('comparison','保存全部对比队伍'):''}
      ${state.appearance.layout==='single'||state.workspaceView==='compare'?renderTeamComparison(state.comparisonTeams,partyOptions()):''}
      ${state.appearance.layout==='single'||state.workspaceView==='compare'?renderComparisonEditor(state.comparisonTeams[state.comparisonEditing],state.comparisonEditing,partyOptions(),state.comparisonSearch):''}
    </section>
    <div id="detail-root">${state.detail ? detailPanelHtml() : ''}</div>
  `

  for(const pos of openExplanations){const note=app.querySelector(`.card[data-pos="${pos}"] .slot-explanation`);if(note)note.open=true}
  bind(app)
  hydrateComparisonArt(app,{fetchNice:fetchServantNice,region:state.region})
  saveCurrentPlanner()
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
  for(const select of app.querySelectorAll('[data-team-export-format]'))select.onchange=()=>{teamReportFormats[select.dataset.teamExportFormat]=select.value}
  const reportFile=document.getElementById('teamReportFile')
  if(reportFile)reportFile.onchange=async()=>{
    const file=reportFile.files[0];if(!file)return
    try{const module=await import('./ui/team-report.js');if(file.name.toLowerCase().endsWith('.jsonl'))await module.showScoreArchive(file,state.data);else module.showTeamReport(await module.readTeamReport(file))}
    catch(error){alert('无法打开队伍档案：'+error.message)}finally{reportFile.value=''}
  }
  for(const button of app.querySelectorAll('[data-team-export]'))button.onclick=async()=>{
    const scope=button.dataset.teamExport,format=app.querySelector(`[data-team-export-format="${scope}"]`).value,hint=app.querySelector(`[data-team-export-status="${scope}"]`)
    button.disabled=true;hint.textContent='正在生成文件…'
    try{
      const module=await import('./ui/team-report.js'),rec=state.recommend
      const plans=scope==='comparison'?state.comparisonTeams:scope==='recommend'?[rec]:[{name:'当前队伍',slots:preparedSlots()}]
      const context={...(scope==='recommend'?rec.queryContext:currentQueryContext()),
        配队设置:`茶壶${state.teapot?'开':'关'}；15绊光环${state.bond15Aura?'开':'关'}；助战${state.allowSupport?'允许':'禁用'}；冠位位置 ${currentGrandSelection().position||'不限'}；目标 ${state.optimizeBy==='prefer'?'主练羁绊':'总羁绊'}`,
        出战筛选:Object.entries(state.filter).filter(([,v])=>Array.isArray(v)?v.length:v?.options?.length).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('；')||'未额外限制'}
      const report=module.createTeamReport(plans,partyOptions(),{scope:scope==='comparison'?'全部对比队伍':scope==='recommend'?'当前推荐队伍':'当前队伍',queryContext:context,status:scope==='recommend'?rec.scoreTeamResults:null})
      await module.exportTeamReport(report,format);hint.textContent='已生成，可离线保存查看'
    }catch(error){hint.textContent='导出失败：'+error.message}finally{button.disabled=false}
  }

  document.getElementById('appearanceToggle')?.addEventListener('click',()=>{state.appearanceOpen=!state.appearanceOpen;render()})
  const commitAppearance=()=>{
    state.appearance=normalizeAppearance(state.appearance)
    state.appearanceError=saveAppearance(state.appearance)?'':'当前设置已应用，但浏览器存储空间不足或不允许保存；刷新后可能恢复原设置。'
    render()
  }
  document.getElementById('appearanceTheme')?.addEventListener('change',e=>{
    state.appearance={...state.appearance,theme:e.target.value,colors:{}};commitAppearance()
  })
  document.getElementById('appearanceLayout')?.addEventListener('change',e=>{
    state.appearance.layout=e.target.value;commitAppearance()
  })
  app.querySelectorAll('[data-appearance-color]').forEach(el=>el.addEventListener('change',()=>{
    state.appearance.colors[el.dataset.appearanceColor]=el.value;commitAppearance()
  }))
  document.getElementById('appearanceColorsReset')?.addEventListener('click',()=>{
    state.appearance.colors={};commitAppearance()
  })
  document.getElementById('appearanceImageClear')?.addEventListener('click',()=>{
    state.appearance.backgroundImage='';commitAppearance()
  })
  document.getElementById('appearanceImage')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>5*1024*1024){
      state.appearanceError='请选择不超过 5 MB 的 PNG、JPG、WebP 或 GIF 图片。';render();return
    }
    try{
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})
      state.appearance.backgroundImage=data;commitAppearance()
    }catch{state.appearanceError='无法读取背景图片，请重新选择。';render()}
  })

  app.querySelector('[data-rec-edit]')?.addEventListener('click',async()=>{
    const rec=state.recommend;if(!rec?.ok)return
    await applyRecommendPlan(rec.plans?.[rec.chosen||0]||rec,rec.plans||[rec],rec.chosen||0)
    state.workspaceView='team';render()
  })
  app.querySelectorAll('[data-workspace]').forEach(el=>el.addEventListener('click',()=>{
    state.workspaceView=el.dataset.workspace
    state.detail=null
    render()
    document.getElementById('work-tab-'+state.workspaceView)?.focus({preventScroll:true})
    if(state.appearance.layout==='single')document.getElementById('work-'+state.workspaceView)?.scrollIntoView({behavior:'instant',block:'start'})
    else window.scrollTo({top:0,behavior:'instant'})
  }))
  app.querySelectorAll('.workspace-nav [role="tab"]').forEach(el=>el.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
    event.preventDefault()
    const views=['conditions','results','team','compare'],index=views.indexOf(state.workspaceView)
    const next=event.key==='Home'?0:event.key==='End'?views.length-1:(index+(event.key==='ArrowRight'?1:views.length-1))%views.length
    document.getElementById('work-tab-'+views[next])?.click()
  }))
  bindFilter(app)
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
  app.querySelectorAll('[data-slot-empty]').forEach(el => el.addEventListener('change', () => {
    if (state.recBusy) cancelRecommend()
    const pos = Number(el.dataset.slotEmpty)
    clearSlotPin(pos)
    if (el.checked) {
      upsertSlotPin({ position: pos + 1, svtId: 0, ceId: 0, empty: true })
      state.slots[pos].pinned = true
      state.slots[pos].ceId = 0
      state.slots[pos].ceBondId = 0
      state.slots[pos].ceRewardId = 0
    }
    state.recommend = null
    state.battle = null
    render()
  }))
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
  bindScoreTeamPages()
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
  const assistSearch=document.getElementById('assistCeQuery');if(assistSearch)assistSearch.oninput=()=>{const q=assistSearch.value.trim().toLowerCase();for(const el of app.querySelectorAll('[data-assist-ce]'))el.hidden=!`${el.dataset.assistCe} ${el.dataset.assistName}`.toLowerCase().includes(q)}
  app.querySelectorAll('[data-assist-ce]').forEach((el) => {
    el.addEventListener('click', () => {
      const rec = state.recommend
      if (!rec || !rec.allPlans) return
      const id = Number(el.dataset.assistCe) || 0
      const current = Number(rec.lockSupportCeId) || 0
      // A feasible alternative is not an optimum for the new support constraint.
      runRecommend({ supportCeId: id && id === current ? 0 : id,replaceRunning:true })
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
    stopRecWorker()
    state.recBusy = false
    state.solverProgress = null
    state.recommend = null
    state.mode = 'free'
    applyModeBonds()
    render()
  })
  document.getElementById('modeAccount').addEventListener('click', () => {
    stopRecWorker()
    state.recBusy = false
    state.solverProgress = null
    state.recommend = null
    state.mode = 'account'
    applyModeBonds()
    render()
  })
  document.getElementById('accountFile').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || [])
    for (const file of files) await importAccountFile(file)
  })
  document.getElementById('accountRefreshFile').addEventListener('change', async event => {
    const file = event.target.files?.[0]
    if (file && state.accountProfileId) await importAccountFile(file, state.accountProfileId)
  })
  document.getElementById('accountSelect').addEventListener('change', event => { if (event.target.value) { activateAccount(event.target.value); render() } })
  document.getElementById('accountRename')?.addEventListener('click', () => { updateAccountProfile(state.accountProfileId, { name: document.getElementById('accountProfileName').value }); syncProfilesForUpdate(); render() })
  document.getElementById('accountClear').addEventListener('click', () => {
    removeAccountProfile(state.accountProfileId)
    stopRecWorker()
    state.account = null
    state.accountProfileId = ''
    state.accountProjection = null
    state.accountSavedAt = 0
    state.accountCost = 0
    if (state.costLocked) state.costLimit = ''
    state.costLocked = false
    state.mode = 'free'
    state.recBusy = false
    state.solverProgress = null
    state.recommend = null
    state.battle = null
    state.pasteOpen = false
    pasteDraft = ''
    applyModeBonds()
    const next = currentAccountProfile(state.region)
    if (next) activateAccount(next.id)
    syncProfilesForUpdate()
    render()
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
  document.getElementById('formationReview')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true
    try {
      if (!state.data.regionBundles.JP) state.data.regionBundles.JP = await loadJpSnapshot().catch(() => null)
      openFormationReview({ bundles: state.data.regionBundles, region: state.region, base: parseBase(state.base),
        cost: parseBase(state.costLimit), accountName: state.mode === 'account' ? currentAccountProfile(state.region)?.name || '' : '' })
    } finally { document.getElementById('formationReview').disabled = !state.data.regionReady }
  })
  document.getElementById('equipmentCurves')?.addEventListener('click', () => {
    const chartSlots=state.recommend?.slots||state.slots
    if (chartSlots.some(s => s.isGrand) || (state.slotPins || []).some(p => p.ceId || p.ceRewardId) || (state.pinCes || []).length) {
      alert('此图展开普通队伍的礼装组合。当前包含 Grand 或锁定礼装，请使用配队求解器比较这些约束。'); return
    }
    const domain = equipmentDomainForParty({ slots: chartSlots, servants: state.data.servants,
      ces: state.data.ces, account: state.account, mode: state.mode, filter: state.filter,
      costLimit: parseBase(state.costLimit), bond15Aura: state.bond15Aura,
      lockSupportCeId: state.recommend?.lockSupportCeId || 0 })
    const rules = questPartyRules(currentQuestPayload() || {})
    if (rules.supportPolicy === 'system') { domain.supportLocked=true; domain.supportEmptyOnly=!chartSlots.find(s=>s.isSupport)?.ceId;
      domain.supportCes=domain.supportCes.filter(c=>c.id===chartSlots.find(s=>s.isSupport)?.ceId) }
    openEquipmentChart(domain,{teapot:state.teapot})
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
  document.getElementById('questPickerChange')?.addEventListener('click', () => {
    state.questPickerOpen = true
    render()
    document.getElementById('questBrowseQuery')?.focus({ preventScroll: true })
  })
  const questQuery = document.getElementById('questBrowseQuery')
  bindLiveInput(questQuery, event => {
    const start = caretPos(event.target)
    state.questBrowseQuery = event.target.value
    state.questBrowseLimit = 12
    render()
    restoreCaret(document.getElementById('questBrowseQuery'), start)
  })
  app.querySelectorAll('[data-quest-category]').forEach(el => el.addEventListener('click', () => {
    state.questBrowseCategory = el.dataset.questCategory
    state.questBrowseContent = ''
    state.questBrowseWar = ''
    state.questBrowseLimit = 12
    render()
  }))
  for (const [id, field] of [['questBrowseContent', 'questBrowseContent'], ['questBrowseWar', 'questBrowseWar'], ['questBrowseScope', 'questBrowseScope']]) {
    document.getElementById(id)?.addEventListener('change', event => {
      state[field] = event.target.value
      state.questBrowseLimit = 12
      if (id === 'questBrowseScope') state.questBrowseWar = ''
      render()
    })
  }
  document.getElementById('questSearchClear')?.addEventListener('click', () => {
    state.questBrowseQuery = ''
    state.questBrowseLimit = 12
    render()
    document.getElementById('questBrowseQuery')?.focus()
  })
  document.getElementById('questBrowseReset')?.addEventListener('click', () => {
    state.questBrowseCategory = 'all'
    state.questBrowseContent = state.questBrowseWar = state.questBrowseQuery = ''
    state.questBrowseScope = 'live'
    state.questBrowseLimit = 12
    render()
  })
  document.getElementById('questBrowseMore')?.addEventListener('click', () => {
    state.questBrowseLimit += 12
    const y = window.scrollY
    render()
    window.scrollTo(0, y)
  })
  app.querySelectorAll('[data-quest-result]').forEach(el => el.addEventListener('click', () => {
    const quest = browserQuestList().find(q => questSelectKey(q) === el.dataset.questResult)
    if (!quest) return
    applyPickedQuest(quest)
    render()
    // Selecting a quest must not focus a numeric input or open the mobile keyboard.
  }))
  for (const [id, field] of [['questCascadeBox', 'questCascadeOpen'], ['questBonusBox', 'questBonusOpen'], ['teamConstraints', 'constraintsOpen']]) {
    document.getElementById(id)?.addEventListener('toggle', event => { state[field] = event.target.open })
  }
  const questKindEl = document.getElementById('questKind')
  if (questKindEl) {
    questKindEl.addEventListener('change', () => {
      state.questKind = questKindEl.value
      state.questClass = ''
      state.questDiff = ''
      state.questWar = ''
      state.questId = ''
      state.questPhase = '1'
      state.questName = ''
      state.questAp = 0
      state.base = ''
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
      state.questPhase = '1'
      state.questName = ''
      state.questAp = 0
      state.base = ''
      state.recommend = null
      state.battle = null
      render()
    })
  }
  const questPickEl = document.getElementById('questPick')
  if (questPickEl) {
    questPickEl.addEventListener('change', () => {
      const key = questPickEl.value
      if (!key) {
        state.questId = ''
        state.questPhase = '1'
        state.questName = ''
        state.questAp = 0
        state.base = ''
        state.recommend = null
        state.battle = null
        render()
        return
      }
      const quest = findCascadeQuest(state.data.quests, { kind: state.questKind, key })
      if (!quest) return
      applyPickedQuest(quest)
      render()
    })
  }

  app.querySelectorAll('[data-compare-current]').forEach(el=>el.addEventListener('click',()=>{
    const plan=copyComparisonTeam({slots:state.slots},'当前队伍'),key=physicalPartyKey(plan)
    if(!state.comparisonTeams.some(p=>physicalPartyKey(p)===key))state.comparisonTeams.push(plan)
    state.workspaceView='compare'
    render()
  }))
  app.querySelectorAll('[data-compare-plan]').forEach(el=>el.addEventListener('click',()=>{
    const index=Number(el.dataset.comparePlan),source=state.recommend?.plans?.[index]
    if(!source)return
    const plan=copyComparisonTeam(source,`推荐队伍 ${index+1}`),key=physicalPartyKey(plan)
    if(!state.comparisonTeams.some(p=>physicalPartyKey(p)===key))state.comparisonTeams.push(plan)
    render()
  }))
  app.querySelectorAll('[data-compare-remove]').forEach(el=>el.addEventListener('click',()=>{
    const index=Number(el.dataset.compareRemove)
    state.comparisonTeams.splice(index,1)
    if(state.comparisonEditing===index)state.comparisonEditing=-1
    else if(state.comparisonEditing>index)state.comparisonEditing--
    state.comparisonSearch={};render()
  }))
  app.querySelector('[data-compare-clear]')?.addEventListener('click',()=>{state.comparisonTeams=[];state.comparisonEditing=-1;state.comparisonSearch={};render()})
  app.querySelector('[data-comparison-new]')?.addEventListener('click',()=>{
    state.comparisonTeams.push(copyComparisonTeam({},`自选队伍 ${state.comparisonTeams.length+1}`))
    state.comparisonEditing=state.comparisonTeams.length-1;state.comparisonSearch={};render()
  })
  app.querySelectorAll('[data-comparison-edit]').forEach(el=>el.addEventListener('click',()=>{
    state.comparisonEditing=Number(el.dataset.comparisonEdit);state.comparisonSearch={};render()
    app.querySelector('.comparison-editor')?.scrollIntoView({block:'start',behavior:'instant'})
  }))
  app.querySelectorAll('[data-comparison-copy]').forEach(el=>el.addEventListener('click',()=>{
    const source=state.comparisonTeams[Number(el.dataset.comparisonCopy)]
    if(!source)return
    state.comparisonTeams.push(copyComparisonTeam(source,`${source.name} · 副本`))
    state.comparisonEditing=state.comparisonTeams.length-1;state.comparisonSearch={};render()
    app.querySelector('.comparison-editor')?.scrollIntoView({block:'start',behavior:'instant'})
  }))
  app.querySelectorAll('[data-comparison-use]').forEach(el=>el.addEventListener('click',()=>{
    const source=state.comparisonTeams[Number(el.dataset.comparisonUse)]
    if(!source||comparisonIssues(source,partyOptions()).length)return
    state.slots=copyComparisonTeam(source).slots.map(s=>({...blankSlot(s.position,s.filled),...s}))
    state.workspaceView='team';render()
  }))
  app.querySelector('[data-comparison-done]')?.addEventListener('click',()=>{state.comparisonEditing=-1;state.comparisonSearch={};render()})
  app.querySelector('[data-comparison-name]')?.addEventListener('change',e=>{
    const team=state.comparisonTeams[state.comparisonEditing];if(team)team.name=e.target.value.slice(0,60)||'自选队伍';render()
  })
  const editCompared=(position,patch)=>{
    const index=state.comparisonEditing,team=state.comparisonTeams[index];if(!team)return
    state.comparisonTeams[index]=editComparisonSlot(team,position,patch)
    state.comparisonSearch={};render()
  }
  app.querySelectorAll('[data-comparison-field]').forEach(el=>el.addEventListener('change',()=>{
    if(state.mode==='account'&&['bondLv','bondCap'].includes(el.dataset.field))return
    const value=el.type==='checkbox'?el.checked:el.dataset.field==='svtArtKey'?el.value:Math.max(0,Math.min(16,Number(el.value)||0))
    editCompared(Number(el.dataset.comparisonField),{[el.dataset.field]:value})
  }))
  app.querySelectorAll('[data-comparison-query]').forEach(el=>bindLiveInput(el,()=>{
    const position=Number(el.dataset.comparisonQuery),field=el.dataset.field,caret=caretPos(el)
    state.comparisonSearch={position,field,query:el.value};render()
    restoreCaret(app.querySelector(`[data-comparison-query="${position}"][data-field="${field}"]`),caret)
  }))
  app.querySelectorAll('[data-comparison-pick]').forEach(el=>el.addEventListener('click',()=>{
    const id=Number(el.dataset.id),field=el.dataset.field
    editCompared(Number(el.dataset.comparisonPick),{[field]:id,filled:true,...(field==='svtId'?{svtArtKey:el.dataset.form||'default'}:{})})
  }))
  app.querySelectorAll('[data-comparison-clear-slot]').forEach(el=>el.addEventListener('click',()=>{
    const field=el.dataset.field
    editCompared(Number(el.dataset.comparisonClearSlot),{[field]:0,...(field==='svtId'?{filled:false,svtArtKey:''}:{})})
  }))
  app.querySelectorAll('[data-comparison-swap]').forEach(el=>el.addEventListener('change',()=>{
    const i=state.comparisonEditing,team=state.comparisonTeams[i];if(!team)return
    state.comparisonTeams[i]=swapComparisonSlots(team,Number(el.dataset.comparisonSwap),Number(el.value));state.comparisonSearch={};render()
  }))
  app.querySelectorAll('[data-alt-apply]').forEach(el=>el.addEventListener('click',()=>{
    const id=Number(el.dataset.altApply),position=Number(el.dataset.altPosition),svt=state.data.servants.find(s=>Number(s.id)===id)
    if(!svt||state.slots.some(s=>s.filled&&!s.isSupport&&s.position!==position&&Number(s.svtId)===id))return
    const previous=state.slots.find(s=>s.position===position),old={id:previous.svtId,formKey:previous.svtArtKey||'default',formLabel:previous.formLabel}
    const result=replacePartyMember(state.slots,position,svt,el.dataset.altForm||'',partyOptions())
    state.slots=result.slots
    const next=state.slots.find(s=>s.position===position)
    next.altSvtForms=[...(previous.altSvtForms||[]),old].filter(e=>Number(e.id)!==id||e.formKey!==el.dataset.altForm)
    next.anySvt=true
    if(next.pinned)upsertSlotPin(pinFromSlot(next))
    render()
  }))
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
        slot.extraPassives = []
        slot.anySvt = false;slot.altSvtIds=[];slot.altSvtForms=[]
        slot.svtArtKey = el.dataset.art || ''
        applyArtToSlot(slot, svt, null)
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
        if (slot.svtId !== svt.id || state.slots[pos - 1] !== slot) return
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
              } else if (!slot.filled) {
                upsertSlotPin(pinFromSlot(slot))
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

let activityTimer
let currentActivityKey
function refreshActivityClock() {
  clearTimeout(activityTimer)
  const resolved = resolveCurrentActivity({ catalog: state.data.bondBonuses })
  if (currentActivityKey != null && currentActivityKey !== resolved.activityState) {
    stopRecWorker()
    state.recBusy = false
    state.solverProgress = null
    state.recommend = { ok: false, error: '活动羁绊加成已变更，当前队伍已重算，请重新推荐。' }
    state.battle = null
    state.data.solutionIndex = null
    syncProfilesForUpdate()
    render()
  }
  currentActivityKey = resolved.activityState
  state.data.currentActivity = resolved
  const next = nextActivityBoundary(state.data.bondBonuses, Date.now())
  if (next != null) activityTimer = setTimeout(refreshActivityClock, Math.min(2147483647, Math.max(1, next * 1000 - Date.now())))
}
window.addEventListener('focus', refreshActivityClock)
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshActivityClock() })

async function boot() {
  render()
  try {
    const [servants, ces, quests] = await Promise.all([
      loadServants(),
      loadCes(),
      loadQuests().catch(() => []),
    ])
    state.data.baseServants = servants
    state.data.baseCes = ces
    state.data.baseQuests = quests
    const extras = await Promise.all([
      loadEnemies().catch(() => []),
      loadSkills().catch(() => []),
      loadNoblePhantasms().catch(() => []),
      loadTraits().catch(() => []),
      loadSolverIndex().catch(() => null),
      loadBondBonuses().catch(() => null),
      loadCurrentActivity().catch(() => ({ activities: [] })),
      loadActivityBondIndex().catch(() => null),
      loadActivityScoreIndex().catch(() => null),
      loadSolutionIndex().catch(() => null),
      loadImageIndex().catch(() => null),
      loadCombinationFactors().catch(() => null),
      loadCurveIndex().catch(() => null),
      loadQuestBrowserIndex().catch(() => null),
      loadJoinedEffects().catch(() => null),
    ])
    state.data.enemies = extras[0]
    state.data.skills = extras[1]
    state.data.noblePhantasms = extras[2]
    state.data.traits = extras[3]
    state.data.solverIndex = extras[4] && { ...extras[4], activityScores: extras[8] || null }
    state.data.bondBonuses = extras[5] || { extraPassives: [], questFriendships: [], events: [] }
    state.data.currentActivity = extras[6] || { activities: [] }
    state.data.activityBondIndex = extras[7]
    state.data.solutionIndex = extras[9]
    state.data.factorIndex = extras[11]
    state.data.curveIndex = extras[12]
    state.data.questBrowserIndex = extras[13]
    state.data.joinedEffectIndex = extras[14]
    state.data.imageIndex = extras[10] || buildAssetIndex({ servants, ces, region: state.region })
    const meta = await loadMetadata().catch(() => null)
    const version = await loadVersion().catch(() => null)
    state.data.updateStatus = await loadDataStatus()
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
    state.data.regionBundles.CN = { region: REGION_CN, servants, ces, quests, version,
      enemies: extras[0], skills: extras[1], noblePhantasms: extras[2], traits: extras[3],
      solverIndex: state.data.solverIndex, bondBonuses: state.data.bondBonuses,
      activityBondIndex: extras[7], solutionIndex: extras[9], factorIndex: extras[11],
      curveIndex: extras[12], questBrowserIndex: extras[13], imageIndex: extras[10],
      joinedEffectIndex: extras[14],
      meta, updateStatus: state.data.updateStatus }
    if (state.region === REGION_JP) {
      try { state.data.regionBundles.JP = await loadJpSnapshot() } catch { /* no CN fallback */ }
    }
    applyCatalog()
    if (!browseQuests(browserQuestList(), { category: 'event' }).length) state.questBrowseCategory = 'all'
  } catch (err) {
    state.data.error = '图鉴快照载入失败，仍可手填加成。'
  }
  const cached = currentAccountProfile(state.region)
  if (cached && cached.account && cached.account.ok) {
    state.account = cached.account
    state.accountSavedAt = cached.savedAt
    state.accountProfileId = cached.id
    state.mode = 'account'
    applyAccountCost(cached.account)
    restoreProfilePlanner(cached)
    if (cached.account.region) setRegion(cached.account.region)
  }
  applySlotPinsToCards()
  syncProfilesForUpdate()
  refreshActivityClock()
  render()
}

function bindAccountImportHooks() {
  document.addEventListener(
    'error',
    (event) => {
      const el = event.target
      handleImgError(el)
    },
    true,
  )
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
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-detail-close]')) {
      closeDetail()
      return
    }
    const tabBtn = event.target.closest('[data-detail-tab]')
    if (tabBtn) {
      const tab = tabBtn.dataset.detailTab === 'give' ? 'give' : 'recv'
      if (tab === state.detailTab) return
      state.detailTab = tab
      const panel = tabBtn.closest('.detail-panel')
      if (!panel) return
      panel.querySelectorAll('.detail-tab').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.detailTab === tab)
      })
      panel.querySelectorAll('.detail-tab-body').forEach((body) => {
        body.hidden = body.dataset.tab !== tab
      })
      return
    }
    if (event.target.closest('[data-assist-ce]')) return
    const hit = event.target.closest('[data-open-detail]')
    if (!hit) return
    const kind = hit.dataset.openDetail === 'ce' ? 'ce' : 'svt'
    const id = Number(hit.dataset.id) || 0
    if (!id) return
    const card = hit.closest('.card')
    const slot = card ? state.slots[Number(card.dataset.pos) - 1] : null
    openDetail({
      kind,
      id,
      mlb: slot ? (Number(hit.dataset.id) === slot.ceRewardId ? slot.ceRewardMlb : slot.ceMlb) !== false : hit.closest('[data-mlb]')?.dataset.mlb !== 'false',
      isSupport: slot ? Boolean(slot.isSupport) : hit.closest('[data-support]')?.dataset.support === 'true',
      position: slot?.position || 0,
      scope: hit.dataset.detailScope || (slot ? 'team' : 'recommendations'),
      formKey: hit.dataset.detailForm ?? slot?.svtArtKey ?? '',
    })
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    closeDetail()
  })
}

bindAccountImportHooks()
boot()


