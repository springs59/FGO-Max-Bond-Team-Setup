// Atlas uses different long-term end-date sentinels on the two servers.
// These dates are availability placeholders, not live limited-event deadlines.
export const PERMANENT_END = { CN: 2145888000, JP: 1893423600 }
export function permanentEnd(region = 'CN') { return PERMANENT_END[region] || PERMANENT_END.CN }

export function eventAvailability(event, war = {}, region = 'CN') {
  if ((war.flags || []).includes('mainScenario')) return 'main-story'
  const name = `${event?.name || ''} ${war.longName || ''} ${war.eventName || ''}`
  if (Number(war.parentWarId) === 1004 || /主线物语|主線物語|メイン・インタールード|Main Interlude/i.test(name)) return 'main-interlude'
  const end = Number(event?.endedAt) || 0
  return !end || end >= permanentEnd(region) ? 'permanent-event' : 'limited-event'
}

export function questAvailability(quest) {
  if (quest?.availabilityKind) return quest.availabilityKind
  const name = `${quest?.war || ''} ${quest?.name || ''}`
  if (/主线物语|主線物語|メイン・インタールード|Main Interlude/i.test(name)) return 'main-interlude'
  const end = Number(quest?.closedAt) || 0
  if (quest?.eventId && end && end < permanentEnd(quest.region)) return 'limited-event'
  return quest?.type === 'main' ? 'main-story' : quest?.eventId ? 'permanent-event' : 'permanent'
}

export function questUnlockTags(quest) {
  const conditions = quest?.releaseConditions || []
  const tags = []
  if (conditions.some(c => c.type === 'purchaseShop')) tags.push('含购买 / 兑换条件')
  if (conditions.some(c => ['questClear', 'warClear'].includes(c.type))) tags.push('需通关前置')
  if (conditions.some(c => !['date', 'questClear', 'warClear', 'purchaseShop'].includes(c.type))) tags.push('有其他解锁条件')
  if (['main-interlude', 'permanent-event'].includes(questAvailability(quest))) tags.push('账号解锁未核验')
  return tags
}
