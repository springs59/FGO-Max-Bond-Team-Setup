import { Worker } from 'node:worker_threads'
import { mkdirSync, existsSync, readFileSync, openSync, writeSync, fsyncSync, closeSync, writeFileSync, statSync, appendFileSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { GENERAL_SPLITS } from './general-ai-cases.mjs'
const folder='experiments/ai-general',n=+(process.env.FGO_GENERAL_TRAIN||30000),workers=+(process.env.FGO_GENERAL_WORKERS||4),file=process.env.FGO_GENERAL_DATA_FILE||folder+'/data/teacher-rows.jsonl'
const sourceSha=createHash('sha256').update(readFileSync(new URL('./general-ai-cases.mjs',import.meta.url))).update(readFileSync(new URL('./general-ai-solver.mjs',import.meta.url))).update(readFileSync(new URL('./general-ai-policy.mjs',import.meta.url))).digest('hex'),started=Date.now()
mkdirSync(folder+'/data',{recursive:true});mkdirSync(folder+'/reports',{recursive:true})
const previous=existsSync(file)?readFileSync(file,'utf8').split('\n').filter(Boolean).map(JSON.parse):[]
if(previous.length&&(!existsSync(file+'.source')||readFileSync(file+'.source','utf8').trim()!==sourceSha))throw Error('Source changed; use a new dataset path instead of mixing labels')
writeFileSync(file+'.source',sourceSha+'\n',{flush:true})
const done=new Set(previous.filter(r=>r.status==='ok').map(r=>r.index)),tasks=Array.from({length:n},(_,index)=>index).filter(i=>!done.has(i))
const fd=openSync(file,'a'),report={schema:3,sourceSha,searchTimeLimit:'none',requested:n,priorComplete:done.size,workers,status:'running',completed:done.size,errors:[],source:'Independent semantic generator A; no catalog captures; single/double mechanism families',families:GENERAL_SPLITS.train.families,ordinaryQueryDiskWrites:0}
let cursor=0;const jobs=new Map(),save=()=>{fsyncSync(fd);writeFileSync(folder+'/reports/teacher.json',JSON.stringify({...report,active:[...jobs.values()],elapsedSeconds:(Date.now()-started)/1000,bytes:statSync(file).size},null,2)+'\n',{flush:true})}
const heartbeat=setInterval(()=>{save();console.log('teacher',report.completed,'/',n,'active',[...jobs.values()].map(x=>x.index))},15000)
async function consume(slot){
 const w=new Worker(new URL('./general-ai-teacher-worker.mjs',import.meta.url),{workerData:{slot},resourceLimits:{maxOldGenerationSizeMb:768}})
 await new Promise((yes,no)=>{w.once('message',m=>m.ready?yes():no(Error('not ready')));w.once('error',no)})
 try{for(;;){const i=cursor++;if(i>=tasks.length)break;const index=tasks[i];jobs.set(slot,{index,startedAt:new Date().toISOString()})
   const row=await new Promise((yes,no)=>{const cleanup=()=>{w.off('message',message);w.off('error',error);w.off('exit',exit)},message=m=>{cleanup();yes(m)},error=e=>{cleanup();no(e)},exit=code=>error(Error('Teacher exited '+code));w.once('message',message);w.once('error',error);w.once('exit',exit);w.postMessage({split:'train',index})})
   appendFileSync(file,JSON.stringify(row)+'\n',{flush:true});report.completed++;if(row.status!=='ok')report.errors.push({index,error:row.error})
   if(report.completed%200===0){save();console.log('teacher',report.completed,'/',n)}
   if(statSync(file).size>80*1024**2)throw Error('Training dataset exceeded explicit 80 MiB storage budget')
  }}finally{jobs.delete(slot);await w.terminate()}
}
try{await Promise.all(Array.from({length:workers},(_,i)=>consume(i)));const bytes=readFileSync(file),rows=bytes.toString().trim().split('\n').map(JSON.parse);if(rows.length!==n||new Set(rows.map(r=>r.index)).size!==n)throw Error('Incomplete teacher records');writeFileSync(file+'.sealed',bytes,{flush:true});renameSync(file+'.sealed',file);report.recordIntegrity={rows:rows.length,uniqueIndices:n,atomicSealed:true};report.status=report.errors.length?'failed':'complete';report.sha256=createHash('sha256').update(readFileSync(file)).digest('hex');save()}
finally{clearInterval(heartbeat);save();closeSync(fd)}
if(report.errors.length)process.exitCode=1
