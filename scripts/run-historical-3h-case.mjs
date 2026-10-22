import {fork,execFileSync} from 'node:child_process'
import {readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import os from 'node:os'
import {wideFixture,WIDE_CASE_IDS} from './all-score-teams-wide-fixtures.mjs'
import {writeJson} from './all-score-teams-3h-lib.mjs'
import {COHORTS,VERSIONS,versionRoot,CURRENT_SOURCE} from './historical-3h-versions.mjs'
const [id,cohort]=process.argv.slice(2),versions=COHORTS[cohort],fixture=wideFixture(id)
if(!versions)throw Error('Unknown cohort '+cohort)
const limitMs=Number(process.env.FGO_HISTORY_LIMIT_MS||10800000),output=resolve(process.env.FGO_HISTORY_OUTPUT||'test-output/historical-3h/'+id+'-'+cohort+'/cell.json')
if(!Number.isFinite(limitMs)||limitMs<1||limitMs>10800000)throw Error('Invalid limit')
const cpus=JSON.parse(execFileSync('python3',['-c','import os,json;print(json.dumps(sorted(os.sched_getaffinity(0))))'],{encoding:'utf8'}))
if(cpus.length<4)throw Error('Four distinct CPU cores required')
const offset=WIDE_CASE_IDS.indexOf(id)%4,cpuMapping=Object.fromEntries(versions.map((v,i)=>[v,cpus[(i+offset)%4]]))
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim()
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=Object.fromEntries(versions.map(v=>{
 const root=versionRoot(v),localSnapshot=process.env.FGO_HISTORY_LOCAL_SMOKE==='1'&&!v.startsWith('current-'),actual=localSnapshot?readFileSync(root+'/SOURCE_COMMIT','utf8').trim():git(root,'rev-parse','HEAD'),expected=v.startsWith('current-')?(process.env.FGO_HISTORY_CANDIDATE_SHA||actual):VERSIONS[v].ref
 if(actual!==expected)throw Error('Unexpected source '+v+': '+actual)
 return [v,{...VERSIONS[v],checkoutCommit:actual,runtimeReference:v.startsWith('current-')?CURRENT_SOURCE:actual,
  recommendSha256:hash(readFileSync(root+'/src/recommend.js')),coreSha256:hash(readFileSync(root+'/src/solver/inventory-curve-solver.js')),modelSha256:v==='v200'?null:hash(readFileSync(root+'/src/solver/ai-model.js')),
  runtimeSha256:Object.fromEntries(['src/solver/ai-search.js','src/solver/query-ai.js','src/solver/query-ai-model.js','src/solver/query-models.js','src/solver/query-policies/T.js','src/solver/query-policies/N8192.js'].filter(p=>existsSync(root+'/'+p)).map(p=>[p,hash(readFileSync(root+'/'+p))]))}]
}))
const state={schema:1,id,cohort,finished:false,status:'running',localSmoke:process.env.FGO_HISTORY_LOCAL_SMOKE==='1',startedAt:new Date().toISOString(),limitMs,cpuMapping,sources,
 inputSha256:hash(JSON.stringify(fixture.opts)),datasetSha256:Object.fromEntries(['src/data/servants.json','src/data/ces.json','src/data/jp/bundle.json','src/data/bond-bonuses.json'].map(p=>[p,hash(readFileSync(p))])),domain:fixture.domain,
 environment:{node:process.version,cpu:os.cpus()[0].model,allowedCpus:cpus},models:{},progress:{},checkpoints:Object.fromEntries(versions.map(v=>[v,[]])),errors:[],
 method:'Unmodified native recommendTeam for every version; same serialized fixture and current exact settlement validator; cold fresh processes; distinct pinned cores; no result cache or index input. Three-hour deadline starts before native preparation. Same-host current-off anchor in every cohort. Complete native result does not mean complete tied-team enumeration.'}
let lastSave=0,lastLog=0
function save(force=false){const now=performance.now();if(force||now-lastSave>=10000){writeJson(output,state);lastSave=now}if(now-lastLog>=60000){console.log(JSON.stringify({id,cohort,done:Object.keys(state.models),progress:state.progress}));lastLog=now}}
const active=new Set(),milestones=[15000,45000,60000,300000,900000,1800000,3600000,7200000,10800000]
async function run(version){return new Promise(resolveRow=>{
 const wallStart=performance.now(),child=fork(new URL('./historical-3h-child.mjs',import.meta.url),[id,version],{env:{...process.env,FGO_SCORE_CPU_CORE:String(cpuMapping[version])},execArgv:['--max-old-space-size=768'],stdio:['ignore','ignore','pipe','ipc']})
 active.add(child);let done=false,started=null,timer,last={},stderr='',affinityVerified=false,next=0
 const finish=row=>{if(done)return;done=true;clearTimeout(timer);active.delete(child);delete state.progress[version];state.models[version]={...row,version,cpuCore:cpuMapping[version],affinityVerified,wallMs:performance.now()-wallStart};save(true);resolveRow(state.models[version])}
 timer=setTimeout(()=>{child.kill('SIGKILL');finish({status:'startup-error',error:'Source import or startup exceeded 30 seconds',validated:false})},30000)
 child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-4000)})
 child.on('message',m=>{
  if(m.type==='affinity'){affinityVerified=m.verified&&m.core===cpuMapping[version];return}
  if(m.type==='started'){started=performance.now();clearTimeout(timer);timer=setTimeout(()=>{child.kill('SIGKILL');finish({...last,status:'timeout',ms:performance.now()-started,validated:false,maximumClaimed:false,allScoreTeamsComplete:false})},limitMs);return}
  if(m.type==='progress'){last=m.value;state.progress[version]=last;while(next<milestones.length&&last.ms>=milestones[next])state.checkpoints[version].push({targetMs:milestones[next++],...last});save();return}
  if(m.type==='result'){if(started!=null&&performance.now()-started>limitMs){child.kill('SIGKILL');finish({...m.value,status:'timeout',maximumClaimed:false,allScoreTeamsComplete:false})}else finish(m.value)}
 })
 child.on('error',e=>finish({status:'process-error',error:String(e),validated:false}))
 child.on('exit',(code,signal)=>{if(!done)finish({status:'process-error',code,signal,error:stderr,validated:false})})
})}
save(true)
try{
 const rows=await Promise.all(versions.map(run))
 for(const r of rows){if(!r.affinityVerified)state.errors.push('Unverified affinity '+r.version);if(!['complete','timeout'].includes(r.status))state.errors.push(r.version+': '+(r.error||r.status))}
 const complete=rows.filter(r=>r.status==='complete'&&r.validated)
 if(new Set(complete.map(r=>r.score)).size>1)state.errors.push('Native solvers disagree on primary maximum')
 state.status=state.errors.length?'failed':'finished-with-explicit-timeouts'
}catch(e){state.errors.push(String(e.stack||e));state.status='failed'}
finally{for(const c of active)c.kill('SIGKILL');state.finished=true;state.endedAt=new Date().toISOString();save(true)}
console.log(JSON.stringify({id,cohort,status:state.status,errors:state.errors,models:Object.fromEntries(Object.entries(state.models).map(([v,r])=>[v,{status:r.status,score:r.score,ms:r.ms}]))}))
if(state.errors.length)process.exitCode=1
