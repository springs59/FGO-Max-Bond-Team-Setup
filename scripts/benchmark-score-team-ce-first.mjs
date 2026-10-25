import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import os from 'node:os'
import {scorePressureFixture,SCORE_PRESSURE_CASES} from './score-first-pressure-fixtures.mjs'

if(process.argv[2]==='--sample'){
 const [mode,id,rawBudget]=process.argv.slice(3),opts={...scorePressureFixture(id),aiMode:'off',skipResultCache:true,skipSolutionLookup:true}
 const inputHash=createHash('sha256').update(JSON.stringify(opts)).digest('hex'),began=performance.now()
 const {createScoreTeamSearch}=await import('../src/recommend.js')
 const q=createScoreTeamSearch({...opts,scoreTeamAudit:{ceFirst:mode==='on'}})
 assert.ok(q.ok,q.error)
 const preparedMs=performance.now()-began
 let first=null,lastBest=null,proof=null,firstCollectedMs=null,groups=0
 for(const event of q.iterator){
  const ms=performance.now()-began
  if(event.type==='best'){first??={ms,score:event.score};lastBest={ms,score:event.score};q.hydrate(event.record)}
  if(event.type==='phase')proof={ms,score:q.state.bestScore,stats:{...q.state.stats}}
  if(event.type==='team'){firstCollectedMs??=ms;groups++}
  if(ms>=Number(rawBudget))break
 }
 console.log(JSON.stringify({mode,id,inputHash,preparedMs,first,lastBest,proof,firstCollectedMs,groups,
  totalMs:performance.now()-began,best:q.state.bestScore,maximumProven:q.state.maximumProven,complete:q.state.complete,
  maxRssMiB:process.resourceUsage().maxRSS/1024,stats:q.state.stats}))
 process.exit(0)
}

const rounds=Number(process.env.FGO_CE_FIRST_ROUNDS||3),budgetMs=Number(process.env.FGO_CE_FIRST_BUDGET||5000)
const ids=process.env.FGO_CE_FIRST_CASES?.split(',')||SCORE_PRESSURE_CASES
const reused=process.env.FGO_CE_FIRST_REUSE_BASELINE?JSON.parse(readFileSync(process.env.FGO_CE_FIRST_REUSE_BASELINE)):null
const records=reused?reused.records.filter(r=>r.mode==='off'&&ids.includes(r.id)&&r.round<rounds):[]
for(const id of ids)for(let round=0;round<rounds;round++)for(const mode of round%2?['on','off']:['off','on']){
 if(records.some(r=>r.id===id&&r.round===round&&r.mode===mode))continue
 try{
  const row=JSON.parse(execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--sample',mode,id,String(budgetMs)],{encoding:'utf8',timeout:budgetMs+15000,maxBuffer:2*1024*1024}))
  records.push({...row,round});console.log(JSON.stringify({id,round,mode,best:row.best,proofMs:row.proof?.ms,complete:row.complete,totalMs:row.totalMs}))
 }catch(error){records.push({id,round,mode,status:error.code==='ETIMEDOUT'?'hard-timeout':'failure',error:String(error.message).slice(0,500)})}
}
const median=xs=>{const ns=xs.filter(Number.isFinite).sort((a,b)=>a-b);return ns.length?ns[Math.floor(ns.length/2)]:null}
const summary=ids.map(id=>({id,modes:Object.fromEntries(['off','on'].map(mode=>{
 const rows=records.filter(r=>r.id===id&&r.mode===mode)
 return [mode,{samples:rows.length,proved:rows.filter(r=>r.maximumProven).length,completed:rows.filter(r=>r.complete).length,
  bestScores:rows.map(r=>r.best??null),firstMs:median(rows.map(r=>r.first?.ms)),lastBestMs:median(rows.map(r=>r.lastBest?.ms)),
  proofMs:median(rows.map(r=>r.proof?.ms)),completeMs:median(rows.filter(r=>r.complete).map(r=>r.totalMs)),
  firstCollectedMs:median(rows.map(r=>r.firstCollectedMs)),maxRssMiB:median(rows.map(r=>r.maxRssMiB)),
  fastProofs:rows.map(r=>r.stats?.ceFirstProofs||0),fallbacks:rows.map(r=>r.stats?.ceFirstFallback||null)}]
 }))}))
for(const id of ids){
 const rows=records.filter(r=>r.id===id)
 assert.equal(rows.length,rounds*2);assert.ok(rows.every(r=>!r.status),id+': sample failure')
 assert.equal(new Set(rows.map(r=>r.inputHash)).size,1,id+': inputs differ')
 const proven=rows.filter(r=>r.maximumProven)
 assert.ok(new Set(proven.map(r=>r.best)).size<=1,id+': proven maxima disagree')
}
const implementationFiles=['src/recommend.js','src/solver/score-team-ce-first.js','src/solver/score-team-phases.js','src/solver/score-team-effects.js','src/solver/score-team-equivalence.js']
const h=createHash('sha256');for(const path of implementationFiles)h.update(path+'\0').update(readFileSync(path)).update('\0')
const report={date:'2026-10-25',sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,cpu:os.cpus()[0].model,
 rounds,budgetMs,implementationFiles,implementationSha256:h.digest('hex'),summary,records,reusedBaseline:Boolean(reused),
 scope:'Same implementation and identical current catalog/inputs, CE-first proof enabled versus its v2.1.13 fallback path. Fresh independent Node processes, alternating order, AI off, no Worker/OPFS/UI. Timing starts after fixture/module loading and includes domain preparation, exact hydration of previews and core search. Memory includes catalog loading. Proof time and complete tie-collection time are separate. Cutoffs are incomplete; no completion speed ratio is inferred. Nodes count different work units in the two engines.'}
const output=process.env.FGO_CE_FIRST_OUTPUT||'test-output/ce-first/benchmark.json';mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({summary,output}))
