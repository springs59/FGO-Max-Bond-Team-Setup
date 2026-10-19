import { applyRate } from '../bond.js'

export function proposePartyFrameworks({ rows, vectors, rate, flat, ceCost, selected,
  support, layout, base, costLimit, required, requiredSeats, fixedPositions,
  minimumOwn, priorities, auraMax }) {
  const budget=costLimit==null?Infinity:costLimit-ceCost
  const frontBase=applyRate(base,layout.position>0&&layout.position<=3?240:200)
  const backBase=applyRate(base,layout.position>0&&layout.position<=3?40:0)
  const flatTotal=flat+(layout.position?support.flat:0)
  const minimum=Math.max(1,minimumOwn,selected.length,required.size)
  const capacity=layout.positions.length
  if(budget<0||minimum>capacity)return []
  const eligible=(r,seat)=> {
    const fixed=fixedPositions[r.svt.id]
    return requiredSeats[r.svt.id]!== (seat==='front'?'back':'front') &&
      (!fixed||layout[seat].includes(fixed))
  }
  const value=(r,seat,aura)=> {
    const v=vectors[r.vector]
    return v.maxed?0:applyRate(seat==='front'?frontBase:backBase,
      rate[r.vector]+(layout.position?support.rates[r.vector]:0)+v.self+aura-v.aura)+flatTotal
  }
  function settle(front,back) {
    const members=[...front,...back],ids=new Set(members.map(r=>r.svt.id))
    if(front.length<1||front.length>layout.front.length||back.length>layout.back.length||
      members.length<minimum||ids.size!==members.length||[...required].some(id=>!ids.has(id)))return null
    const occupied=new Set()
    for(const [seat,items] of [['front',front],['back',back]])for(const r of items){
      if(!rows.includes(r)||!eligible(r,seat))return null
      const fixed=fixedPositions[r.svt.id]
      if(fixed&&occupied.has(fixed))return null
      if(fixed)occupied.add(fixed)
    }
    const cost=ceCost+members.reduce((n,r)=>n+r.cost,0)
    if(costLimit!=null&&cost>costLimit)return null
    const aura=members.reduce((n,r)=>n+r.contribution,0)
    const score=front.reduce((n,r)=>n+value(r,'front',aura),0)+back.reduce((n,r)=>n+value(r,'back',aura),0)
    if(!Number.isSafeInteger(score)||!Number.isSafeInteger(cost))return null
    return {front,back,aura,live:members.filter(r=>!vectors[r.vector].maxed).length,
      cost,score,layout,ownCes:selected.slice(),supportCe:layout.position?support.ce:null}
  }
  const results=[]
  for(const economy of [false,true]){
    const front=[],back=[],used=new Set();let spent=0
    const pending=[...required]
    for(let step=0;step<capacity;step++){
      const requiredId=pending.shift()
      let best=null,bestRank=-Infinity
      const reserve=pending.reduce((n,id)=>n+Math.min(...rows.filter(r=>r.svt.id===id).map(r=>r.cost)),0)
      for(const r of rows){
        if(used.has(r.svt.id)||requiredId!=null&&r.svt.id!==requiredId||spent+r.cost+reserve>budget)continue
        for(const seat of ['front','back']){
          if((seat==='front'?front:back).length===layout[seat].length||!eligible(r,seat))continue
          if(seat==='back'&&!front.length&&front.length+back.length===capacity-1)continue
          const optimistic=value(r,seat,auraMax)+r.contribution*base*Math.max(1,minimum-1)/1000
          const priority=priorities.get(r)??0.5
          const rank=optimistic*(0.8+0.4*priority)/(economy?1+r.cost:1)-r.cost*1e-6
          if(rank>bestRank){bestRank=rank;best={r,seat}}
        }
      }
      if(!best)break
      used.add(best.r.svt.id);spent+=best.r.cost
      ;(best.seat==='front'?front:back).push(best.r)
      const candidate=settle(front.slice(),back.slice())
      if(candidate)results.push(candidate)
    }
  }
  return results
}
