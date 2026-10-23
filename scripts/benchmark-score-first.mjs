import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {mkdirSync,writeFileSync} from 'node:fs'
import {dirname} from 'node:path'
import {createScoreTeamSearch} from '../src/recommend.js'
import {physicalTeamKey} from '../src/solver/score-team-oracle-fixture.js'
if(!process.env.FGO_SCORE_BASELINE)throw Error('Set FGO_SCORE_BASELINE to the previous revision’s absolute src/recommend.js path')
const previous=(await import(pathToFileURL(process.env.FGO_SCORE_BASELINE))).createScoreTeamSearch
const ce=(id,rate,target='ptFull',trait=0)=>({id,name:'CE'+id,cost:1,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target,rate,tvals:trait?[{id:trait}]:[],add:0}]}))})
const roster=n=>Array.from({length:n},(_,i)=>({id:i+1,collectionNo:i+1,name:'S'+i,className:'saber',rarity:3,cost:i%3+1,traitIds:[10+i%2]}))
const standard={servants:roster(4),ces:[ce(101,100),ce(102,300,'ptFull',10)],base:815,costLimit:12,allowSupport:true,
 quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},slotPins:[3,5].map(position=>({position,empty:true})),aiMode:'off',scoreTeamAudit:{compact:false}}
const fixtures=[
 ['ordinary-conditional',standard],
 ['rounding-ties',{...standard,base:1,ces:[ce(101,10),ce(102,20)]}],
 ['grand',{...standard,servants:roster(2),allowSupport:false,quest:null,questType:'grand',questClass:'saber',grandPosition:1,slotPins:[3,4,5,6].map(position=>({position,empty:true})),ces:[ce(101,100)]}],
 ['extended-count',{...standard,servants:roster(3),allowSupport:false,quest:{noSupport:true,restrictions:[{type:'mySvtNum',rangeType:'equal',targetVals:[2]}]},slotPins:[3,5,6].map(position=>({position,empty:true}))}],
 ['live-campaign',{...standard,servants:roster(3),bondBonuses:{extraPassives:[],questFriendships:[{eventId:0,allQuests:true,targetIds:[1],rate:0.2,startedAt:1,endedAt:4102444800}]}}],
]
const rounds=Number(process.env.FGO_SCORE_ROUNDS||3),report={passed:false,baseline:'4a07d846bdcf85eda8e716d23b5191aa818a7068',rounds,
 scope:'Same-process synthetic exact searches, physical domain without equivalence compression; timings exclude Worker/storage/UI overhead. Compare complete optimal team fingerprints; previous proof ends with collection.',cases:[]}
const median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1]
function run(search,opts){
 const began=performance.now(),q=search(structuredClone(opts));assert.equal(q.ok,true,q.error)
 let proof=null,firstOptimal=null,archived=0,best=-Infinity,teams=new Set()
 for(const event of q.iterator){
  if(event.type==='best')firstOptimal={score:event.score,ms:performance.now()-began,nodes:q.state.stats.nodes}
  if(event.type==='phase')proof={ms:performance.now()-began,nodes:q.state.stats.nodes,evaluated:q.state.stats.evaluated,archived}
  if(event.type!=='team')continue
  const r=event.record;archived++
  if(r.score>best){best=r.score;teams.clear()}
  if(r.score===best){const key=physicalTeamKey(r.packed);assert.ok(!teams.has(key),'No repeated physical team across the two phases');teams.add(key)}
 }
 const totalMs=performance.now()-began;assert.equal(q.state.complete,true);assert.equal(best,q.state.bestScore)
 proof??={ms:totalMs,nodes:q.state.stats.nodes,evaluated:q.state.stats.evaluated,archived}
 assert.equal(firstOptimal?.score,best)
 return {best,ties:teams.size,fingerprint:createHash('sha256').update([...teams].sort().join('\n')).digest('hex'),firstOptimal,proof,totalMs,archived,stats:q.state.stats}
}
for(const [id,opts] of fixtures){
 const runs=[]
 for(let round=-1;round<rounds;round++)for(const mode of round%2?['previous','score-first']:['score-first','previous']){
  const result=run(mode==='previous'?previous:createScoreTeamSearch,opts)
  if(round>=0)runs.push({mode,round,...result})
 }
 assert.equal(new Set(runs.map(r=>JSON.stringify([r.best,r.ties,r.fingerprint]))).size,1,id+' must retain the exact optimal result set')
 const row={id,best:runs[0].best,ties:runs[0].ties,fingerprint:runs[0].fingerprint,runs}
 for(const mode of ['previous','score-first']){
  const xs=runs.filter(r=>r.mode===mode)
  row[mode]={firstOptimalMs:median(xs.map(r=>r.firstOptimal.ms)),firstOptimalNodes:median(xs.map(r=>r.firstOptimal.nodes)),proofMs:median(xs.map(r=>r.proof.ms)),proofNodes:median(xs.map(r=>r.proof.nodes)),archivedBeforeProof:median(xs.map(r=>r.proof.archived)),totalMs:median(xs.map(r=>r.totalMs))}
 }
 report.cases.push(row);console.log(JSON.stringify({...row,runs:undefined}))
}
report.passed=true
const output=process.env.FGO_SCORE_OUTPUT||'docs/score-first-benchmark.json'
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,output}))
