import {createScoreEffects,usefulScoreEquipment} from './score-team-effects.js'
import {physicalVariantKey} from './score-team-diversity.js'

// Fast, literal alternatives while the complete family archive is still being
// collected. Full browsing uses the archive, not this finite neighbourhood.
export function* localEquipmentTeams(record,d){
  if(!d||d.partyConstraints||d.systemSupport)return
  const source=record.packed.slots,own=source.filter(s=>s.f&&!s.s)
  const picked=own.map(s=>{const i=d.rows.findIndex(r=>r.svt.id===s.svt&&(r.form.key==='default'?'':r.form.key)===(s.art||''));return {i,r:d.rows[i]}})
  if(picked.some(x=>!x.r))return
  const effects=createScoreEffects(d),stock=new Map(),friends=new Map(),seen=new Set([physicalVariantKey(source)])
  const key=(id,mlb)=>`${id}:${mlb!==false}`
  for(const c of d.ownCes)stock.set(key(c.id,c.accountMlb),(stock.get(key(c.id,c.accountMlb))||0)+1)
  for(const c of d.supportCes)friends.set(c.id,(friends.get(c.id)||0)+1)
  const fields=source.flatMap((s,i)=>s.f?[{i,field:'ce',mlb:'mlb'},...(s.g?[{i,field:'reward',mlb:'rewardMlb'}]:[])]:[])
  const pinFor=(s,f)=>d.pins.find(p=>p.position===s.p)?.[f==='ce'?'ceId':'ceRewardId']||
    (f==='ce'?(s.s?d.lockSupportCeId:d.pinCes.find(p=>p.svtId===s.svt)?.ceId):0)||0
  let work=0
  function accept(slots){
    const signature=physicalVariantKey(slots);if(seen.has(signature))return null
    const usage=new Map(),supportUsage=new Map()
    for(const s of slots.filter(s=>s.f))for(const [f,m] of [['ce','mlb'],['bond','bondMlb'],['reward','rewardMlb']])if(s[f]){
      if(s.s){supportUsage.set(s[f],(supportUsage.get(s[f])||0)+1);continue}
      const k=key(s[f],s[m]);usage.set(k,(usage.get(k)||0)+1)
    }
    if([...usage].some(([k,n])=>n>(stock.get(k)||0))||[...supportUsage].some(([id,n])=>n>(friends.get(id)||0)))return null
    for(const f of fields){
      const s=slots[f.i],pin=pinFor(s,f.field);if(pin&&s[f.field]!==pin)return null
      if(s[f.field]){
        const c=(s.s?d.supportCes:d.ownCes).find(c=>c.id===s[f.field]&&((s.s?c.supportMlb:c.accountMlb)!==false)===(s[f.mlb]!==false))
        if(!c)return null
        const explicit=pin||!s.s&&f.field==='ce'&&d.pinCes.some(p=>!p.svtId&&p.ceId===s.ce)
        if(!explicit&&!usefulScoreEquipment(effects(c,!!s.s),picked,d.base))return null
      }
    }
    if(d.pinCes.some(p=>p.ceId&&!slots.some(s=>s.f&&!s.s&&s.ce===p.ceId&&(!p.svtId||s.svt===p.svtId))))return null
    const packed={...record.packed,equivalence:undefined,slots},plan=d.hydrate(packed)
    if(!plan?.ok||d.costLimit!=null&&plan.costUsed>d.costLimit||(d.optimizeBy==='prefer'?plan.preferBond:plan.total)!==record.score)return null
    seen.add(signature);return {...record,packed:{...packed,cost:plan.costUsed}}
  }
  for(let a=0;a<fields.length;a++)for(let b=a+1;b<fields.length;b++){
    if(++work%16===0)yield {type:'tick'}
    const x=fields[a],y=fields[b];if(!!source[x.i].s!==!!source[y.i].s)continue
    const slots=source.map(s=>({...s})),sx=slots[x.i],sy=slots[y.i]
    ;[sx[x.field],sy[y.field]]=[sy[y.field]||0,sx[x.field]||0]
    ;[sx[x.mlb],sy[y.mlb]]=[sy[y.mlb]!==false,sx[x.mlb]!==false]
    const result=accept(slots);if(result)yield result
  }
  for(const f of fields){
    const s=source[f.i],pool=s.s?d.supportCes:d.ownCes
    for(const c of [null,...new Map(pool.map(c=>[key(c.id,s.s?c.supportMlb:c.accountMlb),c])).values()]){
      if(++work%16===0)yield {type:'tick'}
      const slots=source.map(s=>({...s}));slots[f.i][f.field]=c?.id||0;slots[f.i][f.mlb]=!c||(s.s?c.supportMlb:c.accountMlb)!==false
      const result=accept(slots);if(result)yield result
    }
  }
}
