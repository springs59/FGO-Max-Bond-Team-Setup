import { mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { AI_FEATURES, AI_FEATURE_VERSION, predictPriority } from '../src/solver/ai-search.js'
import { makeSearchCase, randomSource, trainingDataVersion } from './ai-search-cases.mjs'

const count=Number(process.env.FGO_AI_TRAIN_CASES||4800),testCount=Number(process.env.FGO_AI_TEST_CASES||800)
const began=performance.now(),dataset={train:{equipment:[],servant:[]},test:{equipment:[],servant:[]}},queries=[]
for(const split of ['train','test']) {
  const total=split==='train'?count:testCount
  for(let i=0;i<total;i++){
    const seed=(split==='train'?100000:900000)+i,scenario=makeSearchCase(seed,{real:i%3===0})
    let domain
    const result=solveInventoryCurves({...scenario.opts,aiMode:'off',onAiDomain:d=>domain=d})
    if(result&&domain){
      const own=result.slots.filter(s=>s.f&&!s.s),counts=new Map()
      for(const s of own.filter(s=>s.ce)){const key=s.ce+':'+(s.mlb!==false);counts.set(key,(counts.get(key)||0)+1)}
      for(const g of domain.equipment){
        const keys=new Set(g.ids.map((id,j)=>id+':'+g.mlb[j])),selected=[...keys].reduce((n,k)=>n+(counts.get(k)||0),0)
        dataset[split].equipment.push({x:g.features,y:selected/Math.min(6* g.features[14],g.ids.length),query:scenario.id})
      }
      const chosenFeatures=new Set(domain.servants.filter(r=>own.some(s=>s.svt===r.id&&(s.art||'default')===(r.form||'default'))).map(r=>JSON.stringify(r.features)))
      // Equivalent effects are all positive: arbitrary identity/form tie choices
      // must not become contradictory negative labels for identical features.
      for(const r of domain.servants)dataset[split].servant.push({x:r.features,
        y:Number(chosenFeatures.has(JSON.stringify(r.features))),query:scenario.id})
      queries.push({id:scenario.id,split,score:result.score,cost:result.cost,base:scenario.opts.base,budget:scenario.opts.costLimit})
    }
    if(i%40===0)console.log(`${split}: ${i}/${total}, elapsed ${Math.round((performance.now()-began)/1000)}s`)
  }
}
function train(samples,seed){
  const rand=randomSource(seed),hidden=16,n=AI_FEATURES.length
  const head={w1:Array.from({length:hidden},()=>Array.from({length:n},()=>(rand()-.5)*.4)),b1:Array(hidden).fill(0),
    w2:Array.from({length:hidden},()=>(rand()-.5)*.4),b2:0}
  const order=samples.map((_,i)=>i),lr=.025
  for(let epoch=0;epoch<180;epoch++){
    for(let i=order.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
    for(const i of order){
      const {x,y}=samples[i],h=head.w1.map((w,j)=>Math.tanh(w.reduce((s,v,k)=>s+v*x[k],head.b1[j])))
      const z=head.w2.reduce((s,w,j)=>s+w*h[j],head.b2),p=1/(1+Math.exp(-Math.max(-30,Math.min(30,z)))),dz=p-y
      const dh=h.map((v,j)=>dz*head.w2[j]*(1-v*v))
      for(let j=0;j<hidden;j++){
        for(let k=0;k<n;k++)head.w1[j][k]-=lr*(dh[j]*x[k]+.0001*head.w1[j][k])
        head.b1[j]-=lr*dh[j];head.w2[j]-=lr*(dz*h[j]+.0001*head.w2[j])
      }
      head.b2-=lr*dz
    }
  }
  for(const name of ['w1','b1','w2'])head[name]=head[name].map(v=>Array.isArray(v)?v.map(x=>+x.toFixed(8)):+v.toFixed(8))
  head.b2=+head.b2.toFixed(8)
  return head
}
function metrics(samples,head){
  let mae=0,bce=0,pairs=0,correct=0
  const groups=new Map()
  for(const s of samples){const p=predictPriority(head,s.x);mae+=Math.abs(p-s.y);bce-=s.y*Math.log(Math.max(1e-8,p))+(1-s.y)*Math.log(Math.max(1e-8,1-p));
    if(!groups.has(s.query))groups.set(s.query,[]);groups.get(s.query).push({...s,p})}
  for(const rows of groups.values())for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j];if(a.y===b.y)continue;pairs++;if((a.p-b.p)*(a.y-b.y)>0)correct++
  }
  return {samples:samples.length,meanAbsoluteError:mae/samples.length,crossEntropy:bce/samples.length,
    unequalLabelPairs:pairs,pairwiseAccuracy:pairs?correct/pairs:null}
}
const heads=Object.fromEntries(['equipment','servant'].map((kind,i)=>[kind,train(dataset.train[kind],5900+i)]))
const digest=createHash('sha256').update(JSON.stringify({heads,queries,trainingDataVersion})).digest('hex')
const model={featureVersion:AI_FEATURE_VERSION,version:'ai200-'+digest.slice(0,12),features:AI_FEATURES,heads,
  training:{teacher:'native-v2.0.0-inventory-ce-vector-cost-dp',trainQueries:queries.filter(q=>q.split==='train').length,
    testQueries:queries.filter(q=>q.split==='test').length,sourceDataSha256:trainingDataVersion,
    seedRanges:{train:[100000,100000+count-1],test:[900000,900000+testCount-1]},sha256:digest}}
writeFileSync('src/solver/ai-model.js','// Trained by scripts/train-search-ai.mjs. Weights rank traversal only.\nexport const SEARCH_MODEL = '+JSON.stringify(model)+'\n')
const report={model:model.version,training:model.training,elapsedSeconds:(performance.now()-began)/1000,
  metrics:Object.fromEntries(['equipment','servant'].map(k=>[k,{train:metrics(dataset.train[k],heads[k]),test:metrics(dataset.test[k],heads[k])}])),
  caveat:'Small-domain synthetic and public-catalog teacher data; held-out ranking is not a proof of speed or optimality.'}
mkdirSync('docs/test-results',{recursive:true});writeFileSync('docs/test-results/ai-200-training.json',JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
