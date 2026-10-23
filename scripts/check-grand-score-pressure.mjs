import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname} from 'node:path'
import {createScoreTeamSearch,servantBondForms} from '../src/recommend.js'
import {isPlayableServant,ceHasBondGain} from '../src/game-data.js'
import {SEARCH_MODEL} from '../src/solver/ai-model.js'
import {selectQueryModel} from '../src/solver/query-models.js'
const data=JSON.parse(readFileSync('src/data/servants.json')),ces=JSON.parse(readFileSync('src/data/ces.json'))
const ownedCes=ces.filter(ceHasBondGain).slice(0,4),records=[]
const classes=['saber','archer','lancer','rider','caster','assassin','berserker']
for(const questClass of classes){
 const servants=data.filter(s=>isPlayableServant(s)&&s.className===questClass),grand=servants.at(-1).id
 const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,maxAscension:4,isGrand:s.id===grand,
  unlockedCostumes:servantBondForms(s).filter(f=>f.key.startsWith('c')).map(f=>Number(f.key.slice(1)))})),ces:ownedCes.map(c=>({id:c.id,count:2,mlbCount:1}))}
 const variants=[{id:'automatic',grandPosition:0,allowSupport:true},{id:'grand-1',grandPosition:1,allowSupport:true},
  {id:'grand-3',grandPosition:3,allowSupport:true},{id:'own-grand-4',grandPosition:4,allowSupport:false},
  {id:'locked-front-2',grandPosition:2,allowSupport:true,frontIds:[0,grand,0]},
  {id:'normal-and-reward-pins',grandPosition:1,allowSupport:true,slotPins:[{position:1,svtId:grand,ceId:ownedCes[0].id,ceRewardId:ownedCes[1].id}]},
  {id:'friend-normal-and-reward-pins',grandPosition:1,allowSupport:true,slotPins:[{position:6,ceId:ownedCes[0].id,ceRewardId:ownedCes[1].id}]}]
 for(const v of variants)for(const model of ['off','baseline','teacher','neural-large']){
  const began=performance.now(),q=createScoreTeamSearch({servants,ces,account,mode:'account',region:'CN',base:4748,costLimit:116,
   questType:'grand',questClass,aiMode:model==='off'?'off':'on',aiModel:selectQueryModel(SEARCH_MODEL,model),...v,skipResultCache:true})
  assert.ok(q.ok,q.error);let plan=null,checkpoint=false
  for(const e of q.iterator){
   assert.ok(q.state.stats.nodes<=4096&&performance.now()-began<5000,questClass+'/'+v.id+'/'+model+' did not reach a legal team promptly')
   if(e.type==='best'||e.type==='team'){plan=q.hydrate(e.record);checkpoint=e.checkpoint===true;break}
  }
  assert.ok(plan?.ok);assert.ok(plan.costUsed<=116)
  const ownGrand=plan.slots.find(s=>s.isGrand&&!s.isSupport)
  assert.equal(ownGrand.svtId,grand)
  if(v.grandPosition)assert.equal(ownGrand.position,v.grandPosition)
  if(v.allowSupport)assert.notEqual(plan.slots.find(s=>s.isSupport).position,ownGrand.position)
  if(v.slotPins){const target=plan.slots.find(s=>s.position===v.slotPins[0].position);assert.equal(target.ceId,v.slotPins[0].ceId);assert.equal(target.ceRewardId,v.slotPins[0].ceRewardId)}
  records.push({questClass,variant:v.id,model,identities:servants.length,ms:performance.now()-began,nodes:q.state.stats.nodes,
   evaluated:q.state.stats.evaluated,constraintPruned:q.state.stats.constraintPruned,checkpoint,total:plan.total,cost:plan.costUsed,complete:q.state.complete})
 }
 console.log(JSON.stringify({questClass,passed:true,cells:variants.length*4,maxFirstTeamMs:Math.max(...records.filter(r=>r.questClass===questClass).map(r=>r.ms))}))
}
const output=process.env.FGO_GRAND_OUTPUT||'test-output/grand-pressure/report.json';mkdirSync(dirname(output),{recursive:true})
writeFileSync(output,JSON.stringify({passed:true,scope:'First legal team only, not global optimality or complete enumeration; public CN class rosters, B=4748, COST116; no private account.',records},null,2)+'\n')
console.log(JSON.stringify({passed:true,cells:records.length,maxNodes:Math.max(...records.map(r=>r.nodes)),maxFirstTeamMs:Math.max(...records.map(r=>r.ms)),output}))
