import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {scorePressureFixture,SCORE_PRESSURE_CASES} from './score-first-pressure-fixtures.mjs'

if(process.argv[2]==='--sample'){
 const [path,kind,id,budget]=process.argv.slice(3),module=await import(pathToFileURL(path))
 const opts={...scorePressureFixture(id),aiMode:'off',skipResultCache:true,skipSolutionLookup:true,useInventoryCurveSolver:true}
 const inputHash=createHash('sha256').update(JSON.stringify(opts)).digest('hex'),began=performance.now()
 if(kind==='legacy'){
  const r=module.recommendTeam(opts)
  console.log(JSON.stringify({id,inputHash,scope:'legacy representative recommendation, not all physical ties',complete:r.ok,score:r.total,
   totalMs:performance.now()-began,records:r.plans?.length||0,error:r.error||null}));process.exit(0)
 }
 const q=module.createScoreTeamSearch(opts);let first=null,lastBest=null,proof=null,records=0
 assert.ok(q.ok,q.error);const preparedMs=performance.now()-began
 for(const event of q.iterator){
  const ms=performance.now()-began
  if(event.type==='best'){first??={ms,score:event.score};lastBest={ms,score:event.score};q.hydrate(event.record)}
  if(event.type==='phase')proof={ms,nodes:q.state.stats.nodes,evaluated:q.state.stats.evaluated}
  if(event.type==='team')records++
  if(ms>=Number(budget))break
 }
 console.log(JSON.stringify({id,inputHash,scope:'complete maximum plus recoverable ties',preparedMs,first,lastBest,proof,
  totalMs:performance.now()-began,score:q.state.bestScore,complete:q.state.complete,maximumProven:q.state.maximumProven,
  records,stats:q.state.stats}));process.exit(0)
}
assert.ok(process.env.FGO_BOUNDS_BASELINE,'Set FGO_BOUNDS_BASELINE to v2.1.12 src/recommend.js')
const versions={v2112:{path:process.env.FGO_BOUNDS_BASELINE,kind:'full'},optimized:{path:resolve('src/recommend.js'),kind:'full'}}
if(process.env.FGO_BOUNDS_PRE_AI)versions.v200={path:process.env.FGO_BOUNDS_PRE_AI,kind:'legacy'}
const rounds=Number(process.env.FGO_BOUNDS_ROUNDS||3),budget=Number(process.env.FGO_BOUNDS_BUDGET||2000)
const cases=process.env.FGO_BOUNDS_CASES?.split(',')||SCORE_PRESSURE_CASES
const reused=process.env.FGO_BOUNDS_REUSE_BASELINE?JSON.parse(readFileSync(process.env.FGO_BOUNDS_REUSE_BASELINE)):null
const records=reused?reused.records.filter(r=>r.version!=='optimized'&&cases.includes(r.id)&&r.round<rounds):[]
const median=xs=>xs.filter(Number.isFinite).sort((a,b)=>a-b)[Math.floor(xs.filter(Number.isFinite).length/2)]??null
for(const id of cases)for(let round=0;round<rounds;round++){
 const order=Object.entries(versions);if(round%2)order.reverse()
 for(const [version,v] of order){
  if(records.some(r=>r.id===id&&r.version===version&&r.round===round))continue
  // These old modules do not model the new extended count domain.
  if(v.kind==='legacy'&&id==='extended-count')continue
  try{
   const r=JSON.parse(execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--sample',v.path,v.kind,id,String(budget)],
    {encoding:'utf8',timeout:v.kind==='legacy'?6000:Math.max(10000,budget+6000),maxBuffer:4*1024*1024}))
   records.push({...r,version,round});console.log(JSON.stringify({id,round,version,score:r.score,complete:r.complete,proofMs:r.proof?.ms,totalMs:r.totalMs}))
  }catch(error){records.push({id,version,round,status:error.code==='ETIMEDOUT'?'process-timeout':'failure',error:String(error.message).slice(0,600)});console.log(JSON.stringify(records.at(-1)))}
 }
}
const summary=cases.map(id=>({id,versions:Object.fromEntries(Object.keys(versions).map(version=>{
 const xs=records.filter(r=>r.id===id&&r.version===version)
 return [version,{completed:xs.filter(r=>r.complete).length,samples:xs.length,bestScores:xs.map(r=>r.score??null),
  firstMs:median(xs.map(r=>r.first?.ms)),finalIncumbentMs:median(xs.map(r=>r.lastBest?.ms)),
  proofMs:median(xs.map(r=>r.proof?.ms)),completeMs:median(xs.filter(r=>r.complete).map(r=>r.totalMs)),
  cutoffMs:median(xs.map(r=>r.totalMs)),nodes:median(xs.map(r=>r.stats?.nodes)),evaluated:median(xs.map(r=>r.stats?.evaluated)),pruned:median(xs.map(r=>r.stats?.scorePruned))}]
 }))}))
for(const id of cases){
 const xs=records.filter(r=>r.id===id&&r.inputHash);assert.equal(new Set(xs.map(r=>r.inputHash)).size,1,'Identical current data and inputs')
 const full=xs.filter(r=>r.scope==='complete maximum plus recoverable ties'&&r.complete)
 assert.ok(new Set(full.map(r=>r.score)).size<=1,id+': completed exact maxima disagree')
}
const sourcePaths=['src/recommend.js','src/grand-selection.js',...execFileSync('git',['ls-files','src/solver'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.js')&&!p.endsWith('.test.js')),'src/solver/score-team-effects.js'].filter((p,i,a)=>a.indexOf(p)===i).sort()
const sourceHash=createHash('sha256')
for(const p of sourcePaths)sourceHash.update(p+'\0').update(readFileSync(p)).update('\0')
const report={date:'2026-10-25',node:process.version,rounds,budgetMs:budget,versions,summary,records,
 reusedBaseline:process.env.FGO_BOUNDS_REUSE_BASELINE||null,
 scope:'Separate fresh Node processes; identical current fixtures; AI off; includes domain preparation and exact search, excludes Worker/storage/UI. Legacy timings are representative recommendations, not complete tie enumeration. A cutoff is never a proof or a speed ratio.',
 sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 implementationSha256:sourceHash.digest('hex'),implementationFiles:sourcePaths,
 catalogSha256:createHash('sha256').update(readFileSync('src/data/metadata.json')).digest('hex')}
const output=process.env.FGO_BOUNDS_OUTPUT||'test-output/grand-safe-bounds/benchmark.json';mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({summary,output}))
