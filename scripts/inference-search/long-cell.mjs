// Publish numeric observations only. Plans and complete case payloads stay in RAM.
import {fork} from 'node:child_process'
import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import os from 'node:os'
import assert from 'node:assert/strict'
import {pressureCases} from './pressure-fixtures.mjs'
import {CONFIGS} from './configs.mjs'
import {validatePlan} from '../version-report-validate.mjs'
const [workArg,caseId,key,outArg,smokeDeadline]=process.argv.slice(2)
const work=resolve(workArg),out=resolve(outArg),request=JSON.parse(readFileSync(work+'/long-request.json'))
assert.ok(request.configs.includes(key));assert.ok(Object.hasOwn(request.cases,caseId))
const c=pressureCases().find(c=>c.id===caseId),config=CONFIGS[key]
assert.equal(c.sha256,request.cases[caseId],'Synthetic input differs from prior pressure input')
const deadlineMs=smokeDeadline?Number(smokeDeadline):request.deadlineMs
assert.ok(Number.isFinite(deadlineMs)&&deadlineMs>0&&deadlineMs<=10800000)
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const record={schema:1,requestId:request.requestId,caseId,key,inputSha256:c.sha256,kind:c.kind,
 deadlineMs,prefixMs:request.prefixMs,smoke:Boolean(smokeDeadline),status:'initializing',startedAt:new Date().toISOString(),
 productCommit:request.productCommit,harnessCommit:process.env.GITHUB_SHA||null,runId:process.env.GITHUB_RUN_ID||null,
 environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,availableParallelism:os.availableParallelism(),totalMemoryMiB:os.totalmem()/2**20},
 validatedCheckpoints:0,checkpoint:null,progress:{},inferenceCallsObserved:0,inferenceMsObserved:0,prefix:null,trace:[]}
mkdirSync(dirname(out),{recursive:true})
function save(){writeFileSync(out+'.tmp',JSON.stringify(record,null,2)+'\n');renameSync(out+'.tmp',out)}
save()
let began=0,finished=false,initTimer,deadlineTimer,prefixTimer,sampleTimer,child,latestCheckpoint=null
const numeric=(target,source,names)=>{for(const name of names)if(Number.isFinite(source?.[name]))target[name]=source[name]}
function elapsed(){return began?performance.now()-began:0}
function view(){return {observedMs:elapsed(),checkpoint:record.checkpoint,progress:{...record.progress},inferenceCallsObserved:record.inferenceCallsObserved,inferenceMsObserved:record.inferenceMsObserved}}
function sample(){record.observedMs=elapsed();record.trace.push(view());save();console.log(JSON.stringify({caseId,key,status:record.status,...view()}))}
function finish(status,extra={}){
 if(finished)return
 finished=true
 for(const t of [initTimer,deadlineTimer,prefixTimer])clearTimeout(t)
 clearInterval(sampleTimer)
 Object.assign(record,{status,observedMs:elapsed(),finishedAt:new Date().toISOString(),...extra})
 if(!record.prefix&&began&&record.observedMs>=request.prefixMs)record.prefix={...view(),lateObservation:true}
 record.trace.push(view());save()
 child?.kill('SIGKILL')
 console.log(JSON.stringify({caseId,key,status,observedMs:record.observedMs,inferenceCalls:record.inferenceCallsExact??record.inferenceCallsObserved,provenComplete:record.provenComplete||false}))
 if(!['complete','timeout'].includes(status))process.exitCode=1
}
function checkpoint(plan){
 validatePlan(c.opts,plan,c.kind==='core')
 const facts=c.kind==='core'?[plan.score,plan.cost]:[plan.total,plan.costUsed,plan.preferBond||0,plan.bond15Count||0,plan.priorityScore||0]
 assert.ok(facts.every(Number.isFinite),'Non-numeric checkpoint facts')
 record.validatedCheckpoints++
 record.checkpoint={facts,valid:true,sha256:hash(plan),observedMs:elapsed()}
 latestCheckpoint=plan // Never serialized to the published record.
}
child=fork(new URL('./long-child.mjs',import.meta.url),[],{stdio:['ignore','ignore','inherit','ipc'],serialization:'advanced'})
initTimer=setTimeout(()=>finish('init-timeout'),60000)
child.on('error',error=>finish('process-error',{errorSha256:hash(String(error))}))
child.on('exit',(code,signal)=>{if(!finished)finish('process-exit',{exitCode:code,signal})})
process.on('SIGTERM',()=>finish('interrupted'))
process.on('SIGINT',()=>finish('interrupted'))
child.on('message',m=>{
 if(finished)return
 try{
  if(m.type==='ready'){
   clearTimeout(initTimer);record.initMs=m.initMs;record.status='running';began=performance.now()
   deadlineTimer=setTimeout(()=>finish('timeout',{provenComplete:false,inferenceCountKind:'last-observed-lower-bound'}),deadlineMs)
   prefixTimer=setTimeout(()=>{record.prefix=view();save()},request.prefixMs)
   sampleTimer=setInterval(sample,request.sampleMs)
   save();child.send({id:1,opts:c.opts,aiMode:config.aiMode||'on'});return
  }
  if(m.type==='telemetry'){
   if(m.checkpoint)checkpoint(m.checkpoint)
   const progress=m.progress||m.worker?.progress||m.worker
   numeric(record.progress,progress,['nodes','evaluated','pruned','elapsed','elapsedMs','bestScore','bestCost','memoHits','memoMisses','seeded'])
   if(Number.isFinite(m.inferenceCalls))record.inferenceCallsObserved=Math.max(record.inferenceCallsObserved,m.inferenceCalls)
   if(Number.isFinite(m.inferenceMs))record.inferenceMsObserved=Math.max(record.inferenceMsObserved,m.inferenceMs)
   return
  }
  if(m.status==='ok'){
   assert.equal(m.valid,true);assert.ok(m.facts?.every(Number.isFinite))
   if(m.wireResult)validatePlan(c.opts,m.wireResult,false)
   record.inferenceCallsObserved=m.inferenceCalls;record.inferenceMsObserved=m.inferenceMs
   finish('complete',{valid:true,provenComplete:m.provenComplete===true,facts:m.facts,
    solveMs:m.ms,cpuMs:m.cpuMs,nodes:m.nodes,inferenceCallsExact:m.inferenceCalls,inferenceMsExact:m.inferenceMs,
    inferenceCountKind:'exact',heapMiB:m.heapMiB,rssMiB:m.rssMiB,validationMs:m.validationMs,cacheHit:m.cacheHit,
    alternativesSha256:m.alternatives?hash(m.alternatives):null})
  }else finish('solver-error',{errorSha256:hash(m.error||m.status||'unknown')})
 }catch(error){finish('validation-error',{errorSha256:hash(String(error))})}
})
child.send({type:'init',root:work+'/pressure/'+config.root,kind:c.kind,config,pressure:true})
