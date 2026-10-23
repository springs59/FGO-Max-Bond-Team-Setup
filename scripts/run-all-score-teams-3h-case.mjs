import {fork,execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import os from 'node:os'
import {wideFixture,WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {MODELS,writeJson,validateRows} from './all-score-teams-3h-lib.mjs'
const id=process.argv[2],fixture=wideFixture(id),output=resolve(process.env.FGO_SCORE_3H_OUTPUT||'test-output/all-score-3h/'+id+'/case.json')
const longMs=Number(process.env.FGO_SCORE_LONG_MS||10800000),shortMs=Number(process.env.FGO_SCORE_SHORT_MS||(fixture.stress?45000:15000))
if(!Number.isFinite(longMs)||longMs<1||longMs>10800000||!Number.isFinite(shortMs)||shortMs<1)throw Error('Invalid query deadlines')
const cpus=JSON.parse(execFileSync('python3',['-c','import os,json;print(json.dumps(sorted(os.sched_getaffinity(0))))'],{encoding:'utf8'}))
if(cpus.length<4)throw Error('Four independent allowed CPU cores are required for the four model choices')
const offset=Math.max(0,WIDE_CASE_IDS.indexOf(id))%4,cpuMapping=Object.fromEntries(MODELS.map((m,i)=>[m,cpus[(i+offset)%4]]))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const paths=['src/recommend.js','src/solver/score-team-enumerator.js','src/solver/query-models.js','src/solver/query-ai-model.js','src/solver/query-policies/T.js','src/solver/query-policies/N8192.js','scripts/all-score-teams-wide-fixtures.mjs','scripts/all-score-teams-wide-child.mjs','src/data/servants.json','src/data/ces.json','src/data/jp/bundle.json','src/data/bond-bonuses.json']
const previous=JSON.parse(readFileSync(new URL('../docs/test-results/2026-10-22-all-score-wide/matrix-actions-full.json',import.meta.url)))
const blobs=Object.fromEntries(paths.map(p=>[p,git('hash-object',p)]))
const state={schema:1,id,finished:false,status:'running',startedAt:new Date().toISOString(),longMs,shortMs,cpuMapping,
 source:{commit:git('rev-parse','HEAD'),gitBlobs:blobs,datasetsMatchArchived:Object.entries(previous.gitBlobs||{}).every(([p,h])=>blobs[p]===h)},
 environment:{node:process.version,cpu:os.cpus()[0].model,parallelism:os.availableParallelism(),allowedCpus:cpus},
 inputSha256:createHash('sha256').update(JSON.stringify(fixture.opts)).digest('hex'),domain:fixture.domain,
 method:'Four fresh single-core processes on distinct pinned cores of the same host; all short controls run together, then all long queries run together. Each long query has its own three-hour engine deadline. Result cache disabled. Query timing includes engine preparation, settlement samples and streaming team fingerprints; catalog startup and result archiving are recorded separately. No all-team journal.',
 archivedPrevious:previous.records.filter(r=>r.id===id),stages:{},progress:{},errors:[]}
const active=new Set();let lastSave=0,lastLog=0
function save(force=false){const now=performance.now();if(force||now-lastSave>=10000){writeJson(output,state);lastSave=now}if(now-lastLog>=60000){console.log(JSON.stringify({id,phase:state.phase,progress:Object.fromEntries(Object.entries(state.progress).map(([m,r])=>[m,{ms:r.ms,best:r.best,tiedTeams:r.tiedTeams,status:r.status}]))}));lastLog=now}}
const milestones=[15000,45000,60000,300000,900000,1800000,3600000,7200000,10800000]
async function run(model,stage,limit){return new Promise(resolveRow=>{
 const wallStart=performance.now(),child=fork(new URL('./all-score-teams-3h-child.mjs',import.meta.url),[id,model,String(limit)],{env:{...process.env,FGO_SCORE_CPU_CORE:String(cpuMapping[model])},execArgv:['--max-old-space-size=768'],stdio:['ignore','ignore','pipe','ipc']})
 active.add(child);let last=null,stderr='',done=false,affinityVerified=false,nextMilestone=0
 const finish=row=>{if(done)return;done=true;clearTimeout(timer);active.delete(child);delete state.progress[model];row={...row,id,model,cpuCore:cpuMapping[model],affinityVerified,wallMs:performance.now()-wallStart};state.stages[stage].models[model]=row;save(true);resolveRow(row)}
 const timer=setTimeout(()=>{child.kill('SIGKILL');finish({...last,status:'hard-timeout',complete:false,maximumProven:false,error:'The engine failed to yield by its deadline plus startup grace'})},limit+30000)
 child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-3000)})
 child.on('message',message=>{
  if(message.type==='affinity'){affinityVerified=message.verified&&message.core===cpuMapping[model];return}
  last=message.value;if(!last)return
  if(message.type==='progress'){
   state.progress[model]=last
   while(nextMilestone<milestones.length&&last.ms>=milestones[nextMilestone]){state.stages[stage].checkpoints[model].push({targetMs:milestones[nextMilestone++],...last});}
   save()
  }else if(message.type==='result')finish(last)
 })
 child.on('error',e=>finish({...last,status:'error',error:String(e),complete:false,maximumProven:false}))
 child.on('exit',(code,signal)=>{if(!done)finish({...last,status:'process-failure',code,signal,error:stderr,complete:false,maximumProven:false})})
})}
save(true)
try{
 for(const [stage,limit] of [['short',shortMs],['long',longMs]]){
  state.phase=stage;state.stages[stage]={limitMs:limit,startedAt:new Date().toISOString(),models:{},checkpoints:Object.fromEntries(MODELS.map(m=>[m,[]]))};save(true)
  const rows=await Promise.all(MODELS.map(m=>run(m,stage,limit)))
  state.stages[stage].endedAt=new Date().toISOString();state.errors.push(...validateRows(rows).map(e=>stage+': '+e));save(true)
 }
 for(const model of MODELS){const a=state.stages.short.models[model],b=state.stages.long.models[model];if(a.best!=null&&b.best!=null&&b.best<a.best)state.errors.push('Long run has a lower feasible score: '+model);if(!a.affinityVerified||!b.affinityVerified)state.errors.push('CPU affinity was not verified: '+model)}
 state.status=state.errors.length?'failed':'finished-with-explicit-timeout-classification'
}catch(error){state.errors.push(String(error.stack||error));state.status='failed'}
finally{for(const child of active)child.kill('SIGKILL');state.finished=true;state.endedAt=new Date().toISOString();save(true)}
console.log(JSON.stringify({id,status:state.status,errors:state.errors,short:Object.fromEntries(MODELS.map(m=>[m,state.stages.short?.models[m]?.status])),long:Object.fromEntries(MODELS.map(m=>[m,state.stages.long?.models[m]?.status]))}))
if(state.status==='failed')process.exitCode=1
