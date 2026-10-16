import { Worker } from 'node:worker_threads'
import { mkdirSync,readFileSync,writeFileSync,appendFileSync,renameSync,openSync,closeSync,unlinkSync,existsSync } from 'node:fs'
import { createHash,randomUUID } from 'node:crypto'
const folder='experiments/ai-general',training=JSON.parse(readFileSync(folder+'/reports/training.json')),model=JSON.parse(readFileSync(process.env.FGO_GENERAL_MODEL||training.selected))
const split=process.env.FGO_GENERAL_SPLIT||'calibration',n=+(process.env.FGO_GENERAL_N||1500),rounds=+(process.env.FGO_GENERAL_ROUNDS||3)
if(!['calibration','validation','test'].includes(split)||!Number.isSafeInteger(n)||n<1||n>10000)throw Error('Invalid split or sample size')
const gate=split==='calibration'?null:JSON.parse(readFileSync(folder+'/models/gate.json'))
if(split==='test'){
 if(process.env.FGO_OPEN_GENERAL_TEST!=='1')throw Error('Test remains sealed')
 const v=JSON.parse(readFileSync(folder+'/reports/validation-qualification.json'))
 if(!v.passed||v.model!==model.version)throw Error('Matching performance validation must pass before sealed test')
}
mkdirSync(folder+'/reports',{recursive:true});mkdirSync(folder+'/data',{recursive:true})
const runId=randomUUID(),lock=folder+'/data/benchmark.lock',lockFd=openSync(lock,'wx')
writeFileSync(lockFd,runId);closeSync(lockFd)
const path=folder+'/data/'+split+'-'+runId+'-runs.jsonl',finalPath=folder+'/data/'+split+'-runs.jsonl',summaryPath=folder+'/reports/'+split+'.json',records=[]
writeFileSync(path,'',{flush:true})
const report={status:'running',schema:3,runId,split,n,rounds,model:model.version,gate,searchTimeLimit:'none',completed:0,errors:[],ordinaryQueryDiskWrites:0}
let current=null,worker,cancelled=false
const atomic=(path,value)=>{writeFileSync(path+'.tmp',JSON.stringify(value,null,2)+'\n',{flush:true});renameSync(path+'.tmp',path)}
const progress=()=>atomic(folder+'/reports/'+split+'-progress.json',{...report,current})
const heartbeat=setInterval(()=>{progress();console.log(split,records.length,'/',n,'current',current)},15000)
process.once('SIGINT',()=>{cancelled=true;worker?.terminate()})
const quantile=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(p*a.length))]??null
try{
 worker=new Worker(new URL('./general-ai-bench-worker.mjs',import.meta.url),{workerData:{model,gate},resourceLimits:{maxOldGenerationSizeMb:1024}})
 await new Promise((yes,no)=>{const clean=()=>{worker.off('message',message);worker.off('error',error);worker.off('exit',exit)},message=m=>{clean();m.ready?yes():no(Error('not ready'))},error=e=>{clean();no(e)},exit=c=>error(Error('Warmup worker exited '+c));worker.once('message',message);worker.once('error',error);worker.once('exit',exit)})
 for(let index=0;index<n;index++){
  if(cancelled)throw Error('Manually cancelled')
  current={index,startedAt:new Date().toISOString()}
  const r=await new Promise((yes,no)=>{const clean=()=>{worker.off('message',message);worker.off('error',error);worker.off('exit',exit)},message=m=>{clean();yes(m)},error=e=>{clean();no(e)},exit=c=>error(Error('Worker exited '+c));worker.once('message',message);worker.once('error',error);worker.once('exit',exit);worker.postMessage({split,index,rounds})})
  if(r.status==='ok'&&r.modelVersion!==model.version)throw Error('Mixed model versions')
  r.runId=runId;r.startedAt=current.startedAt;r.finishedAt=new Date().toISOString()
  records.push(r);appendFileSync(path,JSON.stringify(r)+'\n',{flush:true});report.completed++
  if(r.status!=='ok')report.errors.push({index,error:r.error})
  if(records.length%100===0){progress();console.log(split,records.length,'/',n)}
 }
 const bytes=readFileSync(path),durable=bytes.toString().trim().split('\n').map(JSON.parse)
 if(durable.length!==n||new Set(durable.map(r=>r.index)).size!==n||durable.some(r=>r.runId!==runId))throw Error('Incomplete or mixed durable records')
 writeFileSync(path+'.sealed',bytes,{flush:true});renameSync(path+'.sealed',finalPath)
 const good=records.filter(r=>r.status==='ok'),active=good.filter(r=>r.decision?.policy>0),sum=(rows,k)=>rows.reduce((s,r)=>s+r[k],0)
 report.status=report.errors.length?'failed':'complete'
 report.summary={queries:good.length,feasible:good.filter(r=>r.feasible).length,active:active.length,
  boundSumMs:sum(good,'boundMs'),boundRatio:sum(good,'boundMs')/sum(good,'offMs'),boundMedian:quantile(good.map(r=>r.boundMs),.5),
  offSumMs:sum(good,'offMs'),onSumMs:sum(good,'onMs'),ratio:sum(good,'onMs')/sum(good,'offMs'),offMedian:quantile(good.map(r=>r.offMs),.5),onMedian:quantile(good.map(r=>r.onMs),.5),offP95:quantile(good.map(r=>r.offMs),.95),onP95:quantile(good.map(r=>r.onMs),.95),
  exactParity:report.errors.length===0,baselineWork:sum(good,'work'),guidedWork:sum(good,'guidedWork'),maxHeapUsed:Math.max(...good.map(r=>r.heapUsed)),
  cohorts:Object.fromEntries([...new Set(good.map(r=>r.family))].map(f=>{const rows=good.filter(r=>r.family===f);return [f,{queries:rows.length,active:rows.filter(r=>r.decision?.policy>0).length,ratio:sum(rows,'onMs')/sum(rows,'offMs'),offP95:quantile(rows.map(r=>r.offMs),.95),onP95:quantile(rows.map(r=>r.onMs),.95)}]}))}
 report.integrity={rows:durable.length,uniqueIndices:n,sha256:createHash('sha256').update(readFileSync(finalPath)).digest('hex'),atomicSealed:true,runId}
 atomic(summaryPath,report);console.log(JSON.stringify(report.summary,null,2))
}catch(error){report.status=cancelled?'cancelled':'failed';report.error=String(error.stack||error);atomic(folder+'/reports/'+split+'-'+runId+'-interrupted.json',report);throw error}
finally{clearInterval(heartbeat);await worker?.terminate();current=null;progress();if(existsSync(lock)&&readFileSync(lock,'utf8')===runId)unlinkSync(lock)}
