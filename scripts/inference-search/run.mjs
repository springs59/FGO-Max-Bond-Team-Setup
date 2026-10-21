import {fork} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import os from 'node:os'
import {validatePlan} from '../version-report-validate.mjs'
import {CONFIGS} from './configs.mjs'
const work=resolve(process.argv[2]),stage=process.argv[3],pressure=stage==='pressure'
const cases=JSON.parse(readFileSync(work+'/cases.json','utf8')).filter(c=>c.stage===stage)
const keys=process.env.FGO_SEARCH_KEYS?process.env.FGO_SEARCH_KEYS.split(','):Object.keys(CONFIGS)
for(const key of keys)if(!CONFIGS[key])throw Error(key)
const rounds=+(process.env.FGO_SEARCH_ROUNDS||(pressure?1:stage==='screen'?3:5)),warmups=pressure?0:stage==='screen'?1:2
const deadline=+(process.env.FGO_SEARCH_DEADLINE||(pressure?30000:60000))
mkdirSync(work+'/results',{recursive:true})
const output=work+'/results/'+stage+'.json'
const report={schema:2,status:'running',startedAt:new Date().toISOString(),stage,configs:Object.fromEntries(keys.map(k=>[k,CONFIGS[k]])),
 manifest:JSON.parse(readFileSync(work+'/adaptive-manifest.json','utf8')),cases:cases.map(({opts,...c})=>c),
 method:{rounds,warmups,deadline,sequential:true,rotatingOrder:true,cache:false,fixedInferenceLimit:null,
  pressureTelemetry:pressure?'Exact incumbent callbacks and progress shared by all pressure variants; do not mix with uninstrumented timings':null,
  timing:'Selection uses ms: core solve or complete Worker handler, all inference included; IPC/import/validation excluded. Secondary response time is roundTripMs minus validationMs',memory:'per-case maxRSS includes imports, input and all preceding rounds'},
 environment:{node:process.version,cpu:os.cpus()[0].model,arch:process.arch,cores:os.availableParallelism()},records:[]}
const persist=()=>{const temp=output+'.tmp';writeFileSync(temp,JSON.stringify(report)+'\n');rename(temp,output)}
import {renameSync as rename} from 'node:fs'
persist();let serial=0
async function start(key,c){
 const config=CONFIGS[key],root=work+(pressure?'/pressure/':'/variants/')+config.root
 const p=fork(new URL('./child.mjs',import.meta.url),[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced'})
 const h={p,dead:false,stderr:''};p.stderr.on('data',b=>h.stderr=(h.stderr+b).slice(-3000))
 h.ready=await new Promise((yes,no)=>{const timer=setTimeout(()=>{h.dead=true;p.kill('SIGKILL');no(Error('init deadline'))},30000)
  p.once('message',m=>{clearTimeout(timer);m.type==='ready'?yes(m):no(Error(JSON.stringify(m)))})
  p.once('exit',()=>{h.dead=true;clearTimeout(timer);no(Error('init exit '+h.stderr))})
  p.send({type:'init',root,kind:c.kind,config,pressure})
 });return h
}
async function run(h,key,c,round){
 if(h.dead)return{key,round,status:'not-run-after-stop'}
 const id=++serial,began=performance.now(),telemetry=[];let checkpoint=null,progress=null,calls=null
 return new Promise(yes=>{
  let finished=false
  const finish=m=>{if(finished)return;finished=true;clearTimeout(timer);h.p.off('message',receive);h.p.off('exit',exit)
   const {wireResult,...safe}=m
   if(checkpoint){try{validatePlan(c.opts,checkpoint,c.kind==='core');safe.checkpointValid=true}catch(e){safe.checkpointValidationError=String(e.stack||e)}}
   yes({key,round,...safe,roundTripMs:performance.now()-began,...(pressure?{telemetry,lastCheckpoint:checkpoint,lastProgress:progress,observedInferenceCalls:calls}:{})})
  }
  const timer=setTimeout(()=>{h.dead=true;h.p.kill('SIGKILL');finish({status:'deadline',observedMs:performance.now()-began})},deadline)
  const receive=m=>{
   if(m.id!==id)return
   if(m.type==='telemetry'){
    if(m.checkpoint)checkpoint=m.checkpoint
    if(m.progress||m.worker?.progress)progress=m.progress||m.worker.progress
    if(Number.isFinite(m.inferenceCalls))calls=m.inferenceCalls
    const elapsedMs=performance.now()-began
    if(telemetry.length<200&&(m.checkpoint||!telemetry.length||elapsedMs-telemetry.at(-1).elapsedMs>1000))telemetry.push({elapsedMs,checkpoint:checkpoint?{score:checkpoint.score??checkpoint.total,cost:checkpoint.cost??checkpoint.costUsed}:null,progress,calls})
    return
   }
   finish(m)
  }
  const exit=(code,signal)=>{h.dead=true;finish({status:'process-exit',code,signal,stderr:h.stderr})}
  h.p.on('message',receive);h.p.once('exit',exit);h.p.send({id,opts:c.opts,aiMode:CONFIGS[key].aiMode||'on'})
 })
}
const heartbeat=setInterval(persist,10000)
try{
 for(const [index,c]of cases.entries()){
  const row={id:c.id,sha256:c.sha256,kind:c.kind,startup:{},warmups:[],runs:[]};report.active=row;persist();const hosts={}
  try{
   for(const key of keys)hosts[key]=await start(key,c)
   for(const key of keys)row.startup[key]=hosts[key].ready
   for(let round=-warmups;round<rounds;round++){
    const order=keys.slice(),offset=(index+round+keys.length)%keys.length;order.push(...order.splice(0,offset))
    for(const key of order){report.active.latest={key,round};persist();const r=await run(hosts[key],key,c,round);(round<0?row.warmups:row.runs).push(r);persist()}
   }
  }finally{for(const h of Object.values(hosts))h.p.kill('SIGKILL')}
  delete row.latest;const ok=row.runs.filter(r=>r.status==='ok')
  row.complete=ok.length===keys.length*rounds
  row.objectivesAgree=new Set(ok.map(r=>JSON.stringify(r.facts))).size<=1
  row.alternativesAgree=new Set(ok.filter(r=>r.alternatives).map(r=>JSON.stringify(Object.entries(r.alternatives).sort(([a],[b])=>a.localeCompare(b))))).size<=1
  row.checkpointsValid=row.runs.every(r=>!r.checkpointValidationError)
  report.records.push(row);delete report.active;persist()
  console.log(JSON.stringify({finished:report.records.length,total:cases.length,id:c.id,complete:row.complete,agree:row.objectivesAgree,alternatives:row.alternativesAgree,checkpoints:row.checkpointsValid,errors:row.runs.filter(r=>r.status==='error').map(r=>({key:r.key,error:r.error}))}))
  if(!row.objectivesAgree||!row.alternativesAgree||!row.checkpointsValid||row.runs.some(r=>r.status==='error'||r.cacheHit))throw Error('correctness gate '+c.id)
 }
 report.status='complete';report.endedAt=new Date().toISOString()
}finally{clearInterval(heartbeat);persist()}
