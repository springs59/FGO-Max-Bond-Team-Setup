import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {grandStockFixture,GRAND_STOCK_CASES} from './grand-stock-fixtures.mjs'

if(process.argv[2]==='--sample'){
 const [mode,id,rawBudget]=process.argv.slice(3),opts=grandStockFixture(id)
 const root=mode==='baseline'?process.env.FGO_GRAND_BASELINE_ROOT:resolve('.')
 assert.ok(root,'Set FGO_GRAND_BASELINE_ROOT to a checkout of native-v2.1.14')
 const {createScoreTeamSearch}=await import(pathToFileURL(resolve(root,'src/recommend.js')))
 const began=performance.now(),q=createScoreTeamSearch(opts),history=[]
 assert.ok(q.ok,q.error)
 let proofMs=null,proofScore=null,bestPlan=null
 for(const event of q.iterator){
  const ms=performance.now()-began
  if(event.type==='best'){
   bestPlan=q.hydrate(event.record);history.push({ms,score:event.score,cost:bestPlan.costUsed})
   assert.ok(bestPlan.costUsed<=opts.costLimit)
  }
  if(event.type==='phase'){proofMs=ms;proofScore=q.state.bestScore;break}
  if(ms>=Number(rawBudget))break
 }
 const implementationSha256=createHash('sha256')
 for(const path of ['src/recommend.js','src/solver/score-team-ce-first.js','src/solver/score-team-effects.js','src/solver/score-team-enumerator.js'])implementationSha256.update(path+'\0').update(readFileSync(resolve(root,path))).update('\0')
 console.log(JSON.stringify({mode,id,inputHash:createHash('sha256').update(JSON.stringify(opts)).digest('hex'),implementationSha256:implementationSha256.digest('hex'),
  ms:performance.now()-began,best:q.state.bestScore,maximumProven:q.state.maximumProven,complete:q.state.complete,proofMs,proofScore,history,stats:q.state.stats,
  bestTeam:bestPlan?.slots.map(s=>({p:s.position,support:s.isSupport,grand:s.isGrand,svt:s.svtId,art:s.svtArtKey,ce:s.ceId,reward:s.ceRewardId,bond:s.ceBondId})),
  maxRssMiB:process.resourceUsage().maxRSS/1024}))
 process.exit(0)
}
const rounds=Number(process.env.FGO_GRAND_ROUNDS||3),budget=Number(process.env.FGO_GRAND_BUDGET||10000),cases=process.env.FGO_GRAND_CASES?.split(',')||GRAND_STOCK_CASES,records=[]
for(const id of cases)for(let round=0;round<rounds;round++)for(const mode of round%2?['current','baseline']:['baseline','current']){
 const value=JSON.parse(execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--sample',mode,id,String(budget)],{encoding:'utf8',timeout:budget+30000,maxBuffer:2*1024*1024}))
 records.push({...value,round});console.log(JSON.stringify({id,round,mode,best:value.best,proofMs:value.proofMs,fallback:value.stats.ceFirstFallback}))
}
for(const id of cases){
 const rows=records.filter(r=>r.id===id)
 assert.equal(new Set(rows.map(r=>r.inputHash)).size,1,'Identical current inputs for both implementations')
 assert.ok(new Set(rows.filter(r=>r.maximumProven).map(r=>r.best)).size<=1,'Proven maxima agree')
}
for(const mode of ['baseline','current'])assert.equal(new Set(records.filter(r=>r.mode===mode).map(r=>r.implementationSha256)).size,1,'Source must remain unchanged throughout timing')
const median=xs=>{const values=xs.filter(Number.isFinite).sort((a,b)=>a-b);return values.length?values[Math.floor(values.length/2)]:null}
const summary=cases.map(id=>({id,modes:Object.fromEntries(['baseline','current'].map(mode=>{
 const rows=records.filter(r=>r.id===id&&r.mode===mode)
 return [mode,{proved:rows.filter(r=>r.maximumProven).length,bestScores:rows.map(r=>r.best),proofMs:median(rows.map(r=>r.proofMs)),
  firstAbove50894Ms:median(rows.map(r=>r.history.find(x=>x.score>=50894)?.ms)),firstMs:median(rows.map(r=>r.history[0]?.ms)),fallbacks:rows.map(r=>r.stats.ceFirstFallback||null)}]
}))}))
const report={date:'2026-10-25',rounds,budgetMs:budget,node:process.version,summary,records,
 scope:'Same current public CN inputs and actual stock in fresh independent Node processes; v2.1.14 versus current implementation. Not the user account or a reproduction of the reported 49522/50894 team. Includes preparation and exact preview hydration, excludes UI/Worker/OPFS. Stops at objective proof; complete tie collection is checked separately by literal oracles. A cutoff is not a proof or a complete query.'}
const output=process.env.FGO_GRAND_OUTPUT||'test-output/grand-incumbent/benchmark.json';mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({summary,output}))
