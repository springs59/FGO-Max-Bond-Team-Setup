import assert from 'node:assert/strict'
import { activityTeamCandidates } from './activity-team-candidates.js'
import { compactPlan, querySolutionIndex, SOLUTION_INDEX_VERSION } from './solution-index.js'
import { hydrateSolutionHits } from '../recommend.js'

const servants = [1, 2, 3, 4, 5, 6].map(id => ({ id, collectionNo: id,
  name: `S${id}`, className: 'saber', attribute: 'earth', traitIds: id === 6 ? [7] : [],
  rarity: 1, cost: 0, forms: [] }))
const conditional = { id: 20, name: 'conditional', cost: 0, skills: [
  { condLimitCount: 4, funcs: [{ target: 'ptFull', rate: 300, tvals: [{ id: 7 }], andTvals: [] }] },
] }
const quest = { id: 10, phase: 1, eventId: 77 }
const catalog = { extraPassives: [{ servantId: 5, rate: 0.5, target: 'ptFull',
  eventId: 77, startedAt: 1, endedAt: 4102444800, applySupportSvt: 1 }], questFriendships: [] }
const extra = { questId: 10, questPhase: 1, questClass: '', questType: 'normal', eventId: 77 }
const seed = compactPlan({ total: 0, costUsed: 0, slots: [1, 2, 3, 4].map((id, i) => ({
  position: i + 1, filled: true, svtId: id, svtArtKey: 'default', ceId: i === 0 ? 20 : 0,
})) }, extra)
const result = activityTeamCandidates({ baselinePlans: [seed], bonuses: { 5: { party: .5 } },
  servants, ces: [conditional], base: 815, quest, bondBonuses: catalog, extra })
assert.equal(result.migrated, 1)
assert.ok(result.evaluated > 1)
assert.ok(result.plans.some(plan => plan.slots.some(row => row.svt === 5)), 'event aura member was recomputed')
const hitSeed = { ...seed, slots: seed.slots.map(row => row.svt === 4 ? { ...row, svt: 6 } : row) }
assert.ok(result.plans.some(plan => plan.slots.some(row => row.svt === 5)), 'event member joins migrated CE teams')
const ceOnly = activityTeamCandidates({ baselinePlans: [hitSeed], bonuses: {}, servants,
  ces: [conditional], base: 815, quest, bondBonuses: { extraPassives: [], questFriendships: [] }, extra })
assert.ok(ceOnly.plans.some(plan => plan.slots.some(row => row.svt === 6)), 'conditional CE hit team was migrated and rescored')
const original = hydrateSolutionHits([seed], { servants, ces: [conditional], base: 815,
  quest, bondBonuses: catalog, bond15Aura: true, allowSupport: true })[0]
assert.ok(result.plans[0].score > original.total, 'full party gains outrank migrated base')
assert.equal(querySolutionIndex({ version: SOLUTION_INDEX_VERSION,
  queries: [{ key: '10#1##normal#1#77', complete: false, plans: result.plans }] },
{ questId: 10, eventId: 77 }).length, 0, 'candidate-only rows must trigger the live optimizer')
console.log('activity-team-candidates.test.js ok')
