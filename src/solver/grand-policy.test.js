import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamController} from './score-team-worker.js'
import {createTeamReport} from '../ui/team-report.js'
import {emptyRosterFilter} from '../filter.js'
const svt=(id,traits=[id],className='saber')=>({id,collectionNo:id,name:'S'+id,className,rarity:3,cost:1,traitIds:traits})
const servants=[svt(1,[1,107]),svt(2,[2,108],'archer')]
const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,isGrand:false})),ces:[]}
const base={servants,ces:[],account,mode:'account',base:100,costLimit:2,allowSupport:false,aiMode:'off',slotPins:[{position:1,svtId:1},{position:4,svtId:2},...[2,3,5,6].map(position=>({position,empty:true}))]}
const r=(type,targetVals,rangeType='equal')=>({type,targetVals,rangeType})
let cases=0
function all(opts){
 const before=JSON.stringify(opts),q=createScoreTeamSearch({...opts,retainAllSettled:true}),plans=[]
 assert.ok(q.ok,q.error)
 for(const e of q.iterator)if(e.type==='settled')plans.push(q.hydrate(e.record))
 assert.equal(JSON.stringify(opts),before,'No account or pin mutation')
 assert.equal(q.state.complete,true);cases++
 return {q,plans}
}
for(const extended of [false,true]){
 const opts={...base,questType:'grand',questClass:'saber',slotPins:[{position:1,svtId:1},...[2,3,4,5,6].map(position=>({position,empty:true}))],quest:extended?{restrictions:[r('mySvtNum',[1],'above')]}:{}}
 const {q,plans}=all(opts);assert.ok(plans.length)
 assert.equal(q.grandSearchScope.includesRecommendations,true)
 for(const p of plans){assert.equal(p.grandRecommendation.requiresSelection,true);assert.equal(p.grandRecommendation.candidates[0].svtId,1)}
}
const required={...base,quest:{noSupport:true,restrictions:[r('myGrandSvt',[107]),r('activeGrandBoard',[1,4])]}}
{
 const opts={...base,account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===1}))},
  quest:{noSupport:true,restrictions:[r('myGrandSvt',[107,108]),r('activeGrandBoard',[4])]}}
 const {plans}=all(opts);assert.ok(plans.length);assert.ok(plans.every(p=>p.grandRecommendation?.candidates[0].svtId===2),'A Grand pinned outside all active positions is not an available Grand for this phase')
}
{
 const opts={...base,servants:servants.map(s=>({...s,className:'saber'})),questType:'grand',questClass:'saber',
  account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===1}))},filter:{...emptyRosterFilter(),banSvtIds:[1]},
  slotPins:[{position:1,svtId:2},...[2,3,4,5,6].map(position=>({position,empty:true}))]}
 const {plans}=all(opts);assert.ok(plans.length);assert.ok(plans.every(p=>p.grandRecommendation?.candidates[0].svtId===2))
}
{
 const {plans}=all(required);assert.ok(plans.length)
 for(const p of plans){assert.deepEqual(p.grandRecommendation.candidates.map(x=>x.svtId),[1]);assert.equal(p.slots.find(s=>s.svtId===1).isGrand,true)}
 const report=createTeamReport([plans[0]],{...required,region:'CN'})
 assert.match(report.queryContext.冠位选择条件,/需先选择冠位/)
 assert.equal(report.teams[0].grandRecommendation.requiresSelection,true)
}
// An existing Grand outside the required trait scope must not suppress the
// missing eligible Grand recommendation. Existing eligible ones remain used.
for(const designated of [[false,true],[true,false],[true,true]]){
 const opts={...required,account:{...account,servants:account.servants.map((s,i)=>({...s,isGrand:designated[i]}))}}
 const {plans}=all(opts);assert.ok(plans.length)
 for(const p of plans)assert.equal(!!p.grandRecommendation,!designated[0])
}
{
 const {plans}=all({...required,questType:'grand',questClass:'saber',servants:servants.map(s=>({...s,className:'saber'})),
  account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===2}))}})
 assert.ok(plans.length);assert.ok(plans.every(p=>p.grandRecommendation?.candidates[0].svtId===1),'An ineligible pinned existing Grand must not force the upgrade suggestion into its seat')
}
// Optional active Grand rules compare ordinary and conditional Grand parties.
{
 const {plans}=all({...base,quest:{noSupport:true,restrictions:[r('activeGrandBoard',[1,4])]}})
 const roles=new Set(plans.map(p=>p.slots.filter(s=>s.isGrand).map(s=>s.svtId).join(',')))
 assert.ok(roles.has(''));assert.ok(roles.has('1'));assert.ok(roles.has('2'));assert.ok(roles.has('1,2'))
 for(const p of plans)assert.equal(!!p.grandRecommendation,p.slots.some(s=>s.filled&&!s.isSupport&&s.isGrand))
}
{
 const {plans}=all({...base,quest:{noSupport:true,restrictions:[r('mySvtNum',[1],'above')]}})
 assert.ok(plans.length);assert.ok(plans.every(p=>!p.grandRecommendation&&!p.slots.some(s=>s.isGrand)))
}
// Position/trait/stock conflicts still cannot be repaired by invented members.
for(const quest of [
 {noSupport:true,restrictions:[r('myGrandSvt',[999])]},
 {noSupport:true,restrictions:[r('myGrandSvt',[107]),r('activeGrandBoard',[4])]},
])assert.equal(all({...base,quest}).plans.length,0)
// Stored recommendation metadata survives the actual Worker result/export.
{
 const messages=[],controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{}})
 await controller.start(99,required)
 const value=messages.find(m=>m.type==='score-complete').result.value
 assert.equal(value.grandRecommendation.requiresSelection,true)
 assert.equal(value.scoreTeamResults.grandSearchScope.includesRecommendations,true)
 await controller.exportTeams({id:99})
 const message=messages.find(m=>m.type==='score-export'),rows=(await(await fetch(message.url)).text()).trim().split('\n').map(JSON.parse)
 assert.equal(rows[0].grandSearchScope.includesRecommendations,true)
 assert.ok(rows.slice(1).every(row=>row.grandRecommendation?.requiresSelection))
 URL.revokeObjectURL(message.url)
}
console.log(JSON.stringify({passed:true,cases,coverage:'mandatory/optional/disabled Grand, trait-specific fallback, actual Grand preference, all legal seats, immutable accounts, report and Worker archive conditions'}))
