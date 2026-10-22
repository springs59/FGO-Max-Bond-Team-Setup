import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdirSync,writeFileSync} from 'node:fs'
import {dirname} from 'node:path'
import os from 'node:os'
import {createScoreTeamSearch} from '../src/recommend.js'
import {SEARCH_MODEL} from '../src/solver/ai-model.js'
import {selectQueryModel} from '../src/solver/query-models.js'
import {WIDE_CASE_IDS,wideFixture} from './all-score-teams-wide-fixtures.mjs'

const output=process.env.FGO_HYBRID_OUTPUT||'test-output/hybrid-resource-bounds/report.json'
const rounds=Number(process.env.FGO_HYBRID_ROUNDS||3),stressMs=Number(process.env.FGO_HYBRID_STRESS_MS||2000)
assert.ok(Number.isInteger(rounds)&&rounds>0&&Number.isFinite(stressMs)&&stressMs>0)
const models=(process.env.FGO_HYBRID_MODELS||'off,baseline,teacher,neural-large').split(',')
const ids=(process.env.FGO_HYBRID_CASES||WIDE_CASE_IDS.join(',')).split(',')
const report={schema:1,passed:false,environment:{node:process.version,cpu:os.cpus()[0].model},rounds,stressMs,
  scope:'Same process, alternating order, one warm-up for completed domains. Both modes retain identical equivalence groups; only combined resource bounds change. Pressure runs are limited smoke tests, not three-hour conclusions. Engine setup, search and fingerprint collection included; browser/OPFS excluded.',cases:[]}
const median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1]
function run(opts,resources,limit){
  const began=performance.now(),q=createScoreTeamSearch({...opts,scoreTeamAudit:{resources}})
  assert.equal(q.ok,true,q.error)
  let best=-Infinity,keys=[],visited=0,samples=0
  for(const e of q.iterator){
    if(e.type==='team'){
      const r=e.record;visited++
      if(visited<=8||visited%10000===0){q.hydrate(r);samples++}
      if(r.score>best){best=r.score;keys=[]}
      if(r.score===best)keys.push(JSON.stringify(r.packed))
    }
    if(performance.now()-began>=limit)break
  }
  const ms=performance.now()-began
  return {resources,ms,complete:q.state.complete,best:Number.isFinite(q.state.bestScore)?q.state.bestScore:null,
    bestEnumerated:Number.isFinite(best)?best:null,groups:keys.length,
    fingerprint:q.state.complete?createHash('sha256').update(keys.sort().join('\n')).digest('hex'):null,
    stats:q.state.stats,visited,settlementSamples:samples,initialScore:q.initial?.total??null,ai:q.state.ai?{profile:q.state.ai.queryProfile,inferenceCalls:q.state.ai.inferenceCalls}:null}
}
for(const id of ids)for(const model of models){
  const fixture=wideFixture(id),pressure=id==='CN-open'||id==='JP-open'
  const opts={...fixture.opts,aiMode:model==='off'?'off':'on',aiModel:model==='off'?undefined:selectQueryModel(SEARCH_MODEL,model)}
  const samples=[]
  for(let round=pressure?0:-1;round<(pressure?1:rounds);round++)for(const resources of round%2?[true,false]:[false,true]){
    const result=run(opts,resources,pressure?stressMs:Infinity)
    if(round>=0)samples.push({...result,round})
  }
  const complete=samples.filter(x=>x.complete)
  if(complete.length){
    if(!pressure)assert.equal(complete.length,samples.length,id+' unexpected completion difference in an unlimited domain')
    assert.equal(new Set(complete.map(x=>JSON.stringify([x.best,x.groups,x.fingerprint]))).size,1,id+' best groups differ')
    assert.ok(samples.every(x=>x.best==null||x.best<=complete[0].best),id+' partial score exceeds a proved maximum')
  }
  const previousMs=median(samples.filter(x=>!x.resources).map(x=>x.ms)),hybridMs=median(samples.filter(x=>x.resources).map(x=>x.ms))
  const row={id,model,pressure,complete:complete.length===samples.length,previousMs,hybridMs,ratio:hybridMs/previousMs,samples}
  report.cases.push(row)
  // Persist after each pair so interruption never erases completed evidence.
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({...row,samples:row.samples.map(x=>({resources:x.resources,nodes:x.stats.nodes,resourcePruned:x.stats.resourcePruned||0,best:x.best,groups:x.groups}))}))
}
report.passed=true;writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({passed:true,cases:report.cases.length,output}))
