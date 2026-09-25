import {
  emptyBondBonusCatalog,
  extraPassiveApplies,
  questFriendshipApplies,
  questFriendshipQuestApplies,
  unixNow,
} from './activity.js'

function catalogOf(input) {
  if (!input) return emptyBondBonusCatalog()
  if (input.extraPassives || input.questFriendships) return input
  return emptyBondBonusCatalog()
}

export function liveBondBonusCatalog(catalog, quest, now) {
  const ts = now == null ? unixNow() : unixNow(now)
  const bag = catalogOf(catalog)
  const extraPassives = []
  for (const rec of bag.extraPassives || []) {
    if (extraPassiveApplies(rec, quest, ts)) extraPassives.push(rec)
  }
  const questFriendships = []
  for (const rec of bag.questFriendships || []) {
    if (questFriendshipQuestApplies(rec, quest, ts)) questFriendships.push(rec)
  }
  return { extraPassives, questFriendships, events: bag.events || [] }
}

function sourceLabel(rec) {
  if (rec.type === 'questFriendship') {
    const pct = Math.round((Number(rec.rate) || 0) * 100)
    return `${rec.name || '关卡活动'} +${pct}%`
  }
  const pct = Math.round((Number(rec.rate) || 0) * 100)
  const who = rec.target === 'ptFull' ? '全队' : '自身'
  return `${rec.name || '活动被动'}（${who} +${pct}%）`
}

export function getEffectiveBondBonus({
  servantId,
  catalog,
  extraPassives,
  questFriendships,
  quest = null,
  now,
} = {}) {
  const ts = now == null ? unixNow() : unixNow(now)
  const bag = catalogOf(catalog)
  const passives = extraPassives || bag.extraPassives || []
  const campaigns = questFriendships || bag.questFriendships || []
  const sid = Number(servantId) || 0
  const sources = []
  let self = 0
  let party = 0
  let partyApplySupport = 1
  let questCampaign = 0

  for (const rec of passives) {
    if (Number(rec.servantId) !== sid) continue
    if (!extraPassiveApplies(rec, quest, ts)) continue
    const rate = Number(rec.rate) || 0
    if (!rate) continue
    const target = rec.target === 'ptFull' ? 'ptFull' : 'self'
    sources.push({
      type: 'extraPassive',
      eventId: rec.eventId || 0,
      skillId: rec.skillId || 0,
      rate,
      target,
      questScope: 'event',
      name: rec.name || '',
      label: sourceLabel(rec),
    })
    if (target === 'ptFull') {
      party += rate
      if (rec.applySupportSvt === 0) partyApplySupport = 0
    } else {
      self += rate
    }
  }

  for (const rec of campaigns) {
    if (!questFriendshipApplies(rec, sid, quest, ts)) continue
    const rate = Number(rec.rate) || 0
    if (!rate) continue
    questCampaign += rate
    sources.push({
      type: 'questFriendship',
      eventId: rec.eventId || 0,
      skillId: 0,
      rate,
      target: 'self',
      questScope: rec.allQuests ? 'all' : 'listed',
      name: rec.name || '',
      label: sourceLabel(rec),
    })
  }

  return {
    self,
    party,
    questCampaign,
    partyApplySupport,
    totalSecondLayer: self + questCampaign,
    sources,
  }
}

export function applyBondBonusesToSlots(slots, { catalog, quest, now } = {}) {
  const ts = now == null ? unixNow() : unixNow(now)
  const bag = liveBondBonusCatalog(catalog, quest, ts)
  const bySvt = new Map()
  for (const rec of bag.extraPassives) {
    const sid = Number(rec.servantId) || 0
    if (!sid) continue
    const list = bySvt.get(sid)
    if (list) list.push(rec)
    else bySvt.set(sid, [rec])
  }
  const auras = []
  for (const slot of slots || []) {
    if (!slot || !slot.filled) continue
    const bonus = getEffectiveBondBonus({
      servantId: slot.svtId,
      extraPassives: bySvt.get(Number(slot.svtId) || 0) || [],
      questFriendships: bag.questFriendships,
      quest,
      now: ts,
    })
    slot.eventBonus = bonus
    slot.eventPassive = bonus.totalSecondLayer
    if (bonus.party) {
      const src = bonus.sources.find((item) => item.target === 'ptFull')
      auras.push({
        rate: bonus.party,
        fromSupport: Boolean(slot.isSupport),
        applySupportSvt: bonus.partyApplySupport,
        name: (src && src.name) || '',
        label: (src && src.label) || '活动全队光环',
        eventId: (src && src.eventId) || 0,
      })
    }
  }
  for (const slot of slots || []) {
    if (!slot || !slot.filled || slot.isSupport) continue
    let extra = 0
    const bonus = slot.eventBonus || { sources: [] }
    for (const aura of auras) {
      if (aura.fromSupport && aura.applySupportSvt === 0) continue
      extra += aura.rate
      const already = (bonus.sources || []).some(
        (item) =>
          item.target === 'ptFull' &&
          Number(item.eventId) === Number(aura.eventId) &&
          Number(item.rate) === Number(aura.rate),
      )
      if (already) continue
      bonus.sources = bonus.sources.concat({
        type: 'extraPassive',
        eventId: aura.eventId,
        skillId: 0,
        rate: aura.rate,
        target: 'ptFull',
        questScope: 'event',
        name: aura.name,
        label: aura.label,
      })
    }
    slot.eventPassive = (Number(slot.eventPassive) || 0) + extra
    slot.eventBonus = bonus
  }
  return slots
}

export function catalogFromSlots(slots) {
  const extraPassives = []
  for (const slot of slots || []) {
    if (!Array.isArray(slot && slot.extraPassives)) continue
    extraPassives.push(...slot.extraPassives)
  }
  return { extraPassives, questFriendships: [], events: [] }
}

export function mergeBondBonusCatalog(...bags) {
  const extraPassives = []
  const questFriendships = []
  const events = []
  for (const bag of bags) {
    if (!bag) continue
    const seenP = new Set(extraPassives.map((rec) => `${rec.servantId}:${rec.skillId}:${rec.eventId}:${rec.startedAt}:${rec.endedAt}:${rec.target}`))
    for (const rec of bag.extraPassives || []) {
      const key = `${rec.servantId}:${rec.skillId}:${rec.eventId}:${rec.startedAt}:${rec.endedAt}:${rec.target}`
      if (seenP.has(key)) continue
      seenP.add(key)
      extraPassives.push(rec)
    }
    const seenQ = new Set(questFriendships.map((rec) => `${rec.eventId}:${rec.value}:${rec.startedAt}:${rec.endedAt}:${rec.rate}`))
    for (const rec of bag.questFriendships || []) {
      const key = `${rec.eventId}:${rec.value}:${rec.startedAt}:${rec.endedAt}:${rec.rate}`
      if (seenQ.has(key)) continue
      seenQ.add(key)
      questFriendships.push(rec)
    }
    const seenE = new Set(events.map((rec) => rec.id))
    for (const rec of bag.events || []) {
      if (!rec || seenE.has(rec.id)) continue
      seenE.add(rec.id)
      events.push(rec)
    }
  }
  return { extraPassives, questFriendships, events }
}

export function resolveSlotEventPassives(slots, { quest, now, catalog } = {}) {
  const bag = mergeBondBonusCatalog(catalog, catalogFromSlots(slots))
  const hasGlobal =
    ((catalog && catalog.questFriendships) || []).length > 0 ||
    ((catalog && catalog.extraPassives) || []).length > 0
  const targets = (slots || []).filter((slot) => {
    if (!slot || !slot.filled) return false
    if (hasGlobal) return true
    return Array.isArray(slot.extraPassives)
  })
  if (!targets.length) return slots
  applyBondBonusesToSlots(targets, {
    catalog: bag,
    quest,
    now,
  })
  return slots
}

export function groupEventBonusSources(bonus) {
  const self = []
  const party = []
  const quest = []
  const seen = new Set()
  for (const src of (bonus && bonus.sources) || []) {
    if (!src) continue
    const key = `${src.type}:${src.eventId || 0}:${src.target || 'self'}:${Number(src.rate) || 0}:${src.skillId || 0}`
    if (seen.has(key)) continue
    seen.add(key)
    if (src.type === 'questFriendship') quest.push(src)
    else if (src.target === 'ptFull') party.push(src)
    else self.push(src)
  }
  return { self, party, quest }
}
