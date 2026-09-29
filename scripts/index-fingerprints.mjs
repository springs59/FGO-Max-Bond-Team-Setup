import { createHash } from 'node:crypto'
import { stableJson } from './write-if-changed.mjs'

export const fingerprintOf = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

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
