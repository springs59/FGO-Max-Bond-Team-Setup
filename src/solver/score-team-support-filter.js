// Index only support equipment actually represented by a collected team.
// A compact family's support CE pool is lossless and independent of own stock.
export function supportCeIds(record,catalog){
  const slot=record?.packed?.slots?.find(s=>s.f&&s.s)
  if(!slot)return []
  const pool=record.packed.equivalence&&slot.cg>=0?catalog?.supportCes?.[slot.cg]:null
  return [...new Set(pool?.length?pool.map(c=>c.id):[slot.ce||0])]
}
export function supportFamily(record,catalog,id){
  if(id==null)return {record,catalog}
  if(!supportCeIds(record,catalog).includes(id))return null
  const slot=record.packed.slots.find(s=>s.f&&s.s)
  if(!record.packed.equivalence||slot.cg<0||!catalog)return {record,catalog}
  const pool=catalog.supportCes[slot.cg].filter(c=>c.id===id),chosen=pool.find(c=>c.mlb===(slot.mlb!==false))||pool[0]
  return {record:{...record,packed:{...record.packed,slots:record.packed.slots.map(s=>s===slot?{...s,ce:chosen.id,mlb:chosen.mlb}:s)}},
    catalog:{...catalog,supportCes:catalog.supportCes.map((p,i)=>i===slot.cg?pool:p)}}
}
export function createSupportIndex(){
  const byId=new Map(),pools=new WeakMap()
  const idsFor=(r,c)=>{
    const slot=r.packed.slots.find(s=>s.f&&s.s),pool=r.packed.equivalence&&slot?.cg>=0?c?.supportCes?.[slot.cg]:null
    if(!pool)return supportCeIds(r,c)
    if(!pools.has(pool))pools.set(pool,[...new Set(pool.map(c=>c.id))])
    return pools.get(pool)
  }
  return {
    add(record,catalog){for(const id of idsFor(record,catalog)){if(!byId.has(id))byId.set(id,{counts:new Map(),total:0,max:-Infinity});const row=byId.get(id);row.counts.set(record.score,(row.counts.get(record.score)||0)+1);row.total++;row.max=Math.max(row.max,record.score)}},
    counts(id){return new Map(byId.get(id)?.counts||[])},
    summary(bestScore){return [...byId].map(([id,row])=>({id,score:row.max,bestCount:row.counts.get(bestScore)||0,otherCount:row.total-(row.counts.get(bestScore)||0)})).sort((a,b)=>b.score-a.score||a.id-b.id)},
  }
}
