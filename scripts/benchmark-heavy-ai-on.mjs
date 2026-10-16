import { Worker } from 'node:worker_threads'
import { readFileSync,writeFileSync,mkdirSync,renameSync,existsSync,openSync,closeSync,unlinkSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { createHash,randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import os from 'node:os'
import { makeBenchmarkCase } from './ai-21-cases.mjs'
const folder='experiments/ai-heavy-comparison',roots={'2.0.0':resolve(process.env.FGO_HEAVY_200||'../teacher-200'),'2.1.1':resolve(process.env.FGO_HEAVY_211||'../fgo-211')},rounds=3
const hash=x=>createHash('sha256').update(x).digest('hex'),old=JSON.parse(gunzipSync(readFileSync('docs/test-results/ai-21-large.json.gz')))
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]
const ranked=old.records.filter(r=>r.id.startsWith('core-')).map(r=>{const a=r.runs.filter(x=>x.version==='2.0.0'&&x.status==='ok').map(x=>x.ms);return {index:r.seed-3100000,incomplete:a.length!==3,oldMs:a.length===3?median(a):null}}).sort((a,b)=>Number(b.incomplete)-Number(a.incomplete)||(b.oldMs??0)-(a.oldMs??0)||a.index-b.index).slice(0,96)
const specs=[...ranked.map(r=>({kind:'core',index:r.index,historicalBaselineMs:r.oldMs,historicalIncomplete:r.incomplete})),...Array.from({length:64},(_,index)=>({kind:'worker',index}))]
mkdirSync(folder+'/data',{recursive:true})
const runId=randomUUID(),lock=folder+'/data/run.lock',fd=openSync(lock,'wx');writeFileSync(fd,runId);closeSync(fd)
const versions=Object.fromEntries(Object.entries(roots).map(([v,root])=>[v,{commit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['-C',root,'status','--porcelain'],{encoding:'utf8'}).trim(),coreSha:hash(readFileSync(root+'/src/solver/inventory-curve-solver.js')),workerSha:hash(readFileSync(root+'/src/recommend-worker.js')),aiModelSha:v==='2.1.1'?hash(readFileSync(root+'/src/solver/ai-model.js')):null}]))
if(Object.values(versions).some(v=>v.dirty))throw Error('Benchmark source worktrees must be clean')
const plan={schema:1,runId,roots,versions,rounds,core:96,worker:64,searchDeadline:'none',aiMode211:'on',historicalRanking:'2.0.0 only; all 9 historical incomplete core cases retained, followed by slowest complete cases. Worker indices 0..63 fixed before fresh timings.',specs,caseGeneratorSha:hash(readFileSync('scripts/ai-21-cases.mjs')),workerAdapterSha:hash(readFileSync('scripts/heavy-ai-bench-worker.mjs'))}
const atomic=(path,value)=>{writeFileSync(path+'.tmp',typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flush:true});renameSync(path+'.tmp',path)}
atomic(folder+'/plan.json',plan)
const report={schema:1,runId,status:'running',startedAt:new Date().toISOString(),planSha:hash(readFileSync(folder+'/plan.json')),versions,rounds,searchDeadline:'none',aiMode211:'on',environment:{node:process.version,cpu:os.cpus()[0].model,parallelism:os.availableParallelism(),memoryBytes:os.totalmem()},records:[]}
const hosts=new Map();let current=null,cancelled=false
const beat=setInterval(()=>console.log('heavy',report.records.length,'/',specs.length,JSON.stringify(current)),15000)
process.once('SIGINT',()=>{cancelled=true;for(const w of hosts.values())w.terminate()})
async function getHost(version,kind){
 const key=version+kind;if(hosts.has(key))return hosts.get(key)
 const w=new Worker(new URL('./heavy-ai-bench-worker.mjs',import.meta.url),{workerData:{root:roots[version],kind,version},resourceLimits:{maxOldGenerationSizeMb:1024}})
 await new Promise((yes,no)=>{const clean=()=>{w.off('message',ok);w.off('error',bad);w.off('exit',exit)},ok=m=>{clean();m.ready?yes():no(Error('Worker not ready'))},bad=e=>{clean();no(e)},exit=c=>bad(Error('Worker startup exit '+c));w.once('message',ok);w.once('error',bad);w.once('exit',exit)})
 hosts.set(key,w)
 // Identical small fixtures warm module/JIT paths; never enter final timings.
 for(let j=0;j<4;j++){const c=makeBenchmarkCase(j,kind);await query(w,{...c,id:'warm-'+version+'-'+kind+'-'+j})}
 return w
}
function query(w,c){return new Promise((yes,no)=>{
 const clean=()=>{w.off('message',ok);w.off('error',bad);w.off('exit',exit)},ok=m=>{if(m.id===c.id){clean();yes(m)}},bad=e=>{clean();no(e)},exit=c=>bad(Error('Worker exited '+c))
 w.on('message',ok);w.once('error',bad);w.once('exit',exit);w.postMessage({id:c.id,opts:c.opts})
})}
try{
 // All hosts finish warmup before measured work begins, avoiding order bias.
 for(const kind of ['core','worker'])for(const v of Object.keys(roots))await getHost(v,kind)
 for(let i=0;i<specs.length;i++){
  if(cancelled)throw Error('Manually cancelled')
  const spec=specs[i],c=makeBenchmarkCase(spec.index,spec.kind),row={...spec,id:c.id,inputSha:c.sha256,region:c.region,cohort:c.cohort,identities:c.opts.servants.length,ceCopies:(c.opts.ownCes||c.opts.ces).length,runs:[]}
  for(let round=0;round<rounds;round++){
   const order=(i+round)%2?['2.1.1','2.0.0']:['2.0.0','2.1.1']
   for(const version of order){
    current={number:i+1,kind:spec.kind,index:spec.index,round,version,startedAt:new Date().toISOString()}
    const start=performance.now(),r=await query(await getHost(version,spec.kind),{...c,id:i+'-'+round+'-'+version})
    r.wallMs=performance.now()-start;r.version=version;r.round=round
    if(r.status!=='ok')throw Error(JSON.stringify(r))
    if(r.cacheHit)throw Error('Cold benchmark hit result cache')
    if(version==='2.1.1'&&r.facts!==null&&!r.ai?.enabled)throw Error('AI not active on successful 2.1.1 query: '+JSON.stringify({current,ai:r.ai,source:r.source}))
    row.runs.push(r)
   }
  }
  row.match=new Set(row.runs.map(r=>JSON.stringify(r.facts))).size===1
  report.records.push(row)
  if(!row.match)console.log('RESULT MISMATCH',row.id)
  if(report.records.length%10===0){atomic(folder+'/data/checkpoint.json',report);console.log('completed',report.records.length)}
 }
 report.status='complete';report.endedAt=new Date().toISOString();current=null
 const bytes=JSON.stringify(report)+'\n';atomic(folder+'/data/runs.json',bytes)
 atomic(folder+'/integrity.json',{status:'complete',runId,queries:report.records.length,uniqueInputs:new Set(report.records.map(r=>r.inputSha)).size,measurements:report.records.reduce((n,r)=>n+r.runs.length,0),sha256:hash(bytes),bytes:Buffer.byteLength(bytes),allMatches:report.records.every(r=>r.match),aiForcedOn:true,deadline:'none'})
 console.log('COMPLETE',report.records.length,'matched',report.records.filter(r=>r.match).length,hash(bytes))
}catch(e){report.status=cancelled?'cancelled':'failed';report.error=String(e.stack||e);report.current=current;atomic(folder+'/data/interrupted-'+runId+'.json',report);console.error(report.error);process.exitCode=1}
finally{clearInterval(beat);for(const w of hosts.values())await w.terminate();if(existsSync(lock)&&readFileSync(lock,'utf8')===runId)unlinkSync(lock)}
