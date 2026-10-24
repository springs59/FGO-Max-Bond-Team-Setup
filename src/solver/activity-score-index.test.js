import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildActivityScoreIndex, lookupActivityScores } from './activity-score-index.js'

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

// A PR can outlive the activity window of its checked-in generated indexes.
// The old snapshot must be rejected after expiry; rebuilding from the same
// catalog must remove expired bonuses without changing the catalog itself.
const lastSecond=cbc.endedAt*1000,afterExpiry=lastSecond+1000
const closing=buildActivityScoreIndex({quests:[quest],servants,bondBonuses,now:lastSecond})
assert.equal(lookupActivityScores(closing,quest,bondBonuses,lastSecond)[100700].totalSecondLayer,0.2)
assert.equal(lookupActivityScores(closing,quest,bondBonuses,afterExpiry),null)
const refreshed=buildActivityScoreIndex({quests:[quest],servants,bondBonuses,now:afterExpiry})
assert.notEqual(refreshed.activityState,closing.activityState)
const refreshedScores=lookupActivityScores(refreshed,quest,bondBonuses,afterExpiry)
assert.equal(refreshed.byQuest[`${quest.id}:1`],undefined)
assert.equal(refreshedScores,null)
console.log('Activity expiry: final second remains valid, stale index rejected, rebuilt index removes expired bonuses')
