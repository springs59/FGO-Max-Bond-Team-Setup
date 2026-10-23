import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createScoreTeamSearch,servantBondForms} from '../src/recommend.js'
import {questPartyRules} from '../src/quest-party-rules.js'
import {needsExtendedPartyRules,QUEST_RESTRICTION_TYPES} from '../src/quest-party-constraints.js'
import {isPlayableServant} from '../src/game-data.js'
const read=n=>JSON.parse(fs.readFileSync('src/data/'+n+'.json'))
const servants=[...new Map([...read('servants'),...read('jp-extra-servants')].map(s=>[s.id,s])).values()].filter(isPlayableServant)
const catalogs=[['CN',read('quests')],['JP',read('jp-extra-quests')]],records=[],rules={},errors={}
for(const [region,quests] of catalogs){
 const account={region,servants:servants.map(s=>({id:s.id,bondLv:5,bondCap:10,maxAscension:4,isGrand:true,unlockedCostumes:servantBondForms(s).filter(f=>f.key.startsWith('c')).map(f=>Number(f.key.slice(1)))})),ces:[],questClears:[]}
 for(const q of quests)for(const s of q.supportServants||[])for(const c of s.releaseConditions||[])if(c.type==='questClear')account.questClears.push({id:c.targetId,clearNum:99})
 for(const quest of quests){
  const parsed=questPartyRules(quest)
  for(const row of quest.restrictions||[]){const r=row.restriction||row;rules[r.type]=(rules[r.type]||0)+1}
  assert.ok(parsed.supported,`${region}/${quest.id}: ${parsed.unsupported}`)
  if(!needsExtendedPartyRules(quest))continue
  const began=performance.now(),q=createScoreTeamSearch({servants,ces:[],base:quest.bond||100,costLimit:116,quest:{...quest,region},mode:'account',account,region,aiMode:'off'})
  let status=q.ok?'empty':'metadata-blocked',plan=null
  if(q.ok)for(const e of q.iterator){
   if(e.type==='team'||e.type==='best'){plan=q.hydrate(e.record);status='legal-first-team';break}
   if(q.state.stats.nodes>2048||performance.now()-began>1000){status='probe-limit';break}
  }
  if(q.ok&&q.state.complete&&!plan)status='infeasible-for-fixture'
  if(status==='metadata-blocked')errors[q.error]=(errors[q.error]||0)+1
  if(records.length%50===0)console.log(JSON.stringify({progress:records.length,region,id:quest.id,status,nodes:q.state.stats.nodes}));
  records.push({region,id:quest.id,phase:quest.phase,status,error:q.error,nodes:q.state.stats.nodes,evaluated:q.state.stats.evaluated,ms:performance.now()-began,external:plan?.slots.filter(s=>s.isSupport).length})
 }
 console.log(JSON.stringify({region,records:records.filter(r=>r.region===region).length}))
}
const statuses={};for(const r of records)statuses[r.status]=(statuses[r.status]||0)+1
assert.equal(statuses['probe-limit']||0,0,'A catalog case failed to reach a witness or a bounded conclusion')
for(const error of Object.keys(errors))assert.match(error,/位置元数据存在冲突/,'Unexpected unresolved metadata must be examined')
const report={registeredTypes:QUEST_RESTRICTION_TYPES,catalogRecords:catalogs.reduce((n,[,qs])=>n+qs.length,0),catalogRuleTypes:rules,extendedRecords:records.length,statuses,errors,records,
 scope:'Existing CN/JP phase metadata; one synthetic all-owned roster, no owned CEs, prerequisite quest clears supplied, COST116. Bounded first-witness probe, not complete optimality or reproduction of a private account.'}
fs.mkdirSync('test-output/extended-quest-rules',{recursive:true});fs.writeFileSync('test-output/extended-quest-rules/report.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({...report,records:undefined}))
