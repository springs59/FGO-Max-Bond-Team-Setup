// Separate exact objective optimization from complete tie collection. A
// counterexample revokes the proof and restarts every domain without score
// bounds; physical feasibility/COST constraints and proven equivalences stay.
export function* enumerateScoreTeamPhases({domains,state,infeasibleDomains=new Set(),enumerateDomain}){
  const recordKey=record=>JSON.stringify([record.domain,record.packed])
  let improvementKey=null
  search:while(true){
    for(const phase of ['optimizing','collecting']){
      state.phase=phase
      if(phase==='collecting'){
        state.maximumProven=Number.isFinite(state.bestScore)
        if(!state.maximumProven)break
        state.optimizationStats={...state.stats}
        yield {type:'phase',phase}
      }
      for(let domain=0;domain<domains.length;domain++){
        if(infeasibleDomains.has(domain))continue
        const d=domains[domain]
        for(const event of enumerateDomain(d,state)){
          if(event.type==='tick'){yield event;continue}
          const {packed}=event,plan=event.score==null?d.hydrate(packed):null
          if(event.score==null&&!plan?.ok)continue
          const score=event.score??(d.optimizeBy==='prefer'?plan.preferBond:plan.total)
          if(!Number.isSafeInteger(score))throw Error('配队得分超出精确整数范围')
          const record={domain,score,packed}
          if(score>state.bestScore){
            const previousBestScore=state.bestScore,recovery=phase==='collecting'
            state.bestScore=score
            if(recovery){
              state.maximumProven=false;state.complete=false;state.phase='optimizing'
              state.useBounds=false;state.recoveries=(state.recoveries||0)+1
            }
            // Only the final strict improvement can overlap the next tie pass.
            // Forget its key once restored, so large tie sets need no hashing.
            // A DP witness is a physical preview, while the collector may
            // archive a whole equivalence family containing that witness.
            // Keep previews outside the archive so that family appears once.
            improvementKey=event.proofOnly?null:recordKey(record)
            yield {type:'best',score,record,...(event.proofOnly?{checkpoint:true}:{}),...(recovery?{recovery:true,previousBestScore}:{})}
            if(state.collectSettled)yield {type:'settled',record}
            if(!event.proofOnly)yield {type:'team',record}
            if(recovery)continue search
          }else{
            if(state.collectSettled)yield {type:'settled',record}
            if(phase!=='collecting'||score!==state.bestScore)continue
            if(improvementKey&&improvementKey===recordKey(record)){improvementKey=null;continue}
            yield {type:'team',record}
          }
        }
      }
    }
    state.complete=true;state.maximumProven=Number.isFinite(state.bestScore);state.phase='finished'
    return
  }
}
