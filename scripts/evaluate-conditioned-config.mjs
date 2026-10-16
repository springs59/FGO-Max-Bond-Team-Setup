import { Worker } from 'node:worker_threads'
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const folder='experiments/ai-conditioned',training=JSON.parse(readFileSync(folder+'/reports/training.json'))
const modelPath=process.env.FGO_CONFIG_MODEL||training.selected,model=JSON.parse(readFileSync(modelPath)),n=+(process.env.FGO_CONFIG_EVAL_QUERIES||480),width=+(process.env.FGO_CONFIG_BEAM||32),top=+(process.env.FGO_CONFIG_TOP||8)
const split=process.env.FGO_CONFIG_SPLIT||'validation',compareBaseline=process.env.FGO_CONFIG_COMPARE_BASELINE==='1'
if(!['validation','qualification'].includes(split))throw Error('Unknown evaluation split')
if(split==='qualification'){
  if(process.env.FGO_OPEN_CONFIG_QUALIFICATION!=='1')throw Error('Qualification requires an explicit open after validation')
  const v=JSON.parse(readFileSync(folder+`/reports/validation-${model.training.hidden[0]}-beam${width}-top${top}.json`)),s=v.summary
  if(v.status!=='complete'||v.model!==model.version||s.errors.length||s.overshoots.length||s.finalWithFallback.hasFeasible!==s.feasible||s.finalWithFallback.atLeast99Percent/s.feasible<.95)throw Error('Matching quality validation must pass before the new qualification set is opened')
}
if(!Number.isSafeInteger(n)||n<1||n>2400||!Number.isSafeInteger(width)||width<1||width>512||!Number.isSafeInteger(top)||top<1||top>width)throw Error('Invalid evaluation size or beam settings')
mkdirSync(folder+'/reports',{recursive:true})
const name=`${split}-${model.training.hidden[0]}-beam${width}-top${top}`,path=folder+'/reports/'+name+'-runs.jsonl',summaryPath=folder+'/reports/'+name+'.json'
writeFileSync(path,'',{flush:true})
const records=[],report={schema:2,model:model.version,modelPath,n,width,top,split,seed:split==='qualification'?42000000:22000000,compareBaseline,searchTimeLimit:'none',sealedTestRead:false,status:'running'}
let worker,id=0,current=null
async function start(){worker=new Worker(new URL('./conditioned-eval-worker.mjs',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:1024}});await new Promise((yes,no)=>{worker.once('message',m=>m.ready?yes():no(Error('not ready')));worker.once('error',no)})}
async function run(index){return new Promise((resolve,reject)=>{
  const key=++id,cleanup=()=>{worker.off('message',done);worker.off('error',fail);worker.off('exit',exit)},done=m=>{if(m.id!==key)return;cleanup();resolve(m)},fail=e=>{cleanup();reject(e)},exit=code=>fail(Error('Evaluation worker exited '+code))
  worker.on('message',done);worker.once('error',fail);worker.once('exit',exit);worker.postMessage({id:key,index,model,width,top,split,compareBaseline})
})}
const persist=()=>writeFileSync(summaryPath,JSON.stringify({...report,completed:records.length,current},null,2)+'\n',{flush:true})
const heartbeat=setInterval(()=>{persist();console.log('quality',records.length,'/',n,'current',current)},15000)
const quantile=(xs,p)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*p))]??null
try {
 await start()
 for(let i=0;i<n;i++) {
  current={index:(i*7)%2400,startedAt:new Date().toISOString()}
  const r=await run(current.index);records.push(r);appendFileSync(path,JSON.stringify(r)+'\n',{flush:true})
  if(records.length%48===0)console.log('quality',records.length,'/',n)
 }
 const persisted=readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)
 if(persisted.length!==n||new Set(persisted.map(r=>r.index)).size!==n)throw Error('Incomplete durable evaluation records')
 report.recordIntegrity={rows:persisted.length,uniqueIndices:n,fsyncEachRecord:true}
 const good=records.filter(r=>r.status==='ok'),feasible=good.filter(r=>r.truth),failed=records.filter(r=>r.status==='error')
 const results={}
 for(const k of [1,2,4,8,16,32,64].filter(k=>k<=top)) {
  const ratios=feasible.map(r=>{const c=r.checkpoints[Math.min(k,r.neuralCount)-1];return c?.score==null?0:r.truth[0]===0?Number(c.score===0):c.score/r.truth[0]})
  results[k]={queries:feasible.length,hasFeasible:ratios.filter(x=>x>0).length,mean:ratios.reduce((a,b)=>a+b,0)/ratios.length,
   median:quantile(ratios,.5),p05:quantile(ratios,.05),min:Math.min(...ratios),atLeast99Percent:ratios.filter(x=>x>=.99).length,
   atLeast95Percent:ratios.filter(x=>x>=.95).length,optimalScore:ratios.filter(x=>x===1).length,
   optimalScoreAndCost:feasible.filter(r=>{const c=r.checkpoints[Math.min(k,r.neuralCount)-1];return c?.score===r.truth[0]&&c?.cost===r.truth[1]}).length,
   medianMs:quantile(feasible.map(r=>r.checkpoints[Math.min(k,r.neuralCount)-1]?.ms??r.ms),.5)}
 }
 report.status='complete';report.summary={inventoryCompleted:good.length,feasible:feasible.length,infeasible:good.length-feasible.length,unsupportedGeneral:records.filter(r=>r.status==='unsupported').length,
  errors:failed,overshoots:feasible.filter(r=>r.score>r.truth[0]).map(r=>r.index),results,
  finalWithFallback:{hasFeasible:feasible.filter(r=>r.score!==null).length,optimalScore:feasible.filter(r=>r.score===r.truth[0]).length,optimalScoreAndCost:feasible.filter(r=>r.score===r.truth[0]&&r.cost===r.truth[1]).length,atLeast99Percent:feasible.filter(r=>r.score!==null&&(r.truth[0]===0?r.score===0:r.score/r.truth[0]>=.99)).length,minRatio:Math.min(...feasible.map(r=>r.score==null?0:r.truth[0]===0?Number(r.score===0):r.score/r.truth[0]))},
  searchedWholeEquipmentDomain:feasible.filter(r=>r.neuralCount>=r.domainCount).length,
  partialDomainOnly:{queries:feasible.filter(r=>r.neuralCount<r.domainCount).length,optimalScore:feasible.filter(r=>r.neuralCount<r.domainCount&&r.score===r.truth[0]).length,atLeast99Percent:feasible.filter(r=>r.neuralCount<r.domainCount&&r.score!==null&&(r.truth[0]===0?r.score===0:r.score/r.truth[0]>=.99)).length},
  baselineComparison:compareBaseline?{queries:feasible.length,meanRatio:feasible.reduce((n,r)=>n+(r.truth[0]===0?Number(r.baseline?.score===0):(r.baseline?.score??0)/r.truth[0]),0)/feasible.length,optimalScore:feasible.filter(r=>r.baseline?.score===r.truth[0]).length,atLeast99Percent:feasible.filter(r=>r.baseline?.score!=null&&(r.truth[0]===0?r.baseline.score===0:r.baseline.score/r.truth[0]>=.99)).length,newBetter:feasible.filter(r=>r.score>r.baseline?.score).length,newWorse:feasible.filter(r=>r.score<r.baseline?.score).length}:null,
  exactMedianMs:quantile(feasible.map(r=>r.exactMs),.5),proposalMedianMs:quantile(feasible.map(r=>r.proposalMs),.5),
  cohorts:Object.fromEntries([...new Set(feasible.map(r=>r.family))].map(f=>{const rows=feasible.filter(r=>r.family===f),ratios=rows.map(r=>r.score==null?0:r.truth[0]===0?Number(r.score===0):r.score/r.truth[0]);return [f,{queries:rows.length,meanRatio:ratios.reduce((a,b)=>a+b,0)/rows.length,minRatio:Math.min(...ratios)}]}))}
 report.rawSha256=createHash('sha256').update(readFileSync(path)).digest('hex');current=null;persist();console.log(JSON.stringify(report.summary,null,2))
} finally {clearInterval(heartbeat);await worker?.terminate();persist()}
