import {fork,execFileSync} from 'node:child_process'
import {readFileSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import os from 'node:os'
import {wideFixture,WIDE_CASE_IDS} from './comprehensive-3h-fixtures.mjs'
import {VERSIONS,ANCHOR,SMALL,runtimeRoot,expectedCommit,RUNTIME_FILES,DATA_FILES} from './comprehensive-3h-config.mjs'
import {hostMemoryBudget,classifyExit,processPeakRssMiB} from './historical-3h-memory.mjs'
import {writeJson} from './all-score-teams-3h-lib.mjs'
const [id,contender]=process.argv.slice(2),variants=[contender,ANCHOR],fixture=wideFixture(id)
if(!VERSIONS[contender]||contender===ANCHOR)throw Error('Unknown contender')
const limitMs=Number(process.env.FGO_COMPARE_LIMIT_MS||10800000),output=resolve(process.env.FGO_COMPARE_OUTPUT||`test-output/comprehensive/${id}-${contender}/cell.json`)
if(!Number.isFinite(limitMs)||limitMs<1||limitMs>10800000)throw Error('Invalid query deadline')
const smoke=process.env.FGO_COMPARE_SMOKE==='1',hash=b=>createHash('sha256').update(b).digest('hex')
const git=(root,...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim()
const sources=Object.fromEntries(variants.map(v=>{
 const root=runtimeRoot(v),expected=expectedCommit(v),actual=smoke&&existsSync(root+'/SOURCE_COMMIT')?readFileSync(root+'/SOURCE_COMMIT','utf8').trim():git(root,'rev-parse','HEAD')
 // The current checkout may add harness/report files, but production source
 // must remain byte-for-byte identical to the frozen candidate commit.
 if(!smoke){if(VERSIONS[v].source==='current')git(root,'diff','--exit-code',expected,'--','src/','native/shared/');else if(actual!==expected)throw Error('Wrong baseline '+v)}
 return [v,{expectedCommit:expected,checkoutCommit:actual,mode:VERSIONS[v].mode,model:VERSIONS[v].model,
  files:Object.fromEntries(RUNTIME_FILES.filter(p=>existsSync(root+'/'+p)).map(p=>[p,hash(readFileSync(root+'/'+p))]))}]
}))
const cpus=JSON.parse(execFileSync('python3',['-c','import os,json;print(json.dumps(sorted(os.sched_getaffinity(0))))'],{encoding:'utf8'}))
if(cpus.length<2)throw Error('Two independent allowed CPU cores required')
const memory=hostMemoryBudget(2,'paired-auto'),offset=WIDE_CASE_IDS.indexOf(id)%cpus.length
const state={schema:2,id,contender,anchor:ANCHOR,finished:false,status:'running',localSmoke:smoke,limitMs,
 startedAt:new Date().toISOString(),sources,memory,inputSha256:hash(JSON.stringify(fixture.opts)),
 datasetSha256:Object.fromEntries(DATA_FILES.map(p=>[p,hash(readFileSync(p))])),domain:fixture.domain,
 environment:{node:process.version,cpu:os.cpus()[0].model,allowedCpus:cpus},rounds:[],progress:{},errors:[],
 method:'Unmodified pinned solver sources, one contender and current group-off on the same host, distinct verified CPU cores, same per-process adaptive heap cap (max 6 GiB), cold processes and shared frozen inputs. Small fast pairs repeat three rounds with swapped cores. Engine and validation/startup timing separated. Native representative results and full recoverable optimum coverage classified separately.'}
let lastSave=0,lastLog=0
function save(force=false){const now=performance.now();if(force||now-lastSave>=10000){writeJson(output,state);lastSave=now}
 if(now-lastLog>=60000){console.log(JSON.stringify({id,contender,round:state.rounds.length,progress:state.progress}));lastLog=now}}
const active=new Set(),milestones=[15000,45000,60000,300000,900000,1800000,3600000,7200000,10800000]
async function run(version,round){return new Promise(resolveRow=>{
 const cpu=cpus[(offset+(variants.indexOf(version)+round)%2)%cpus.length],wallStart=performance.now()
 const child=fork(new URL('./comprehensive-3h-child.mjs',import.meta.url),[id,version,String(limitMs)],
  {env:{...process.env,FGO_SCORE_CPU_CORE:String(cpu)},execArgv:['--max-old-space-size='+memory.heapMiB],stdio:['ignore','ignore','pipe','ipc']})
 active.add(child);let done=false,started=null,timer,last={},stderr='',affinity=false,peak=0,next=0,engineDone=false
 const checkpoints=[],monitor=setInterval(()=>{peak=Math.max(peak,processPeakRssMiB(child.pid));save()},1000)
 const finish=row=>{if(done)return;done=true;clearTimeout(timer);clearInterval(monitor);active.delete(child);delete state.progress[version]
  resolveRow({...row,version,round,cpuCore:cpu,affinityVerified:affinity,wallMs:performance.now()-wallStart,heapLimitMiB:memory.heapMiB,
   maxRssMiB:Math.max(peak,row.maxRssMiB||0)||null,checkpoints})}
 const timeout=()=>{child.kill('SIGKILL');finish({...last,status:'timeout',ms:started==null?null:performance.now()-started,validated:Boolean(last.bestValidated),
  maximumProvenInUnifiedDomain:false,allOptimalCovered:false,engineDeadlineEnforced:true})}
 timer=setTimeout(()=>{child.kill('SIGKILL');finish({status:'startup-error',error:'Imports/startup exceeded 60 seconds',validated:false})},60000)
 child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-4000)})
 child.on('message',m=>{
  if(m.type==='affinity'){affinity=m.verified&&m.core===cpu;return}
  if(m.type==='started'){started=performance.now();clearTimeout(timer);timer=setTimeout(timeout,limitMs);return}
  if(m.type==='engine-done'){engineDone=true;clearTimeout(timer);timer=setTimeout(()=>{child.kill('SIGKILL');finish({...last,status:'validation-error',error:'Post-engine checks exceeded 120 seconds'})},120000);return}
  if(m.type==='progress'){
   last=m.value;state.progress[version]=last
   while(next<milestones.length&&last.ms>=milestones[next])checkpoints.push({targetMs:milestones[next++],...last})
   save();return
  }
  if(m.type==='result'){
   if(!engineDone&&started!=null&&performance.now()-started>limitMs+1000){timeout();return}
   finish(m.value)
  }
 })
 child.on('error',e=>finish({status:'process-error',error:String(e),validated:false}))
 child.on('exit',(code,signal)=>{if(!done)finish({...last,status:classifyExit(stderr),code,signal,error:stderr,validated:false,
  ms:started==null?null:performance.now()-started,maximumProvenInUnifiedDomain:false,allOptimalCovered:false})})
})}
save(true)
try{
 let wanted=1
 for(let round=0;round<wanted;round++){
  const rows=await Promise.all(variants.map(v=>run(v,round)))
  state.rounds.push({round,rows});save(true)
  for(const r of rows){
   if(!r.affinityVerified)state.errors.push('CPU affinity unverified: '+r.version)
   if(!['complete','timeout'].includes(r.status))state.errors.push(r.version+': '+(r.error||r.status))
   if(r.status==='timeout'&&(r.maximumProvenInUnifiedDomain||r.allOptimalCovered))state.errors.push('Timeout incorrectly claimed complete: '+r.version)
  }
  if(round===0&&SMALL.has(id)&&process.env.FGO_COMPARE_NO_REPEAT!=='1'&&rows.every(r=>r.status==='complete'&&r.ms<30000))wanted=3
 }
 state.status=state.errors.length?'finished-with-recorded-errors':'finished-with-explicit-timeouts'
}catch(error){state.errors.push(String(error.stack||error));state.status='infrastructure-failure'}
finally{for(const child of active)child.kill('SIGKILL');state.finished=true;state.endedAt=new Date().toISOString();save(true)}
console.log(JSON.stringify({id,contender,status:state.status,rounds:state.rounds.length,errors:state.errors}))
// Keep every solver error as evidence. The report decides infrastructure
// failure, illegal outputs and cross-version correctness findings separately.
if(state.status==='infrastructure-failure')process.exitCode=1
