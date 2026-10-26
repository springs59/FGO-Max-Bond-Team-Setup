import assert from 'node:assert/strict'
import {createReuseEvaluator,createScoreTeamSearch,recommendTeam} from '../recommend.js'
import {physicalVariantKey} from './score-team-diversity.js'

const servants=[1,2].map(id=>({id,collectionNo:id,name:'S'+id,className:'saber',cost:1,rarity:3,traitIds:[id]}))
const ces=[101,102].map(id=>({id,cost:1,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate:100}]}))}))
const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,isGrand:true})),ces:ces.map(c=>({id:c.id,count:1,mlbCount:1}))}
const base={servants,ces,account,mode:'account',base:100,costLimit:4,questType:'grand',questClass:'saber',allowSupport:false,aiMode:'off',
 slotPins:[{position:1,svtId:1},{position:4,svtId:2},...[2,3,5,6].map(position=>({position,empty:true}))]}
let checked=0
for(const questType of ['grand','normal']){
 const opts={...base,questType},q=createScoreTeamSearch(opts),plans=[]
 for(const event of q.iterator)if(event.type==='team')plans.push(q.hydrate(event.record))
 assert.ok(plans.length)
 const evaluate=createReuseEvaluator(opts),actual=evaluate(plans)
 assert.deepEqual(new Set(actual.map(physicalVariantKey)),new Set(plans.map(physicalVariantKey)))
 for(const p of actual)assert.ok(plans.some(s=>physicalVariantKey(s)===physicalVariantKey(p)&&s.total===p.total))
 const bad=mutate=>{const plan=structuredClone({...plans[0],total:999999,slots:plans[0].slots.map(s=>({...s}))});mutate(plan);assert.equal(evaluate([plan]).length,0);checked++}
 bad(p=>p.slots[0].svtId=999)
 bad(p=>p.slots[3].svtId=p.slots[0].svtId)
 bad(p=>p.slots[0].svtArtKey='unavailable-form')
 bad(p=>{p.slots[0].ceId=101;p.slots[3].ceId=101;p.slots[0].ceMlb=p.slots[3].ceMlb=true})
 bad(p=>{p.slots[0].ceId=101;p.slots[0].ceMlb=false})
 assert.equal(createReuseEvaluator({...opts,costLimit:0})(plans).length,0)
 assert.equal(createReuseEvaluator({...opts,account:{...account,servants:[]}})(plans).length,0)
 assert.equal(createReuseEvaluator({...opts,grandPosition:2})(questType==='grand'?plans:[]).length,0)
 const reused=recommendTeam({...opts,reuseOnly:true,reusePlans:plans.map(p=>({...p,total:999999}))})
 assert.equal(reused.ok,true);assert.equal(reused.resultStatus.optimality,'candidate')
 assert.equal(reused.queryStats.search.nodes,0);assert.equal(reused.total,q.state.bestScore)
 checked+=plans.length+4
}
console.log(JSON.stringify({passed:true,checked,coverage:'literal Grand/ordinary archives, fresh settlement, ownership, identity uniqueness, forms, stock/MLB, COST, explicit Grand placement and no roster search'}))
