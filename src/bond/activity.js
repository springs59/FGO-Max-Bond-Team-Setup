export const DREAMFIRE_SKILL_ID = 970663
export const FAR_FUTURE = 2145888000
export const CE_SKILL_MIN = 990000
export const CE_SKILL_MAX = 1000000

export function unixNow(date = Date.now()) {
  return Math.floor(Number(date) / (Number(date) > 1e12 ? 1000 : 1))
}

export function emptyBondBonusCatalog() {
  return { extraPassives: [], questFriendships: [], events: [] }
}

export function isWindowOpen(startedAt, endedAt, now) {
  const start = Number(startedAt) || 0
  const end = Number(endedAt) || 0
  const ts = Number(now) || 0
  if (!ts) return false
  if (start === end && start >= FAR_FUTURE) return false
  if (!start && !end) return false
  return ts >= start && ts <= end
}

export function rateFromCount(rateCount) {
  return (Number(rateCount) || 0) / 1000
}

export function rateFromCampaignValue(value) {
  const raw = Number(value) || 0
  if (!raw) return 0
  return (raw - 1000) / 1000
}

function firstSvals(func) {
  return ((func && func.svals) || [{}])[0] || {}
}

function nestedExtra(skill) {
  const list = (skill && skill.extraPassive) || []
  return list[0] || {}
}

export function isCeSkillId(skillId) {
  const id = Number(skillId) || 0
  return id >= CE_SKILL_MIN && id < CE_SKILL_MAX
}

export function extractExtraPassives(svtNice) {
  if (!svtNice) return []
  const servantId = Number(svtNice.id) || 0
  const out = []
  for (const skill of svtNice.extraPassive || []) {
    const skillId = Number(skill.id) || 0
    if (skillId === DREAMFIRE_SKILL_ID) continue
    if (isCeSkillId(skillId)) continue
    const extra = nestedExtra(skill)
    for (const func of skill.functions || []) {
      if (func.funcType !== 'servantFriendshipUp') continue
      const svals = firstSvals(func)
      const rate = rateFromCount(svals.RateCount)
      const add = Number(svals.AddCount) || 0
      if (!rate && !add) continue
      out.push({
        type: 'extraPassive',
        servantId,
        skillId,
        name: skill.name || '',
        eventId: Number(svals.EventId || extra.eventId) || 0,
        rate,
        add,
        target: func.funcTargetType || 'self',
        startedAt: Number(extra.startedAt) || 0,
        endedAt: Number(extra.endedAt) || 0,
        condQuestId: Number(extra.condQuestId) || 0,
        condQuestPhase: Number(extra.condQuestPhase) || 0,
        applySupportSvt: svals.ApplySupportSvt == null ? 1 : Number(svals.ApplySupportSvt),
      })
    }
  }
  return out
}

export function extraPassiveApplies(rec, quest, now) {
  if (!rec) return false
  if (rec.skillId === DREAMFIRE_SKILL_ID || isCeSkillId(rec.skillId)) return false
  if (!isWindowOpen(rec.startedAt, rec.endedAt, now)) return false
  const eventId = Number(rec.eventId) || 0
  if (!eventId) return false
  const questEventId = Number(quest && (quest.eventId || quest.event_id)) || 0
  return questEventId === eventId
}

export function extractQuestFriendships(eventNice) {
  if (!eventNice || eventNice.type !== 'questCampaign') return []
  const out = []
  const campaignQuests = eventNice.campaignQuests || []
  for (const campaign of eventNice.campaigns || []) {
    if (campaign.target !== 'questFriendship') continue
    const allQuests = campaignQuests.some((row) => Number(row.questId) === 0 && !row.isExcepted)
    const questIds = campaignQuests
      .filter((row) => Number(row.questId) && !row.isExcepted)
      .map((row) => Number(row.questId))
    const exceptedQuestIds = campaignQuests
      .filter((row) => row.isExcepted && Number(row.questId))
      .map((row) => Number(row.questId))
    out.push({
      type: 'questFriendship',
      eventId: Number(eventNice.id) || 0,
      name: eventNice.name || '',
      startedAt: Number(eventNice.startedAt) || 0,
      endedAt: Number(eventNice.endedAt) || 0,
      value: Number(campaign.value) || 0,
      rate: rateFromCampaignValue(campaign.value),
      calcType: campaign.calcType || 'multiplication',
      targetIds: (campaign.targetIds || []).map((id) => Number(id)).filter((id) => id),
      allQuests,
      questIds,
      exceptedQuestIds,
    })
  }
  return out
}

export function questFriendshipApplies(rec, servantId, quest, now) {
  if (!rec || !rec.rate) return false
  if (!isWindowOpen(rec.startedAt, rec.endedAt, now)) return false
  const ids = rec.targetIds || []
  if (ids.length && !ids.includes(Number(servantId))) return false
  const questId = Number(quest && quest.id) || 0
  if (rec.allQuests) {
    if (questId && (rec.exceptedQuestIds || []).includes(questId)) return false
    return true
  }
  if (!questId) return false
  return (rec.questIds || []).includes(questId)
}

export function slimEvent(eventNice) {
  if (!eventNice) return null
  return {
    id: Number(eventNice.id) || 0,
    name: eventNice.name || '',
    type: eventNice.type || '',
    startedAt: Number(eventNice.startedAt) || 0,
    endedAt: Number(eventNice.endedAt) || 0,
  }
}
