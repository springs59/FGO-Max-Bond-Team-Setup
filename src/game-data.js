const PLAYABLE_TYPES = new Set(['normal', 'heroine'])
const PLAYABLE_CLASSES = new Set([
  'saber',
  'archer',
  'lancer',
  'rider',
  'caster',
  'assassin',
  'berserker',
  'ruler',
  'avenger',
  'moonCancer',
  'shielder',
  'alterEgo',
  'foreigner',
  'pretender',
  'beast',
  'unBeast',
  'beastEresh',
  'unBeastOlgaMarie',
])

export function isPlayableServant(svt) {
  if (!svt || !(Number(svt.collectionNo) > 0)) return false
  if (svt.type === 'normal' || svt.type === 'heroine') return true
  if (svt.type) return false
  return PLAYABLE_CLASSES.has(svt.className)
}

export function slimServants(list) {
  return (list || [])
    .filter(isPlayableServant)
    .map((svt) => ({
      id: svt.id,
      collectionNo: svt.collectionNo,
      name: svt.name,
      originalName: svt.originalName || svt.name,
      className: svt.className,
      attribute: svt.attribute,
      rarity: svt.rarity,
      cost: Number(svt.cost) || (svt.collectionNo === 1 ? 0 : [0, 3, 4, 7, 12, 16][svt.rarity] ?? 16),
      face: svt.face,
      traitIds: (svt.traits || []).map((trait) => trait.id || trait),
      aliases: [],
      forms: slimForms(svt),
    }))
}

const GENERIC_ALIASES = new Set(
  [
    'saber',
    'archer',
    'lancer',
    'rider',
    'caster',
    'assassin',
    'berserker',
    'ruler',
    'avenger',
    'mooncancer',
    'alterego',
    'foreigner',
    'pretender',
    'shielder',
    'beast',
    'servant',
    '从者',
    '剑',
    '弓',
    '枪',
    '骑',
    '术',
    '杀',
    '狂',
    '裁',
    '仇',
    '月',
    '盾',
  ].map((name) => name.toLowerCase()),
)

export function keepAlias(value) {
  const text = String(value || '').trim()
  if (!text) return false
  return !GENERIC_ALIASES.has(text.toLowerCase())
}

function slimForms(svt) {
  const out = []
  const seen = new Set()
  const base = idsOfTraits(svt.traits)
  for (const [id, rec] of Object.entries(svt.costume || {})) {
    const name = String((rec && rec.shortName) || '').trim()
    if (!name) continue
    const key = `c${id}`
    if (seen.has(key)) continue
    seen.add(key)
    const item = { key, name }
    const traitIds = formTraitIds(svt, 'costume', id)
    if (!sameTraitIds(traitIds, base)) item.traitIds = traitIds
    out.push(item)
  }
  const ascBag = ((svt.ascensionAdd && svt.ascensionAdd.individuality) || {}).ascension || {}
  for (const [stage, extra] of Object.entries(ascBag)) {
    if (!extra || !extra.length) continue
    const traitIds = idsOfTraits(extra)
    if (sameTraitIds(traitIds, base)) continue
    const key = `a${stage}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, name: `灵基 ${stage}`, traitIds })
  }
  return out
}

function idsOfTraits(traits) {
  return (traits || []).map((trait) => (trait && typeof trait === 'object' ? trait.id : trait)).filter((id) => id != null)
}

function formTraitIds(svt, kind, rawId) {
  const base = idsOfTraits(svt.traits)
  const bag = (svt.ascensionAdd && svt.ascensionAdd.individuality) || {}
  let extra
  if (kind === 'costume') extra = (bag.costume || {})[rawId]
  else extra = (bag.ascension || {})[rawId]
  if (extra && extra.length) return idsOfTraits(extra)
  return base
}

function sameTraitIds(left, right) {
  if (left.length !== right.length) return false
  const a = left.slice().sort((x, y) => x - y)
  const b = right.slice().sort((x, y) => x - y)
  return a.every((id, index) => id === b[index])
}

function uniqueStrings(values) {
  const out = []
  const seen = new Set()
  for (const raw of values || []) {
    const text = String(raw || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
  }
  return out
}

export function applyAliases(list, aliasMap) {
  const map = aliasMap || {}
  return (list || []).map((svt) => ({
    ...svt,
    aliases: uniqueStrings([
      ...(svt.aliases || []),
      ...(map[svt.collectionNo] || []),
      ...(map[String(svt.collectionNo)] || []),
    ]),
  }))
}

export function parseMooncellAliases(text) {
  const map = {}
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (!lines.length) return map
  const header = lines[0].split(',')
  const col = (name, fallback) => {
    const index = header.indexOf(name)
    return index >= 0 ? index : fallback
  }
  const iId = col('id', 0)
  const iCn = col('name_cn', 2)
  const iJp = col('name_jp', 3)
  const iEn = col('name_en', 4)
  const iLink = col('name_link', 5)
  const iOther = col('name_other', 6)
  const needed = Math.max(iId, iCn, iJp, iEn, iLink, iOther) + 1
  for (const line of lines.slice(1)) {
    const cols = line.split(',', needed)
    const no = Number(cols[iId])
    if (!Number.isFinite(no) || no <= 0) continue
    const nicknames = String(cols[iOther] || '')
      .split(/[&＆]/)
      .map((part) => part.trim())
      .filter(Boolean)
    const names = []
    const cn = String(cols[iCn] || '').trim()
    const link = String(cols[iLink] || '').trim()
    if (link && link !== cn) names.push(link)
    for (const value of [cols[iJp], cols[iEn]]) {
      const t = String(value || '').trim()
      if (keepAlias(t)) names.push(t)
    }
    const uniq = []
    const seen = new Set()
    for (const t of [...nicknames, ...names]) {
      if (!t || seen.has(t)) continue
      seen.add(t)
      uniq.push(t)
    }
    if (uniq.length) map[no] = uniq
  }
  return map
}
function faceOf(ce) {
  const faces = ce.extraAssets?.faces?.equip || {}
  return faces[String(ce.id)] || faces[ce.id] || ''
}

function slimFunc(fn) {
  const s0 = (fn.svals || [{}])[0] || {}
  const f0 = (fn.followerVals || [])[0] || {}
  const andGroups = (fn.overWriteTvalsList && fn.overWriteTvalsList.length
    ? fn.overWriteTvalsList
    : fn.script?.overwriteTvals) || []
  return {
    target: fn.funcTargetType,
    rate: s0.RateCount || 0,
    add: s0.AddCount || 0,
    eventId: s0.EventId || 0,
    indiv: s0.Individuality || 0,
    applySupport: s0.ApplySupportSvt ?? fn.script?.ApplySupportSvt ?? fn.script?.ApplySupport ?? null,
    followerRate: f0.RateCount ?? null,
    tvals: (fn.functvals || []).map((trait) => ({ id: trait.id, name: trait.name })),
    andTvals: andGroups.map((group) =>
      (group || []).map((trait) => ({ id: trait.id, name: trait.name })),
    ),
  }
}

export function slimBondCes(equips) {
  return (equips || [])
    .map((ce) => ({
      id: ce.id,
      collectionNo: ce.collectionNo,
      name: ce.name,
      rarity: ce.rarity,
      cost: Number(ce.cost) || 0,
      face: faceOf(ce) || ce.face || '',
      skills: (ce.skills || []).map((skill) => ({
        name: skill.name,
        condLimitCount: skill.condLimitCount,
        funcs: (skill.functions || []).filter((fn) => fn.funcType === 'servantFriendshipUp').map(slimFunc),
      })),
    }))
    .filter((ce) => ce.skills.some((skill) => skill.funcs.length))
}

const WEEKDAY_PREFIX = /^(?:周[一二三四五六日]|星期[一二三四五六日天])\s+/
const EVENT_WRAP = /^【[^】]+】\s*/
const DAILY_SWAP = /^每日替换\s+/
const DL_MEMORIAL = /^\d+万(?:DL)?(?:突破)?纪念\s+/
const TRAINING = /((?:剑|弓|枪|骑|术|杀|狂|暗)之修炼场)\s*((?:初级|中级|上级|超级|极级))/
const VAULT = /(?:打开)?宝物库(?:之门)?\s*((?:初级|中级|上级|超级|极级))/

export function questDisplayName(name) {
  const raw = String(name || '').trim()
  const training = raw.match(TRAINING)
  if (training) return `${training[1]} ${training[2]}`
  const vault = raw.match(VAULT)
  if (vault) return `宝物库 ${vault[1]}`
  let text = raw
  let prev = ''
  while (text && text !== prev) {
    prev = text
    text = text.replace(DAILY_SWAP, '').replace(EVENT_WRAP, '').replace(DL_MEMORIAL, '').replace(WEEKDAY_PREFIX, '').trim()
  }
  return text
}

export function slimQuests(list) {
  return (list || [])
    .filter((quest) => Number(quest.bond) > 0)
    .map((quest) => ({
      id: quest.id,
      phase: quest.phase,
      name: quest.name,
      display: questDisplayName(quest.name),
      spot: quest.spotName || '',
      war: quest.warLongName || '',
      type: quest.type,
      ap: Number(quest.consume) || 0,
      bond: Number(quest.bond) || 0,
      openedAt: Number(quest.openedAt) || 0,
      closedAt: Number(quest.closedAt) || 0,
    }))
}

export function keepLatestPhases(list) {
  const byId = new Map()
  for (const quest of list || []) {
    const prev = byId.get(quest.id)
    if (!prev || quest.phase > prev.phase) byId.set(quest.id, quest)
  }
  return [...byId.values()]
}

function isLiveQuest(quest, now) {
  const closed = quest.closedAt || 0
  return quest.openedAt <= now && (closed === 0 || now <= closed)
}

export function collapseQuests(list, now = Date.now() / 1000) {
  const groups = new Map()
  for (const quest of list || []) {
    const key = `${quest.display}|${quest.ap}`
    const prev = groups.get(key)
    if (!prev) {
      groups.set(key, quest)
      continue
    }
    const live = isLiveQuest(quest, now)
    const prevLive = isLiveQuest(prev, now)
    if (live !== prevLive) groups.set(key, live ? quest : prev)
    else if (quest.bond !== prev.bond) groups.set(key, quest.bond > prev.bond ? quest : prev)
    else if (quest.id > prev.id) groups.set(key, quest)
  }
  return [...groups.values()]
}

export function snapshotQuests(list, now = Date.now() / 1000) {
  return collapseQuests(keepLatestPhases(slimQuests(list)), now)
}

export const GRAND_QUEST_CLASSES = [
  ['saber', '剑'],
  ['archer', '弓'],
  ['lancer', '枪'],
  ['rider', '骑'],
  ['caster', '术'],
  ['assassin', '杀'],
  ['berserker', '狂'],
  ['extra1', 'Extra I'],
  ['extra2', 'Extra II'],
]

export function grandQuestCatalog() {
  return GRAND_QUEST_CLASSES.map(([questClass, label], index) => ({
    id: 83951001 + index,
    phase: 1,
    name: `冠位研钻战 ${label} 100★★★`,
    display: `冠位研钻战 ${label} 100★★★`,
    spot: '冠位研钻',
    war: '冠位研钻战',
    type: 'grand',
    ap: 40,
    bond: 4748,
    openedAt: 1,
    closedAt: 2145888000,
    questType: 'grand',
    questClass,
    aliases: ['冠位战', '戴冠战', '戴冠戦', '研钻', '研鑽', label, `${label}阶`],
  }))
}

export function mergeGrandQuests(list) {
  const catalog = grandQuestCatalog()
  const seen = new Set(
    (list || [])
      .filter((quest) => quest.type === 'grand' || quest.questType === 'grand')
      .map((quest) => quest.display),
  )
  return [...catalog.filter((quest) => !seen.has(quest.display)), ...(list || [])]
}

const CLASS_FROM_QUEST = [
  ['剑之修炼场', 'saber'],
  ['弓之修炼场', 'archer'],
  ['枪之修炼场', 'lancer'],
  ['骑之修炼场', 'rider'],
  ['术之修炼场', 'caster'],
  ['暗之修炼场', 'assassin'],
  ['杀之修炼场', 'assassin'],
  ['狂之修炼场', 'berserker'],
]

const CLASS_FROM_GRAND = [
  ['Extra II', 'extra2'],
  ['Extra I', 'extra1'],
  ['剑', 'saber'],
  ['弓', 'archer'],
  ['枪', 'lancer'],
  ['骑', 'rider'],
  ['术', 'caster'],
  ['杀', 'assassin'],
  ['暗', 'assassin'],
  ['狂', 'berserker'],
]

export function questLimits(quest) {
  if (quest?.questType === 'grand' || quest?.type === 'grand') {
    return { questType: 'grand', questClass: quest.questClass || classFromGrandText(quest) }
  }
  const text = `${quest?.display || ''} ${quest?.name || ''} ${quest?.war || ''}`
  const grand = /冠位研钻|戴冠戦|戴冠战/.test(text)
  let questClass = ''
  for (const [key, cls] of CLASS_FROM_QUEST) {
    if (text.includes(key)) {
      questClass = cls
      break
    }
  }
  if (grand && !questClass) questClass = classFromGrandText(quest)
  return { questType: grand ? 'grand' : 'normal', questClass }
}

function classFromGrandText(quest) {
  const text = `${quest?.display || ''} ${quest?.name || ''} ${quest?.questClass || ''}`
  for (const [key, cls] of CLASS_FROM_GRAND) {
    if (text.includes(key)) return cls
  }
  return quest?.questClass || ''
}

const TRAIN_CLASS_ORDER = ['剑之', '弓之', '枪之', '骑之', '术之', '暗之', '杀之', '狂之']
const DIFF_ORDER = ['初级', '中级', '上级', '超级', '极级']

export function questSelectKey(quest) {
  return `${quest.id}:${quest.phase}`
}

export function questGroupLabel(quest) {
  if (quest?.type === 'grand' || quest?.questType === 'grand') return '冠位研钻战'
  const display = `${quest?.display || ''} ${quest?.name || ''}`
  if (display.includes('修炼场')) return '每日修炼场'
  if (display.includes('宝物库')) return '宝物库'
  if ((quest?.war || '').includes('每日')) return '每日其他'
  return String(quest?.war || '自由本').replace(/\s+/g, ' ')
}

function rankByNeedles(text, needles) {
  const index = needles.findIndex((key) => text.includes(key))
  return index < 0 ? 99 : index
}

function sortGroupQuests(label, quests) {
  return [...quests].sort((a, b) => {
    const da = String(a.display || a.name || '')
    const db = String(b.display || b.name || '')
    if (label === '每日修炼场') {
      return rankByNeedles(da, TRAIN_CLASS_ORDER) - rankByNeedles(db, TRAIN_CLASS_ORDER) || rankByNeedles(da, DIFF_ORDER) - rankByNeedles(db, DIFF_ORDER)
    }
    if (label === '宝物库' || label === '每日其他') {
      return rankByNeedles(da, DIFF_ORDER) - rankByNeedles(db, DIFF_ORDER) || da.localeCompare(db, 'zh')
    }
    if (label === '冠位研钻战') return (a.id || 0) - (b.id || 0)
    return da.localeCompare(db, 'zh') || (a.id || 0) - (b.id || 0)
  })
}

const GROUP_HEAD = ['每日修炼场', '宝物库', '冠位研钻战', '每日其他']

export function questSelectGroups(list) {
  const buckets = new Map()
  for (const quest of list || []) {
    const label = questGroupLabel(quest)
    if (!buckets.has(label)) buckets.set(label, [])
    buckets.get(label).push(quest)
  }
  const labels = [...GROUP_HEAD.filter((label) => buckets.has(label)), ...[...buckets.keys()].filter((label) => !GROUP_HEAD.includes(label)).sort((a, b) => a.localeCompare(b, 'zh'))]
  return labels.map((label) => ({ label, quests: sortGroupQuests(label, buckets.get(label) || []) }))
}

export const QUEST_KINDS = [
  ['train', '每日修炼场'],
  ['vault', '宝物库'],
  ['grand', '冠位研钻战'],
  ['daily', '每日其他'],
  ['free', '自由本'],
]

export const TRAIN_CLASSES = [
  ['saber', '剑'],
  ['archer', '弓'],
  ['lancer', '枪'],
  ['rider', '骑'],
  ['caster', '术'],
  ['assassin', '暗'],
  ['berserker', '狂'],
]

export const QUEST_DIFFS = ['初级', '中级', '上级', '超级', '极级']

export function questKindOf(quest) {
  const label = questGroupLabel(quest)
  if (label === '每日修炼场') return 'train'
  if (label === '宝物库') return 'vault'
  if (label === '冠位研钻战') return 'grand'
  if (label === '每日其他') return 'daily'
  return 'free'
}

export function questDiffOf(quest) {
  const text = `${quest?.display || ''} ${quest?.name || ''}`
  return QUEST_DIFFS.find((diff) => text.includes(diff)) || ''
}

export function questsOfKind(list, kind) {
  return (list || []).filter((quest) => questKindOf(quest) === kind)
}

export function freeWars(list) {
  return [...new Set(questsOfKind(list, 'free').map((quest) => String(quest.war || '自由本').replace(/\s+/g, ' ')))].sort((a, b) =>
    a.localeCompare(b, 'zh'),
  )
}

export function questsInWar(list, war) {
  const name = String(war || '').replace(/\s+/g, ' ')
  return questsOfKind(list, 'free').filter((quest) => String(quest.war || '自由本').replace(/\s+/g, ' ') === name)
}

export function findCascadeQuest(list, pick) {
  const kind = pick?.kind
  const pool = questsOfKind(list, kind)
  if (kind === 'train') {
    return pool.find((quest) => questLimits(quest).questClass === pick.questClass && questDiffOf(quest) === pick.diff) || null
  }
  if (kind === 'vault') {
    return pool.find((quest) => questDiffOf(quest) === pick.diff) || null
  }
  if (kind === 'grand') {
    return pool.find((quest) => (quest.questClass || questLimits(quest).questClass) === pick.questClass) || null
  }
  if (pick?.key) return pool.find((quest) => questSelectKey(quest) === pick.key) || null
  return null
}

export function availableDiffs(list, kind, questClass) {
  if (kind === 'vault') return QUEST_DIFFS.filter((diff) => findCascadeQuest(list, { kind, diff }))
  if (kind === 'train') return QUEST_DIFFS.filter((diff) => findCascadeQuest(list, { kind, questClass, diff }))
  return []
}

export function availableTrainClasses(list) {
  const have = new Set(questsOfKind(list, 'train').map((quest) => questLimits(quest).questClass))
  return TRAIN_CLASSES.filter(([id]) => have.has(id))
}

export const LIVING_HUMAN_TRAIT = 2654

const SNAPSHOT_CE_NAMES = ['迦勒底之晨', '检查报告', '手稿之翼', '秘密任务', '至诚的一针']

function unionIds(a, b) {
  const out = []
  const seen = new Set()
  for (const id of [...(a || []), ...(b || [])]) {
    const n = Number(id)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

export function mergeJpTraits(cnList, jpList) {
  const jpById = new Map((jpList || []).map((svt) => [svt.id, svt]))
  return (cnList || []).map((svt) => {
    const jp = jpById.get(svt.id)
    if (!jp) return svt
    const forms = (svt.forms || []).map((form) => {
      const jpForm = (jp.forms || []).find((item) => item.key === form.key)
      return { ...form, traitIds: unionIds(form.traitIds, jpForm && jpForm.traitIds) }
    })
    const seen = new Set(forms.map((form) => form.key).filter(Boolean))
    for (const jpForm of jp.forms || []) {
      if (!jpForm || !jpForm.key || seen.has(jpForm.key)) continue
      seen.add(jpForm.key)
      forms.push({ ...jpForm })
    }
    return { ...svt, traitIds: unionIds(svt.traitIds, jp.traitIds), forms }
  })
}

export function analyzeSnapshot(servants = [], ces = [], extra = {}) {
  const check = validateSnapshot(servants, ces)
  return {
    lastUpdated: extra.lastUpdated || new Date().toISOString(),
    region: extra.region || 'CN',
    jpServantCount: extra.jpServantCount || 0,
    livingHuman: check.living,
    servantCount: check.servantCount,
    ceCount: check.ceCount,
    ok: check.ok,
    errors: check.errors,
  }
}

export function validateSnapshot(servants = [], ces = []) {
  const errors = []
  const living = servants.filter((svt) => (svt.traitIds || []).includes(LIVING_HUMAN_TRAIT)).length
  if (living < 20) errors.push(`livingHuman 覆盖数异常: ${living}`)
  for (const name of SNAPSHOT_CE_NAMES) {
    if (!(ces || []).some((ce) => String(ce.name || '').includes(name))) {
      errors.push(`缺失关键礼装: ${name}`)
    }
  }
  if (servants.length < 400) errors.push(`从者数异常: ${servants.length}`)
  return { ok: !errors.length, errors, living, servantCount: servants.length, ceCount: ces.length }
}
