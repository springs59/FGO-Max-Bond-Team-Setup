import assert from 'node:assert/strict'
import {settleParty,interchangeableMembers} from '../party-state.js'
import {createScoreTeamSearch} from '../recommend.js'
import {comparePartyRows} from '../ui/team-comparison.js'

// Generic public rule fixture, with no imported account data: being female
// alone does not satisfy a CE requiring lawful AND female. Stale traits or
// an archived claimed total must not survive a physical member replacement.
for(const trait of [304,9000]){
 const svt=(id,cost,traits)=>({id,collectionNo:id,name:'Synthetic '+id,className:'assassin',rarity:cost===16?5:4,cost,traitIds:traits})
 const servants=[svt(1,12,[2,301,trait]),svt(2,12,[2,300,trait]),svt(3,12,[2,300,trait]),svt(4,16,[2,301,203,trait]),svt(5,16,[2,300,trait]),svt(6,12,[2,300,trait])]
 const card=(id,rate,followerRate=rate,conditions={})=>({id,cost:12,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate,followerRate,...conditions}]}))})
 const ces=[card(101,200,200,{andTvals:[[{id:300},{id:2}]]}),card(102,100),card(103,50,150),card(104,50),card(105,200,200,{tvals:trait===304?[{id:304},{id:203}]:[{id:9000}]})]
 const slots=Array.from({length:6},(_,i)=>({position:i+1,filled:true,isSupport:i===5,isGrand:i===3||i===5,svtId:i<5?i+1:0,
  svtArtKey:'default',bondLv:5,bondCap:10,ceId:i<4?101+i:i===5?105:0,ceMlb:true,ceRewardId:i===3?105:i===5?103:0,ceRewardMlb:true,
  // An old representative's cached traits deliberately disagree with ID 1.
  traitIds:[2,300,trait]}))
 const options={servants,ces,mode:'free',questType:'grand',questClass:'assassin',base:4748,costLimit:116,allowSupport:true}
 const plan=settleParty(slots,options)
 assert.equal(plan.total,49754);assert.equal(plan.costUsed,116)
 assert.deepEqual(plan.output.results.filter(r=>r.eligible).map(r=>r.final),[9969,11109,11109,8309,9258])
 assert.ok(!plan.slots[0].ceLines.some(l=>l.key.startsWith('ce-101-')))
 assert.ok(!plan.slots[3].ceLines.some(l=>l.key.startsWith('ce-101-')))
 const compared=comparePartyRows([{total:50894,slots}],options)
 assert.deepEqual(compared.find(r=>r.label==='总羁绊').values,['49754'],'Comparison always recomputes the physical team')
 const alternatives=interchangeableMembers(slots,1,[{id:6,formKey:'default'}],options)
 assert.equal(alternatives[0].onField,false)
 assert.equal(alternatives[0].sameEffect,false,'A same-cost lawful female is not equivalent to a chaotic female')
 const q=createScoreTeamSearch({...options,grandPosition:4,aiMode:'off',slotPins:slots.filter(s=>!s.isSupport).map(s=>({position:s.position,svtId:s.svtId}))})
 for(const event of q.iterator)if(event.type==='team')q.hydrate(event.record)
 assert.ok(q.state.complete&&q.state.maximumProven);assert.equal(q.state.bestScore,49754)
}
console.log('Conditional 20% CE: lawful AND female, fresh identity traits, exact 1140-point front-row difference, ignored stale totals and complete fixed-party optimum passed')
