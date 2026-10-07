import { eventAvailability } from '../src/quest-availability.js'
import { stampEventQuests } from '../src/game-data.js'

// Collect permanent event chapters from this server, including their real
// purchase/progression conditions. Never borrow chapters or conditions from CN.
export async function loadPermanentQuestSources({ pull, events, wars, region, now = Date.now() / 1000 }) {
  const warMap = new Map((wars || []).map(w => [Number(w.id), w]))
  const targets = new Map()
  for (const event of events || []) {
    const end = Number(event.endedAt) || 0
    if (event.type !== 'eventQuest' || Number(event.startedAt) > now || (end && end < now)) continue
    for (const id of event.warIds || []) {
      const kind = eventAvailability(event, warMap.get(Number(id)), region)
      if (['main-interlude', 'permanent-event'].includes(kind)) targets.set(Number(id), event)
    }
  }
  const rows = [], warDetails = [], questDetails = []
  const entries = [...targets]
  for (let start = 0; start < entries.length; start += 4) {
    const batch = await Promise.all(entries.slice(start, start + 4).map(async ([id, event]) => {
      const [phases, war] = await Promise.all([
        pull(`/basic/${region}/quest/phase/search?warId=${id}`), pull(`/nice/${region}/war/${id}`),
      ])
      return { event, phases, war }
    }))
    for (const { event, phases, war } of batch) {
      rows.push(...stampEventQuests(phases, { eventId: event.id, name: event.name }))
      warDetails.push({ id: war.id, parentWarId: war.parentWarId, flags: war.flags, eventId: war.eventId })
      questDetails.push(...(war.spots || []).flatMap(spot => spot.quests || []).map(q => ({ id: q.id, releaseConditions: q.releaseConditions || [] })))
    }
  }
  return { rows, warDetails, questDetails }
}
