import assert from 'node:assert/strict'
import { recommendTeam } from '../recommend.js'
import { applyCraftEssences } from '../atlas.js'
import { calcParty } from '../bond.js'
const servants=Array.from({length:6},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i?16:3,traitIds:[100]}))
for(const teapot of [false,true])for(const useInventoryCurveSolver of [false,true]){
  const progress=[]
  const out=recommendTeam({servants,ces:[],base:1000,costLimit:20,lockSvtIds:[100],teapot,useInventoryCurveSolver,
    solverAudit:useInventoryCurveSolver?{defaultDp:true}:null,onSolverProgress:p=>progress.push(p)})
  assert.ok(out.ok,out.error);assert.equal(out.total,(useInventoryCurveSolver?2480:2400)*(teapot?2:1))
  assert.ok(out.costUsed<=20);assert.equal(out.solverStats.bestScore,out.total)
  for(const p of progress)assert.ok(p.bestScore<=out.total,'progress must be an achievable score within the query')
  const slots=out.slots.map(s=>({...s,ceLines:[],eventPassive:0,customPercent:0}))
  applyCraftEssences(slots,[])
  assert.equal(calcParty(1000,teapot,slots).results.reduce((n,r)=>n+r.final,0),out.total,'display settlement equals solver settlement')
}
for(const [extra,check] of [
  [{allowSupport:false},out=>assert.ok(out.slots.every(s=>!s.isSupport))],
  [{frontIds:[0,0,100]},out=>assert.equal(out.slots[2].svtId,100)],
  [{slotPins:[{position:5,svtId:100},{position:2,empty:true}]},out=>{assert.equal(out.slots[4].svtId,100);assert.ok(!out.slots[1].filled)}],
]){
  const out=recommendTeam({servants,ces:[],base:1000,costLimit:20,useInventoryCurveSolver:true,lockSvtIds:[100],...extra})
  assert.ok(out.ok,out.error);assert.equal(out.resultStatus.source,'curve-dp');check(out)
}
const impossible=recommendTeam({servants,ces:[],base:1000,costLimit:1,lockSvtIds:[100]})
assert.ok(!impossible.ok);assert.match(impossible.error,/COST/)
console.log('progress/query: feasible incumbents, COST, tea multiplier, locked identities/seats, empty seats and display settlement passed')
