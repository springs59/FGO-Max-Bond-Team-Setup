import assert from 'node:assert/strict'
import {mkdirSync,writeFileSync} from 'node:fs'
import {dirname} from 'node:path'
import os from 'node:os'
import {createScoreTeamSearch} from '../src/recommend.js'
import {expandScoreTeamFamily} from '../src/solver/score-team-equivalence.js'
import {wideFixture} from './all-score-teams-wide-fixtures.mjs'
const output=process.env.FGO_GROUP_BENCH_OUTPUT||'test-output/grouped-score/benchmark.json',rounds=3
const ce=(id,rate,trait=0)=>({id,name:'CE'+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target:'ptFull',rate,add:0,tvals:trait?[{id:trait}]:[],andTvals:[]}]}))})
const base={servants:Array.from({length:4},(_,i)=>({id:i+1,collectionNo:i+1,name:'S'+i,className:'saber',rarity:3,cost:i%2+1,traitIds:[10+i%2]})),
  ces:[ce(101,100),ce(102,100),ce(103,200,10)],base:815,costLimit:9,allowSupport:true,
  quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},slotPins:[3,5].map(position=>({position,empty:true})),aiMode:'off'}
const fixtures=[{id:'equal-effects',opts:base},{id:'rounding',opts:{...base,base:1}},
  {id:'tight-budget',opts:{...base,costLimit:5}},{id:'prefer',opts:{...base,optimizeBy:'prefer',preferSvtIds:[1]}},
  {id:'zero-small',opts:{...base,base:0,ces:[]}}]
const key=r=>JSON.stringify([r.score,r.packed.cost,r.packed.slots.map(s=>[s.p,s.f,s.s,s.svt,s.art||'default',s.ce,s.ce?s.mlb!==false:true])])
const median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1]
function run(opts,compact){
  const began=performance.now(),q=createScoreTeamSearch({...opts,scoreTeamAudit:{compact}}),records=[];let best=-Infinity,visited=0
  for(const e of q.iterator)if(e.type==='team'){
    visited++;if(e.record.score>best){best=e.record.score;records.length=0}if(e.record.score===best)records.push(e.record)
  }
  const ms=performance.now()-began
  assert.equal(q.state.complete,true)
  return {ms,best,visited,records,q}
}
const report={passed:false,source:'PR 19 plus constrained equivalence search',environment:{node:process.version,cpu:os.cpus()[0].model},rounds,
  method:'Same process, alternating order; one warm-up each; compilation/search and retaining best records timed. Physical expansion and exact settlement outside timing. Different output representation, equal recoverable optimal-team set. Synthetic timings do not predict full-catalog proof time.',cases:[]}
for(const {id,opts} of fixtures){
  const physical=run(opts,false),grouped=run(opts,true)
  const expected=new Set(physical.records.map(key)),actual=new Set()
  for(const r of grouped.records)for(const variant of expandScoreTeamFamily(r,grouped.q.equivalenceCatalogs[r.domain])){
    grouped.q.hydrate(variant);const k=key(variant);assert.ok(!actual.has(k),id+' duplicate');actual.add(k)
  }
  assert.deepEqual(actual,expected,id+' complete recoverable optimum set')
  const samples=[]
  for(let round=0;round<rounds;round++)for(const compact of round%2?[true,false]:[false,true]){
    const r=run(opts,compact);samples.push({round,compact,ms:r.ms,best:r.best,bestRecords:r.records.length,visited:r.visited,stats:r.q.state.stats})
  }
  const row={id,physicalTeams:expected.size,groups:grouped.records.length,physicalMs:median(samples.filter(r=>!r.compact).map(r=>r.ms)),groupedMs:median(samples.filter(r=>r.compact).map(r=>r.ms)),samples}
  row.ratio=row.groupedMs/row.physicalMs;report.cases.push(row);console.log(JSON.stringify({...row,samples:undefined}))
}
const dense=[]
for(let i=-1;i<rounds;i++){const r=run({...wideFixture('dense-zero').opts,aiMode:'off'},true);if(i>=0)dense.push({ms:r.ms,best:r.best,groups:r.records.length,stats:r.q.state.stats})}
report.denseZero={id:'dense-zero',identities:20,complete:true,groupedMedianMs:median(dense.map(r=>r.ms)),samples:dense,
  note:'Same 20-identity synthetic fixture as the prior three-hour run. No physical expansion in this test; completeness of factorization is checked independently on small domains.'}
report.passed=true;mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,denseZero:report.denseZero,output}))
