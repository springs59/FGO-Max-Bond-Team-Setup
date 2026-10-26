import {packedTeamOf,physicalVariantKey} from './score-team-diversity.js'

// Reuse only literal, currently legal parties. This does no roster search
// and never trusts archived scores, account facts, COST or equipment stock.
export function evaluateReuseDomain(d,plans){
 if(d.partyConstraints||d.systemSupport)return []
 const stock=new Map(),friends=new Map(),key=(id,mlb)=>`${id}:${mlb!==false}`
 for(const c of d.ownCes)stock.set(key(c.id,c.accountMlb),(stock.get(key(c.id,c.accountMlb))||0)+1)
 for(const c of d.supportCes)friends.set(key(c.id,c.supportMlb),(friends.get(key(c.id,c.supportMlb))||0)+1)
 const result=[],seen=new Set()
 for(const source of plans||[]){
  if(!source?.ok||!Array.isArray(source.slots)||source.slots.length!==6)continue
  const slots=packedTeamOf(source),own=slots.filter(s=>s.f&&!s.s),support=slots.filter(s=>s.f&&s.s),grands=own.filter(s=>s.g)
  if(slots.some((s,i)=>s.p!==i+1)||support.length>1||!d.layouts.includes(support[0]?.p||0)||own.length<d.minimumOwn||!slots.some(s=>s.f&&s.p<=3))continue
  if(new Set(own.map(s=>s.svt)).size!==own.length||d.requiredIds.some(id=>!own.some(s=>s.svt===id)))continue
  if(own.some(s=>!d.rows.some(r=>r.svt.id===s.svt&&(r.form.key==='default'?'':r.form.key)===s.art)||d.fixedPositions[s.svt]&&d.fixedPositions[s.svt]!==s.p))continue
  if(d.grand?(grands.length!==1||d.grandPosition&&grands[0].p!==d.grandPosition||d.grandIds.length&&!d.grandIds.includes(grands[0].svt)):grands.length>0)continue
  if(support.some(s=>Boolean(s.g)!==Boolean(d.grand)||s.bond))continue
  if(slots.some(s=>(!s.f&&(s.ce||s.bond||s.reward))||s.f&&!s.g&&(s.bond||s.reward)))continue
  if(d.pins.some(p=>{const s=slots[p.position-1];return !s||p.empty&&!p.reserved&&s.f||p.svtId&&(!s.f||s.s||s.svt!==p.svtId)||p.support&&(!s.f||!s.s)||p.formKey&&s.art!==(p.formKey==='default'?'':p.formKey)||
   ['ceId','ceBondId','ceRewardId'].some((f,i)=>p[f]&&s[['ce','bond','reward'][i]]!==p[f])}))continue
  if(d.pinCes.some(p=>!own.some(s=>s.ce===p.ceId&&(!p.svtId||s.svt===p.svtId)))||d.lockSupportCeId&&support[0]?.ce!==d.lockSupportCeId)continue
  const used=new Map(),friendUsed=new Map()
  let valid=true
  for(const s of slots.filter(s=>s.f))for(const [f,m] of [['ce','mlb'],['bond','bondMlb'],['reward','rewardMlb']])if(s[f]){
   const pool=s.s?d.supportCes:d.ownCes,k=key(s[f],s[m]),usage=s.s?friendUsed:used
   const c=pool.find(c=>key(c.id,s.s?c.supportMlb:c.accountMlb)===k)
   if(!c||f==='bond'&&Number(c.bondEquipOwner)!==s.svt){valid=false;break}
   usage.set(k,(usage.get(k)||0)+1)
  }
  if(!valid||[...used].some(([k,n])=>n>(stock.get(k)||0))||[...friendUsed].some(([k,n])=>n>(friends.get(k)||0)))continue
  const signature=physicalVariantKey(slots)
  if(seen.has(signature))continue
  const plan=d.hydrate({slots})
  if(!plan?.ok||d.costLimit!=null&&plan.costUsed>d.costLimit)continue
  seen.add(signature);result.push(plan)
 }
 return result
}
