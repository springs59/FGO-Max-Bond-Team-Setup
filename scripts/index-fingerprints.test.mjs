import assert from 'node:assert/strict'
import { baseDataVersionOf, fingerprintOf, indexRefreshDecision, openEventQuestState } from './index-fingerprints.mjs'

const base = fingerprintOf({ servants: [1], ces: [2] })
const activity = fingerprintOf({ event: 3 })
const before = { baseFingerprint: base, activityFingerprint: activity }
const data = { servants: [{ id: 1 }], ces: [{ id: 2 }], traits: [],
  quests: [{ id: 1, bond: 815 }, { id: 2, eventId: 80, bond: 915 }], questBondSource: 'friendshipExp' }
assert.equal(baseDataVersionOf(data), baseDataVersionOf({ ...data,
  quests: [data.quests[0], { ...data.quests[1], bond: 715 }] }))
assert.notEqual(baseDataVersionOf(data), baseDataVersionOf({ ...data,
  quests: [{ ...data.quests[0], bond: 715 }, data.quests[1]] }))
assert.deepEqual(indexRefreshDecision(before, before),
  { baseChanged: false, activityChanged: false, changed: false })
assert.deepEqual(indexRefreshDecision(before, { ...before, activityFingerprint: 'new' }),
  { baseChanged: false, activityChanged: true, changed: true })
assert.deepEqual(indexRefreshDecision(before, { ...before, baseFingerprint: 'new' }),
  { baseChanged: true, activityChanged: true, changed: true })
assert.deepEqual(indexRefreshDecision(null, before),
  { baseChanged: true, activityChanged: true, changed: true })
const delayed = [{ id: 10, eventId: 80, bond: 815, phase: 1, openedAt: 200, closedAt: 400 }]
assert.deepEqual(openEventQuestState(delayed, 199), [])
assert.deepEqual(openEventQuestState(delayed, 200), [[10, 1, 815]])
assert.deepEqual(openEventQuestState(delayed, 401), [])
assert.notEqual(fingerprintOf(openEventQuestState(delayed, 199)),
  fingerprintOf(openEventQuestState(delayed, 200)))
console.log('separate base and activity fingerprints passed')
