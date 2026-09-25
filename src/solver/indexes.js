import { isPlayableServant, questKindOf, questLimits } from '../game-data.js'
import { isWindowOpen, unixNow } from '../bond/activity.js'
import { classBucketOf, costBucketOf, extraGroupOf, traitSig } from './common.js'

export function buildServantIndex({ servants = [], formsOf } = {}) {
  if (typeof formsOf !== 'function') throw new Error('buildServantIndex 需要 formsOf')
  const playable = (servants || []).filter(isPlayableServant)
  const servantRows = []
  const formEntries = []
  for (const svt of playable) {
    const forms = (formsOf(svt) || []).map((form) => ({
      key: form.key || 'default',
      name: form.name || form.key || '默认灵基',
      rarity: form.rarity != null ? form.rarity : svt.rarity,
      cost: Number(form.cost) || 0,
      attribute: form.attribute || svt.attribute,
      traitIds: (form.traitIds || []).slice(),
      sig: traitSig(form.traitIds || []),
    }))
    servantRows.push({
      id: svt.id,
      collectionNo: svt.collectionNo,
      className: svt.className,
      attribute: svt.attribute,
      rarity: svt.rarity,
      cost: Number(svt.cost) || 0,
      extra: extraGroupOf(svt.className),
      forms,
    })
    for (const form of forms) formEntries.push({ svtId: svt.id, ...form })
  }
  return { servants: servantRows, formCount: formEntries.length, formEntries }
}

export function classifyCeKinds(rec) {
  const kinds = []
  if (!rec) return ['other']
  if (rec.portrait) kinds.push('portrait')
  if (rec.svtBond) kinds.push('bondEquip')
  const rate = Number(rec.mlb && rec.mlb.rate) || 0
  const follower = rec.mlb && rec.mlb.followerRate
  if (rate >= 200) kinds.push('bond20')
  else if (rate >= 100) kinds.push('bond15')
  else if (rate > 0) kinds.push('bond')
  if (follower != null && Number(follower) > rate) kinds.push('tea')
  if (!kinds.length) kinds.push('other')
  return kinds
}

export function buildQuestIndex({ quests = [], now = null } = {}) {
  const ts = now == null ? unixNow() : unixNow(now)
  return (quests || []).map((quest) => {
    const limits = questLimits(quest)
    const openedAt = Number(quest.openedAt) || 0
    const closedAt = Number(quest.closedAt) || 0
    const available = (!openedAt && !closedAt) || (ts >= openedAt && (!closedAt || ts <= closedAt))
    return {
      id: Number(quest.id) || 0,
      phase: Number(quest.phase) || 1,
      kind: questKindOf(quest),
      questType: limits.questType,
      questClass: limits.questClass || '',
      eventId: Number(quest.eventId || quest.event_id) || 0,
      bond: Number(quest.bond) || 0,
      ap: Number(quest.ap) || 0,
      openedAt,
      closedAt,
      available: available ? 1 : 0,
    }
  })
}

function slimPassive(rec) {
  return {
    eventId: rec.eventId || 0,
    skillId: rec.skillId || 0,
    rate: Number(rec.rate) || 0,
    name: rec.name || '',
    target: rec.target === 'ptFull' ? 'ptFull' : 'self',
    applySupportSvt: rec.applySupportSvt == null ? 1 : Number(rec.applySupportSvt),
  }
}

export function buildBonusIndex({ bondBonuses = null, now = null } = {}) {
  const ts = now == null ? unixNow() : unixNow(now)
  const bag = bondBonuses || { extraPassives: [], questFriendships: [], events: [] }
  const selfBySvt = {}
  const partyBySvt = {}
  for (const rec of bag.extraPassives || []) {
    if (!isWindowOpen(rec.startedAt, rec.endedAt, ts)) continue
    if (!(Number(rec.rate) || 0)) continue
    const sid = Number(rec.servantId) || 0
    if (!sid) continue
    const row = slimPassive(rec)
    if (row.target === 'ptFull') {
      if (!partyBySvt[sid]) partyBySvt[sid] = []
      partyBySvt[sid].push(row)
    } else {
      if (!selfBySvt[sid]) selfBySvt[sid] = []
      selfBySvt[sid].push(row)
    }
  }
  const questFriendship = []
  for (const rec of bag.questFriendships || []) {
    if (!isWindowOpen(rec.startedAt, rec.endedAt, ts)) continue
    questFriendship.push({
      eventId: rec.eventId || 0,
      name: rec.name || '',
      rate: Number(rec.rate) || 0,
      allQuests: Boolean(rec.allQuests),
      questIds: rec.questIds || [],
      exceptedQuestIds: rec.exceptedQuestIds || [],
      targetIds: rec.targetIds || [],
    })
  }
  const events = (bag.events || [])
    .filter((ev) => isWindowOpen(ev.startedAt, ev.endedAt, ts))
    .map((ev) => ({
      id: Number(ev.id) || 0,
      name: ev.name || '',
      type: ev.type || '',
      startedAt: Number(ev.startedAt) || 0,
      endedAt: Number(ev.endedAt) || 0,
    }))
  return { now: ts, selfBySvt, partyBySvt, questFriendship, events }
}

export function buildCandidateIndex({ servants = [], ces = [], bonuses = null, quests = [] } = {}) {
  const byClass = {}
  const byExtra = { 0: [], 1: [], 2: [] }
  const costBuckets = { '0-4': [], '5-8': [], '9-12': [], '13-16': [], '17+': [] }
  for (const svt of servants || []) {
    const bucket = classBucketOf(svt.className, svt.extra)
    if (!byClass[bucket]) byClass[bucket] = []
    byClass[bucket].push(svt.id)
    const extra = Number(svt.extra) || 0
    if (!byExtra[extra]) byExtra[extra] = []
    byExtra[extra].push(svt.id)
    const key = costBucketOf(svt.cost)
    if (!costBuckets[key]) costBuckets[key] = []
    costBuckets[key].push(svt.id)
  }
  const byCeKind = {}
  for (const ce of ces || []) {
    for (const kind of ce.kinds || ['other']) {
      if (!byCeKind[kind]) byCeKind[kind] = []
      byCeKind[kind].push(ce.id)
    }
  }
  const byQuestKind = {}
  for (const quest of quests || []) {
    const kind = quest.kind || 'free'
    if (!byQuestKind[kind]) byQuestKind[kind] = []
    byQuestKind[kind].push(quest.id)
  }
  return {
    byClass,
    byExtra,
    byCeKind,
    costBuckets,
    byQuestKind,
    byBonusSelf: Object.keys((bonuses && bonuses.selfBySvt) || {}).map(Number),
    byBonusParty: Object.keys((bonuses && bonuses.partyBySvt) || {}).map(Number),
  }
}

export function buildSolverMeta({ index, durationMs = 0, checksum = '' } = {}) {
  return {
    schemaVersion: (index && index.schemaVersion) || 2,
    solverIndexVersion: (index && index.solverIndexVersion) || 0,
    sourceVersion: (index && index.sourceVersion) || '',
    gameDataVersion: (index && index.gameDataVersion) || '',
    generatedAt: (index && index.builtAt) || new Date().toISOString(),
    checksum: checksum || '',
    buildDurationMs: durationMs || 0,
    servantCount: (index && index.servantCount) || 0,
    ceCount: (index && index.ceCount) || 0,
    formCount: (index && index.formCount) || 0,
    questCount: ((index && index.quests) || []).length,
  }
}

export function solverIndexPublishDecision({ ok, errors = [] } = {}) {
  if (!ok) return { publish: false, keepPrevious: true, errors }
  return { publish: true, keepPrevious: false, errors: [] }
}
