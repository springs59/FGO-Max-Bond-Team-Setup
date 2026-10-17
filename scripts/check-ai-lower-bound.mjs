import {Worker} from 'node:worker_threads'
import {mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {makeSearchCase} from './ai-search-cases.mjs'
import {makeBenchmarkCase} from './ai-21-cases.mjs'
const baseline=process.env.FGO_LB_BASELINE
if(!baseline)throw Error('Set FGO_LB_BASELINE to the unchanged 2.1.2 source')
const count=+(process.env.FGO_LB_CASES||48),rounds=+(process.env.FGO_LB_ROUNDS||5)
const offset=+(process.env.FGO_LB_OFFSET||4600000),output=process.env.FGO_LB_OUTPUT||'docs/test-results/ai-lower-bound.json'
const report={baseline:resolve(baseline),candidate:process.cwd(),offset,count,rounds,passed:false,records:[]},hosts={}
mkdirSync('docs/test-results',{recursive:true})
const median=xs=>{const s=[...xs].sort((a,b)=>a-b);return s.length%2?s[s.length>>1]:(s[s.length/2-1]+s[s.length/2])/2}
const persist=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n')
try{
 for(const [name,root] of [['before',baseline],['after',process.cwd()]]){
   const worker=new Worker(new URL('./ai-21-benchmark-worker.mjs',import.meta.url),{workerData:{root:resolve(root),kind:'core'}})
   await new Promise((yes,no)=>{worker.once('message',m=>m.ready?yes():no(Error('not ready')));worker.once('error',no)})
   hosts[name]=worker
 }
 async function run(name,c,id){
   const worker=hosts[name]
   return new Promise((yes,no)=>{
     const timer=setTimeout(()=>{worker.off('message',receive);no(Error('Benchmark timeout '+c.id+' '+name))},20000)
     function receive(m){if(m.id!==id)return;clearTimeout(timer);worker.off('message',receive);m.status==='ok'?yes(m):no(Error(m.error))}
     worker.on('message',receive);worker.postMessage({id,opts:c.opts,aiMode:'on',collectAlternatives:true})
   })
 }
 for(let i=0;i<count;i++){
   let c
   if(i>=count-8&&process.env.FGO_LB_PUBLIC==='1'){const j=i-(count-8);c=makeBenchmarkCase(900+j,'core');c.opts.costLimit=[40,60,80,95,113,null,40,80][j]}
   else{
     const raw=makeSearchCase(offset+i,{real:i%3===0,larger:i>=count/2}),opts={...raw.opts}
     opts.forms=Object.fromEntries(opts.servants.map(s=>[s.id,opts.formsOf(s)]));opts.states=Object.fromEntries(opts.servants.map(s=>[s.id,opts.stateOf(s)]))
     delete opts.formsOf;delete opts.stateOf;c={id:raw.id,opts}
   }
   if(process.env.FGO_LB_ALTERNATIVES==='1')c.opts.allSupportAlternatives=true
   const row={id:c.id,identities:c.opts.servants.length,costLimit:c.opts.costLimit,runs:[]}
   for(let round=-1;round<rounds;round++)for(const name of (i+round)%2?['before','after']:['after','before']){
     const result=await run(name,c,c.id+name+round)
     if(round>=0)row.runs.push({name,round,...result})
   }
   assert.equal(new Set(row.runs.map(r=>JSON.stringify(r.facts))).size,1,c.id+' exact score and COST tie')
   const normalize=x=>JSON.stringify(Object.entries(x||{}).sort(([a],[b])=>a.localeCompare(b)))
   assert.equal(new Set(row.runs.map(r=>normalize(r.alternatives))).size,1,c.id+' retained support/position optima')
   const oldBound=row.runs.find(r=>r.name==='before').certificate?.ai.seedBestScore
   const newBound=row.runs.find(r=>r.name==='after').certificate?.ai.seedBestScore
   if(Number.isFinite(oldBound))assert.ok(newBound>=oldBound,c.id+' verified initial lower bound must not regress')
   row.beforeMs=median(row.runs.filter(r=>r.name==='before').map(r=>r.ms));row.afterMs=median(row.runs.filter(r=>r.name==='after').map(r=>r.ms))
   row.ratio=row.afterMs/row.beforeMs;report.records.push(row)
   if(i%8===0){persist();console.log(i+'/'+count)}
 }
 report.summary={beforeSumMs:report.records.reduce((n,r)=>n+r.beforeMs,0),afterSumMs:report.records.reduce((n,r)=>n+r.afterMs,0),
   pairedMedianRatio:median(report.records.map(r=>r.ratio)),faster:report.records.filter(r=>r.ratio<1).length,
   feasible:report.records.filter(r=>r.runs[0].facts).length}
 report.summary.ratio=report.summary.afterSumMs/report.summary.beforeSumMs
 report.passed=true;console.log(JSON.stringify(report.summary))
}finally{persist();for(const w of Object.values(hosts))await w.terminate()}
