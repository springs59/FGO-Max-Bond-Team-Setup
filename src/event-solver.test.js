import assert from 'node:assert/strict'
import { recommendTeam } from './recommend.js'
import { referenceRecommendTeam, planObjective } from './reference-solver.js'
import { compactPlan, queryKeyOf } from './solver/solution-index.js'
import { SOLUTION_INDEX_VERSION } from './rules/versions.js'

const servants = Array.from({ length: 6 }, (_, i) => ({
  id: 101 + i, collectionNo: 101 + i, name: `S${i}`, className: 'saber',
  attribute: 'earth', traitIds: [i % 2 ? 9002 : 9001], forms: [], cost: 3, rarity: 3,
}))
function ce(id, rate, cost, trait) {
  const fn = { target: 'ptFull', rate, add: 0, eventId: 0, indiv: 0,
    applySupport: null, followerRate: rate, tvals: trait ? [{ id: trait }] : [], andTvals: [] }
  return { id, collectionNo: id, name: `CE${id}`, cost, rarity: 4,
    skills: [{ condLimitCount: 0, funcs: [fn] }, { condLimitCount: 4, funcs: [fn] }] }
}
const ces = [ce(201, 100, 1), ce(202, 250, 3, 9001), ce(203, 300, 4, 9002)]
const quest = { id: 501, eventId: 77 }
const record = (servantId, rate, target = 'self') => ({
  servantId, rate, target, eventId: 77, skillId: 940194,
  startedAt: 1, endedAt: 4102444800, applySupportSvt: 1,
})
const opts = { base: 815, servants, ces, allowSupport: false, quest,
  bondBonuses: { extraPassives: [record(106, 1), record(105, .05, 'ptFull')], questFriendships: [] },
  skipSolutionLookup: true }
function compare(options, label) {
  const fast = recommendTeam(options)
  const reference = referenceRecommendTeam(options)
  assert.equal(fast.ok, true, label)
  assert.equal(reference.ok, true, label)
  assert.equal(fast.total, reference.total, `${label}: ${JSON.stringify([planObjective(fast), planObjective(reference)])}`)
  assert.equal(fast.costUsed, reference.costUsed, `${label}: cost`)
  return fast
}
compare(opts, 'event front position + party aura')
for (let seed = 0; seed < 8; seed++) {
  compare({ ...opts, servants: servants.slice(0, 4), base: 701 + seed * 17,
    allowSupport: seed % 2 === 0, teapot: seed % 3 === 0, costLimit: 15 + seed,
    bondBonuses: { extraPassives: [record(101 + seed % 4, .3 + seed / 10), record(104, .05, 'ptFull')], questFriendships: [] },
  }, `event differential ${seed}`)
}
// A precomputed ordinary plan must not suppress an event-specific optimum.
const ordinary = recommendTeam({ ...opts, bondBonuses: null })
const index = { version: SOLUTION_INDEX_VERSION, queries: [{ key: queryKeyOf({ allowSupport: false, eventId: 77 }), plans: [compactPlan(ordinary)] }] }
const indexed = recommendTeam({ ...opts, skipSolutionLookup: false, solutionIndex: index })
assert.equal(indexed.total, referenceRecommendTeam(opts).total)
// A quest-wide campaign can change while the event id remains zero.
const campaign = { eventId: 88, rate: 1, allQuests: false, questIds: [601],
  targetIds: [106], startedAt: 1, endedAt: 4102444800 }
const campaignOpts = { ...opts, quest: { id: 601 }, bondBonuses: { extraPassives: [], questFriendships: [campaign] } }
compare(campaignOpts, 'campaign active')
compare({ ...campaignOpts, quest: { id: 602 } }, 'campaign excluded')
console.log('event solver differential tests passed')
