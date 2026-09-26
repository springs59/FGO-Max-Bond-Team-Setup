import { isWindowOpen, unixNow } from '../bond/activity.js'

export function activityRecord(eventNice, now) {
  const ts = unixNow(now)
  const startedAt = Number(eventNice && eventNice.startedAt) || 0
  const endedAt = Number(eventNice && eventNice.endedAt) || 0
  return {
    eventId: Number(eventNice && (eventNice.id || eventNice.eventId)) || 0,
    name: (eventNice && eventNice.name) || '',
    type: (eventNice && eventNice.type) || '',
    startedAt,
    endedAt,
    active: isWindowOpen(startedAt, endedAt, ts),
  }
}

export function currentActivities(events, now) {
  return (events || []).map((eventNice) => activityRecord(eventNice, now)).filter((row) => row.eventId && row.active)
}

export function activityStateKey(activities) {
  return (activities || [])
    .map((row) => `${row.eventId}:${row.active ? 1 : 0}:${row.startedAt}:${row.endedAt}`)
    .sort()
    .join('|')
}

export function liveExtraPassives(catalog, now) {
  const ts = unixNow(now)
  return ((catalog && catalog.extraPassives) || []).filter((rec) => isWindowOpen(rec.startedAt, rec.endedAt, ts))
}

export function liveQuestFriendships(catalog, now) {
  const ts = unixNow(now)
  return ((catalog && catalog.questFriendships) || []).filter((rec) => isWindowOpen(rec.startedAt, rec.endedAt, ts))
}

export function resolveCurrentActivity({ catalog, now } = {}) {
  const ts = unixNow(now)
  const bag = catalog || { extraPassives: [], questFriendships: [], events: [] }
  const extraPassives = liveExtraPassives(bag, ts).map((rec) => ({
    servantId: Number(rec.servantId) || 0,
    eventId: Number(rec.eventId) || 0,
    skillId: Number(rec.skillId) || 0,
    name: rec.name || '',
    rate: Number(rec.rate) || 0,
    target: rec.target === 'ptFull' ? 'ptFull' : 'self',
    startedAt: Number(rec.startedAt) || 0,
    endedAt: Number(rec.endedAt) || 0,
    condQuestId: Number(rec.condQuestId) || 0,
    condQuestPhase: Number(rec.condQuestPhase) || 0,
    applySupportSvt: rec.applySupportSvt == null ? 1 : Number(rec.applySupportSvt),
  }))
  const questFriendships = liveQuestFriendships(bag, ts).map((rec) => ({
    eventId: Number(rec.eventId) || 0,
    name: rec.name || '',
    rate: Number(rec.rate) || 0,
    startedAt: Number(rec.startedAt) || 0,
    endedAt: Number(rec.endedAt) || 0,
    allQuests: Boolean(rec.allQuests),
    questIds: rec.questIds || [],
    exceptedQuestIds: rec.exceptedQuestIds || [],
    targetIds: rec.targetIds || [],
  }))
  const liveEventIds = new Set([
    ...extraPassives.map((rec) => rec.eventId),
    ...questFriendships.map((rec) => rec.eventId),
  ])
  const activities = currentActivities(bag.events || [], ts).filter((row) => liveEventIds.has(row.eventId))
  return {
    now: ts,
    activities,
    activityState: activityStateKey(activities),
    extraPassives,
    questFriendships,
  }
}
