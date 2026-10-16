import {Worker} from 'node:worker_threads'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {makeBenchmarkCase,catalogCounts} from './ai-21-cases.mjs'
const roots={'2.0.0':process.env.FGO_BASELINE_200,'2.0.9':process.env.FGO_BASELINE_209,'2.1':process.cwd()}
if(process.env.FGO_BENCH_ABLATION){delete roots['2.0.0'];delete roots['2.0.9'];roots['2.1-off']=process.cwd()}
if(Object.values(roots).some(v=>!v))throw Error('Set FGO_BASELINE_200 and FGO_BASELINE_209 to independent worktrees')
const count=+(process.env.FGO_BENCH_CASES||1200),workerCount=+(process.env.FGO_BENCH_WORKER_CASES||32),rounds=+(process.env.FGO_BENCH_ROUNDS||3),timeout=+(process.env.FGO_BENCH_TIMEOUT_MS||5000)
const output=process.env.FGO_BENCH_OUTPUT||'docs/test-results/ai-21-large.json'
const offset=+(process.env.FGO_BENCH_OFFSET||0)
const stride=+(process.env.FGO_BENCH_STRIDE||1)
const report={schema:1,startedAt:new Date().toISOString(),status:'running',count,workerCount,rounds,timeoutMs:timeout,
  method:'Sequential paired cases, rotated version order, isolated Node Worker threads, in-worker core timer / parent end-to-end timer; cold-condition caches bypassed. 2.0.9 storage APIs unavailable in Node; browser confirmation is separate. Timeout is benchmark-only. No dropped records.',
  versions:Object.fromEntries(Object.entries(roots).map(([v,p])=>[v,{root:resolve(p),commit:execFileSync('git',['-C',p,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    dirty:!!execFileSync('git',['-C',p,'status','--porcelain'],{encoding:'utf8'}).trim(),
    coreSha256:createHash('sha256').update(readFileSync(p+'/src/solver/inventory-curve-solver.js')).digest('hex'),
    workerSha256:createHash('sha256').update(readFileSync(p+'/src/recommend-worker.js')).digest('hex')} ])),
  environment:{node:process.version,platform:os.platform(),cpu:os.cpus()[0]?.model,parallelism:os.availableParallelism(),memoryBytes:os.totalmem()},catalogCounts,records:[]}
mkdirSync('docs/test-results',{recursive:true})
const persist=()=>writeFileSync(output,JSON.stringify(report)+'\n')
const hosts=new Map()
async function host(version,kind) {
  const key=version+kind
  if(hosts.has(key))return hosts.get(key)
  const worker=new Worker(new URL('./ai-21-benchmark-worker.mjs',import.meta.url),{workerData:{root:resolve(roots[version]),kind},resourceLimits:{maxOldGenerationSizeMb:768}})
  const entry={worker}
  await new Promise((yes,no)=>{worker.once('message',m=>m.ready?yes():no(Error('not ready')));worker.once('error',no)})
  hosts.set(key,entry);return entry
}
async function run(version,kind,c,round) {
  let entry
  try{entry=await host(version,kind)}catch(e){return {version,round,status:'startup-error',error:String(e)}}
  const {worker}=entry,start=performance.now(),id=c.id+'-'+round
  return new Promise(resolve=>{
    const finish=async value=>{
      clearTimeout(timer);worker.off('message',onMessage);worker.off('error',onError);worker.off('exit',onExit)
      if(value.status!=='ok'){hosts.delete(version+kind);await worker.terminate()}
      resolve({version,round,wallMs:performance.now()-start,...value})
    }
    const onMessage=m=>{if(m.id===id)finish(m)},onError=e=>finish({status:'error',error:String(e)}),onExit=code=>finish({status:'exit',code})
    const timer=setTimeout(()=>finish({status:'timeout'}),timeout)
    worker.on('message',onMessage);worker.once('error',onError);worker.once('exit',onExit)
    worker.postMessage({id,opts:c.opts,aiMode:version==='2.1-off'?'off':'auto'})
  })
}
const quantile=(xs,p)=>xs.length?[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))]:null
try {
  for(const [kind,total] of [['core',count],['worker',workerCount]])for(let i=0;i<total;i++) {
    const c=makeBenchmarkCase(Math.floor((i+offset)*stride),kind),record={...c,opts:undefined,identities:c.opts.servants.length,ceCopies:(c.opts.ownCes||c.opts.ces).length,runs:[]}
    for(let round=0;round<rounds;round++) {
      const versions=Object.keys(roots),offset=(i+round)%versions.length;versions.push(...versions.splice(0,offset))
      for(const version of versions)record.runs.push(await run(version,kind,c,round))
    }
    const completed=record.runs.filter(r=>r.status==='ok')
    record.match=completed.length===record.runs.length&&new Set(completed.map(r=>JSON.stringify(r.facts))).size===1
    report.records.push(record)
    if(i%10===0||i===total-1){persist();console.log(kind,i+1,'/',total,'mismatches/incomplete',report.records.filter(r=>!r.match).length)}
  }
  report.summary={}
  for(const kind of ['core','worker']) {
    const rows=report.records.filter(r=>r.id.startsWith(kind+'-')),paired=rows.filter(r=>r.runs.every(x=>x.status==='ok'))
    report.summary[kind]={queries:rows.length,completePaired:paired.length,matching:rows.filter(r=>r.match).length,
      versions:Object.fromEntries(Object.keys(roots).map(version=>{
        const runs=rows.flatMap(r=>r.runs.filter(x=>x.version===version)),ok=runs.filter(x=>x.status==='ok'),ms=ok.map(x=>kind==='core'?x.ms:x.wallMs)
        const pairedMedians=paired.map(r=>quantile(r.runs.filter(x=>x.version===version).map(x=>kind==='core'?x.ms:x.wallMs),.5))
        return [version,{attempts:runs.length,completed:ok.length,timeouts:runs.filter(x=>x.status==='timeout').length,errors:runs.filter(x=>!['ok','timeout'].includes(x.status)).length,
          medianMs:quantile(ms,.5),p95Ms:quantile(ms,.95),maxMs:ms.length?Math.max(...ms):null,
          pairedSumOfMediansMs:pairedMedians.reduce((a,b)=>a+b,0),maxObservedWorkerHeapBytes:ok.length?Math.max(...ok.map(x=>x.heapUsed||0)):null}]
      }))}
  }
  report.status='complete';report.endedAt=new Date().toISOString();persist();console.log(JSON.stringify(report.summary,null,2))
}finally{for(const {worker}of hosts.values())await worker.terminate();persist()}
