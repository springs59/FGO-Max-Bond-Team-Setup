import assert from 'node:assert/strict'
import {createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamController} from './score-team-worker.js'
import {createTeamReport} from '../ui/team-report.js'
import {parseAccount} from '../account.js'
import {importAccountProfile,currentAccountProfile,selectAccountProfile} from '../account-profiles.js'
import {grandCandidatePolicy,markGrandRecommendation} from './grand-policy.js'
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
 const {q,plans}=all(opts);assert.ok(plans.length);assert.equal(q.grandSearchScope.includesRecommendations,true)
 assert.ok(plans.every(p=>p.grandRecommendation.candidates[0].svtId===2))
}
{
 const opts={...base,servants:servants.map(s=>({...s,className:'saber'})),questType:'grand',questClass:'saber',
  account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===1}))},filter:{...emptyRosterFilter(),banSvtIds:[1]},
  slotPins:[{position:1,svtId:2},...[2,3,4,5,6].map(position=>({position,empty:true}))]}
 const {q,plans}=all(opts);assert.equal(plans.length,0);assert.equal(q.grandSearchScope.includesRecommendations,false)
}
{
 const {plans}=all(required);assert.ok(plans.length)
 for(const p of plans){assert.ok(p.grandRecommendation.candidates.some(x=>x.svtId===1));assert.equal(p.slots.find(s=>s.svtId===1).isGrand,true)}
 const report=createTeamReport([plans[0]],{...required,region:'CN'})
 assert.match(report.queryContext.冠位选择条件,/需先选择冠位/)
 assert.equal(report.teams[0].grandRecommendation.requiresSelection,true)
}
// Only the corresponding class designation suppresses proposals.
for(const designated of [[false,true],[true,false],[true,true]]){
 const opts={...required,account:{...account,servants:account.servants.map((s,i)=>({...s,isGrand:designated[i]}))}}
 const {q,plans}=all(opts);assert.equal(q.grandSearchScope.includesRecommendations,designated.some(v=>!v))
 assert.ok(plans.length)
 for(const p of plans){
  for(const c of p.grandRecommendation?.candidates||[])assert.equal(designated[c.svtId-1],false)
  if(!designated[0])assert.ok(p.grandRecommendation.candidates.some(c=>c.svtId===1))
 }
}
{
 const {plans}=all({...required,questType:'grand',questClass:'saber',servants:servants.map(s=>({...s,className:'saber'})),
  account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===2}))}})
 assert.equal(plans.length,0,'An ineligible recorded Grand cannot be replaced with a proposal')
}
// The complete imported inventory controls proposals, not the filtered rows.
{
 const parsed=parseAccount({cache:{replaced:{userSvt:[{id:77,svtId:2,friendshipRank:5}],userSvtCollection:[{svtId:1,status:2},{svtId:2,status:2}],userSvtGrand:[{userSvtId:77,grandGraphId:10002}]}}})
 assert.equal(parsed.ok,true);assert.equal(parsed.servants.find(s=>s.id===2).isGrand,true)
 const data=new Map(),store={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}
 const profile=importAccountProfile(parsed,{store}),empty=importAccountProfile({...account,ok:true},{store})
 selectAccountProfile(profile.id,store)
 const restored=currentAccountProfile('CN',store).account
 for(const rows of [[],[{svt:servants[0]}]])for(const rules of [[],[{values:[107]}]]){
  const policy=grandCandidatePolicy(rows,{mode:'account',account:restored,servants},{enabled:true,required:true,rules})
  assert.deepEqual(policy.grandIds,rows.length?[2,1]:[2]);assert.deepEqual(policy.grandSuggestionIds,rows.length?[1]:[])
 }
 const {q,plans}=all({...required,account:restored})
 assert.equal(q.grandSearchScope.includesRecommendations,true);assert.ok(plans.length)
 const stale={slots:[{filled:true,isGrand:true,svtId:1}],grandRecommendation:{requiresSelection:true}}
 markGrandRecommendation(stale,{mode:'account',account:restored,servants});assert.equal(stale.grandRecommendation.requiresSelection,true)
 selectAccountProfile(empty.id,store)
 assert.ok(all({...required,account:currentAccountProfile('CN',store).account}).q.grandSearchScope.includesRecommendations)
}
// Optional rules keep ordinary parties when the recorded Grand is out of scope.
{
 const {q,plans}=all({...base,servants:servants.map(s=>({...s,className:'saber'})),account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===2}))},quest:{noSupport:true,restrictions:[r('activeGrandBoard',[1])]}})
 assert.ok(plans.length);assert.equal(q.grandSearchScope.includesRecommendations,false)
 assert.ok(plans.every(p=>!p.grandRecommendation&&!p.slots.some(s=>s.isGrand)))
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
// Every class bucket can be missing while other class Grands exist. Query
// filters, traits and positions must never erase its recorded designation.
const classPairs=[...['saber','archer','lancer','rider','caster','assassin','berserker'].map(c=>[c,c]),['ruler','avenger'],['alterEgo','foreigner']]
for(const [candidateClass,recordedClass] of classPairs){
 const catalog=[svt(1,[1,107],candidateClass),svt(2,[2,108],recordedClass),svt(3,[3,109],candidateClass==='saber'?'archer':'saber')]
 for(const recorded of [2,3])for(const extended of [false,true]){
  const opts={...base,servants:catalog,account:{...account,servants:catalog.map(s=>({id:s.id,bondLv:5,bondCap:10,isGrand:s.id===recorded}))},
   questType:extended?'normal':'grand',questClass:extended?'':candidateClass==='ruler'?'extra1':candidateClass==='alterEgo'?'extra2':candidateClass,
   filter:{...emptyRosterFilter(),banSvtIds:[2,3]},
   slotPins:[{position:1,svtId:1},...[2,3,4,5,6].map(position=>({position,empty:true}))],
   quest:extended?{noSupport:true,restrictions:[r('myGrandSvt',[107]),r('activeGrandBoard',[1])]}:{}}
  const {q,plans}=all(opts),missing=recorded===3
  assert.equal(q.grandSearchScope.includesRecommendations,missing)
  assert.equal(plans.length>0,missing)
  for(const p of plans){
   assert.deepEqual(p.grandRecommendation.candidates.map(c=>c.svtId),[1])
   assert.equal(p.slots.find(s=>s.isGrand).position,1)
   assert.equal(createTeamReport([p],opts).teams[0].grandRecommendation.requiresSelection,true)
  }
 }
}
for(const classes of [['ruler','avenger'],['alterEgo','foreigner']]){
 const {plans}=all({...base,servants:servants.map((s,i)=>({...s,className:classes[i]})),quest:{noSupport:true,restrictions:[r('activeGrandBoard',[1,4])]}})
 assert.ok(plans.some(p=>p.grandRecommendation))
 assert.ok(plans.every(p=>p.slots.filter(s=>s.filled&&!s.isSupport&&s.isGrand).length<=1),'Only one selection per Extra Grand bucket')
}
// Stored recommendation metadata survives the actual Worker result/export,
// including an account that already has a different class Grand.
{
 const messages=[],controller=createScoreTeamController({post:m=>messages.push(m),yieldTask:async()=>{}})
 await controller.start(99,{...required,account:{...account,servants:account.servants.map(s=>({...s,isGrand:s.id===2}))}})
 const value=messages.find(m=>m.type==='score-complete').result.value
 assert.equal(value.grandRecommendation.requiresSelection,true)
 assert.equal(value.scoreTeamResults.grandSearchScope.includesRecommendations,true)
 await controller.exportTeams({id:99})
 const message=messages.find(m=>m.type==='score-export'),rows=(await(await fetch(message.url)).text()).trim().split('\n').map(JSON.parse)
 assert.equal(rows[0].grandSearchScope.includesRecommendations,true)
 assert.ok(rows.slice(1).every(row=>row.grandRecommendation?.requiresSelection))
 URL.revokeObjectURL(message.url)
}
console.log(JSON.stringify({passed:true,cases,coverage:'mandatory/optional/disabled Grand, class-specific Grand gate, actual Grand preference, all legal seats, immutable accounts, report and Worker archive conditions'}))
