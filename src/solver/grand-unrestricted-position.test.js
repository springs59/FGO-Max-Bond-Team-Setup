import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {physicalTeamKey} from './score-team-oracle-fixture.js'

const servants=[1,2,3].map(id=>({id,collectionNo:id,name:'S'+id,className:'assassin',rarity:3,cost:1,traitIds:[107]}))
const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,isGrand:s.id<3})),ces:[]}
const base={servants,ces:[],mode:'account',account,base:100,costLimit:3,questType:'grand',questClass:'assassin',allowSupport:false,aiMode:'off',grandPosition:0,
 slotPins:[{position:1,svtId:3},{position:4,svtId:1},{position:5,svtId:2},...[2,3,6].map(position=>({position,empty:true}))]}
const restriction=(type,targetVals,rangeType='equal')=>({type,targetVals,rangeType})
let cases=0,physicalTeams=0
function collect(opts,audit={}){
 const q=createScoreTeamSearch({...opts,scoreTeamAudit:audit}),records=[]
 assert.ok(q.ok,q.error)
 for(const e of q.iterator)if(e.type==='team')for(const record of expandScoreTeamFamily(e.record,q.equivalenceCatalogs[e.record.domain])){
  const plan=q.hydrate(record),grand=plan.slots.find(s=>s.isGrand&&!s.isSupport)
  assert.ok(grand,'Every retained team has an owned Grand')
  assert.ok(!plan.slots.some(s=>s.isSupport&&s.position===grand.position))
  records.push({key:physicalTeamKey(record.packed),score:record.score,grand:grand.position})
 }
 assert.equal(q.state.complete,true)
 const best=records.filter(r=>r.score===q.state.bestScore)
 assert.equal(q.state.maximumProven,best.length>0)
 cases++;physicalTeams+=best.length
 return {keys:new Set(best.map(r=>r.key)),seats:new Set(best.map(r=>r.grand)),score:q.state.bestScore}
}
// Rear candidates remain alternatives when neither has been manually chosen.
// Compare physical enumeration, compact collection and CE-first proof.
for(const quest of [{},{restrictions:[restriction('mySvtNum',[1],'above')]}]){
 const expected=new Set([4,5].flatMap(grandPosition=>[...collect({...base,quest,grandPosition}).keys]))
 for(const audit of [{compact:false,ceFirst:false},{compact:true,ceFirst:false},{compact:true,ceFirst:'force'}]){
  const result=collect({...base,quest},audit)
  assert.deepEqual(result.keys,expected)
  assert.deepEqual(result.seats,new Set([4,5]))
  assert.equal(result.score,320)
 }
}
// With no selected seat, the complete physical result is the union of all
// six explicit seats. A zero base makes front/rear assignments equal score.
const unpinned={...base,base:0,servants:servants.slice(0,2),account:{...account,servants:account.servants.slice(0,2).map(s=>({...s,isGrand:s.id===1}))},slotPins:[]}
for(const quest of [{},{restrictions:[restriction('mySvtNum',[1],'above')]}]){
 const expected=new Set([1,2,3,4,5,6].flatMap(grandPosition=>[...collect({...unpinned,quest,grandPosition}).keys]))
 for(const audit of [{compact:false,ceFirst:false},{compact:true,ceFirst:false},{compact:true,ceFirst:'force'}]){
  const result=collect({...unpinned,quest},audit)
  assert.deepEqual(result.keys,expected)
  assert.deepEqual(result.seats,new Set([1,2,3,4,5,6]))
 }
 const friend=collect({...unpinned,quest,allowSupport:true})
 assert.deepEqual(friend.seats,new Set([1,2,3,4,5,6]),'A movable friend does not reserve seat 6 for every layout')
}
// A required owned Grand with no phase position limit can be in the rear.
const ownedGrand=restriction('myGrandSvt',[107])
const rear=collect({...base,questType:'normal',quest:{noSupport:true,restrictions:[ownedGrand]}})
assert.deepEqual(rear.seats,new Set([4,5]))
// Explicit phase limits remain binding; a manual choice cannot override them.
assert.deepEqual(collect({...base,questType:'normal',quest:{noSupport:true,restrictions:[ownedGrand,restriction('activeGrandBoard',[1,2,3])]}}).keys.size,0,'Existing rear Grands cannot be replaced by an invented front Grand')
assert.equal(collect({...base,grandPosition:4,quest:{noSupport:true,restrictions:[restriction('activeGrandBoard',[5])]}}).keys.size,0)
// Missing designation now produces explicitly conditional Grand suggestions.
assert.ok(collect({...base,questType:'normal',account:{...account,servants:account.servants.map(s=>({...s,isGrand:false}))},quest:{noSupport:true,restrictions:[ownedGrand]}}).keys.size>0)
console.log(JSON.stringify({passed:true,cases,physicalTeams,coverage:'all six own seats, two rear Grands, explicit-seat union, compact/physical/CE-first paths, movable friend, required owned Grand and phase position limits'}))
