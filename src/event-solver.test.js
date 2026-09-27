import assert from 'node:assert/strict'
import { recommendTeam } from './recommend.js'
import { referenceRecommendTeam, planObjective } from './reference-solver.js'
import { compactPlan, queryKeyOf } from './solver/solution-index.js'
import { SOLUTION_INDEX_VERSION } from './rules/versions.js'
import { resolveCurrentActivity } from './rules/activity-rules.js'
import { buildActivityScoreIndex, lookupActivityScores } from './solver/activity-score-index.js'

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
{
  const secondQuest = { id: 502, eventId: 77, bond: 615 }
  const matrix = buildActivityScoreIndex({ quests: [quest, secondQuest], servants, bondBonuses: opts.bondBonuses })
  assert.ok(lookupActivityScores(matrix, quest, opts.bondBonuses)?.[106])
  const indexed = recommendTeam({ ...opts, solverIndex: { gameDataVersion: 'matrix-test', activityScores: matrix },
    game: { version: { dataVersion: 'matrix-test', region: 'CN' } } })
  const direct = recommendTeam(opts)
  assert.equal(indexed.total, direct.total)
  assert.deepEqual(indexed.slots.map(row => row.eventPassive), direct.slots.map(row => row.eventPassive))
  const second = { ...opts, base: secondQuest.bond, quest: secondQuest }
  const secondIndexed = recommendTeam({ ...second, solverIndex: { gameDataVersion: 'matrix-test', activityScores: matrix },
    game: { version: { dataVersion: 'matrix-test', region: 'CN' } } })
  assert.equal(secondIndexed.total, recommendTeam(second).total)
  assert.notEqual(secondIndexed.total, indexed.total)
  assert.equal(lookupActivityScores(matrix, quest, { extraPassives: [], questFriendships: [] }), null)
  assert.equal(lookupActivityScores(matrix, quest, opts.bondBonuses, 4_102_444_801_000), null)
}
// An exact event quest can use a matching offline result; another quest or a
// changed activity state must go through live search.
{
  const live = { ...opts, allowSupport: true, skipSolutionLookup: false }
  const computed = recommendTeam(live)
  const extra = { questId: quest.id, questClass: '', questType: 'normal', allowSupport: true, eventId: quest.eventId }
  const precomputed = {
    version: SOLUTION_INDEX_VERSION,
    gameDataVersion: 'test-event',
    activityState: resolveCurrentActivity({ catalog: opts.bondBonuses }).activityState,
    queries: [{ key: queryKeyOf(extra), questId: quest.id, base: 815, plans: [compactPlan(computed, extra)] }],
  }
  const game = { version: { dataVersion: 'test-event', region: 'CN' } }
  const hit = recommendTeam({ ...live, solutionIndex: precomputed, game })
  assert.equal(hit.total, computed.total)
  assert.equal(hit.solverStats.nodes, 0)
  const otherQuest = recommendTeam({ ...live, quest: { ...quest, id: 502 }, solutionIndex: precomputed, game })
  assert.equal(otherQuest.total, referenceRecommendTeam({ ...live, quest: { ...quest, id: 502 } }).total)
  assert.ok(otherQuest.solverStats.nodes > 0)
  const expired = { ...opts.bondBonuses, extraPassives: [] }
  const changed = recommendTeam({ ...live, bondBonuses: expired, solutionIndex: precomputed, game })
  assert.equal(changed.total, referenceRecommendTeam({ ...live, bondBonuses: expired }).total)
  assert.ok(changed.solverStats.nodes > 0)
}
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
