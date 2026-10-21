import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import {makeSearchCase} from '../ai-search-cases.mjs'
const work=resolve(process.argv[2])
const configs=[['query','baseline'],['domain','baseline'],['query','teacher'],['domain','teacher'],['query','neural-large'],['domain','neural-large'],['framework-raw','baseline'],['framework-memo','baseline']]
const loaded=[]
for(const[mode,id]of configs){
 const url=p=>pathToFileURL(work+'/variants/'+mode+'/src/solver/'+p)
 const {createLearnedSearch,searchFeatures,predictPriority}=await import(url('ai-search.js'))
 const {SEARCH_MODEL}=await import(url('ai-model.js'))
 const {selectQueryModel}=await import(url('query-models.js'))
 const {createQuerySession}=await import(url('query-ai.js'))
 const model=selectQueryModel(SEARCH_MODEL,id),session=createQuerySession()
 const f=searchFeatures({rates:[120,250],cost:4}),g=searchFeatures({rates:[100,1000],cost:16})
 for(const features of[f,f,g,g]){
  const s=createLearnedSearch({mode:'on',model,querySession:session,equipmentFeatures:[features],servantFeatures:[features]})
  for(let i=0;i<20;i++){
   const score=s.score('equipment',features)
   if(mode.startsWith('framework'))assert.equal(score,predictPriority(model.heads.equipment,features),'memoization must preserve actual head outputs')
  }
 }
 assert.equal(session.inferenceCalls,mode==='query'?1:mode==='framework-raw'?80:2,mode+' actual inference accounting')
 const off=createQuerySession();assert.equal(createLearnedSearch({mode:'off',model,querySession:off}).score('equipment',f),null);assert.equal(off.inferenceCalls,0)
 loaded.push({mode,id,model,createQuerySession,solve:(await import(url('inventory-curve-solver.js'))).solveInventoryCurves})
}
let comparisons=0
for(let i=0;i<40;i++){
 const opts=makeSearchCase(151000000+i,{real:i%2===0,larger:false}).opts
 opts.allSupportAlternatives=true
 const expected=loaded[0].solve({...opts,aiMode:'off'})
 const facts=x=>x?[x.score,x.cost,Object.entries(Object.fromEntries(x.plans.map(p=>{const s=p.slots.find(x=>x.s);return[(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]}))).sort(([a],[b])=>a.localeCompare(b))]:null
 for(const c of loaded){
  const session=c.createQuerySession(),actual=c.solve({...opts,aiMode:'on',aiModel:c.model,querySession:session})
  assert.deepEqual(facts(actual),facts(expected),c.mode+'/'+c.id+' exact objectives and all alternatives '+i);comparisons++
 }
}
console.log(JSON.stringify({passed:true,configurations:loaded.length,exactComparisons:comparisons,inferenceCounters:true,memoizedHeadValuesUnchanged:true}))
