import { parentPort, workerData } from 'node:worker_threads'
import { makeGeneralCase, materializeGeneral } from './general-ai-cases.mjs'
import { solveGeneral,resultFacts,GENERAL_KERNEL_SHA } from './general-ai-solver.mjs'
import { predictRoot } from './general-ai-policy.mjs'
import { createGeneralRuntime } from './general-ai-runtime.mjs'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
let model=workerData.model,gate=workerData.gate
const permissive={enabled:true,modelVersion:model.version,minGroups:0,minRawStock:0,logGain:0,minLogWork:0}
const candidate=createGeneralRuntime(model,gate||permissive),reject=createGeneralRuntime(model,{...permissive,logGain:Infinity})
for(let i=0;i<30;i++){
 const opts=materializeGeneral(makeGeneralCase('train',120000+i).opts)
 solveInventoryCurves({...opts,aiMode:'off'});candidate.solve(opts);reject.solve(opts)
}
const med=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)]
parentPort.on('message',m=>{
 try{
  const c=makeGeneralCase(m.split,m.index),opts=materializeGeneral(c.opts),timings={off:[],on:[],reject:[],bound:[]};let facts,decision
  for(let round=0;round<(m.rounds||3);round++){
   const variants=gate?['off','on','bound']:['off','on','reject','bound']
   const order=variants.slice((m.index+round)%variants.length).concat(variants.slice(0,(m.index+round)%variants.length))
   for(const kind of order){
    const began=performance.now(),r=kind==='off'?{result:solveInventoryCurves({...opts,aiMode:'off'})}:kind==='on'?candidate.solve(opts):kind==='bound'?solveGeneral(opts,{policy:5}):reject.solve(opts)
    timings[kind].push(performance.now()-began)
    const f=JSON.stringify(resultFacts(r.result,opts.allSupportAlternatives))
    if(facts===undefined)facts=f;else if(facts!==f)throw Error('Exact score/COST/support-alternative mismatch')
    if(kind==='on')decision=r.decision
   }
  }
  const observed=solveGeneral(opts,{capture:true,measured:true}),work=observed.work?observed.work.dpTransitions+observed.work.upperRows+observed.work.nodes:0
  let prediction=null
  if(observed.observation){const p=predictRoot(model,observed.observation.x),policy=p.indexOf(Math.min(...p));prediction={policy,logGain:p[0]-p[policy],logWork:p[0],groups:observed.observation.x[0]*10}}
  const guided=gate&&(!gate.enabled||opts.ownCes.length<(gate.minRawStock||0))?observed:gate?solveGeneral(opts,{model,gate,measured:true}):solveGeneral(opts,{model,gate:permissive,measured:true})
  const guidedWork=guided.work?guided.work.dpTransitions+guided.work.upperRows+guided.work.nodes:0
  parentPort.postMessage({status:'ok',modelVersion:model.version,kernelSha:GENERAL_KERNEL_SHA,split:m.split,index:m.index,family:c.family,structureKey:c.structureKey,inputSha256:c.inputSha256,nearSha256:c.nearSha256,
   feasible:observed.result!==null,rawStock:opts.ownCes.length,prediction,decision,work,guidedWork,offMs:med(timings.off),onMs:med(timings.on),rejectMs:timings.reject.length?med(timings.reject):null,boundMs:med(timings.bound),
   timings,exactParity:true,heapUsed:process.memoryUsage().heapUsed,ordinaryQueryDiskWrites:0})
 }catch(error){parentPort.postMessage({status:'error',split:m.split,index:m.index,error:String(error.stack||error)})}
})
parentPort.postMessage({ready:true})
