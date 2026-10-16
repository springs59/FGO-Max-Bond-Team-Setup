import {Worker} from 'node:worker_threads'
import {createWriteStream,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs'
import {createGzip,gunzipSync} from 'node:zlib'
import {pipeline} from 'node:stream/promises'
import {once} from 'node:events'
import {createHash} from 'node:crypto'
import {FAMILIES,DATA_SHA,SPLIT_SEEDS} from './ai-diverse-cases.mjs'
const counts={train:+(process.env.FGO_TRAIN_QUERIES||12000),validation:+(process.env.FGO_VALIDATION_QUERIES||2400),test:+(process.env.FGO_TEST_QUERIES||2400)},parallel=+(process.env.FGO_LABEL_WORKERS||4),timeout=+(process.env.FGO_LABEL_TIMEOUT_MS||0),folder=process.env.FGO_TRAIN_OUTPUT||'experiments/ai-diverse'
if(!process.env.FGO_AI_TEACHER_BASELINE)throw Error('Set FGO_AI_TEACHER_BASELINE to an independent native-v2.0.0 checkout')
mkdirSync(folder+'/data',{recursive:true});mkdirSync(folder+'/reports',{recursive:true})
const report={schema:1,startedAt:new Date().toISOString(),status:'running',dataSha256:DATA_SHA,seedRanges:SPLIT_SEEDS,families:FAMILIES,counts,parallel,timeoutMs:timeout,searchTimeLimit:timeout>0?'explicit-user-override':'none',teacher:'Unchanged 2.1 aiMode:off (2.0.0 exact core plus retained correctness fixes); observation-only general probe. Independent native-v2.0.0 inventory parity and uninstrumented general parity checked on first 240 queries per split.',splits:{},errors:[]}
for(const split of Object.keys(counts))report.splits[split]={attempted:0,feasible:0,infeasible:0,timeouts:0,errors:0,equipmentSamples:0,servantSamples:0,families:{}}
const writes=[]
const outputs=Object.fromEntries(Object.keys(counts).map(split=>{const gz=createGzip({level:6});writes.push(pipeline(gz,createWriteStream(folder+'/data/'+split+'.jsonl.gz.tmp')));return [split,gz]}))
const tasks=Object.entries(counts).flatMap(([split,n])=>Array.from({length:n},(_,index)=>({split,index}))),started=Date.now();let next=0,finished=0
const persist=()=>{report.elapsedSeconds=(Date.now()-started)/1000;writeFileSync(folder+'/reports/dataset.json',JSON.stringify(report,null,2)+'\n')}
async function makeHost(slot){const w=new Worker(new URL('./ai-diverse-worker.mjs',import.meta.url),{workerData:{slot,baseline:process.env.FGO_AI_TEACHER_BASELINE},resourceLimits:{maxOldGenerationSizeMb:768}});await new Promise((resolve,reject)=>{w.once('message',m=>m.ready?resolve():reject(Error('Not ready')));w.once('error',reject)});return w}
async function run(w,task,id){return await new Promise(resolve=>{const finish=value=>{clearTimeout(timer);w.off('message',message);w.off('error',error);w.off('exit',exited);resolve(value)},message=m=>{if(m.id===id)finish(m)},error=e=>finish({status:'error',error:String(e)}),exited=code=>finish({status:'error',error:'Teacher worker exited '+code});const timer=timeout>0?setTimeout(()=>finish({status:'timeout'}),timeout):null;w.on('message',message);w.once('error',error);w.once('exit',exited);w.postMessage({...task,id,labels:true,mode:'off',parity:task.index<240})})}
async function consume(slot){let w=await makeHost(slot);try{for(;;){const index=next++;if(index>=tasks.length)break;const task=tasks[index],r=await run(w,task,index),family=FAMILIES[task.index%FAMILIES.length],s=report.splits[task.split];s.attempted++;s.families[family]??={attempted:0,feasible:0,infeasible:0,timeouts:0,errors:0,equipmentSamples:0,servantSamples:0};const f=s.families[family];f.attempted++
 if(r.status==='ok'){const status=r.facts?'feasible':'infeasible';s[status]++;f[status]++;for(const head of ['equipment','servant']){const n=r.labels?.[head]?.length||0;s[head+'Samples']+=n;f[head+'Samples']+=n}}
 else{const key=r.status==='timeout'?'timeouts':'errors';s[key]++;f[key]++;if(r.error)report.errors.push({...task,error:r.error})}
 const row={...task,family,...r};if(!outputs[task.split].write(JSON.stringify(row)+'\n'))await once(outputs[task.split],'drain')
 if(r.status!=='ok'){await w.terminate();w=await makeHost(slot)}
 finished++;if(finished%120===0){persist();console.log('labels',finished,'/',tasks.length,'seconds',Math.round((Date.now()-started)/1000))}
 }}finally{await w.terminate()}}
try{await Promise.all(Array.from({length:parallel},(_,i)=>consume(i)));for(const stream of Object.values(outputs))stream.end();await Promise.all(writes);report.files=Object.fromEntries(Object.keys(counts).map(split=>{const tmp=folder+'/data/'+split+'.jsonl.gz.tmp',dest=folder+'/data/'+split+'.jsonl.gz',b=readFileSync(tmp),rows=gunzipSync(b).toString().trim().split('\n').filter(Boolean).map(JSON.parse);if(rows.length!==counts[split]||new Set(rows.map(r=>r.index)).size!==counts[split])throw Error('Incomplete dataset '+split);renameSync(tmp,dest);return [split,{bytes:b.length,rows:rows.length,sha256:createHash('sha256').update(b).digest('hex')}]}));report.status='complete';report.endedAt=new Date().toISOString();persist();console.log(JSON.stringify(report.splits,null,2))}catch(error){report.status='failed';report.error=String(error.stack||error);persist();throw error}
