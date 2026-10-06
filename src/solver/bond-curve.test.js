import assert from 'node:assert/strict'
import { compileBondCurve, evaluateBondCurve, curveResidue } from './bond-curve.js'
import { oracleParty } from '../bond-oracle.js'
import { solveDefaultCurves } from './default-curve-solver.js'
import { hydrateSolutionHits, servantBondForms, recommendTeam } from '../recommend.js'
import { referenceRecommendTeam } from '../reference-solver.js'
import { buildCombinationFactors, projectFactorMembers } from './combination-factors.js'
import { emptyRosterFilter } from '../filter.js'

let seed = 7459
const rand = n => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n }
let settlements = 0
for (let trial = 0; trial < 100; trial++) {
  const slots = Array.from({ length: 6 }, (_, i) => ({ position: i+1, svtId: i+1,
    filled: rand(5) !== 0, isSupport: i === rand(6), bondMaxed: !rand(5), bond15: !rand(4),
    lunch: rand(5)*.025, eventPassive: rand(50)*.025,
    portrait: !rand(3), customPercent: rand(5)*.01, ceLines: [{ key: 'test', pct: rand(8)*.025 }] }))
  const bond15Aura = Boolean(rand(2))
  const curve = compileBondCurve(slots, { bond15Aura })
  for (const base of [0, 1, 4, 49, 50, 165, 265, 315, 815, 1318, 9999]) {
    for (const teapot of [false, true]) {
      const value = evaluateBondCurve(curve, base, { teapot })
      assert.equal(value.total, oracleParty(base, teapot, slots, { bond15Aura }).total)
      assert.equal(value.gain, value.total - value.eligibleCount*base)
      settlements++
    }
    const residue = base % curve.period, q = Math.floor(base/curve.period)
    const model = curveResidue(curve, residue)
    assert.equal(evaluateBondCurve(curve, base).total, q*model.increment + model.offset)
  }
}
const flat = compileBondCurve([{ position:4, svtId:1, filled:true, portrait:true }])
const rate = compileBondCurve([{ position:4, svtId:1, filled:true, customPercent:.2 }])
assert.ok(evaluateBondCurve(flat,165).total > evaluateBondCurve(rate,165).total)
assert.ok(evaluateBondCurve(flat,315).total < evaluateBondCurve(rate,315).total)
assert.equal(evaluateBondCurve(flat,250).total, evaluateBondCurve(rate,250).total)

const ce = (id, milli, cost, trait=0, flat=0) => ({ id, collectionNo:id, cost, rarity:3, name:`C${id}`,
  skills: [0,4].map(condLimitCount => ({ condLimitCount, funcs: [{ target:'ptFull',rate:milli,
    followerRate:milli+(!flat?25:0),add:flat,eventId:0,tvals:trait?[{id:trait}]:[],andTvals:[] }] })) })
for (let trial=0; trial<30; trial++) {
  const servants = Array.from({length:6}, (_,i)=>({id:101+i,collectionNo:101+i,name:`S${i}`,
    cost:rand(10),rarity:3,className:'saber',attribute:'earth',traitIds:[1+(i%2)],
    forms:i===0?[{key:'a1',cost:rand(10),rarity:3,attribute:'sky',traitIds:[2]}]:[]}))
  const ces = [ce(201,50,2),ce(202,200,4,1),ce(203,0,1,0,50)]
  const quest = {id:501,eventId:77}
  const bonuses = {105:{totalSecondLayer:.25,party:.05},106:{totalSecondLayer:.5,party:0}}
  const bondBonuses = {extraPassives:[
    {servantId:105,eventId:77,target:'self',rate:.25,startedAt:1,endedAt:4102444800},
    {servantId:105,eventId:77,target:'ptFull',rate:.05,startedAt:1,endedAt:4102444800},
    {servantId:106,eventId:77,target:'self',rate:.5,startedAt:1,endedAt:4102444800}],questFriendships:[]}
  const base = [1,4,49,165,265,315,815][trial%7]
  const excluded = trial%3===0 ? servants.slice(0,4) : servants
  const allowedCes = trial%4===0 ? ces.slice(1) : ces
  const input={servants:excluded,ces:allowedCes,base,quest,bondBonuses,allowSupport:true}
  const compact=solveDefaultCurves({...input,formsOf:servantBondForms,bonuses})
  const [plan]=hydrateSolutionHits([compact],input)
  const reference=referenceRecommendTeam(input)
  assert.deepEqual([plan.total,plan.costUsed],[reference.total,reference.costUsed],`DP trial ${trial}`)
  const direct=recommendTeam({...input,useDefaultCurveSolver:true,skipSolutionLookup:true,solverAudit:{defaultDp:true}})
  assert.ok(direct.total>=reference.total, 'both support positions dominate the legacy rear-only domain')
  const factors=buildCombinationFactors({...input,formsOf:servantBondForms,version:{dataVersion:'test'}})
  assert.equal(factors.members.length,excluded.flatMap(servantBondForms).length)
  const projected=projectFactorMembers(factors,{servants:excluded,mode:'account',account:{servants:[{id:excluded[0].id}]}})
  assert.ok(projected.members.every(row=>row.svt===excluded[0].id))
}
// A current candidate curve is never an optimality proof after filtering.
{
  const servants=[101,102,103].map((id,i)=>({id,collectionNo:id,name:`S${id}`,cost:i,rarity:3,
    className:'saber',attribute:'earth',traitIds:[],forms:[]}))
  const options={servants,ces:[ce(201,100,2)],base:165,allowSupport:true,useDefaultCurveSolver:true,
    game:{version:{dataVersion:'test',region:'CN'}},filter:{...emptyRosterFilter(),banSvtIds:[101]},costLimit:20}
  const actual=recommendTeam(options)
  const reference=referenceRecommendTeam({...options,servants:servants.slice(1)})
  assert.ok(actual.total>=reference.total)
  assert.ok(actual.slots.every(slot=>slot.svtId!==101))
}
console.log(`exact curves: ${settlements} independent settlements; 30 CE-vector DP/full-enumeration comparisons passed`)
