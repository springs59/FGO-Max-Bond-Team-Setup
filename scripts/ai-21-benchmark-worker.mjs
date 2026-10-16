import { parentPort, workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
const root=workerData.root
let solve
if(workerData.kind==='core')({solveInventoryCurves:solve}=await import(pathToFileURL(root+'/src/solver/inventory-curve-solver.js')))
else {
  globalThis.self={postMessage(message){
    if(message.type==='progress')return
    const result=message.result?.value
    parentPort.postMessage({id:message.id,status:message.ok?'ok':'error',error:message.error,
      facts:result?.ok?[result.total,result.costUsed]:null,source:result?.resultStatus?.source,
      cacheHit:!!result?.queryStats?.cacheHit,ai:result?.resultStatus?.ai,
      heapUsed:process.memoryUsage().heapUsed})
  }}
  await import(pathToFileURL(root+'/src/recommend-worker.js'))
}
parentPort.on('message',async m=>{
  try {
    if(workerData.kind==='worker'){await self.onmessage({data:m});return}
    const opts=m.opts,forms=opts.forms,states=opts.states
    const start=performance.now()
    const result=solve({...opts,formsOf:s=>forms[s.id],stateOf:s=>states[s.id],aiMode:m.aiMode||'auto'})
    const ms=performance.now()-start
    parentPort.postMessage({id:m.id,status:'ok',ms,facts:result?[result.score,result.cost]:null,
      certificate:result?.certificate,heapUsed:process.memoryUsage().heapUsed})
  }catch(e){parentPort.postMessage({id:m.id,status:'error',error:String(e.stack||e)})}
})
parentPort.postMessage({ready:true})
