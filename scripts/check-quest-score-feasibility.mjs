import assert from 'node:assert/strict'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {dirname} from 'node:path'
import {createScoreTeamSearch,servantBondForms} from '../src/recommend.js'
import {questPartyRules} from '../src/quest-party-rules.js'
import {isPlayableServant,ceHasBondGain} from '../src/game-data.js'
import {SEARCH_MODEL} from '../src/solver/ai-model.js'
import {selectQueryModel} from '../src/solver/query-models.js'
const read=name=>JSON.parse(readFileSync('src/data/'+name+'.json'))
const servants=read('servants').filter(isPlayableServant),ces=read('ces'),cards=ces.filter(ceHasBondGain).slice(0,4)
const locked=servants.at(-1).id,second=servants.at(-2).id
const account={region:'CN',servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,limitCount:4,maxAscension:4,
 unlockedCostumes:servantBondForms(s).filter(f=>f.key.startsWith('c')).map(f=>Number(f.key.slice(1)))})),ces:cards.map(c=>({id:c.id,count:2,mlbCount:1}))}
const restriction=(type,n=6)=>({type,rangeType:'equal',targetVals:[n]})
const fixed=n=>restriction('fixedSupportPosition',n)
const npc={id:9,svtId:700100,name:'NPC',required:true,releaseConditions:[],equips:[]}
const eventBonus=target=>({extraPassives:[{type:'extraPassive',servantId:locked,skillId:1,name:'Audit event',eventId:999999,
 rate:0.5,add:0,target,startedAt:1,endedAt:4102444800,condQuestId:0,condQuestPhase:0,applySupportSvt:1}],questFriendships:[]})
const kinds=[
 ['ordinary',{}],['event-self',{quest:{eventId:999999},bondBonuses:eventBonus('self')}],
 ['event-party',{quest:{eventId:999999},bondBonuses:eventBonus('ptFull')}],
 ['campaign',{bondBonuses:{extraPassives:[],questFriendships:[{eventId:0,allQuests:true,targetIds:[locked],rate:0.2,startedAt:1,endedAt:4102444800}]}}],
 ['no-support',{quest:{flags:['eventDeckNoSupport']}}],
 ['fixed-friend-front',{quest:{restrictions:[fixed(1)]}}],
 ['fixed-friend-back',{quest:{restrictions:[fixed(6)]}}],
 ['npc-empty-ce',{quest:{flags:['noSupportList'],supportServants:[npc],restrictions:[fixed(1)]}}],
 ['npc-fixed-ce',{quest:{flags:['noSupportList'],supportServants:[{...npc,equips:[{ceId:cards[0].id,ceMlb:false,ce:cards[0]}]}],restrictions:[fixed(6)]}}],
 ['six-own',{quest:{restrictions:[restriction('mySvtNum')]}}],
 ['six-total',{quest:{restrictions:[restriction('svtNum')]}}],
 ['npc-six-total',{quest:{flags:['noSupportList'],supportServants:[npc],restrictions:[fixed(1),restriction('svtNum')]}}],
]
const variants=[
 ['default',{},true],['required-members',{lockSvtIds:[locked,second]},true],
 ['bound-ce',{pinCes:[{svtId:locked,ceId:cards[0].id}]},true],
 ['unbound-two-ces',{pinCes:[{ceId:cards[0].id},{ceId:cards[1].id}]},true],
 ['shared-two-copies',{pinCes:[{svtId:locked,ceId:cards[0].id},{svtId:second,ceId:cards[0].id}]},true],
 ['missing-stock',{pinCes:[{svtId:locked,ceId:cards[0].id}],account:{...account,ces:[]}},false],
 ['shared-one-copy',{pinCes:[{svtId:locked,ceId:cards[0].id},{svtId:second,ceId:cards[0].id}],account:{...account,ces:[{id:cards[0].id,count:1,mlbCount:1}]}},false],
 ['required-over-cost',{pinCes:[{svtId:locked,ceId:cards[0].id}],costLimit:0},false],
]
const records=[]
for(const [kind,extra] of kinds){
 for(const [variant,change,feasible] of variants)for(const model of ['off','baseline','teacher','neural-large']){
  const opts={servants,ces,account,mode:'account',region:'CN',base:4748,costLimit:116,allowSupport:true,...extra,...change,
   aiMode:model==='off'?'off':'on',aiModel:selectQueryModel(SEARCH_MODEL,model)}
  const began=performance.now(),q=createScoreTeamSearch(opts);assert.ok(q.ok,kind+'/'+variant+': '+q.error)
  let plan=q.initial
  if(!plan)for(const e of q.iterator){
   assert.ok(q.state.stats.nodes<4096&&performance.now()-began<5000,kind+'/'+variant+'/'+model+' stalled before first legal team or infeasibility')
   if(e.type==='best'||e.type==='team'){plan=q.hydrate(e.record);break}
  }
  assert.equal(Boolean(plan?.ok),feasible,kind+'/'+variant+'/'+model)
  if(feasible){
   assert.ok(plan.costUsed<=(opts.costLimit??116))
   for(const pin of opts.pinCes||[])assert.ok(plan.slots.some(s=>!s.isSupport&&s.ceId===pin.ceId&&(!pin.svtId||s.svtId===pin.svtId)))
   if(kind==='six-own')assert.equal(plan.slots.filter(s=>s.filled&&!s.isSupport).length,6)
   if(kind.endsWith('six-total')||kind==='six-total')assert.equal(plan.slots.filter(s=>s.filled).length,6)
   if(kind==='no-support')assert.ok(!plan.slots.some(s=>s.isSupport))
   if(kind.startsWith('npc'))assert.equal(plan.slots.find(s=>s.isSupport)?.svtId,npc.svtId)
  }else{assert.equal(q.state.complete,true);assert.equal(q.state.maximumProven,false);assert.ok(q.state.stats.nodes<64)}
  records.push({kind,variant,model,feasible,ms:performance.now()-began,...q.state.stats,complete:q.state.complete})
 }
 console.log(JSON.stringify({kind,passed:true,cells:variants.length*4}))
}
// Scan both checked-in quest catalogs. Metadata that the current rule parser
// cannot model must be rejected before search, rather than silently searched.
const catalogs=[]
for(const name of ['quests','jp-extra-quests']){
 const quests=read(name),unsupported={};let supported=0,rejected=0
 for(const quest of quests){
  const rules=questPartyRules(quest)
  if(rules.supported){supported++;continue}
  for(const reason of rules.unsupported)unsupported[reason]=(unsupported[reason]||0)+1
  const q=createScoreTeamSearch({servants:[servants[0]],ces:[],base:quest.bond||100,quest,aiMode:'off'})
  assert.equal(q.ok,false,`${name}/${quest.id}/${quest.phase} unsupported metadata entered search`);assert.equal(q.state.stats.nodes,0);rejected++
 }
 catalogs.push({name,total:quests.length,parserSupported:supported,rejectedBeforeSearch:rejected,unsupported})
}
const output=process.env.FGO_QUEST_FEASIBILITY_OUTPUT||'test-output/quest-feasibility/report.json';mkdirSync(dirname(output),{recursive:true})
const report={passed:true,scope:'First legal team or immediate infeasibility, not optimum/completeness timing; public CN roster, synthetic quest-rule combinations; metadata census covers checked-in CN/JP catalogs.',identities:servants.length,cells:records.length,maxNodes:Math.max(...records.map(r=>r.nodes)),maxMs:Math.max(...records.map(r=>r.ms)),catalogs,records}
writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({...report,records:undefined,output}))
