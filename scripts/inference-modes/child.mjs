import {pathToFileURL} from 'node:url'
import {validatePlan} from '../version-report-validate.mjs'
let source, kind, model, createSession, resolveReply
process.on('message',async m=>{
  try{
    if(m.type==='init'){
      const began=performance.now();kind=m.kind
      const url=p=>pathToFileURL(m.root+'/src/'+p)
      const {selectQueryModel}=await import(url('solver/query-models.js'))
      const {SEARCH_MODEL}=await import(url('solver/ai-model.js'))
      createSession=(await import(url('solver/query-ai.js'))).createQuerySession
      model=selectQueryModel(SEARCH_MODEL,m.queryModel)
      if(kind==='core')source=await import(url('solver/inventory-curve-solver.js'))
      else{
        globalThis.self={postMessage(reply){if(['result','error'].includes(reply.type))resolveReply(reply)}}
        await import(url('recommend-worker.js'))
      }
      process.send({type:'ready',initMs:performance.now()-began});return
    }
    const session=createSession(),opts=m.opts,cpuStart=process.cpuUsage(),began=performance.now()
    let result
    if(kind==='core')result=source.solveInventoryCurves({...opts,formsOf:s=>opts.forms[s.id],stateOf:s=>opts.states[s.id]||{},
      aiMode:m.aiMode,aiModel:model,querySession:session})
    else{
      const promise=new Promise(resolve=>{resolveReply=resolve})
      await self.onmessage({data:{id:m.id,opts:{...opts,aiMode:m.aiMode,aiModel:model,skipResultCache:true,accountProfileId:'inference-'+m.id}}})
      const reply=await promise
      if(!reply.ok)throw Error(reply.error||'Worker failed')
      result=reply.result.value
    }
    const ms=performance.now()-began,cpu=process.cpuUsage(cpuStart),valid=kind==='core'?Boolean(result):result?.ok===true
    const ai=kind==='core'?result?.certificate?.ai:result?.resultStatus?.ai
    const summary={id:m.id,status:'ok',ms,cpuMs:(cpu.user+cpu.system)/1000,valid,
      facts:valid?(kind==='core'?[result.score,result.cost]:[result.total,result.costUsed,result.preferBond||0,result.bond15Count||0,result.priorityScore||0]):null,
      alternatives:valid&&kind==='core'&&opts.allSupportAlternatives?Object.fromEntries(result.plans.map(p=>{const s=p.slots.find(x=>x.s);return[(s?.ce||0)+':'+(s?.p||0),[p.score,p.cost]]})):null,
      inferenceCalls:kind==='core'?session.inferenceCalls:(result?.queryStats?.aiInferenceCalls??ai?.inferenceCalls??0),
      inferenceMs:kind==='core'?session.inferenceMs:(result?.queryStats?.aiInferenceMs??ai?.inferenceMs??0),
      ai,cacheHit:Boolean(result?.queryStats?.cacheHit),heapMiB:process.memoryUsage().heapUsed/2**20,rssMiB:process.resourceUsage().maxRSS/1024}
    const validateBegan=performance.now()
    if(valid){validatePlan(opts,result,kind==='core');if(kind==='core')for(const p of result.plans||[])validatePlan(opts,p,true)}
    summary.validationMs=performance.now()-validateBegan
    // Round-trip includes the actual production result, not only statistics.
    process.send({...summary,wireResult:kind==='core'?undefined:result})
  }catch(error){process.send({id:m.id,status:'error',error:String(error.stack||error)})}
})
