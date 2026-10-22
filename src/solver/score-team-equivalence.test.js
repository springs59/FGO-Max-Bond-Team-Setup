import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {createScoreTeamController} from './score-team-worker.js'
const svt=(id,cost=1)=>({id,collectionNo:id,name:'S'+id,className:'saber',rarity:3,cost,traitIds:[10]})
const ce=(id,rate=100,cost=1)=>({id,name:'C'+id,cost,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate,add:0,tvals:[],andTvals:[]}]}))})
const key=r=>JSON.stringify([r.score,r.packed.cost,r.packed.slots.map(s=>[s.p,s.f,s.s,s.g||0,s.svt,s.art||'default',s.ce,s.ce?s.mlb!==false:true,s.bond||0,s.reward||0])])
const base={servants:[svt(1),svt(2),svt(3)],ces:[ce(101),ce(102)],base:100,costLimit:6,
  allowSupport:false,slotPins:[3,5,6].map(position=>({position,empty:true})),aiMode:'off'}
function run(opts,compact){
  const q=createScoreTeamSearch({...opts,scoreTeamAudit:{compact}}),physical=new Set();let best=-Infinity,groups=0
  assert.equal(q.ok,true,q.error)
  for(const event of q.iterator)if(event.type==='team'){
    const r=event.record;q.hydrate(r);groups++
    if(r.score>best){best=r.score;physical.clear()}
    if(r.score===best)for(const variant of expandScoreTeamFamily(r,q.equivalenceCatalogs[r.domain])){
      q.hydrate(variant);const k=key(variant);assert.ok(!physical.has(k),'Families must be disjoint');physical.add(k)
    }
  }
  assert.equal(q.state.complete,true)
  return {q,physical,groups,best}
}
const cases=[{...base,servants:[svt(1),svt(2)],ces:[],base:0,allowSupport:true,slotPins:[]},
 {...base,servants:[svt(1),svt(2)],ces:[],base:0,slotPins:[]},{...base,slotPins:[{position:1,svtId:1,formKey:'a1'},...base.slotPins]},
 {...base,slotPins:[{position:1,formKey:'a1'},...base.slotPins]},base,{...base,base:0},{...base,base:1,teapot:true},
 {...base,allowSupport:true,quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},slotPins:[3,5].map(position=>({position,empty:true}))},
 {...base,allowSupport:true,slotPins:[3,5].map(position=>({position,empty:true}))},
 {...base,servants:[svt(1),svt(2,2),svt(3,3)],base:1},
 {...base,optimizeBy:'prefer',preferSvtIds:[1]},
 {...base,lockSvtIds:[2],pinCes:[{ceId:101,svtId:2}]},
 {...base,frontIds:[1]},
 {...base,slotPins:[{position:1,ceId:101},...[3,5,6].map(position=>({position,empty:true}))]},
 {...base,servants:[{...svt(1),forms:[{key:'c1',cost:1,traitIds:[11]}]},svt(2)],ces:[{...ce(101),skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate:200,tvals:[{id:11}],andTvals:[]}]}))}]},
 {...base,mode:'account',account:{region:'CN',servants:base.servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4})),ces:[{id:101,count:2,mlbCount:1},{id:102,count:1,mlbCount:0}]}},
 {...base,ces:[],mode:'account',account:{region:'CN',servants:base.servants.map(s=>({id:s.id,bondLv:s.id<3?15:5,bondCap:15,limitCount:4})),ces:[]}},
 {...base,ces:[{...ce(101),skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'self',rate:500,tvals:[],andTvals:[]}]}))}]},
 {...base,bondBonuses:{extraPassives:[],questFriendships:[{eventId:0,allQuests:true,targetIds:[1],rate:0.2,startedAt:1,endedAt:4102444800}]}},
 {...base,servants:[svt(1)],questType:'grand',questClass:'saber',grandPosition:1,slotPins:[2,3,4,5,6].map(position=>({position,empty:true}))},
]
let teams=0
for(let i=0;i<cases.length;i++){
  const reference=run(cases[i],false),grouped=run(cases[i],true)
  assert.equal(grouped.best,reference.best,`maximum ${i}`)
  assert.deepEqual(grouped.physical,reference.physical,`ALL physical variants ${i}`)
  teams+=grouped.physical.size
}
// More than one identity in a pooled aura category must remain available
// in the score upper bound, even when its representative is already used.
const aura=cases[16],reference=run(aura,false),grouped=run(aura,true)
assert.deepEqual(grouped.physical,reference.physical)
// The ordinary zero-score example searches three families, not 66 records.
const small={...base,servants:[svt(1),svt(2)],ces:[],base:0}
assert.equal(run(small,true).groups,3);assert.equal(run(small,true).physical.size,66)
const messages=[],controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{}})
await controller.start(1,small)
const info=messages.at(-1).result.value.scoreTeamResults
assert.equal(info.grouped,true);assert.equal(info.bestCount,3)
assert.ok(messages.at(-1).result.value.plans.every(p=>p.equivalence))
await controller.exportTeams({id:1})
const exported=messages.at(-1);assert.equal(exported.type,'score-export');assert.equal(exported.ok,true)
const lines=(await (await fetch(exported.url)).text()).trim().split('\n').map(JSON.parse)
assert.equal(lines.length,4,'Export stays compact rather than expanding physical variants')
assert.equal(lines[0].resultUnit,'equivalence-group');assert.equal(lines[0].equivalenceCatalogs.length,1)
const restored=[]
for(const line of lines.slice(1))for(const variant of expandScoreTeamFamily({domain:line.family.domain,score:line.score,packed:line.family.packed},lines[0].equivalenceCatalogs[line.family.domain]))restored.push(key(variant))
assert.equal(new Set(restored).size,66,'The standalone export preserves every original legal alternative')
URL.revokeObjectURL(exported.url)
console.log(JSON.stringify({passed:true,cases:cases.length,physicalOptimalTeams:teams,small:{physical:66,groups:3},coverage:'disjoint lazy expansion, identities/forms, CE pools/MLB stock, all support positions, seat symmetry, pins, prefer, COST, aura bounds, exact fallback and compact archive round trip'}))
