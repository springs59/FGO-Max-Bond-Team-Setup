import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { writeIfChanged } from './write-if-changed.mjs'
import { eventAvailability } from '../src/quest-availability.js'

// Display metadata is independent from solver fingerprints and result indexes.
export function buildQuestBrowserIndex(rows, quests, previous = null, region = 'CN', sources = {}) {
  const raw = new Map((rows || []).map(q => [Number(q.id), q]))
  const wars = new Map((sources.wars || []).map(w => [Number(w.id), w]))
  for (const war of sources.warDetails || []) wars.set(Number(war.id), { ...wars.get(Number(war.id)), ...war })
  const events = new Map((sources.events || []).map(e => [Number(e.id), e]))
  const details = new Map((sources.questDetails || []).map(q => [Number(q.id), q]))
  const entries = {}
  for (const q of [...quests].sort((a, b) => Number(a.id) - Number(b.id))) {
    const r = raw.get(Number(q.id)) || (previous?.region === region ? previous.quests?.[q.id] : null)
    if (!r) continue
    const old = previous?.region === region ? previous.quests?.[q.id] : null
    const war = wars.get(Number(r.warId))
    const event = events.get(Number(r.eventId || q.eventId || war?.eventId))
    const kind = war?.flags?.includes('mainScenario') ? 'main-story' : event ? eventAvailability(event, war, region) : old?.availabilityKind
    const conditions = details.get(Number(q.id))?.releaseConditions || r.releaseConditions || old?.releaseConditions || []
    entries[q.id] = { type: r.type, afterClear: r.afterClear || '', warId: Number(r.warId) || 0,
      flags: Array.isArray(r.flags) ? r.flags : [],
      ...(kind ? { availabilityKind: kind } : {}),
      ...(conditions.length ? { releaseConditions: conditions.map(c => ({ type: c.type, targetId: c.targetId, value: c.value })) } : {}) }
  }
  return { version: 2, region, source: 'Atlas Academy regional war, event and quest releaseConditions', quests: entries }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = JSON.parse(await readFile(process.argv[2], 'utf8'))
  const quests = JSON.parse(await readFile('src/data/quests.json', 'utf8'))
  const index = buildQuestBrowserIndex(rows, quests)
  await writeIfChanged('generated/quest-browser-index.json', JSON.stringify(index) + '\n')
  console.log(`quest browser metadata: ${Object.keys(index.quests).length}/${quests.length}`)
}
