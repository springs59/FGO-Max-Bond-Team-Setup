import assert from 'node:assert/strict'
import {fork,execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import os from 'node:os'
import {wideFixture,WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {MODELS,writeJson,validateRows} from './all-score-teams-3h-lib.mjs'

const [id,model]=process.argv.slice(2)
assert.ok(WIDE_CASE_IDS.includes(id)&&MODELS.includes(model),'Unknown case or model')
const fixture=wideFixture(id),limit=Number(process.env.FGO_HYBRID_LIMIT_MS||10800000)
assert.ok(Number.isFinite(limit)&&limit>0&&limit<=10800000,'Invalid per-query deadline')
const rounds=Number(process.env.FGO_HYBRID_ROUNDS||(fixture.stress?1:3))
assert.ok(Number.isInteger(rounds)&&rounds>0&&rounds<=3)
const cpus=JSON.parse(execFileSync('python3',['-c','import os,json;print(json.dumps(sorted(os.sched_getaffinity(0))))'],{encoding:'utf8'}))
assert.ok(cpus.length>=2,'Two allowed cores required')
let memory=os.totalmem()
for(const path of ['/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory/memory.limit_in_bytes']){
 try{const value=Number(readFileSync(path,'utf8').trim());if(Number.isFinite(value)&&value>0)memory=Math.min(memory,value)}catch{}
}
const heapMiB=Math.min(6144,Math.floor((memory/1048576-2048)/2))
assert.ok(heapMiB>=512,'Insufficient memory for two bounded processes')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const paths=['src/recommend.js','src/solver/score-team-enumerator.js','src/solver/score-team-resource-bound.js','src/solver/query-models.js','src/solver/query-ai-model.js','src/solver/query-policies/T.js','src/solver/query-policies/N8192.js','scripts/all-score-teams-wide-fixtures.mjs','scripts/all-score-teams-wide-child.mjs','scripts/run-hybrid-three-hour.mjs','src/data/servants.json','src/data/ces.json','src/data/jp/bundle.json','src/data/bond-bonuses.json']
const output=process.env.FGO_HYBRID_OUTPUT||`test-output/hybrid-three-hour/${id}-${model}/case.json`
const state={schema:1,id,model,finished:false,status:'running',startedAt:new Date().toISOString(),limitMs:limit,rounds,
 source:{commit:git('rev-parse','HEAD'),gitBlobs:Object.fromEntries(paths.map(p=>[p,git('hash-object',p)]))},
 inputSha256:createHash('sha256').update(JSON.stringify(fixture.opts)).digest('hex'),
 environment:{node:process.version,cpu:os.cpus()[0].model,allowedCpus:cpus,memoryMiB:memory/1048576,heapMiB},
 method:'Two fresh processes on distinct pinned cores of the same host. Resource bounds off/on; all other options and data identical. Core assignments swap each repeat. Ordinary cases repeat three cold runs; stress cases once. Each query has an independent engine deadline up to three hours plus 30 seconds supervisor grace. Timing includes preparation, sampled exact settlement and streaming fingerprints; excludes imports and archiving. No expanded team journal.',
 samples:[],progress:{},errors:[]}
const active=new Set();let saved=0,logged=0
function save(force=false){const now=performance.now();if(force||now-saved>=10000){writeJson(output,state);saved=now}if(now-logged>=60000){console.log(JSON.stringify({id,model,round:state.round,progress:state.progress}));logged=now}}
async function run(resources,round){return new Promise(resolveRow=>{
 const wallStart=performance.now(),core=cpus[(round+(resources==='on'?1:0))%2]
 const child=fork(new URL('./all-score-teams-3h-child.mjs',import.meta.url),[id,model,String(limit)],{
  env:{...process.env,FGO_SCORE_CPU_CORE:String(core),FGO_HYBRID_RESOURCES:resources},execArgv:[`--max-old-space-size=${heapMiB}`],stdio:['ignore','ignore','pipe','ipc']})
 active.add(child);let last=null,stderr='',done=false,affinityVerified=false,received=null
 const finish=row=>{if(done)return;done=true;clearTimeout(timer);active.delete(child);delete state.progress[resources];row={...row,id,model,resources,round,cpuCore:core,affinityVerified,wallMs:performance.now()-wallStart};state.samples.push(row);save(true);resolveRow(row)}
 const timer=setTimeout(()=>{child.kill('SIGKILL');finish({...last,status:'hard-timeout',complete:false,maximumProven:false,error:'Engine deadline plus startup grace exceeded'})},limit+30000)
 child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-4000)})
 child.on('message',message=>{
  if(message.type==='affinity'){affinityVerified=message.verified&&message.core===core;return}
  if(message.type==='result'){received=message.value;return}
  if(message.type==='progress'){last=message.value;state.progress[resources]=last;save()}
 })
 child.on('error',e=>finish({...last,status:'error',error:String(e),complete:false,maximumProven:false}))
 child.on('exit',(code,signal)=>{
  if(received&&code===0)finish(received)
  else finish({...last,status:'process-failure',code,signal,error:stderr||received?.error||'No final result',complete:false,maximumProven:false})
 })
})}
save(true)
try{
 for(let round=0;round<rounds;round++){
  state.round=round;save(true)
  const rows=await Promise.all((round%2?['on','off']:['off','on']).map(resources=>run(resources,round)))
  state.errors.push(...validateRows(rows).map(error=>`round ${round}: ${error}`))
  if(rows.some(row=>!row.affinityVerified))state.errors.push(`round ${round}: unverified CPU affinity`)
 }
 state.errors.push(...validateRows(state.samples))
 state.status=state.errors.length?'failed':'finished-with-explicit-timeout-classification'
}catch(error){state.errors.push(String(error.stack||error));state.status='failed'}
finally{for(const child of active)child.kill('SIGKILL');state.finished=true;state.endedAt=new Date().toISOString();save(true)}
console.log(JSON.stringify({id,model,status:state.status,errors:state.errors,samples:state.samples}))
if(state.errors.length)process.exitCode=1
