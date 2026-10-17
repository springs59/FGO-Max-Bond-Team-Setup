import assert from 'node:assert/strict'
import { copyComparisonTeam, editComparisonSlot, swapComparisonSlots, comparisonIssues, renderComparisonEditor } from './comparison-workspace.js'
import { settleParty } from '../party-state.js'
import { plannerFromState, applyPlanner } from '../user-data.js'
import { renderPlanGroups } from './team-comparison.js'

const servants=[1,2,3].map(id=>({id,name:'S'+id,cost:id,rarity:1,className:'saber',traitIds:[id],forms:id===1?[{key:'c10',name:'特殊灵基',cost:7,traitIds:[3]}]:[]}))
const ces=[{id:101,name:'全体加成',cost:2,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate:condLimitCount?200:100,add:0,eventId:0,tvals:[],andTvals:[]}]}))}]
const options={servants,ces,mode:'free',base:1000,costLimit:10,quest:{},questType:'normal'}
let team=copyComparisonTeam({slots:[{position:1,filled:true,svtId:1,bondLv:1,bondCap:10,ceId:101,ceMlb:true}]},'<我的队伍>')
assert.deepEqual(comparisonIssues(team,options),[])
const copy=copyComparisonTeam(team,'副本')
assert.notEqual(copy.slots,team.slots)
const moved=swapComparisonSlots(copy,1,4)
assert.equal(moved.slots[3].svtId,1)
assert.equal(team.slots[0].svtId,1)
assert.ok(settleParty(moved.slots,options).total<settleParty(team.slots,options).total,'front/back relocation updates live settlement')
assert.match(comparisonIssues(editComparisonSlot(team,2,{svtId:1,filled:true}),options).join(),/重复上场/)
assert.match(comparisonIssues(editComparisonSlot(team,1,{svtArtKey:'c10'}),{...options,costLimit:1}).join(),/超过上限/)
const support=editComparisonSlot(editComparisonSlot(team,6,{isSupport:true,filled:true}),3,{isSupport:true,filled:true})
assert.equal(support.slots.filter(s=>s.isSupport).length,1)
assert.match(comparisonIssues(support,{...options,quest:{noSupport:true}}).join(),/不允许助战/)
assert.match(comparisonIssues(team,{...options,quest:{restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[6]}]}}).join(),/人数不足/)
assert.match(comparisonIssues(team,{...options,slotPins:[{position:1,empty:true}]}).join(),/锁定为空/)
assert.match(comparisonIssues(team,{...options,requiredIds:[3]}).join(),/缺少锁定从者/)
const account={servants:[{id:1,bondLv:15,bondCap:16}],ces:[{id:101,count:1,mlbCount:0}]}
assert.match(comparisonIssues(team,{...options,mode:'account',account}).join(),/满破数量/)
assert.match(comparisonIssues(editComparisonSlot(team,1,{ceMlb:false}),{...options,mode:'account',account:{...account,ces:[{id:101,count:1,mlbCount:1}]}}).join(),/满破数量/,'a full-limit copy cannot masquerade as a separate non-MLB copy')
assert.equal(settleParty(team.slots,{...options,mode:'account',account}).slots[0].bondLv,15,'account bond level is authoritative')
assert.match(comparisonIssues(editComparisonSlot(team,1,{svtArtKey:'c10'}),{...options,mode:'account',account}).join(),/尚未解锁/)
assert.match(comparisonIssues(editComparisonSlot(team,1,{svtId:3}),{...options,mode:'account',account}).join(),/未持有/)
assert.doesNotMatch(renderComparisonEditor(team,0,options),/<我的队伍>/,'names must be HTML escaped')
const state={region:'CN',comparisonTeams:[team]},planner=plannerFromState(state),restored=applyPlanner({},planner)
assert.deepEqual(restored.comparisonTeams,state.comparisonTeams)
restored.comparisonTeams[0].slots[0].ceId=0
assert.equal(team.slots[0].ceId,101,'saved/restored copies do not alias')
const oversized={...team,allPlans:Array(10000).fill({}),slots:team.slots.map(s=>({...s,altSvtIds:Array(10000).fill(1)}))}
assert.ok(JSON.stringify(plannerFromState({...state,comparisonTeams:[oversized]})).length<5000,'only six physical slots are persisted')
assert.match(renderPlanGroups({plans:[{total:100,costUsed:1}],chosen:0},()=>''),/data-compare-plan="0"/)
const npc={svtId:900,name:'系统从者',equips:[{ceId:101,ceMlb:true}],traitIds:[8]}
const npcTeam=copyComparisonTeam({slots:[...team.slots.filter(s=>s.position!==6),{position:6,filled:true,isSupport:true,supportKind:'system',svtId:900,ceId:101,ceMlb:true,traitIds:[8]}]})
assert.deepEqual(npcTeam.slots[5].traitIds,[8])
const npcOptions={...options,quest:{supportPolicy:'system',supportServants:[npc]}}
assert.deepEqual(comparisonIssues(npcTeam,npcOptions),[])
assert.match(comparisonIssues(editComparisonSlot(npcTeam,6,{ceId:0}),npcOptions).join(),/系统助战/)
assert.doesNotThrow(()=>applyPlanner({},{comparisonTeams:[null,{slots:[]},{slots:[{position:6,isSupport:true,supportKind:'system',traitIds:'broken'}]}]}))
console.log('Comparison workspace: isolated copies/edits, exact settlement, identity/quest/COST/MLB/form/NPC validation, safe rendering and compact persistence passed')
