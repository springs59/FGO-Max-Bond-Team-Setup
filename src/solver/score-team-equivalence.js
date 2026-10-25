// A family stores a legal representative plus constrained substitution pools.
// It is searched directly; physical variants are expanded only on request.
// Identity pools never overlap: an identity with non-equivalent forms stays
// separate, so choosing its first available representative is lossless.
export function compileScoreEquivalence(d,{ordinary,rateFor,flatFor,effectsFor,grand=false}={}) {
  const protectedIds=new Set([...d.requiredIds,...Object.keys(d.fixedPositions).map(Number),
    ...d.pins.map(p=>p.svtId),...d.pinCes.map(p=>p.svtId)].filter(Boolean))
  const protectedCes=new Set([...d.pinCes.map(p=>p.ceId),...d.pins.flatMap(p=>[p.ceId,p.ceBondId,p.ceRewardId]),d.lockSupportCeId].filter(Boolean))
  const grandIds=new Set(d.grandIds),bondOwners=grand?d.ownCes.filter(c=>c.bondEquipOwner):[]
  // Equal complete recipient profiles impose the same member distinction.
  // Compare each distinct column once, rather than thousands of zero-CE
  // columns for every form. This changes neither stock nor CE identity pools.
  const rateProfiles=ordinary&&effectsFor?[...new Map([...d.ownCes.map(c=>effectsFor(c,false).rates),...d.supportCes.map(c=>effectsFor(c,true).rates)].map(rates=>[JSON.stringify(rates),rates])).values()]:null
  const rowSignature=(r,i)=>ordinary?JSON.stringify([r.cost,!!r.maxed,r.self,r.ownAura,r.contribution,
    grand&&(!grandIds.size||grandIds.has(r.svt.id)),bondOwners.map(c=>Number(c.bondEquipOwner)===r.svt.id),
    d.optimizeBy==='prefer'&&d.preferIds.includes(r.svt.id),d.pins.map(p=>!p.formKey||r.form.key===p.formKey),
    rateProfiles?rateProfiles.map(rates=>rates[i]):[d.ownCes.map(c=>rateFor(c,r.form,false,c.accountMlb!==false)),
    d.supportCes.map(c=>rateFor(c,r.form,true,c.supportMlb!==false))]]):String(r.svt.id)+':'+r.form.key
  const signatures=d.rows.map(rowSignature),byIdentity=new Map()
  d.rows.forEach((r,i)=>{if(!byIdentity.has(r.svt.id))byIdentity.set(r.svt.id,new Set());byIdentity.get(r.svt.id).add(signatures[i])})
  const groups=new Map(),rows=[],catalog={version:1,rows:[],ownCes:[],supportCes:[],seatGroups:[]}
  for(let i=0;i<d.rows.length;i++){
    const r=d.rows[i],isolated=protectedIds.has(r.svt.id)||byIdentity.get(r.svt.id).size>1
    const key=signatures[i]+(isolated?'|identity:'+r.svt.id:'')
    let group=groups.get(key)
    if(group==null){group=rows.length;groups.set(key,group);rows.push({...r,equivalentRows:[],equivalentGroup:group});catalog.rows.push([])}
    rows[group].equivalentRows.push(r)
    catalog.rows[group].push({svt:r.svt.id,art:r.form.key==='default'?'':r.form.key})
  }
  function equipment(ces,support){
    const map=new Map(),result=[],list=support?catalog.supportCes:catalog.ownCes
    for(const c of ces){
      const mlb=support?c.supportMlb!==false:c.accountMlb!==false
      // Grand reward/bond fields share physical stock with normal CEs.
      // Keep equipment identity/MLB pools literal; compress members and seats.
      const key=ordinary&&!grand?JSON.stringify([support?0:c.cost||0,effectsFor?effectsFor(c,support).flat:flatFor(c,mlb,support),
        effectsFor?effectsFor(c,support).rates:d.rows.map(r=>rateFor(c,r.form,support,mlb)),protectedCes.has(c.id)?c.id:0]):`${c.id}:${Number(mlb)}`
      let group=map.get(key)
      if(group==null){group=result.length;map.set(key,group);result.push({...c,equivalentGroup:group,equivalentCopies:[],left:0});list.push([])}
      const entry=result[group],variant=entry.equivalentCopies.find(v=>v.id===c.id&&v.mlb===mlb)
      if(variant){variant.count++;variant.left++;list[group].find(v=>v.id===c.id&&v.mlb===mlb).count++}
      else{entry.equivalentCopies.push({id:c.id,mlb,count:1,left:1,ce:c});list[group].push({id:c.id,mlb,count:1})}
      entry.left++
    }
    return result
  }
  const ownTypes=equipment(d.ownCes,false),supportTypes=equipment(d.supportCes,true)
  const supportCes=grand?d.supportCes.map(c=>({...c,equivalentGroup:supportTypes.find(t=>t.id===c.id&&(t.supportMlb!==false)===(c.supportMlb!==false)).equivalentGroup})):supportTypes
  const fixedSeats=new Set([...d.pins.map(p=>p.position),...Object.values(d.fixedPositions)])
  if(grand&&d.grandPosition)fixedSeats.add(d.grandPosition)
  if(d.layouts.length===1&&d.layouts[0])fixedSeats.add(d.layouts[0])
  const seats=new Map()
  for(let p=1;p<=6;p++){
    const key=ordinary&&!fixedSeats.has(p)?(p<=3?'front':'back'):'fixed:'+p
    if(!seats.has(key))seats.set(key,[]);seats.get(key).push(p)
  }
  catalog.seatGroups=[...seats.values()]
  d.equivalenceCatalog=catalog
  // A budgeted probe may find the final best family before the full pass.
  // Its records need the query's catalog immediately, including on stop.
  if(d.guidanceSource)d.guidanceSource.equivalenceCatalog=catalog
  return {...d,guidanceSource:d.guidanceSource||d,rows,ownTypes,supportCes}
}

// Names and pictures are resolved by the UI. The archive references this
// catalog once, rather than copying substitution lists into every record.
export function scoreFamilyInfo(record,catalog) {
  if(!catalog||!record.packed.equivalence)return null
  const own=record.packed.slots.filter(s=>s.f&&!s.s)
  return {version:1,seatGroups:catalog.seatGroups.filter(g=>g.length>1),
    members:own.map(s=>({position:s.p,options:catalog.rows[s.rg]||[]})),
    equipment:record.packed.slots.filter(s=>s.f&&s.cg>=0).map(s=>({position:s.p,support:!!s.s,group:s.cg,
      options:(s.s?catalog.supportCes:catalog.ownCes)[s.cg]||[]}))}
}

const physicalKey=s=>JSON.stringify([s.f,s.s,s.g,s.svt,s.art||'',s.ce,s.mlb!==false,s.bond||0,s.reward||0,s.bondMlb!==false,s.rewardMlb!==false])
// Grand identity and extra equipment must travel with the whole slot. They
// are distinct abstract roles, not interchangeable normal-CE assignments.
const abstractKey=s=>s.f?(s.s?'support':`own:${s.rg}`)+':'+s.cg+':'+JSON.stringify([s.g||0,s.bond||0,s.reward||0,s.bondMlb!==false,s.rewardMlb!==false]):'empty'

// Optional lazy expansion for audits or an explicitly selected family. Pool
// capacities and all-different servant identities are enforced jointly.
// Do not call this on the normal search, page, or export path.
export function* expandScoreTeamFamily(record,catalog,{fixedMembers=null,cooperative=false}={}) {
  if(!catalog||!record.packed.equivalence){yield record;return}
  const slots=record.packed.slots.map(s=>({...s})),own=slots.filter(s=>s.f&&!s.s),used=new Set()
  const normalize=art=>!art||art==='default'||art==='d'?'':art
  const wanted=fixedMembers&&new Map(fixedMembers.map(s=>[s.p,s]))
  const allowed=fixedMembers&&new Set(fixedMembers.filter(s=>s.f&&!s.s).map(s=>`${s.svt}:${normalize(s.art)}`))
  let work=0
  const matches=(s,p)=>{const target=wanted?.get(p);return !wanted||target&&!!s.f===!!target.f&&(!s.f||!!s.s===!!target.s&&!!s.g===!!target.g&&s.svt===target.svt&&normalize(s.art)===normalize(target.art))}
  const equipment=slots.filter(s=>s.f&&s.cg>=0),stock=new Map()
  for(let g=0;g<catalog.ownCes.length;g++)for(const c of catalog.ownCes[g])stock.set(`${g}:${c.id}:${c.mlb}`,c.count)
  // Extra fields were enumerated literally. Reserve their copies before
  // expanding the normal equipment's shared substitution pools.
  for(const s of own)for(const [field,mlbField] of [['bond','bondMlb'],['reward','rewardMlb']])if(s[field]){
    const g=catalog.ownCes.findIndex(pool=>pool.some(c=>c.id===s[field]&&c.mlb===(s[mlbField]!==false)))
    const k=`${g}:${s[field]}:${s[mlbField]!==false}`
    if(g<0||!stock.get(k))return
    stock.set(k,stock.get(k)-1)
  }
  function canonical(){
    for(const positions of catalog.seatGroups){
      const last=new Map()
      for(const p of positions){const s=slots[p-1],abstract=abstractKey(s),physical=physicalKey(s)
        if(last.has(abstract)&&last.get(abstract)>physical)return false
        last.set(abstract,physical)
      }
    }
    return true
  }
  function* permute(group=0){
    if(group===catalog.seatGroups.length){
      yield {...record,packed:{...record.packed,equivalence:undefined,slots:slots.map((s,i)=>{
        const {rg,cg,...physical}=s;return {...physical,p:i+1}
      })}};return
    }
    const positions=catalog.seatGroups[group],items=positions.map(p=>slots[p-1]),taken=new Set()
    function* assign(at){
      if(at===positions.length){yield* permute(group+1);return}
      const seen=new Set()
      for(let i=0;i<items.length;i++)if(!taken.has(i)){
        if(cooperative&&++work%128===0)yield {type:'tick'}
        if(!matches(items[i],positions[at]))continue
        const key=physicalKey(items[i]);if(seen.has(key))continue;seen.add(key)
        taken.add(i);slots[positions[at]-1]=items[i];yield* assign(at+1);taken.delete(i)
      }
    }
    yield* assign(0)
    positions.forEach((p,i)=>{slots[p-1]=items[i]})
  }
  function* equips(at){
    if(at===equipment.length){if(canonical())yield* permute();return}
    const s=equipment[at],pool=(s.s?catalog.supportCes:catalog.ownCes)[s.cg]
    for(const c of pool){const key=`${s.cg}:${c.id}:${c.mlb}`
      if(cooperative&&++work%128===0)yield {type:'tick'}
      if(!s.s&&!stock.get(key))continue
      if(!s.s)stock.set(key,stock.get(key)-1)
      s.ce=c.id;s.mlb=c.mlb;yield* equips(at+1)
      if(!s.s)stock.set(key,stock.get(key)+1)
    }
  }
  function* members(at){
    if(at===own.length){yield* equips(0);return}
    const s=own[at]
    for(const option of catalog.rows[s.rg])if(!used.has(option.svt)&&(!allowed||allowed.has(`${option.svt}:${normalize(option.art)}`))){
      if(cooperative&&++work%128===0)yield {type:'tick'}
      s.svt=option.svt;s.art=option.art;used.add(option.svt);yield* members(at+1);used.delete(option.svt)
    }
  }
  yield* members(0)
}
