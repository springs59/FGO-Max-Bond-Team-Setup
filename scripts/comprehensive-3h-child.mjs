import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {pinCpu} from './historical-3h-affinity.mjs'
import {validatePlan} from './comprehensive-3h-validate.mjs'
import {VERSIONS,runtimeRoot,physicalKey} from './comprehensive-3h-config.mjs'
import {wideFixture} from './comprehensive-3h-fixtures.mjs'
import {expandScoreTeamFamily} from '../src/solver/score-team-equivalence.js'
pinCpu()
const [id,version,limitRaw]=process.argv.slice(2),limit=Number(limitRaw),meta=VERSIONS[version]
if(!meta||!Number.isFinite(limit)||limit<1||limit>10800000)throw Error('Bad benchmark arguments')
const importStart=performance.now(),runtime=await import(pathToFileURL(runtimeRoot(version)+'/src/recommend.js'))
const {opts:fixture,stress}=wideFixture(id)
let aiModel
if(!['off','bundled'].includes(meta.model)){
 const {SEARCH_MODEL}=await import('../src/solver/ai-model.js'),{selectQueryModel}=await import('../src/solver/query-models.js')
 aiModel=selectQueryModel(SEARCH_MODEL,meta.model)
}
const opts={...fixture,aiMode:meta.model==='off'?'off':'on',...(aiModel?{aiModel}:{}),aiFramework:'auto',
 skipResultCache:true,skipSolutionLookup:true,solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null,
 accountProfileId:`comprehensive:${id}:${version}`,scoreTeamAudit:{bounds:meta.bounds!==false}}
const send=(type,value)=>process.send?.({type,value}),began=performance.now(),startupMs=began-importStart
let lastPost=began,firstFeasibleMs=null,lastImprovementMs=null,bestValidated=null,preparedMs=null,initialScore=null,query=null
let observedBest=-Infinity,count=0,visited=0,checks=0,hash=createHash('sha256'),keys=[],families=[],fingerprintCap=false
const CAP=100000,FAMILY_CAP=10000,improvements=[],fingerprintEligible=!stress&&id!=='six-own'
const numeric=(o,depth=3)=>{
 if(o==null||['number','boolean','string'].includes(typeof o))return typeof o==='string'?o.slice(0,250):o
 if(Array.isArray(o)||ArrayBuffer.isView(o))return {length:o.length}
 if(depth<=0)return undefined
 return Object.fromEntries(Object.entries(o).slice(0,64).map(([k,v])=>[k,numeric(v,depth-1)]).filter(([,v])=>v!==undefined))
}
function observe(score,source){
 firstFeasibleMs??=performance.now()-began
 if(!bestValidated||score>bestValidated.score){bestValidated={score};lastImprovementMs=performance.now()-began;improvements.push({score,ms:lastImprovementMs,source})}
}
function facts(status){return {id,version,status,mode:meta.mode,outputUnit:meta.mode==='native'?'representative':meta.mode==='literal'?'physical-teams':'equivalence-groups',
 ms:performance.now()-began,startupMs,preparedMs,initialScore,firstFeasibleMs,lastImprovementMs,bestValidated,score:query?query.state.bestScore:bestValidated?.score,
 enumeratedBest:Number.isFinite(observedBest)?observedBest:null,optimalRecords:query&&observedBest===query.state.bestScore?count:null,visited,settlementChecks:checks,
 maxRssMiB:process.resourceUsage().maxRSS/1024,heapUsedMiB:process.memoryUsage().heapUsed/1048576,
 search:numeric(query?.state.stats),ai:numeric(query?.state.ai),improvements}}
function progress(force=false){const now=performance.now();if(force||now-lastPost>=1000){send('progress',facts('running'));lastPost=now}}
send('started',{id,version,startupMs})
try{
 if(meta.mode==='native'){
  const plan=runtime.recommendTeam({...opts,onSolverProgress(p){
   if(performance.now()-lastPost>=1000){send('progress',{...facts('running'),reportedProgress:numeric(p)});lastPost=performance.now()}
  },onCheckpointPlan(p){try{const f=validatePlan(opts,p);checks++;observe(f.score,'verified-checkpoint')}catch{/* Legacy compact callbacks may not be hydrated plans. */}}})
  const engineMs=performance.now()-began;send('engine-done',{ms:engineMs})
  const validationStart=performance.now(),validated=validatePlan(opts,plan);checks++;observe(validated.score,'final-plan')
  send('result',{...facts('complete'),...validated,ms:engineMs,validationMs:performance.now()-validationStart,
   solverMaximumClaimed:true,maximumProvenInUnifiedDomain:false,allOptimalCovered:false,
   returnedPlans:plan.plans?.length||1,stats:numeric(plan.queryStats||plan.solverStats),ai:numeric(plan.resultStatus?.ai||plan.solverStats?.ai),
   source:plan.resultStatus?.source,optimality:plan.resultStatus?.optimality,
   postLastVerifiedImprovementMs:Math.max(0,engineMs-(lastImprovementMs||engineMs))})
 }else{
  if(typeof runtime.createScoreTeamSearch!=='function')throw Error('Full-score interface unavailable')
  query=runtime.createScoreTeamSearch(opts);preparedMs=performance.now()-began
  if(!query.ok)throw Error(query.error)
  if(query.initial){const f=validatePlan(opts,query.initial);checks++;initialScore=f.score;observe(f.score,'verified-seed')}
  for(const event of query.iterator){
   if(event.type==='team'){
    const r=event.record;visited++
    if(visited<=16||visited%10000===0||r.score>observedBest){
     const f=validatePlan(opts,query.hydrate(r));checks++;if(f.score!==r.score)throw Error('Unified exact score differs from enumerator');observe(f.score,'verified-enumeration')
    }
    if(r.score>observedBest){observedBest=r.score;count=0;hash=createHash('sha256');keys=[];families=[];fingerprintCap=!fingerprintEligible;observe(r.score,'exact-search')}
    if(r.score===observedBest){
     count++;hash.update(physicalKey(r)+'\n')
     if(meta.mode==='literal'){if(!fingerprintCap){if(keys.length<CAP)keys.push(physicalKey(r));else{fingerprintCap=true;keys=[]}}}
     else if(families.length<FAMILY_CAP&&!fingerprintCap)families.push(r);else{fingerprintCap=true;families=[]}
    }
   }
   progress()
   if(performance.now()-began>=limit){send('result',{...facts('timeout'),validated:checks>0,maximumProvenInUnifiedDomain:false,allOptimalCovered:false});process.disconnect?.();process.exit(0)}
  }
  if(!count||observedBest!==query.state.bestScore)throw Error('Claimed maximum has no enumerated realization')
  const engineMs=performance.now()-began;send('engine-done',{ms:engineMs})
  const validationStart=performance.now();let expansionComplete=!fingerprintCap
  if(meta.mode==='group'&&expansionComplete){
   for(const r of families){
    for(const physical of expandScoreTeamFamily(r,query.equivalenceCatalogs?.[r.domain])){
     if(keys.length>=CAP){expansionComplete=false;break}
     keys.push(physicalKey(physical))
    }
    if(!expansionComplete)break
   }
  }
  let physicalFingerprint=null,physicalCount=null
  if(expansionComplete){
   if(new Set(keys).size!==keys.length)throw Error('Duplicate physical teams within or across families')
   physicalCount=keys.length;physicalFingerprint=createHash('sha256').update(keys.sort().join('\n')).digest('hex')
  }
  send('result',{...facts('complete'),ms:engineMs,validationMs:performance.now()-validationStart,validated:checks>0,
   score:query.state.bestScore,solverMaximumClaimed:true,maximumProvenInUnifiedDomain:query.state.maximumProven,allOptimalCovered:query.state.complete,
   recordsSha256:hash.digest('hex'),physicalFingerprint,physicalCount,expansionCheck:expansionComplete?'complete':fingerprintEligible?'explicit-check-budget':'not-expanded-pressure-or-large-formation',
   physicalFingerprintBudget:CAP,postLastVerifiedImprovementMs:Math.max(0,engineMs-(lastImprovementMs||engineMs)),
   compression:query.equivalenceCatalogs?.map(c=>c?{rowGroups:c.rows.length,rowOptions:c.rows.reduce((n,g)=>n+g.length,0),
    ownCeGroups:c.ownCes.length,supportCeGroups:c.supportCes.length,seatGroups:c.seatGroups}:null)})
 }
}catch(error){send('result',{...facts('error'),validated:false,error:String(error.stack||error),maximumProvenInUnifiedDomain:false,allOptimalCovered:false});process.exitCode=1}
process.disconnect?.()
