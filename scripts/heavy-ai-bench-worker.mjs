import { parentPort,workerData } from 'node:worker_threads'
import { pathToFileURL } from 'node:url'
const {root,kind,version}=workerData
let solve,current,start,receive
if(kind==='core')({solveInventoryCurves:solve}=await import(pathToFileURL(root+'/src/solver/inventory-curve-solver.js')))
else{
 try{({receiveWorkerPort:receive}=await import(pathToFileURL(root+'/src/worker-transport.js')))}catch{}
 globalThis.self={postMessage(m){
  if(m.transport){if(!receive)throw Error('Unsupported transport');receive(m.port).then(x=>self.postMessage(x)).catch(e=>parentPort.postMessage({id:m.id,status:'error',error:String(e)}));return}
  if(m.type==='progress')return
  const r=m.result?.value
  parentPort.postMessage({id:m.id,status:m.ok?'ok':'error',error:m.error,ms:performance.now()-start,
   facts:r?.ok?[r.total,r.costUsed]:null,ai:r?.resultStatus?.ai||r?.solverStats?.ai||null,
   cacheHit:!!r?.queryStats?.cacheHit,source:r?.resultStatus?.source,
   heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss})
 }}
 await import(pathToFileURL(root+'/src/recommend-worker.js'))
}
const facts=(r,all)=>!r?null:[r.score,r.cost,...(all?[[...new Set(r.plans.map(p=>{const s=p.slots.find(x=>x.f&&x.s);return JSON.stringify([s?.p||0,s?.ce||0,p.score,p.cost])}))].sort()]:[])]
parentPort.on('message',async m=>{
 current=m.id;start=performance.now()
 try{
  if(kind==='worker'){await self.onmessage({data:{id:m.id,opts:{...m.opts,aiMode:version==='2.1.1'?'on':'off',accountProfileId:m.opts.accountProfileId+':'+m.id}}});return}
  const o=m.opts,r=solve({...o,formsOf:s=>o.forms[s.id],stateOf:s=>o.states[s.id],aiMode:version==='2.1.1'?'on':'off'}),ms=performance.now()-start
  parentPort.postMessage({id:m.id,status:'ok',ms,facts:facts(r,o.allSupportAlternatives),ai:r?.certificate?.ai||null,
   certificate:r?.certificate?{complete:r.certificate.complete,nodes:r.certificate.nodes,evaluated:r.certificate.evaluated,pruned:r.certificate.pruned,ceGroups:r.certificate.ceGroups}:null,
   heapUsed:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss})
 }catch(e){parentPort.postMessage({id:current,status:'error',error:String(e.stack||e)})}
})
parentPort.postMessage({ready:true})
