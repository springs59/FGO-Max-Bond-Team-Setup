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

// Compare every field against the independent direct scorer, including labels,
// scopes and exclusions; equal rates alone must not merge different sources.
const quests = [quest, {...quest,id:99000002}, {...quest,id:99000003,eventId:0}]
const now = (cbc.startedAt + 3600) * 1000
const { getEffectiveBondBonus } = await import('../bond/bonus.js')
const shared = buildActivityScoreIndex({quests,servants,bondBonuses,now})
for (const q of quests) for (const svt of servants) {
  const expected = getEffectiveBondBonus({servantId:svt.id,catalog:bondBonuses,quest:q,now})
  assert.deepEqual(shared.byQuest[`${q.id}:1`]?.[svt.id],expected.totalSecondLayer || expected.party ? expected : undefined)
}
assert.equal(shared.byQuest[`${quest.id}:1`][100700],shared.byQuest['99000002:1'][100700], 'identical full source graphs share one value')
const { shareActivityScoreValues } = await import('./activity-score-index.js')
const parsed = JSON.parse(JSON.stringify(shared)), before = structuredClone(parsed)
shareActivityScoreValues(parsed)
assert.deepEqual(parsed,before,'legacy JSON compaction preserves every field')
assert.equal(parsed.byQuest[`${quest.id}:1`][100700],parsed.byQuest['99000002:1'][100700])
console.log('Activity sharing: full direct oracle, cross-quest aliases and lossless legacy compaction passed')
