import {globalFirstMultiplier} from './global-envelope.js'
import {globalMemberPositions} from './global-curve-expand.js'

export function describeGlobalCurve(c,meta) {
  const positions=globalMemberPositions(c),live=positions.filter(i=>c[8+i]),support=meta.supports[c[1]]
  const hits=g=>({fielded:positions.filter(i=>g.flat||g.rates[c[14+i]]>0).length,eligible:live.filter(i=>g.flat||g.rates[c[14+i]]>0).length})
  const groupDescription=(g,items,count)=>({kind:g.kind||(g.flat?'portrait':new Set(g.rates).size>1?'conditional':'universal'),count,items,flat:g.flat,rate:Math.max(...g.rates)/10,nominalRates:[...new Set(items.map(x=>x.nominalRate??Math.max(...g.rates)/10))],...hits(g)})
  const equipment=meta.groups.flatMap((g,j)=>c[20+j]?[groupDescription(g,g.items.slice(0,c[20+j]),c[20+j])]:[])
  const rewardGroup=c.at(-1)?.rewardGroup??-1,rewardCounts=c.at(-1)?.rewardCounts||meta.groups.map((_,j)=>j===rewardGroup?1:0),rewards=meta.groups.flatMap((g,j)=>rewardCounts[j]?g.items.slice(c[20+j]-rewardCounts[j],c[20+j]):[]),reward=rewards[0]||null
  const assigned=equipment.flatMap(g=>g.items).filter(x=>!rewards.some(r=>r.id===x.id))
  const members=positions.map((i,j)=>({position:i+1,row:meta.rows[c[14+i]],index:c[14+i],ce:assigned[j]||null,capped:!c[8+i],first:globalFirstMultiplier(c,meta,i),second:c[8+i],flat:50*c[2]+support.flat,hits:equipment.map(g=>({names:g.items.map(x=>x.name),rate:meta.groups.find(x=>x.items[0]?.id===g.items[0]?.id).rates[c[14+i]]/10,flat:g.flat,count:g.count})),supportRate:support.rates[c[14+i]]/10,supportHits:(support.parts||[support]).map(p=>({kind:p.kind,rate:p.rates[c[14+i]]/10,nominalRate:p.items[0]?.nominalRate||0,flat:p.flat,count:p.items.length?1:0}))}))
  const ownEquipped=equipment.reduce((s,g)=>s+g.count,0),party=positions.reduce((s,i)=>s+meta.rows[c[14+i]].party,0),grandCandidates=meta.rules?.grand?members.filter(m=>!meta.rules.grandPositions?.length||meta.rules.grandPositions.includes(m.position)):[],grandMembers=[]
  if(meta.rules?.grandSlots>1){const used=new Map();for(const m of grandCandidates){const cl=m.row.ruleRole>>8,limit=cl===8?2:1;if((used.get(cl)||0)>=limit)continue;used.set(cl,(used.get(cl)||0)+1);grandMembers.push(m);if(grandMembers.length===rewards.length)break}if(!rewards.length)grandMembers.length=0}
  else if(grandCandidates.length&&(rewards.length||!meta.rules?.generic))grandMembers.push(grandCandidates[0])
  grandMembers.forEach((grand,i)=>{grand.grand=true;grand.reward=rewards[i]||null;grand.bondCe=grand.row.bondCeName||'对应从者的10绊礼装（可空置）'});const grand=grandMembers[0]||null
  const parts=support.parts||[support]
  return {layout:c[0],cost:c[7],ownCount:c[3],eligible:live.length,capped:c[5],ownEquipped,ownNormal:assigned.length,ownEmpty:c[3]-assigned.length,grand,grandMembers,reward,rewards,emptySlots:6-c[3]-(support.external?.length??(c[0]?1:0)),portraits:c[2],equipment,support:c[0]?{external:support.external||null,kind:support.external?(support.external.some(s=>s.friend)?support.external.length>1?'mixed':'friend':'system'):'friend',position:c[0]===2?'前排':'后排',seat:support.external?.find(x=>x.friend)?.position||support.external?.[0]?.position||meta.rules?.supportPosition||(c[0]===2?3:6),equipped:support.equipmentCount??(support.items.length?1:0),parts:parts.map(p=>groupDescription(p,p.items,p.items.length?1:0)),...groupDescription(support,support.items,1)}:null,members,party:party/10,guestParty:c[6]*meta.guestPartyMax/10,flat:50*c[2]+support.flat}
}

// Anonymous effects are the display identity. Concrete servants only witness
// realizability and cannot split an otherwise identical effect tab.
export function globalAnonymousEffects(d){
 const types=new Map();d.equipment.forEach((g,i)=>{const key=JSON.stringify([g.kind,g.nominalRates,g.flat]);if(!types.has(key))types.set(key,{kind:g.kind,rates:g.nominalRates,flat:g.flat,count:0,indices:[]});const t=types.get(key);t.count+=g.count;t.indices.push(i)})
 const owned=[...types.values()].sort((a,b)=>JSON.stringify([a.kind,a.rates,a.flat]).localeCompare(JSON.stringify([b.kind,b.rates,b.flat]))),members=d.members.map(m=>({position:m.position,capped:m.capped,first:m.first,second:m.second,self:m.row.self,party:m.row.party,activity:m.row.activity,hits:owned.map(t=>t.indices.reduce((s,i)=>s+(m.hits[i].rate>0?d.equipment[i].count:0),0)),support:[...m.supportHits].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),supportRate:m.supportRate,flat:m.flat}))
 return {owned,members}
}
export function globalCurveContentKey(c,meta) {
 const d=describeGlobalCurve(c,meta),a=globalAnonymousEffects(d)
 return JSON.stringify([d.cost,d.ownCount,d.capped,d.ownNormal,d.rewards.length,d.flat,a.owned.map(t=>[t.kind,t.rates,t.flat,t.count]),d.support?.external?.map(s=>[s.name,s.position,s.friend])||[],a.members.map(m=>[m.position<=3,m.capped,m.first,m.second,m.hits,m.support,m.self,m.party,m.activity?[(m.activity.self||0),(m.activity.questCampaign||0),(m.activity.party||0),m.activity.partyApplySupport,(m.activity.sources||[]).some(s=>s.type==='extraPassive')]:null]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))])
}
export function mergeGlobalIntervals(intervals,records,meta) {
 const groups=new Map()
 for(const x of intervals){const key=globalCurveContentKey(records[x.id],meta);if(!groups.has(key))groups.set(key,{id:x.id,ids:[],ranges:[]});const g=groups.get(key);if(!g.ids.includes(x.id))g.ids.push(x.id);g.ranges.push([x.lo,x.hi])}
 return [...groups.values()].map(g=>{g.ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const out=[];for(const range of g.ranges){const last=out.at(-1);if(last&&range[0]<=last[1]+1)last[1]=Math.max(last[1],range[1]);else out.push(range.slice())}return {...g,ranges:out}})
}
