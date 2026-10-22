import {createHash} from 'node:crypto'
import {createScoreTeamSearch} from '../src/recommend.js'
import {SEARCH_MODEL} from '../src/solver/ai-model.js'
import {selectQueryModel} from '../src/solver/query-models.js'
import {wideFixture} from './all-score-teams-wide-fixtures.mjs'
const [id,model,timeoutRaw]=process.argv.slice(2),timeout=Number(timeoutRaw),fixture=wideFixture(id)
const opts={...fixture.opts,aiMode:model==='off'?'off':'on',aiModel:model==='off'?null:selectQueryModel(SEARCH_MODEL,model),skipResultCache:true}
const began=performance.now(),q=createScoreTeamSearch(opts),preparedMs=performance.now()-began
let best=-Infinity,count=0,visited=0,hash=createHash('sha256'),firstFeasibleMs=null,lastBestMs=null,lastPost=began,checks=0
const initial=q.initial?(opts.optimizeBy==='prefer'?q.initial.preferBond:q.initial.total):null
function result(status){return {id,model,status,resultUnit:'equivalence-groups',ms:performance.now()-began,preparedMs,firstFeasibleMs:initial!=null?preparedMs:firstFeasibleMs,firstEnumeratedMs:firstFeasibleMs,lastBestMs,initialScore:initial,best:Number.isFinite(q.state.bestScore)?q.state.bestScore:null,bestEnumerated:Number.isFinite(best)?best:null,tiedTeams:best===q.state.bestScore?count:0,
 visited,settlementSamples:checks,maxRssMiB:process.resourceUsage().maxRSS/1024,heapUsedMiB:process.memoryUsage().heapUsed/1048576,
 complete:q.state.complete,maximumProven:q.state.maximumProven,ai:q.state.ai?Object.fromEntries(['enabled','modelVersion','inferenceCalls','inferenceMs','queryProfile','reason'].map(key=>[key,q.state.ai[key]])):null,stats:{...q.state.stats},domain:fixture.domain}}
try{
 if(!q.ok)throw Error(q.error)
 for(const e of q.iterator){
  if(e.type==='team'){
   const r=e.record;visited++;firstFeasibleMs??=performance.now()-began
   if(r.score>best){best=r.score;count=0;hash=createHash('sha256');lastBestMs=performance.now()-began}
   if(r.score===best){count++;hash.update(JSON.stringify(r.packed.slots)+'\n')}
   if(visited<=16||visited%10000===0){const p=q.hydrate(r),score=opts.optimizeBy==='prefer'?p.preferBond:p.total;if(score!==r.score)throw Error('Exact settlement mismatch');checks++}
  }
  const now=performance.now()
  if(now-lastPost>=1000){process.send?.({type:'progress',value:result('running')});lastPost=now}
  if(now-began>=timeout){process.send?.({type:'result',value:result('timeout')});process.disconnect?.();process.exit(0)}
 }
 process.send?.({type:'result',value:{...result('complete'),tiedTeamsSha256:hash.digest('hex')}})
}catch(error){process.send?.({type:'result',value:{...result('error'),error:String(error.stack||error)}});process.exitCode=1}
process.disconnect?.()

