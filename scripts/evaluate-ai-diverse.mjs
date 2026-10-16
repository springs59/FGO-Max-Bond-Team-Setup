import {Worker} from 'node:worker_threads'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {FAMILIES} from './ai-diverse-cases.mjs'
const folder='experiments/ai-diverse',training=JSON.parse(readFileSync(folder+'/reports/training.json')),split=process.env.FGO_EVAL_SPLIT||'validation',n=+(process.env.FGO_EVAL_QUERIES||240),rounds=+(process.env.FGO_EVAL_ROUNDS||3),timeout=+(process.env.FGO_EVAL_TIMEOUT_MS||0)
if(split==='test'&&!process.env.FGO_OPEN_SEALED_TEST)throw Error('Sealed test may only be opened after the validation gate passes')
const modelPath=process.env.FGO_EVAL_MODEL||training.selectedByValidationLoss,model=JSON.parse(readFileSync(modelPath)),report={status:'running',split,n,rounds,timeoutMs:timeout,searchTimeLimit:timeout>0?'explicit-user-override':'none',model:model.version,modelPath,seedMetricScope:'Inventory only; general solver seed incumbents may include baseline greedy seeds.',scope:'Offline candidate vs same exact solver with AI off. Production model and all app entry points remain unchanged; not a three-version integration comparison.',records:[]}
if(split==='test'){const validation=JSON.parse(readFileSync(folder+'/reports/validation-solver-gate-'+model.training.hidden+'.json'));if(validation.model!==model.version||!validation.gate?.passed)throw Error('Matching candidate must pass validation before sealed test evaluation')}
const path=folder+'/reports/'+split+'-solver-gate-'+model.training.hidden+'.json';mkdirSync(folder+'/reports',{recursive:true})
const save=()=>{let output=report;if(report.status==='complete'){const rawPath=path.replace('-solver-gate-','-solver-runs-').replace('.json','.jsonl.gz'),raw=gzipSync(report.records.map(r=>JSON.stringify(r)).join('\n')+'\n',{level:9});writeFileSync(rawPath,raw);const {records,...metadata}=report;output={...metadata,rawRecords:{path:rawPath,queries:records.length,attempts:records.reduce((n,r)=>n+r.runs.length,0),bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')}}}writeFileSync(path,JSON.stringify(output,null,2)+'\n')}
let worker,seq=0
async function start(){worker=new Worker(new URL('./ai-diverse-worker.mjs',import.meta.url),{workerData:{slot:777},resourceLimits:{maxOldGenerationSizeMb:768}});await new Promise((yes,no)=>{worker.once('message',m=>m.ready?yes():no(Error('not ready')));worker.once('error',no)})}
async function run(task){if(!worker)await start();const id=++seq;return new Promise(resolve=>{const current=worker,done=async result=>{clearTimeout(timer);current.off('message',msg);current.off('error',err);current.off('exit',exit);if(result.status!=='ok'){worker=null;await current.terminate()}resolve(result)},msg=m=>{if(m.id===id)done(m)},err=e=>done({status:'error',error:String(e)}),exit=code=>done({status:'error',error:'exit '+code}),timer=timeout>0?setTimeout(()=>done({status:'timeout'}),timeout):null;current.on('message',msg);current.once('error',err);current.once('exit',exit);current.postMessage({...task,id})})}
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)],quantile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))]
try{
 for(let i=0;i<n;i++){
  const index=i*7,family=FAMILIES[index%24],row={index,family,runs:[]}
  for(let r=0;r<rounds;r++)for(const variant of ((i+r)%2?['on','off']:['off','on']))row.runs.push({variant,round:r,...await run({split,index,mode:variant==='on'?'auto':'off',model:variant==='on'?model:undefined})})
  row.complete=row.runs.every(x=>x.status==='ok');row.match=row.complete&&new Set(row.runs.map(x=>JSON.stringify(x.facts))).size===1;report.records.push(row)
  if(i%12===0){save();console.log('offline',split,i+1,'/',n)}
 }
 const complete=report.records.filter(r=>r.complete),good=complete.filter(r=>r.match),feasible=good.filter(r=>r.runs[0].facts),times=(rows,v)=>rows.map(r=>median(r.runs.filter(x=>x.variant===v).map(x=>x.ms))),sum=xs=>xs.reduce((a,b)=>a+b,0)
 const on=times(feasible,'on'),off=times(feasible,'off'),ratio=sum(on)/sum(off),boot=[];let random=42001;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296}
 for(let b=0;b<2000;b++){let a=0,z=0;for(let j=0;j<on.length;j++){const k=Math.floor(rand()*on.length);a+=on[k];z+=off[k]}if(z)boot.push(a/z)}
 const cohort=Object.fromEntries(FAMILIES.map(f=>{const rows=feasible.filter(r=>r.family===f);return [f,{queries:rows.length,onP95Ms:rows.length?quantile(times(rows,'on'),.95):null,offP95Ms:rows.length?quantile(times(rows,'off'),.95):null}]}))
 const enabled=feasible.filter(r=>r.runs[0].case.kind==='inventory').map(r=>r.runs.find(x=>x.variant==='on'&&x.ai?.enabled)).filter(Boolean),seeded=enabled.filter(r=>r.ai.seedFeasible>0),optimal=seeded.filter(r=>r.ai.seedBestScore===r.facts[0])
 report.summary={queries:n,complete:complete.length,matching:good.length,mismatches:complete.filter(r=>!r.match).map(r=>r.index),incomplete:n-complete.length,feasible:feasible.length,ratio,onSumMs:sum(on),offSumMs:sum(off),bootstrap95:[quantile(boot,.025),quantile(boot,.975)],enabledInventoryQueries:enabled.length,feasibleSeeds:seeded.length,optimalSeeds:optimal.length,cohort}
 const checks={exact:good.length===n,overallAtLeast10PercentFaster:ratio<=.9,bootstrapUpperBelowOne:report.summary.bootstrap95[1]<1,seedFeasibleAtLeast95Percent:enabled.length>0&&seeded.length/enabled.length>=.95,seedOptimalAtLeast60Percent:enabled.length>0&&optimal.length/enabled.length>=.6,noCohortP95RegressionOver5Percent:Object.values(cohort).every(c=>c.queries===0||c.onP95Ms<=c.offP95Ms*1.05)}
 report.gate={checks,passed:Object.values(checks).every(Boolean),policy:'Engineering acceptance target, not a user-guaranteed SLA. All checks must pass before product integration; sealed test remains unopened on validation failure.'};report.status='complete';report.endedAt=new Date().toISOString();save();console.log(JSON.stringify({summary:report.summary,gate:report.gate},null,2))
}finally{await worker?.terminate();save()}
