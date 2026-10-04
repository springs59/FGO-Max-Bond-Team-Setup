import { readFile } from 'node:fs/promises'
import { writeIfChanged } from './write-if-changed.mjs'
import { bondMechanismOf } from '../src/bond/activity.js'
import { validateBondBonusCatalog } from '../src/bond/snapshot.js'
import { activityTemplateOf } from '../src/solver/activity-template.js'

const catalog = JSON.parse(await readFile('src/data/bond-bonuses.json', 'utf8'))
const check = validateBondBonusCatalog(catalog)
if (!check.ok) throw new Error(check.errors.join('; '))
const events = new Map()
const recordsByEvent = new Map()
let ignoredWithoutEvent = 0
for (const event of catalog.events || []) events.set(Number(event.id), {
  eventId: Number(event.id), name: event.name || '', mechanisms: {},
})
for (const rec of [...catalog.extraPassives, ...catalog.questFriendships]) {
  const mechanism = bondMechanismOf(rec)
  if (!mechanism) throw new Error(`unknown bond mechanism in event ${rec.eventId}`)
  const eventId = Number(rec.eventId) || 0
  if (!eventId) { ignoredWithoutEvent += 1; continue }
  if (!recordsByEvent.has(eventId)) recordsByEvent.set(eventId, [])
  recordsByEvent.get(eventId).push(rec)
  if (!events.has(eventId)) events.set(eventId, { eventId, name: rec.name || '', mechanisms: {} })
  const item = events.get(eventId)
  item.mechanisms[mechanism] = (item.mechanisms[mechanism] || 0) + 1
}
const templates = {}
for (const item of events.values()) {
  const records = recordsByEvent.get(item.eventId) || []
  item.template = activityTemplateOf({ extraPassives: records.filter(rec => rec.type === 'extraPassive'),
    questFriendships: records.filter(rec => rec.type === 'questFriendship') })
  if (!templates[item.template]) templates[item.template] = { eventCount: 0, recordCount: 0 }
  templates[item.template].eventCount += 1
  templates[item.template].recordCount += records.length
}
const audit = { ignoredWithoutEvent, templates, events: [...events.values()].sort((a, b) => a.eventId - b.eventId) }
await writeIfChanged('generated/bond-mechanism-audit.json', JSON.stringify(audit, null, 2) + '\n')
console.log(`bond mechanism audit ${audit.events.length} events`)
