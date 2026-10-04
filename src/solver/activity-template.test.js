import assert from 'node:assert/strict'
import { activityTemplateOf, activityEffectKey, activityCalculationKey } from './activity-template.js'

const first = { extraPassives: [{ type: 'extraPassive', eventId: 1,
  servantId: 101, target: 'self', rate: .5 }], questFriendships: [] }
const rerun = { extraPassives: [{ ...first.extraPassives[0], eventId: 2,
  name: 'new event', startedAt: 123 }], questFriendships: [] }
const template = activityTemplateOf(first)
assert.equal(template, 'event-self')
assert.equal(activityTemplateOf(rerun), template)
const a = { 101: { totalSecondLayer: .5, party: 0, sources: [{ eventId: 1 }] } }
const b = { 101: { totalSecondLayer: .5, party: 0, sources: [{ eventId: 2 }] } }
const key = bonuses => activityCalculationKey({ template, bonuses, base: 815 })
assert.equal(key(a), key(b), 'new event with the same effect and base shares one calculation')
assert.notEqual(key(a), activityCalculationKey({ template, bonuses: b, base: 715 }))
assert.notEqual(activityEffectKey(a), activityEffectKey({ 102: b[101] }), 'different targets require a new result')
assert.notEqual(activityEffectKey(a), activityEffectKey({ 101: { ...b[101], party: .5 } }), 'party aura is distinct')
assert.notEqual(activityEffectKey({ 101: { party: .5, partyApplySupport: 0 } }),
  activityEffectKey({ 101: { party: .5, partyApplySupport: 1 } }), 'support scope is distinct')
assert.equal(activityTemplateOf({ extraPassives: [], questFriendships: [{ type: 'questFriendship',
  allQuests: true, targetIds: [101], exceptedQuestIds: [] }] }), 'campaign-self')
assert.equal(activityTemplateOf({ extraPassives: [], questFriendships: [{ type: 'questFriendship',
  allQuests: false, targetIds: [], questIds: [10] }] }), 'campaign-self')
assert.throws(() => activityTemplateOf({ extraPassives: [{ type: 'extraPassive', target: 'unknown' }] }), /unknown/)
console.log('activity-template.test.js ok')
