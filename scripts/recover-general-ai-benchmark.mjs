// Explicit recovery of a completed calculation whose append journal was short.
// Only missing conditions are recomputed. Paired timings stay within a query;
// the report discloses the two timing phases rather than hiding the recovery.
import { Worker } from 'node:worker_threads'
import { readFileSync,writeFileSync,renameSync,openSync,closeSync,unlinkSync,existsSync } from 'node:fs'
import { createHash,randomUUID } from 'node:crypto'
const folder='experiments/ai-general',split=process.env.FGO_GENERAL_SPLIT||'calibration'
const meta=JSON.parse(readFileSync(folder+'/reports/'+split+'-progress.json'))
if(meta.status!=='failed'||meta.completed!==meta.n||!meta.error?.includes('Incomplete or mixed durable records')||meta.errors.length)throw Error('Only explicit persistence failure recovery is supported')
const model=JSON.parse(readFileSync(JSON.parse(readFileSync(folder+'/reports/training.json')).selected))
if(model.version!==meta.model)throw Error('Model changed')
const rows=readFileSync(folder+'/data/'+split+'-'+meta.runId+'-runs.jsonl','utf8').trim().split('\n').map(JSON.parse),seen=new Set(rows.map(r=>r.index)),kernels=new Set(rows.map(r=>r.kernelSha))
if(rows.length!==seen.size||kernels.size!==1||rows.some(r=>r.status!=='ok'||r.runId!==meta.runId||r.modelVersion!==meta.model||r.index<0||r.index>=meta.n))throw Error('Mixed, duplicate or invalid surviving records')
const missing=Array.from({length:meta.n},(_,i)=>i).filter(i=>!seen.has(i)),runId=randomUUID(),lock=folder+'/data/benchmark.lock'
// Caller must establish that the failed process has exited before requesting recovery.
if(process.env.FGO_GENERAL_CONFIRM_FAILED_PROCESS_EXITED!=='1')throw Error('Confirm failed process exit explicitly before clearing its stale lock')
if(existsSync(lock)){if(readFileSync(lock,'utf8').trim()!==meta.runId)throw Error('Another process owns the lock');unlinkSync(lock)}
const fd=openSync(lock,'wx');writeFileSync(fd,runId);closeSync(fd)
const atomic=(path,value)=>{writeFileSync(path+'.tmp',typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flush:true});renameSync(path+'.tmp',path)}
const recovery={status:'running',originalRunId:meta.runId,recoveryRunId:runId,surviving:rows.length,missingIndices:missing,completed:0,startedAt:new Date().toISOString(),note:'Original calculation reached all requested conditions, but append persistence was incomplete. Surviving records retained; only missing conditions recomputed with identical frozen model, kernel, rounds and paired variant protocol. Timing phases are disclosed.'}
let current=null,worker
const beat=setInterval(()=>console.log('recovery',recovery.completed,'/',missing.length,'current',current),15000)
try{
 worker=new Worker(new URL('./general-ai-bench-worker.mjs',import.meta.url),{workerData:{model,gate:meta.gate},resourceLimits:{maxOldGenerationSizeMb:1024}})
 const request=message=>new Promise((yes,no)=>{const clean=()=>{worker.off('message',ok);worker.off('error',bad);worker.off('exit',exit)},ok=r=>{clean();yes(r)},bad=e=>{clean();no(e)},exit=c=>bad(Error('Worker exited '+c));worker.once('message',ok);worker.once('error',bad);worker.once('exit',exit);if(message)worker.postMessage(message)})
 if(!(await request()).ready)throw Error('Warmup failed')
 for(const index of missing){current=index;const startedAt=new Date().toISOString(),r=await request({split,index,rounds:meta.rounds})
  if(r.status!=='ok'||r.modelVersion!==meta.model||!kernels.has(r.kernelSha))throw Error('Recovery mismatch at '+index+': '+r.error)
  rows.push({...r,runId:meta.runId,recoveryRunId:runId,startedAt,finishedAt:new Date().toISOString()});recovery.completed++;console.log('recovered',index)
 }
 rows.sort((a,b)=>a.index-b.index)
 if(rows.length!==meta.n||new Set(rows.map(r=>r.index)).size!==meta.n)throw Error('Incomplete recovery')
 const bytes=Buffer.from(rows.map(r=>JSON.stringify(r)).join('\n')+'\n'),sha256=createHash('sha256').update(bytes).digest('hex')
 atomic(folder+'/data/'+split+'-'+runId+'-recovered-runs.jsonl',bytes);atomic(folder+'/data/'+split+'-runs.jsonl',bytes)
 const q=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(p*a.length))],sum=(a,k)=>a.reduce((s,r)=>s+r[k],0),active=rows.filter(r=>r.decision?.policy>0)
 const summary={queries:rows.length,feasible:rows.filter(r=>r.feasible).length,active:active.length,
  boundSumMs:sum(rows,'boundMs'),boundRatio:sum(rows,'boundMs')/sum(rows,'offMs'),boundMedian:q(rows.map(r=>r.boundMs),.5),offSumMs:sum(rows,'offMs'),onSumMs:sum(rows,'onMs'),ratio:sum(rows,'onMs')/sum(rows,'offMs'),offMedian:q(rows.map(r=>r.offMs),.5),onMedian:q(rows.map(r=>r.onMs),.5),offP95:q(rows.map(r=>r.offMs),.95),onP95:q(rows.map(r=>r.onMs),.95),exactParity:true,baselineWork:sum(rows,'work'),guidedWork:sum(rows,'guidedWork'),maxHeapUsed:Math.max(...rows.map(r=>r.heapUsed)),
  cohorts:Object.fromEntries([...new Set(rows.map(r=>r.family))].map(f=>{const a=rows.filter(r=>r.family===f);return [f,{queries:a.length,active:a.filter(r=>r.decision?.policy>0).length,ratio:sum(a,'onMs')/sum(a,'offMs'),offP95:q(a.map(r=>r.offMs),.95),onP95:q(a.map(r=>r.onMs),.95)}]}))}
 recovery.status='complete';recovery.finishedAt=new Date().toISOString();recovery.finalSha256=sha256
 const report={...meta,status:'complete',current:null,error:undefined,summary,integrity:{rows:rows.length,uniqueIndices:meta.n,sha256,atomicSealed:true,runId:meta.runId,recoveryRunId:runId},recovery}
 atomic(folder+'/reports/'+split+'.json',report);atomic(folder+'/reports/'+split+'-progress.json',report);atomic(folder+'/reports/'+split+'-persistence-recovery.json',recovery)
 console.log(JSON.stringify(summary,null,2))
}finally{clearInterval(beat);await worker?.terminate();if(existsSync(lock)&&readFileSync(lock,'utf8').trim()===runId)unlinkSync(lock)}
