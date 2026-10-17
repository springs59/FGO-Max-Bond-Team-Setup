import {parentPort,workerData} from 'node:worker_threads'
import {pathToFileURL} from 'node:url'
const root=workerData.root
const output=value=>parentPort.postMessage({...value,heapUsed:process.memoryUsage().heapUsed})
if(workerData.kind==='core'){
 const {solveInventoryCurves}=await import(pathToFileURL(root+'/src/solver/inventory-curve-solver.js'))
 parentPort.on('message',m=>{
  try{
   const {forms,states}=m.opts,start=performance.now()
   const r=solveInventoryCurves({...m.opts,formsOf:s=>forms[s.id],stateOf:s=>states[s.id]||{},aiMode:m.aiMode})
   const ms=performance.now()-start
   output({id:m.id,status:'ok',ms,facts:r?[r.score,r.cost]:null,certificate:r?.certificate,
    alternatives:r?Object.fromEntries(r.plans.map(p=>{const s=p.slots.find(s=>s.s);return [(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]})):null})
  }catch(e){output({id:m.id,status:'error',error:String(e.stack||e)})}
 })
}else{
 globalThis.self={postMessage(m){
  if(m.type==='progress')return
  const r=m.result?.value
  output({id:m.id,status:m.ok?'ok':'error',error:m.error||r?.error,valid:r?.ok===true,
   facts:r?.ok?[r.total,r.costUsed,r.preferBond||0,r.bond15Count||0,r.priorityScore||0]:null,
   cacheHit:!!r?.queryStats?.cacheHit,ai:r?.resultStatus?.ai,source:r?.resultStatus?.source,
   candidatePlans:r?.plans?.length||0})
 }}
 await import(pathToFileURL(root+'/src/recommend-worker.js'))
 parentPort.on('message',m=>Promise.resolve(self.onmessage({data:{id:m.id,opts:{...m.opts,aiMode:m.aiMode,
  accountProfileId:m.opts.accountProfileId+':'+m.id,skipResultCache:true}}})).catch(e=>output({id:m.id,status:'error',error:String(e.stack||e)})))
}
parentPort.postMessage({ready:true})
