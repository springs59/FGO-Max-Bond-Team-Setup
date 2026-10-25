// One physical representative per distinct set of owned identities. Do not
// enumerate seat/CE permutations before reaching the next member composition.
export function* distinctMemberTeams(record,catalog){
  if(!record?.packed?.equivalence||!catalog){if(record)yield record;return}
  const slots=record.packed.slots.map(s=>({...s})),own=slots.filter(s=>s.f&&!s.s),used=new Set()
  const lastByGroup=new Map()
  function* visit(at){
    if(at===own.length){yield {...record,packed:{...record.packed,equivalence:undefined,slots:slots.map(s=>({...s}))}};return}
    const s=own[at],previous=lastByGroup.get(s.rg)
    // Identity pools are disjoint. Ascending IDs within a pool remove member
    // swaps; CE assignments and extra equipment stay on their legal roles.
    const options=[...new Map((catalog.rows[s.rg]||[]).map(o=>[o.svt,o])).values()].sort((a,b)=>a.svt-b.svt)
    for(const o of options)if(!used.has(o.svt)&&(previous==null||o.svt>previous)){
      s.svt=o.svt;s.art=o.art;used.add(o.svt);lastByGroup.set(s.rg,o.svt)
      yield* visit(at+1)
      used.delete(o.svt)
      if(previous==null)lastByGroup.delete(s.rg);else lastByGroup.set(s.rg,previous)
    }
  }
  yield* visit(0)
}
export const memberCompositionKey=plan=>JSON.stringify((plan.slots||[]).filter(s=>s.filled&&!s.isSupport).map(s=>Number(s.svtId)).sort((a,b)=>a-b))
const artKey=art=>!art||art==='default'||art==='d'?'':art
export const packedTeamOf=plan=>(Array.isArray(plan)?plan:plan.slots||[]).map(s=>({p:s.p??s.position,f:Number(!!(s.f??s.filled)),s:Number(!!(s.s??s.isSupport)),g:Number(!!(s.g??s.isGrand)),
  svt:s.svt??s.svtId??0,art:artKey(s.art??s.svtArtKey),ce:s.ce??s.ceId??0,mlb:(s.mlb??s.ceMlb)!==false,
  bond:s.bond??s.ceBondId??0,bondMlb:(s.bondMlb??s.ceBondMlb)!==false,reward:s.reward??s.ceRewardId??0,rewardMlb:(s.rewardMlb??s.ceRewardMlb)!==false})).sort((a,b)=>a.p-b.p)
export const memberPlacementKey=plan=>JSON.stringify(packedTeamOf(plan).map(s=>[s.p,s.f,...(s.f?[s.s,s.g,s.svt,s.art]:[])]))
export const physicalVariantKey=plan=>JSON.stringify(packedTeamOf(plan).map(s=>[s.p,s.f,...(s.f?[s.s,s.g,s.svt,s.art,s.ce,s.ce?s.mlb:true,s.bond,s.bond?s.bondMlb:true,s.reward,s.reward?s.rewardMlb:true]:[])]))

// Literal one-member neighbours can be equal under the selected equipment
// even when their responses to unused CEs differ. This is a view request,
// never an optimality proof or an addition to the complete family archive.
export function* localMemberTeams(record,d){
  if(!d||d.partyConstraints||d.systemSupport)return
  const own=record.packed.slots.filter(s=>s.f&&!s.s),used=new Set(own.map(s=>s.svt)),seen=new Set()
  const protectedIds=new Set([...d.requiredIds,...Object.keys(d.fixedPositions).map(Number),...d.pinCes.map(p=>p.svtId),...d.pins.map(p=>p.svtId)].filter(Boolean))
  const catalog=d.equivalenceCatalog;let work=0
  for(const slot of own){
    if(protectedIds.has(slot.svt))continue
    const pin=d.pins.find(p=>p.position===slot.p),pool=catalog?.rows.find(p=>p.some(o=>o.svt===slot.svt))||[]
    for(const r of d.rows){
      if(++work%16===0)yield {type:'tick'}
      if(used.has(r.svt.id)||pool.some(o=>o.svt===r.svt.id))continue
      if(pin?.formKey&&pin.formKey!==r.form.key)continue
      if(slot.g&&d.grandIds.length&&!d.grandIds.includes(r.svt.id))continue
      if(slot.bond&&Number(d.ceById.get(slot.bond)?.bondEquipOwner)!==r.svt.id)continue
      const packed={...record.packed,equivalence:undefined,slots:record.packed.slots.map(s=>s===slot?{...s,svt:r.svt.id,art:r.form.key==='default'?'':r.form.key}:{...s})}
      const key=JSON.stringify(packed.slots.filter(s=>s.f&&!s.s).map(s=>s.svt).sort((a,b)=>a-b))
      if(seen.has(key))continue
      const plan=d.hydrate(packed)
      if(!plan?.ok||Number.isFinite(d.costLimit)&&d.costLimit>=0&&plan.costUsed>d.costLimit)continue
      const score=d.optimizeBy==='prefer'?plan.preferBond:plan.total
      if(score!==record.score)continue
      seen.add(key);yield {...record,packed:{...packed,cost:plan.costUsed}}
    }
  }
}
