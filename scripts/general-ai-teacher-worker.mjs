import { parentPort, workerData } from 'node:worker_threads'
import { makeGeneralCase, materializeGeneral } from './general-ai-cases.mjs'
import { solveGeneral, resultFacts } from './general-ai-solver.mjs'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
// Warm the available implementations equally before collecting any timings.
for(let i=0;i<20;i++)for(let policy=0;policy<5;policy++)solveGeneral(materializeGeneral(makeGeneralCase('train',100000+i).opts),{policy,measured:true})
parentPort.on('message',m=>{
 try{
  const c=makeGeneralCase(m.split,m.index),opts=materializeGeneral(c.opts),variants=[];let observation,truth
  for(let p=0;p<5;p++){
   const policy=(p+m.index)%5,t=performance.now(),r=solveGeneral(opts,{policy,measured:true,capture:policy===0}),facts=resultFacts(r.result,opts.allSupportAlternatives)
   if(policy===0)observation=r.observation
   variants.push({policy,ms:performance.now()-t,work:r.work? r.work.dpTransitions+r.work.upperRows+r.work.nodes:0,counters:r.work,facts})
  }
  variants.sort((a,b)=>a.policy-b.policy);truth=JSON.stringify(variants[0].facts)
  if(variants.some(v=>JSON.stringify(v.facts)!==truth))throw Error('Exact parity failed across complete search orders')
  if(m.index<24&&JSON.stringify(resultFacts(solveInventoryCurves({...opts,aiMode:'off'}),opts.allSupportAlternatives))!==truth)throw Error('Unmodified exact reference mismatch')
  parentPort.postMessage({status:'ok',split:m.split,index:m.index,family:c.family,structureKey:c.structureKey,inputSha256:c.inputSha256,nearSha256:c.nearSha256,
   feasible:variants[0].facts!==null,x:observation?.x||null,features:observation?.features||null,variants:variants.map(({facts,...v})=>v),referenceChecked:m.index<24})
 }catch(error){parentPort.postMessage({status:'error',split:m.split,index:m.index,error:String(error.stack||error)})}
})
parentPort.postMessage({ready:true})
