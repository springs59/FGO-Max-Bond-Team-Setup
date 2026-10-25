import {pickCeSkill,ceMatchesServant} from '../atlas.js'

const blank=p=>({p,f:0,s:0,g:0,svt:0,art:'',ce:0,mlb:true,bond:0,reward:0})
export const physicalTeamKey=packed=>JSON.stringify(packed.slots.map(s=>[s.p,s.f,s.s,s.f?s.g:0,s.svt,s.art||'',s.ce,s.ce?s.mlb!==false:true,s.bond||0,s.reward||0,s.bond?s.bondMlb!==false:true,s.reward?s.rewardMlb!==false:true]))

// The requested result domain leaves optional, provably zero-gain equipment
// empty. This oracle checks literal recipients directly, without the cached
// effect tables, equivalence pools or optimization engine.
export function oracleUsefulEquipment(d,packed){
 const own=packed.slots.filter(s=>s.f&&!s.s),recipients=own.map(s=>d.rows.find(r=>r.svt.id===s.svt&&r.form.key===(s.art||'default'))).filter(r=>r&&!r.maxed)
 for(const s of packed.slots.filter(s=>s.f))for(const field of ['ce','reward','bond']){
  const id=s[field];if(!id)continue
  const pin=d.pins.find(p=>p.position===s.p),key=field==='ce'?'ceId':field==='reward'?'ceRewardId':'ceBondId'
  if(pin?.[key]===id||s.s&&field==='ce'&&d.lockSupportCeId===id||!s.s&&field==='ce'&&d.pinCes.some(p=>p.ceId===id&&p.svtId===s.svt))continue
  const unbound=!s.s&&field==='ce'&&d.pinCes.some(p=>p.ceId===id&&!p.svtId)&&!d.pinCes.some(p=>p.ceId===id&&p.svtId)
  if(unbound&&own.filter(x=>x.ce===id).length===1)continue
  if(field==='bond')return false
  const mlb=field==='ce'?s.mlb!==false:s.rewardMlb!==false
  const c=(s.s?d.supportCes:d.ownCes).find(c=>c.id===id&&(s.s?c.supportMlb!==false:c.accountMlb!==false)===mlb)
  const fs=(pickCeSkill(c,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!s.s||f.target==='ptFull'&&f.applySupport!==0))
  // General non-party/negative/conditional-flat effects are settled exactly
  // by the fallback and are not classified as removable here.
  if(fs.some(f=>[f.rate||0,f.followerRate??f.rate??0,f.add||0].some(v=>!Number.isSafeInteger(v)||v<0)||f.target!=='ptFull'&&((f.rate||0)||(f.add||0))||(f.add||0)&&(f.tvals?.length||f.andTvals?.length)))continue
  if(!recipients.some(r=>fs.some(f=>(f.add||0)>0||d.base>0&&(s.s?(f.followerRate??f.rate??0):f.rate||0)>0&&ceMatchesServant(f,r.form.traitIds||[]))))return false
 }
 return true
}

// Independent literal construction: assign physical members first and check
// every final seat constraint, then all stock-valid equipment. No production
// bounds, Grand-seat pruning or equivalence compiler is used by this oracle.
export function literalScoreTeams(d){
 const result=new Set(),slots=Array.from({length:6},(_,i)=>blank(i+1)),used=new Set()
 const copies=new Map();for(const c of d.ownCes){const k=c.id+':'+(c.accountMlb!==false);if(!copies.has(k))copies.set(k,{c,n:0});copies.get(k).n++}
 for(const support of d.layouts){
  for(let i=0;i<6;i++)slots[i]=blank(i+1)
  if(support)Object.assign(slots[support-1],{f:1,s:1,g:Number(d.grand)})
  const positions=[1,2,3,4,5,6].filter(p=>p!==support)
  function members(at){
   if(at<positions.length){
    const p=positions[at]
    slots[p-1]=blank(p);members(at+1)
    if(d.pins.some(pin=>pin.position===p&&pin.empty&&!pin.reserved))return
    for(const r of d.rows)if(!used.has(r.svt.id)){
     used.add(r.svt.id);slots[p-1]={...blank(p),f:1,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key};members(at+1);used.delete(r.svt.id)
    }
    slots[p-1]=blank(p);return
   }
   const own=slots.filter(s=>s.f&&!s.s)
   if(own.length<d.minimumOwn||!own.length||!slots.slice(0,3).some(s=>s.f)||d.requiredIds.some(id=>!own.some(s=>s.svt===id)))return
   if(d.pins.some(pin=>pin.position===support&&(pin.svtId||pin.empty&&!pin.reserved&&!pin.support)))return
   if(own.some(s=>d.fixedPositions[s.svt]&&d.fixedPositions[s.svt]!==s.p))return
   if(d.pins.some(pin=>!pin.support&&(pin.svtId&&slots[pin.position-1].svt!==pin.svtId||pin.formKey&&slots[pin.position-1].art!==(pin.formKey==='default'?'':pin.formKey))))return
   for(const g of d.grand?own:[null]){
    if(d.grand&&(d.grandPosition?g.p!==d.grandPosition:g.p>3))continue
    if(d.grand&&d.grandIds.length&&!d.grandIds.includes(g.svt))continue
    for(const s of own)s.g=Number(s===g)
    if(d.pins.some(pin=>pin.position!==support&&(pin.ceBondId||pin.ceRewardId)&&pin.position!==g?.p))continue
    const fields=own.map(s=>({s,f:'ce'})).concat(g?[{s:g,f:'reward'},{s:g,f:'bond'}]:[])
    function equipment(j,cost){
     if(d.costLimit!=null&&cost>d.costLimit)return
     if(j===fields.length){
      const normal=support?(d.lockSupportCeId?d.supportCes.filter(c=>c.id===d.lockSupportCeId):[null,...d.supportCes]):[null]
      for(const ce of normal)for(const reward of support&&d.grand?[null,...d.supportCes]:[null]){
       if(ce&&reward&&ce.id===reward.id&&d.supportCes.filter(c=>c.id===ce.id).length<2)continue
       if(support)Object.assign(slots[support-1],{ce:ce?.id||0,mlb:ce?.supportMlb!==false,reward:reward?.id||0,rewardMlb:true})
       if(d.pins.some(pin=>{const s=slots[pin.position-1];return pin.ceId&&s.ce!==pin.ceId||pin.ceBondId&&s.bond!==pin.ceBondId||pin.ceRewardId&&s.reward!==pin.ceRewardId}))continue
       if(d.pinCes.some(pin=>!own.some(s=>s.ce===pin.ceId&&(!pin.svtId||s.svt===pin.svtId))))continue
       if(oracleUsefulEquipment(d,{slots}))result.add(physicalTeamKey({slots}))
      }
      return
     }
     const {s,f}=fields[j],pin=d.pins.find(p=>p.position===s.p),forced=f==='ce'?(pin?.ceId||d.pinCes.find(p=>p.svtId===s.svt)?.ceId||0):f==='bond'?pin?.ceBondId||0:pin?.ceRewardId||0
     s[f]=0;if(!forced)equipment(j+1,cost)
     for(const v of copies.values())if(v.n&&(!forced||v.c.id===forced)&&(f!=='bond'||forced||Number(v.c.bondEquipOwner)===s.svt)){
      v.n--;s[f]=v.c.id;s[f==='ce'?'mlb':f+'Mlb']=v.c.accountMlb!==false
      equipment(j+1,cost+(f==='ce'?v.c.cost||0:0));v.n++
     }
     s[f]=0
    }
    equipment(0,own.reduce((n,s)=>n+d.rows.find(r=>r.svt.id===s.svt&&r.form.key===(s.art||'default')).cost,0))
   }
  }
  members(0)
 }
 return result
}

