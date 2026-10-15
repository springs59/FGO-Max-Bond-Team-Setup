import assert from 'node:assert/strict'
import { settleParty, interchangeableMembers, replacePartyMember } from './party-state.js'
import { groupBondPlans, comparePartyRows, renderPlanGroups } from './ui/team-comparison.js'
import { renderLibraryCurve } from './ui/library-curve.js'

const servants=[1,2,3,4].map(id=>({id,name:'S'+id,className:'saber',attribute:'man',rarity:1,cost:3,traitIds:[1],
  forms:id===2?[{key:'c10',cost:9,traitIds:[2],attribute:'sky',rarity:4}]:[]}))
const slots=Array.from({length:6},(_,i)=>({position:i+1,filled:i===0||i===3||i===5,isSupport:i===5,
  svtId:i===0?1:i===3?3:0,svtArtKey:'default',bondLv:1,bondCap:10,ceId:0,ceMlb:true}))
const bondBonuses={extraPassives:[1,4].map(servantId=>({servantId,skillId:servantId,eventId:1,
  target:'ptFull',rate:.5,startedAt:1,endedAt:2145888000})),events:[],questFriendships:[]}
const options={servants,ces:[],mode:'free',base:1000,quest:{id:1,eventId:1},bondBonuses}
const original=settleParty(slots,options)
assert.equal(original.total,3300)
const replacement=replacePartyMember(slots,1,servants[1],'default',options)
assert.equal(replacement.total,2200,'removing the provider must change every recipient immediately')
const alternatives=interchangeableMembers(slots,1,[{id:2,formKey:'default'},{id:3,formKey:'a1'},{id:4,formKey:'default'}],options)
assert.equal(alternatives.find(e=>e.id===2).sameEffect,false,'same cost and own CE hits do not imply equal provided buffs')
assert.equal(alternatives.find(e=>e.id===4).sameEffect,true)
assert.equal(alternatives.find(e=>e.id===3).onField,true,'different portraits cannot bypass identity occupancy')
const moved=slots.map(s=>s.position===4?{...s,filled:false}:s)
assert.equal(interchangeableMembers(moved,1,[{id:3,formKey:'a1'}],options)[0].onField,false)
const form=replacePartyMember(slots,1,servants[1],'c10',options)
assert.deepEqual(form.slots[0].traitIds.includes(2),true)
assert.equal(form.costUsed,12)
const rows=comparePartyRows([{slots},{slots:replacement.slots}],options)
assert.equal(rows.find(r=>r.label==='总羁绊').different,true)
assert.deepEqual(rows.find(r=>r.label==='前排 1 · 对其他队员贡献').values,['+500','+0'])
assert.deepEqual(groupBondPlans([{total:100},{total:90},{total:100}]),[{total:100,indices:[0,2]},{total:90,indices:[1]}])
assert.match(renderPlanGroups({plans:[{total:100,costUsed:1},{total:100,costUsed:2}],chosen:1},()=>''),/100 羁绊 · 2 队/)
const graph=renderLibraryCurve({points:[{cost:1,total:120},{cost:3,total:150}],hasGap:true})
assert.equal((graph.match(/<polyline/g)||[]).length,0,'missing cost points must not be interpolated')
console.log('Party edits: live aura settlement, identity occupancy, form costs, comparison differences and curve gaps passed')
