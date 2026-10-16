import { parentPort } from 'node:worker_threads'
import { makeDiverseCase, materialize, SPLIT_SEEDS } from './ai-diverse-cases.mjs'
import { prepareConfig, proposeConfigs, countConfigDomain, proposeIndependentConfigs } from './conditioned-config.mjs'
import { settleProposals, verifyConfigPlan } from './config-settler.mjs'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { SEARCH_MODEL } from '../src/solver/ai-model.js'
SPLIT_SEEDS.qualification=42000000
parentPort.on('message',m=>{
  try {
    const c=makeDiverseCase(m.split||'validation',m.index)
    if(c.kind!=='inventory'){parentPort.postMessage({id:m.id,status:'unsupported',index:m.index,family:c.family});return}
    const opts=materialize(c.opts),exactStart=performance.now(),exact=solveInventoryCurves({...opts,aiMode:'off'}),exactMs=performance.now()-exactStart
    if(!exact){parentPort.postMessage({id:m.id,status:'ok',index:m.index,family:c.family,proposalMs:0,ms:0,exactMs,proposalCount:0,checkpoints:[],score:null,cost:null,truth:null});return}
    const began=performance.now(),ctx=prepareConfig(opts)
    const counts=proposeConfigs(ctx,m.model,{width:m.width||32,top:m.top||8}),proposalMs=performance.now()-began,checkpoints=[]
    const neuralCount=counts.length,zero=ctx.groups.map(()=>0)
    if(!counts.some(c=>c.every(k=>k===0)))counts.push(zero)
    const result=settleProposals(opts,counts,(index,p)=>{
      verifyConfigPlan(opts,p)
      checkpoints.push({k:index+1,score:p?.score??null,cost:p?.cost??null,ms:performance.now()-began})
    })
    const ms=performance.now()-began
    let baseline=null
    if(m.compareBaseline){
      const suggestions=proposeIndependentConfigs(ctx,SEARCH_MODEL,{width:m.width||128,top:m.top||32}),zero=ctx.groups.map(()=>0)
      if(!suggestions.some(c=>c.every(k=>k===0)))suggestions.push(zero)
      const old=settleProposals(opts,suggestions);verifyConfigPlan(opts,old)
      baseline={score:old?.score??null,cost:old?.cost??null,proposals:suggestions.length}
    }
    parentPort.postMessage({id:m.id,status:'ok',index:m.index,family:c.family,identities:opts.servants.length,proposalMs,ms,exactMs,
      baseline,neuralCount,domainCount:countConfigDomain(ctx),proposalCount:counts.length,checkpoints,score:result?.score??null,cost:result?.cost??null,truth:exact?[exact.score,exact.cost]:null})
  } catch(error) {parentPort.postMessage({id:m.id,status:'error',index:m.index,error:String(error.stack||error)})}
})
parentPort.postMessage({ready:true})
