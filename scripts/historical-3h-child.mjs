import {pathToFileURL} from 'node:url'
import {pinCpu} from './historical-3h-affinity.mjs'
import {VERSIONS,versionRoot} from './historical-3h-versions.mjs'
import {wideFixture} from './all-score-teams-wide-fixtures.mjs'
import {validatePlan} from './historical-3h-validate.mjs'
pinCpu()
const [id,version]=process.argv.slice(2),meta=VERSIONS[version],{opts}=wideFixture(id)
const {recommendTeam}=await import(pathToFileURL(versionRoot(version)+'/src/recommend.js'))
let aiModel
if(meta.model){const {SEARCH_MODEL}=await import('../src/solver/ai-model.js'),{selectQueryModel}=await import('../src/solver/query-models.js');aiModel=selectQueryModel(SEARCH_MODEL,meta.model)}
let lastPost=-Infinity,firstFeasibleMs=null,bestValidated=null,checks=0
const began=performance.now(),send=(type,value)=>process.send?.({type,value})
send('started',{id,version})
try{
 const plan=recommendTeam({...opts,aiMode:meta.ai,...(aiModel?{aiModel}:{}),aiFramework:'auto',skipResultCache:true,skipSolutionLookup:true,
  accountProfileId:'historical-3h:'+id+':'+version,
  onSolverProgress(p){const now=performance.now();if(now-lastPost>=1000){lastPost=now;send('progress',{ms:now-began,bestReported:Number.isFinite(p.bestScore)?p.bestScore:null,bestValidated,firstFeasibleMs,nodes:p.nodes,pruned:p.pruned,maxRssMiB:process.resourceUsage().maxRSS/1024})}},
  onCheckpointPlan(p){try{const r=validatePlan(opts,p);checks++;firstFeasibleMs??=performance.now()-began;if(!bestValidated||r.score>bestValidated.score)bestValidated=r}catch{/* Intermediate legacy compact records are not treated as settled plans. */}}
 })
 const ms=performance.now()-began,validationStart=performance.now(),facts=validatePlan(opts,plan)
 firstFeasibleMs??=ms
 send('result',{status:'complete',ms,validationMs:performance.now()-validationStart,...facts,firstFeasibleMs,maximumClaimed:true,allScoreTeamsComplete:false,
  returnedPlans:plan.plans?.length||1,settlementChecks:checks+1,maxRssMiB:process.resourceUsage().maxRSS/1024,
  ai:plan.resultStatus?.ai||plan.solverStats?.ai||null,queryStats:plan.queryStats,solverStats:plan.solverStats,
  source:plan.resultStatus?.source,optimality:plan.resultStatus?.optimality})
}catch(error){send('result',{status:'error',ms:performance.now()-began,validated:false,error:String(error.stack||error),bestValidated,firstFeasibleMs,maxRssMiB:process.resourceUsage().maxRSS/1024});process.exitCode=1}
process.disconnect?.()
