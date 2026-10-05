import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCombinationFactors, factorsMatch } from '../src/solver/combination-factors.js'
import { BOND_CURVE_VERSION, evaluateBondCurve, compileBondCurve, curveKey } from '../src/solver/bond-curve.js'
import { isPlayableServant, ceHasBondGain } from '../src/game-data.js'
import { servantBondForms, hydrateSolutionHits } from '../src/recommend.js'
import { resolveCurrentActivity } from '../src/rules/activity-rules.js'
import { activityEffectKey } from '../src/solver/activity-template.js'
import { oracleParty } from '../src/bond-oracle.js'

const read = async path => JSON.parse(await readFile(path,'utf8'))
const [factors, bank, factorActivities, servants, ces, quests, bonuses, version, activity] = await Promise.all([
  read('generated/combination-factors.json'), read('generated/curve-index.json'), read('generated/factor-activities.json'),
  read('src/data/servants.json'), read('src/data/ces.json'), read('src/data/quests.json'),
  read('src/data/bond-bonuses.json'), read('src/data/version.json'), read('generated/activity-score-index.json')])
assert.ok(factorsMatch(factors, version),'stale factor index')
const expected = buildCombinationFactors({ servants:servants.filter(isPlayableServant),
  ces:ces.filter(ceHasBondGain), formsOf:servantBondForms, version })
assert.deepEqual(factors.members,expected.members,'factor compression lost identities or form conditions')
assert.deepEqual(factors.vectors,expected.vectors,'factor CE vector mismatch')
assert.deepEqual(factors.ces,expected.ces,'factor CE domain mismatch')
assert.equal(bank.version,BOND_CURVE_VERSION)
assert.equal(bank.rulesDigest,factors.rulesDigest)
assert.equal(bank.baseDataVersion,factors.baseDataVersion)
assert.equal(bank.activityState,resolveCurrentActivity({catalog:bonuses}).activityState)
assert.equal(factorActivities.activityState,bank.activityState)
assert.equal(bank.coverage,'candidate-only','a materialized shortlist is not exhaustive')
for (const [key, rows] of Object.entries(activity.byQuest)) {
  assert.deepEqual(factorActivities.scenarios[factorActivities.byQuest[key]].effects,
    JSON.parse(activityEffectKey(rows)),'activity delta lost a self/party/support effect')
}
let checked=0
for(const scenario of bank.scenarios) {
  assert.equal(scenario.coverage,'candidate-only')
  for(const candidate of scenario.candidates) {
    const quest=quests.find(q=>q.id===candidate.plan.questId)
    const [plan]=hydrateSolutionHits([candidate.plan],{servants,ces,base:0,quest,bondBonuses:bonuses,bond15Aura:true})
    assert.ok(plan)
    const curve=bank.curves[candidate.curveId]
    assert.equal(curveKey(curve),curveKey(compileBondCurve(plan.slots)))
    for(const base of [0,1,4,49,165,265,315,815,1318,2001]) for(const teapot of [false,true]) {
      assert.equal(evaluateBondCurve(curve,base,{teapot}).total,oracleParty(base,teapot,plan.slots).total)
      checked++
    }
  }
}
console.log(`curve/factor index validated: ${factors.members.length} identities/forms, ${checked} independent settlements`)
