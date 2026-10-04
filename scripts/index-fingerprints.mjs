import { createHash } from 'node:crypto'
import { stableJson } from './write-if-changed.mjs'

export const fingerprintOf = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function openEventQuestState(quests, now = Date.now()) {
  const ts = Math.floor(Number(now) / (Number(now) > 1e12 ? 1000 : 1))
  return (quests || []).filter(quest => Number(quest.eventId || quest.event_id) && Number(quest.bond) > 0 &&
    (!Number(quest.openedAt) || ts >= Number(quest.openedAt)) &&
    (!Number(quest.closedAt) || ts <= Number(quest.closedAt)))
    .map(quest => [Number(quest.id), Number(quest.phase) || 1, Number(quest.bond)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
}

export function baseDataVersionOf({ servants, ces, traits, quests, questBondSource }) {
  const ordinaryQuests = (quests || []).filter(quest => !Number(quest.eventId || quest.event_id))
  return fingerprintOf(stableJson({ servants, ces, traits, quests: ordinaryQuests, questBondSource }))
}

export function indexRefreshDecision(previous, next) {
  const baseChanged = !previous?.baseFingerprint || previous.baseFingerprint !== next.baseFingerprint
  const activityChanged = baseChanged || !previous?.activityFingerprint ||
    previous.activityFingerprint !== next.activityFingerprint
  return { baseChanged, activityChanged, changed: baseChanged || activityChanged }
}
