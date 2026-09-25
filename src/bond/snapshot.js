import { isCountDrop } from '../snapshot-guard.js'
import {
  DREAMFIRE_SKILL_ID,
  emptyBondBonusCatalog,
  extractExtraPassives,
  extractQuestFriendships,
  isCeSkillId,
  slimEvent,
} from './activity.js'
import { mergeBondBonusCatalog } from './bonus.js'

function eventStub(id, rec = {}) {
  return slimEvent({
    id,
    name: rec.name || '',
    type: rec.type || '',
    startedAt: rec.startedAt || 0,
    endedAt: rec.endedAt || 0,
  })
}

export function buildBondBonusSnapshot({ servantsNice = [], eventsNice = [], basicEvents = [] } = {}) {
  const extraPassives = []
  for (const svt of servantsNice || []) {
    extraPassives.push(...extractExtraPassives(svt))
  }

  const questFriendships = []
  const eventMap = new Map()
  for (const ev of eventsNice || []) {
    const recs = extractQuestFriendships(ev).filter((rec) => rec.rate)
    if (!recs.length) continue
    questFriendships.push(...recs)
    const slim = slimEvent(ev)
    if (slim && slim.id) eventMap.set(slim.id, slim)
  }

  const basics = new Map()
  for (const ev of basicEvents || []) {
    const slim = slimEvent(ev)
    if (slim && slim.id) basics.set(slim.id, slim)
  }

  for (const rec of extraPassives) {
    const id = Number(rec.eventId) || 0
    if (!id || eventMap.has(id)) continue
    eventMap.set(id, basics.get(id) || eventStub(id, rec))
  }
  for (const rec of questFriendships) {
    const id = Number(rec.eventId) || 0
    if (!id || eventMap.has(id)) continue
    eventMap.set(id, basics.get(id) || eventStub(id, rec))
  }

  const events = [...eventMap.values()].sort((a, b) => a.id - b.id)
  return mergeBondBonusCatalog({ extraPassives, questFriendships, events })
}

export function validateBondBonusCatalog(catalog) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return { ok: false, errors: ['bond-bonuses 必须是对象'], extraPassiveCount: 0, questFriendshipCount: 0, eventCount: 0 }
  }
  const errors = []
  if (!Array.isArray(catalog.extraPassives)) errors.push('extraPassives 必须是数组')
  if (!Array.isArray(catalog.questFriendships)) errors.push('questFriendships 必须是数组')
  if (!Array.isArray(catalog.events)) errors.push('events 必须是数组')
  const extraPassives = Array.isArray(catalog.extraPassives) ? catalog.extraPassives : []
  const questFriendships = Array.isArray(catalog.questFriendships) ? catalog.questFriendships : []
  const events = Array.isArray(catalog.events) ? catalog.events : []

  for (const rec of extraPassives) {
    if (!rec || typeof rec !== 'object') {
      errors.push('extraPassive 条目损坏')
      continue
    }
    if (!(Number(rec.servantId) > 0)) errors.push('extraPassive 缺 servantId')
    const skillId = Number(rec.skillId) || 0
    if (skillId === DREAMFIRE_SKILL_ID) errors.push('含梦火技能 970663')
    if (isCeSkillId(skillId)) errors.push(`含礼装技能 ${skillId}`)
    if (rec.type && rec.type !== 'extraPassive') errors.push(`extraPassive type 异常: ${rec.type}`)
    if (rec.target && rec.target !== 'self' && rec.target !== 'ptFull') {
      errors.push(`extraPassive target 异常: ${rec.target}`)
    }
    const rate = Number(rec.rate) || 0
    const add = Number(rec.add) || 0
    if (!rate && !add) errors.push(`extraPassive ${skillId} 无倍率`)
  }

  for (const rec of questFriendships) {
    if (!rec || typeof rec !== 'object') {
      errors.push('questFriendship 条目损坏')
      continue
    }
    if (!(Number(rec.eventId) > 0)) errors.push('questFriendship 缺 eventId')
    if (!(Number(rec.rate) > 0)) errors.push(`questFriendship ${rec.eventId} 无倍率`)
    if (rec.calcType && rec.calcType !== 'multiplication') {
      errors.push(`questFriendship calcType 异常: ${rec.calcType}`)
    }
  }

  for (const rec of events) {
    if (!rec || !(Number(rec.id) > 0)) errors.push('event 缺 id')
  }

  return {
    ok: !errors.length,
    errors,
    extraPassiveCount: extraPassives.length,
    questFriendshipCount: questFriendships.length,
    eventCount: events.length,
  }
}

export function bondBonusPublishDecision({ previous = null, candidate } = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, errors: ['无候选活动羁绊目录'], keepPrevious: true }
  }
  const check = validateBondBonusCatalog(candidate)
  const errors = check.errors.slice()
  if (previous) {
    if (isCountDrop((previous.extraPassives || []).length, (candidate.extraPassives || []).length)) {
      errors.push(
        `extraPassive 骤降 ${(previous.extraPassives || []).length} -> ${(candidate.extraPassives || []).length}`,
      )
    }
    if (isCountDrop((previous.questFriendships || []).length, (candidate.questFriendships || []).length)) {
      errors.push(
        `questFriendship 骤降 ${(previous.questFriendships || []).length} -> ${(candidate.questFriendships || []).length}`,
      )
    }
  }
  return { ok: !errors.length, errors, keepPrevious: errors.length > 0 }
}

export function catalogOrEmpty(value) {
  if (!value || typeof value !== 'object') return emptyBondBonusCatalog()
  return {
    extraPassives: Array.isArray(value.extraPassives) ? value.extraPassives : [],
    questFriendships: Array.isArray(value.questFriendships) ? value.questFriendships : [],
    events: Array.isArray(value.events) ? value.events : [],
  }
}
