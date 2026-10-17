import { parentPort, workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
const root=workerData.root
let solve
if(workerData.kind==='core')({solveInventoryCurves:solve}=await import(pathToFileURL(root+'/src/solver/inventory-curve-solver.js')))
else {
  let receive
  try{({receiveWorkerPort:receive}=await import(pathToFileURL(root+'/src/worker-transport.js')))}catch{}
  globalThis.self={postMessage(message){
    if(message.transport){
      if(!receive)throw Error('Benchmark adapter does not support the result transport')
      receive(message.port).then(value=>self.postMessage(value)).catch(error=>parentPort.postMessage({id:message.id,status:'adapter-error',error:String(error)}))
      return
    }
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
    if(workerData.kind==='worker'){
      // 2.0.0 predates skipResultCache. A new opaque profile ID for each trial
      // keeps its original memory cache cold without changing any math input.
      // The same effective request and profile ID are used by all versions.
      await self.onmessage({data:{...m,opts:{...m.opts,accountProfileId:m.opts.accountProfileId+':'+m.id}}})
      return
    }
    const opts=m.opts,forms=opts.forms,states=opts.states
    const start=performance.now()
    const result=solve({...opts,formsOf:s=>forms[s.id],stateOf:s=>states[s.id],aiMode:m.aiMode||'auto'})
    const ms=performance.now()-start
    parentPort.postMessage({id:m.id,status:'ok',ms,facts:result?[result.score,result.cost]:null,
      ...(m.collectAlternatives?{alternatives:result?Object.fromEntries((result.plans||[result]).map(p=>{
        const support=p.slots.find(s=>s.s);return [(support?.ce||0)+':'+(support?.p||0),[p.score,p.cost]]
      })):null}:{}),
      certificate:result?.certificate,heapUsed:process.memoryUsage().heapUsed})
  }catch(e){parentPort.postMessage({id:m.id,status:'error',error:String(e.stack||e)})}
})
parentPort.postMessage({ready:true})
