import {physicalVariantKey} from './score-team-diversity.js'
export function familyRecord(record,catalog){
  if(!record||!catalog||record.packed.equivalence)return record
  const slots=record.packed.slots.map(s=>({...s,
    rg:s.f&&!s.s?catalog.rows.findIndex(pool=>pool.some(o=>o.svt===s.svt&&(o.art||'')===(s.art||''))):-1,
    cg:s.f&&s.ce?(s.s?catalog.supportCes:catalog.ownCes).findIndex(pool=>pool.some(o=>o.id===s.ce&&o.mlb===(s.mlb!==false))):-1}))
  if(slots.some(s=>s.f&&!s.s&&s.rg<0||s.f&&s.ce&&s.cg<0))return record
  return {...record,packed:{...record.packed,equivalence:1,slots}}
}
export function scoreRecordKey(record,catalog){
  if(!record.packed.equivalence||!catalog)return JSON.stringify([record.domain,record.score,record.packed.external||null,physicalVariantKey(record.packed.slots)])
  return JSON.stringify([record.domain,record.score,catalog.seatGroups.map(group=>group.map(p=>{
    const s=record.packed.slots[p-1]
    return JSON.stringify(s.f?[s.s||0,s.g||0,s.s?s.svt||0:s.rg,s.s?s.art||'':'',s.cg??-1,s.bond||0,s.bondMlb!==false,s.reward||0,s.rewardMlb!==false]:[])
  }).sort())])
}
