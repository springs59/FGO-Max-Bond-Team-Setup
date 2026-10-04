import { bondMechanismOf } from '../bond/activity.js'

// A template describes the calculation rules. Event ids, dates, names and
// quest ids are inputs to those rules and never choose an implementation.
export function activityTemplateOf(live) {
  const records = [...(live?.extraPassives || []), ...(live?.questFriendships || [])]
  const families = records.map(rec => bondMechanismOf(rec))
  if (families.some(family => !family)) throw new Error('unknown activity bond calculation template')
  // Unlock and campaign scopes select applicable records before scoring.
  // They become parameters of the same self/party calculation template.
  const calculations = families.map(family => family.startsWith('event-') || family.startsWith('unlock-')
    ? family.replace(/^unlock-/, 'event-') : 'campaign-self')
  return calculations.length ? [...new Set(calculations)].sort().join('+') : 'ordinary'
}

// Two quests can share a solved team only if every servant has the same
// effective bonus, including support handling. Labels are hydrated per quest.
export function activityEffectKey(bonuses = {}) {
  return JSON.stringify(Object.entries(bonuses).map(([id, bonus]) => [
    Number(id),
    Math.round((Number(bonus.totalSecondLayer) || 0) * 1000),
    Math.round((Number(bonus.party) || 0) * 1000),
    bonus.partyApplySupport === 0 ? 0 : 1,
  ]).filter(([, self, party]) => self || party).sort((a, b) => a[0] - b[0]))
}

export function activityCalculationKey({ template, bonuses, base, questType = 'normal', questClass = '' }) {
  return JSON.stringify([template, questType, questClass, Number(base) || 0, activityEffectKey(bonuses)])
}
