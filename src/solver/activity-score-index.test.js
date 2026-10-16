import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildActivityScoreIndex } from './activity-score-index.js'

const read = name => JSON.parse(readFileSync(new URL(`../data/${name}`, import.meta.url), 'utf8'))
const bondBonuses = read('bond-bonuses.json')
const servants = read('servants.json')
const cbc = bondBonuses.events.find(event => event.id === 80520)
assert.ok(cbc, 'CBC event must be present in the historical bonus catalog')
const quest = { id: 99000001, phase: 1, eventId: cbc.id, bond: 815 }
const index = buildActivityScoreIndex({ quests: [quest], servants, bondBonuses,
  now: (cbc.startedAt + 3600) * 1000 })
const scores = index.byQuest[`${quest.id}:1`]
assert.ok(Object.keys(scores).length >= 150, 'CBC wide servant bonus should be enumerated')
assert.equal(scores[100700].totalSecondLayer, 0.2)
assert.equal(scores[100100], undefined)
console.log('CBC wide roster activity bonus passed')
