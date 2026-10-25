import assert from 'node:assert/strict'
import {distinctMemberTeams,memberCompositionKey,localMemberTeams} from './score-team-diversity.js'
import {createScoreTeamController} from './score-team-worker.js'
const catalog={rows:[[1,2,3,4].map(svt=>({svt,art:''}))]}
const record={score:10,domain:0,packed:{equivalence:1,slots:[{p:1,f:1,rg:0,svt:1,ce:10},{p:2,f:1,rg:0,svt:2,ce:11}]}}
const variants=[...distinctMemberTeams(record,catalog)]
assert.equal(variants.length,6,'4 choose 2, without seat permutations')
assert.equal(new Set(variants.map(r=>JSON.stringify(r.packed.slots.map(s=>s.svt)))).size,6)
assert.ok(variants.every(r=>r.packed.slots[0].ce===10&&r.packed.slots[1].ce===11))
assert.equal(record.packed.slots[0].svt,1,'Original representative is immutable')
const messages=[],controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{}})
await controller.start(1,{servants:[1,2,3,4].map(id=>({id,name:'S'+id,collectionNo:id,className:'saber',rarity:1,cost:3,traitIds:[]})),ces:[],base:815,allowSupport:false,costLimit:6,slotPins:[3,4,5,6].map(position=>({position,empty:true})),aiMode:'off'})
const result=messages.find(m=>m.type==='score-complete').result.value,plan=result.plans.find(p=>p.slots.filter(s=>s.filled).length===2)
assert.ok(plan?.scoreFamilyRef)
await controller.variant({id:1,request:1,ref:plan.scoreFamilyRef,currentMembers:memberCompositionKey(plan)})
const changed=messages.at(-1)
assert.equal(changed.type,'score-variant');assert.equal(changed.ok,true);assert.ok(changed.plan)
assert.equal(changed.plan.total,plan.total);assert.equal(changed.plan.costUsed,plan.costUsed)
assert.notEqual(memberCompositionKey(changed.plan),memberCompositionKey(plan))
assert.equal(new Set(changed.plan.slots.filter(s=>s.filled).map(s=>s.svtId)).size,2)
console.log('Different-member ties: lazy combinations, exact equal score, CE roles, no duplicate identities and immutable representative passed')
{
 const d={rows:[2,3,4].map(id=>({svt:{id},form:{key:'default'}})),requiredIds:[],fixedPositions:{},pinCes:[],pins:[],grandIds:[1],ceById:new Map(),costLimit:6,
  hydrate:p=>({ok:true,total:p.slots[0].svt===3?999:10,costUsed:p.slots[0].svt===4?7:6})}
 const original={score:10,domain:0,packed:{slots:[{p:1,f:1,svt:1,ce:42}]}}
 const found=[...localMemberTeams(original,d)].filter(r=>r.type!=='tick')
 assert.equal(found.length,1);assert.equal(found[0].packed.slots[0].svt,2)
 assert.equal(found[0].packed.slots[0].ce,42)
 for(const protect of [{requiredIds:[1]},{pinCes:[{svtId:1,ceId:42}]},{fixedPositions:{1:1}},{pins:[{position:1,svtId:1}]},{partyConstraints:{}}])assert.equal([...localMemberTeams(original,{...d,...protect})].length,0)
 assert.equal([...localMemberTeams({...original,packed:{slots:[{...original.packed.slots[0],g:1}]}},d)].length,0,'Account Grand identity cannot be replaced with an undesignated member')
}
console.log('Literal neighbour fallback: exact score, COST, unchanged CE roles, required/pinned/fixed identities, Grand designation and extended-party fallback passed')
