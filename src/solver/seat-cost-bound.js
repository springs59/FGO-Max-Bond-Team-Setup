// Exact minimum COST for the resource-only problem: actual seats, distinct
// identities, unlocked forms, mandatory members and optional empty positions.
// Rewards and auras are ignored, so these are safe feasibility lower bounds.
// Only 64 masks per identity; no party enumeration or temporary file is used.
export function seatCostBounds(rows,layouts,required,requiredSeats={},fixedPositions={},minimumOwn=1) {
  return layouts.map(layout=>{
    const available=layout.positions.reduce((mask,p)=>mask|1<<(p-1),0)
    const front=layout.front.reduce((mask,p)=>mask|1<<(p-1),0)
    const groups=new Map()
    for(const r of rows){
      const id=r.svt.id,fixed=fixedPositions[id]
      let mask=available
      if(requiredSeats[id]==='front')mask&=front
      if(requiredSeats[id]==='back')mask&=~front
      if(fixed)mask&=1<<(fixed-1)
      let costs=groups.get(id)
      if(!costs){costs=new Float64Array(6).fill(Infinity);groups.set(id,costs)}
      for(let p=0;p<6;p++)if(mask&(1<<p))costs[p]=Math.min(costs[p],r.cost)
    }
    let dp=new Float64Array(64).fill(Infinity);dp[0]=0
    if([...required].some(id=>!groups.has(id)))dp.fill(Infinity)
    for(const [id,costs] of groups){
      const next=required.has(id)?new Float64Array(64).fill(Infinity):dp.slice()
      for(let mask=0;mask<64;mask++)if(Number.isFinite(dp[mask]))for(let p=0;p<6;p++){
        if(mask&(1<<p)||!Number.isFinite(costs[p]))continue
        const at=mask|1<<p
        next[at]=Math.min(next[at],dp[mask]+costs[p])
      }
      dp=next
    }
    const result=Array(7).fill(Infinity)
    for(let mask=0;mask<64;mask++)if(mask&front){
      let count=0;for(let x=mask;x;x&=x-1)count++
      if(count<minimumOwn)continue
      for(let n=0;n<=count;n++)result[n]=Math.min(result[n],dp[mask])
    }
    return result
  })
}
