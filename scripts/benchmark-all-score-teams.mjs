import {createScoreTeamSearch} from '../src/recommend.js'
import assert from 'node:assert/strict'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {mkdirSync,writeFileSync} from 'node:fs'
import {dirname} from 'node:path'
const ce=(id,cost,rate,trait=0,flat=0)=>({id,cost,name:'Synthetic CE '+id,skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target:'ptFull',rate:mlb?rate:Math.floor(rate/2),add:flat,tvals:trait?[{id:trait}]:[],andTvals:[]}]}))})
const roster=n=>Array.from({length:n},(_,i)=>({id:100+i,collectionNo:100+i,name:'Synthetic '+i,className:'saber',rarity:3,cost:i%4+1,traitIds:[10+i%2]}))
const fixtures=[
 {id:'conditional',n:3,base:815,budget:12,ces:[ce(101,1,100),ce(102,2,300,10)]},
 {id:'tight-budget',n:4,base:815,budget:6,ces:[ce(101,1,100),ce(102,2,200,11),ce(103,2,0,0,50)]},
 {id:'rounding-ties',n:3,base:1,budget:9,ces:[ce(101,1,10),ce(102,2,20)]},
 {id:'identity-stress',n:7,base:815,budget:12,ces:[ce(101,1,100),ce(102,2,300,10)]},
 {id:'all-zero-ties',n:4,base:0,budget:12,ces:[]},
]
const rounds=Number(process.env.FGO_SCORE_ROUNDS||3),output=process.env.FGO_SCORE_OUTPUT||'docs/test-results/2026-10-21-all-score-teams/benchmark.json'
assert.ok(Number.isInteger(rounds)&&rounds>0)
const report={schema:1,passed:false,scope:'Same-machine synthetic all-score enumeration. Reference uses the identical physical domain with score bounds disabled, not the old representative-only solver.',
 environment:{node:process.version,cpu:os.cpus()[0].model,availableParallelism:os.availableParallelism(),platform:process.platform,arch:process.arch},rounds,cases:[]}
const median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1]
for(const fixture of fixtures){
 const opts={servants:roster(fixture.n),ces:fixture.ces,base:fixture.base,costLimit:fixture.budget,allowSupport:true,
  quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},slotPins:[3,5].map(position=>({position,empty:true})),aiMode:'on'}
 const runs=[]
 for(let round=-1;round<rounds;round++)for(const mode of round%2?['reference','optimized']:['optimized','reference']){
  const began=performance.now(),q=createScoreTeamSearch({...opts,scoreTeamAudit:{bounds:mode==='optimized',compact:false}})
  let best=-Infinity,teams=new Set(),visited=0
  for(const e of q.iterator)if(e.type==='team'){
   visited++
   if(e.record.score>best){best=e.record.score;teams=new Set()}
   if(e.record.score===best)teams.add(JSON.stringify(e.record.packed.slots))
  }
  assert.equal(q.state.complete,true)
  const ms=performance.now()-began,sha=createHash('sha256').update([...teams].sort().join('\n')).digest('hex')
  if(round>=0)runs.push({mode,round,ms,best,tiedTeams:teams.size,tiedTeamsSha256:sha,visitedLeaves:visited,...q.state.stats})
 }
 assert.equal(new Set(runs.map(r=>JSON.stringify([r.best,r.tiedTeams,r.tiedTeamsSha256]))).size,1,fixture.id+' all equal-score teams must match')
 const row={id:fixture.id,identities:fixture.n,ownPositions:3,base:fixture.base,costLimit:fixture.budget,runs,
  referenceMs:median(runs.filter(r=>r.mode==='reference').map(r=>r.ms)),optimizedMs:median(runs.filter(r=>r.mode==='optimized').map(r=>r.ms))}
 row.ratio=row.optimizedMs/row.referenceMs;report.cases.push(row)
 console.log(JSON.stringify({id:row.id,referenceMs:row.referenceMs,optimizedMs:row.optimizedMs,ratio:row.ratio,best:runs[0].best,tiedTeams:runs[0].tiedTeams}))
}
report.passed=true;mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({passed:true,cases:report.cases.length,rounds,output}))

