// Sample several promising parties before a large literal equipment search.
// The exact pass always restarts from its root. Sampling is neither a proof
// nor a pruning rule; its only lasting effect is an exactly settled incumbent.
export function* prioritizeScoreTeamDomain(d,state,enumerate,{enabled=true,now=()=>performance.now()}={}){
  const large=d.rows.length>12||d.ownCes.length>4||d.supportCes.length>16
  const literal=d.grand||d.systemSupport||d.arithmeticBounds===false||d.partyConstraints&&!d.safeOrdinaryUpper
  if(enabled&&large&&literal&&state.phase==='optimizing'&&!state.recoveries){
    let began=null
    const startNodes=state.stats.nodes,startEvaluated=state.stats.evaluated
    const probe=Object.create(state);probe.guidanceOnly=true;probe.useBounds=false
    // Enumeration owns its stock counters. Do not let an early return from
    // a suspended generator leave the subsequent exact pass short of copies.
    const sampleDomain={...d,ownTypes:undefined,guidanceSource:d}
    try{
      for(const event of enumerate(sampleDomain,probe)){
        // Cached CE preparation is needed by the exact pass too. Start the
        // extra-work clock when member/equipment exploration actually begins.
        if(state.stats.nodes>startNodes)began??=now()
        yield event
        if(began!=null&&now()-began>=150||state.stats.nodes-startNodes>=4096||state.stats.evaluated-startEvaluated>=64)break
      }
    }finally{
      state.stats.guidanceNodes=(state.stats.guidanceNodes||0)+state.stats.nodes-startNodes
      state.stats.guidanceEvaluated=(state.stats.guidanceEvaluated||0)+state.stats.evaluated-startEvaluated
    }
  }
  yield* enumerate(d,state)
}
