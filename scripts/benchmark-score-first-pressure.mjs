import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {pathToFileURL,fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {scorePressureFixture,SCORE_PRESSURE_CASES} from './score-first-pressure-fixtures.mjs'

if(process.argv[2]==='--sample'){
 const [modulePath,id,budget]=process.argv.slice(3),{createScoreTeamSearch}=await import(pathToFileURL(modulePath))
 const opts=scorePressureFixture(id),inputHash=createHash('sha256').update(JSON.stringify(opts)).digest('hex')
 const began=performance.now(),q=createScoreTeamSearch(opts),trace=[];assert.equal(q.ok,true,q.error)
 const preparedMs=performance.now()-began
 for(const event of q.iterator){
  const ms=performance.now()-began
  if(event.type==='best')trace.push({score:event.score,ms,nodes:q.state.stats.nodes})
  if(ms>=Number(budget))break
 }
 console.log(JSON.stringify({id,inputHash,preparedMs,elapsedMs:performance.now()-began,best:q.state.bestScore,trace,
  complete:q.state.complete,maximumProven:q.state.maximumProven,stats:q.state.stats}))
}else{
 assert.ok(process.env.FGO_SCORE_BASELINES,'Set FGO_SCORE_BASELINES to JSON mapping version labels to absolute src/recommend.js paths')
 const versions={...JSON.parse(process.env.FGO_SCORE_BASELINES),optimized:resolve('src/recommend.js')},rounds=Number(process.env.FGO_SCORE_ROUNDS||3),budgetMs=Number(process.env.FGO_SCORE_BUDGET_MS||2000)
 const cases=process.env.FGO_SCORE_CASES?.split(',')||SCORE_PRESSURE_CASES,median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1]
 const report={passed:false,date:'2026-10-24',runtime:process.version,rounds,budgetMs,
  scope:'Separate Node processes, identical inputs/data, AI off; cooperative wall-time cutoff including preparation. Excludes Worker, storage and UI. Scores at cutoff are incumbents, not claims of proven maxima.',
  dataHash:createHash('sha256').update(readFileSync('src/data/metadata.json')).digest('hex'),versions,cases:[]}
 for(const id of cases){
  const runs=[]
  for(let round=0;round<rounds;round++)for(const [version,modulePath] of (round%2?Object.entries(versions).reverse():Object.entries(versions))){
   const sample=JSON.parse(execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--sample',modulePath,id,String(budgetMs)],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024}))
   runs.push({version,round,...sample})
  }
  assert.equal(new Set(runs.map(r=>r.inputHash)).size,1,'Compare exactly the same inputs')
  const row={id,versions:{},runs}
  for(const version of Object.keys(versions)){
   const xs=runs.filter(r=>r.version===version)
   row.versions[version]={bestAtCutoff:median(xs.map(r=>r.best)),bestSamples:xs.map(r=>r.best),
    evaluated:median(xs.map(r=>r.stats.evaluated)),elapsedMs:median(xs.map(r=>r.elapsedMs)),firstFinalIncumbentMs:median(xs.map(r=>r.trace.find(t=>t.score===r.best)?.ms??r.elapsedMs))}
  }
  report.cases.push(row);console.log(JSON.stringify({id,versions:row.versions}))
 }
 report.passed=true
 const output=process.env.FGO_SCORE_OUTPUT||'docs/score-first-pressure-benchmark.json'
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
 console.log(JSON.stringify({passed:true,output}))
}
