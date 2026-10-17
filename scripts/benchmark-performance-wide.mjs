import {Worker} from 'node:worker_threads'
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {wideCases} from './performance-wide-cases.mjs'
const roots={'2.0.0':process.env.FGO_WIDE_200,'2.1.2':process.env.FGO_WIDE_212,'2.1-interval':process.env.FGO_WIDE_INTERVAL||process.cwd(),...(process.env.FGO_WIDE_WORKSPACE?{'2.1-workspace':process.env.FGO_WIDE_WORKSPACE}:{})}
if(Object.values(roots).some(x=>!x))throw Error('Set all baseline source roots')
const rounds=Number(process.env.FGO_WIDE_ROUNDS||5),path=process.env.FGO_WIDE_OUTPUT||'docs/test-results/performance-wide.json'
const shard=process.env.FGO_WIDE_SHARD?.split('/').map(Number)
const cases=wideCases().filter((c,i)=>(!process.env.FGO_WIDE_IDS||process.env.FGO_WIDE_IDS.split(',').includes(c.id))&&(!shard||i%shard[1]===shard[0]))
const report={schema:1,status:'running',startedAt:new Date().toISOString(),rounds,warmups:1,queryTimeout:null,
 method:'Sequential queries, rotating version order; one excluded warmup per case/version; 5 recorded trials by default. Core measured inside Worker, production request measured at parent. No result cache, unique profile per request. No per-query deadline, Worker heap cap, or slow-case dropping. Same serialized input catalog for all versions. AI forced on in every 2.1 version.',
 environment:{node:process.version,cpu:os.cpus()[0]?.model,parallelism:os.availableParallelism(),memoryBytes:os.totalmem()},
 versions:Object.fromEntries(Object.entries(roots).map(([name,root])=>[name,{root:resolve(root),commit:execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  coreSha256:createHash('sha256').update(readFileSync(root+'/src/solver/inventory-curve-solver.js')).digest('hex')} ])),records:[]}
mkdirSync(dirname(path),{recursive:true});const persist=()=>writeFileSync(path,JSON.stringify(report)+'\n')
const hosts=new Map();let pending='startup',activeId=0
const heartbeat=setInterval(()=>{persist();console.log('active',pending,'completed',report.records.length,'/',cases.length)},30000)
async function host(name,kind){
 const key=name+kind;if(hosts.has(key))return hosts.get(key)
 const w=new Worker(new URL('./performance-wide-worker.mjs',import.meta.url),{workerData:{root:resolve(roots[name]),kind}})
 await new Promise((yes,no)=>{w.once('message',m=>m.ready?yes():no(Error('startup')));w.once('error',no)})
 hosts.set(key,w);return w
}
async function run(name,c,round){
 const w=await host(name,c.kind),id=++activeId,start=performance.now();pending=`${c.id} ${name} round ${round}`
 return new Promise(yes=>{
  const clean=()=>{w.off('message',receive);w.off('error',error);w.off('exit',exit)}
  const finish=m=>{clean();yes({name,round,wallMs:performance.now()-start,...m})}
  const receive=m=>{if(m.id===id)finish(m)},error=e=>{hosts.delete(name+c.kind);finish({status:'error',error:String(e)})},exit=code=>{hosts.delete(name+c.kind);finish({status:'exit',code})}
  w.on('message',receive);w.once('error',error);w.once('exit',exit)
  w.postMessage({id,opts:c.opts,aiMode:name==='2.0.0'?'off':'on'})
 })
}
const median=a=>{const s=a.toSorted((a,b)=>a-b);return s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2}
try{
 for(let i=0;i<cases.length;i++){
  const c=cases[i],row={...c,opts:undefined,runs:[],warmup:[]};report.active={id:c.id,domain:c.domain}
  for(let round=-1;round<rounds;round++){
   const names=Object.keys(roots),offset=(i+round+names.length)%names.length;names.push(...names.splice(0,offset))
   for(const name of names){const r=await run(name,c,round);(round<0?row.warmup:row.runs).push(r);report.active=row;persist()}
  }
  row.complete=row.runs.every(r=>r.status==='ok')
  row.objectivesMatch=row.complete&&new Set(row.runs.map(r=>JSON.stringify(r.facts))).size===1
  row.alternativesMatch=c.kind==='core'?row.complete&&new Set(row.runs.map(r=>JSON.stringify(Object.entries(r.alternatives||{}).sort(([a],[b])=>a.localeCompare(b))))).size===1:null
  row.medians=Object.fromEntries(Object.keys(roots).map(n=>[n,median(row.runs.filter(r=>r.name===n&&r.status==='ok').map(r=>c.kind==='core'?r.ms:r.wallMs))]))
  report.records.push(row);delete report.active;persist()
  console.log(i+1+'/'+cases.length,c.id,JSON.stringify(row.medians),'match',row.objectivesMatch,row.alternativesMatch)
 }
 report.status='complete';report.endedAt=new Date().toISOString()
}finally{clearInterval(heartbeat);persist();for(const w of hosts.values())await w.terminate()}
