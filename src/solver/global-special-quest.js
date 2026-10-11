// The phase script is authoritative for forced costumes and guest seats.
// Unknown preset-deck / Grand equipment details are kept as explicit blockers.
export function globalTraitMatch(row,values=[]) {
  return values.some(v=>Number(v)===row.id||(row.traits||row.traitIds||[]).includes(Number(v)))
}
export function compileSpecialGlobalRules(quest,nice,raw) {
  const frontGroups=[],banned=[],unique=[],unsupported=[],flags=nice.flags||quest.flags||[],script=raw.mstQuestPhase?.script||{}
  let ownMin=1,ownMax=6,totalMin=1,totalMax=6,frontMin=1,allowed=null,supportPositions=[6],grandPositions=[]
  const forms={}
  for(let i=0;i<(script.overwriteLimitCountSvtIds||[]).length;i++){
    const id=script.overwriteLimitCountSvtIds[i],limit=script.overwriteLimitCounts[i];(forms[id]??=[]).push(limit)
  }
  for(const row of nice.restrictions||[]){const r=row.restriction,vals=(r.targetVals||[]).map(Number),v=vals[0]
    if(['mySvtNum','svtNum'].includes(r.type)&&vals.length===1&&['equal','below','above'].includes(r.rangeType)&&v>=0&&v<=6){
      if(r.type==='mySvtNum'&&r.rangeType==='equal'&&v===6){ownMax=6;continue}
      if(r.type==='mySvtNum'){if(r.rangeType!=='below')ownMin=Math.max(ownMin,v);if(r.rangeType!=='above')ownMax=Math.min(ownMax,v);if(v===0)ownMin=0}
      else {if(r.rangeType!=='below')totalMin=Math.max(totalMin,v);if(r.rangeType!=='above')totalMax=Math.min(totalMax,v)}
    }else if(r.type==='svtNum'&&r.rangeType==='between'&&vals.length===2){totalMin=vals[0];totalMax=vals[1]}
    else if(r.type==='individuality'&&r.rangeType==='notEqual')banned.push(...vals)
    else if(r.type==='uniqueIndividuality')unique.push(...vals)
    else if(r.type==='fixedSupportPosition'&&vals.every(v=>v>=1&&v<=6))supportPositions=vals
    else if(r.type==='fixedMySvtIndividualitySingle'){allowed=vals;ownMin=Math.max(1,ownMin)}
    else if(r.type==='fixedMySvtIndividualityPositionMain'){for(const v of vals)frontGroups.push({values:[v],ownOnly:true})}
    else if(['mySvtOrNpc','mySvtOrSupport'].includes(r.type))frontGroups.push({values:vals,ownOnly:false})
    else if(r.type==='fixedCostume'){for(const v of vals)if(!forms[v])unsupported.push('缺少强制形态编号：'+v)}
    else if(r.type==='activeGrandBoard')grandPositions=vals
    else unsupported.push(r.name||r.type)
    if(/スターティングメンバーに[\s\S]*3騎/.test(row.dialogMessage||''))frontMin=3
  }
  if(flags.includes('supportOnlyBattle')){ownMin=0;ownMax=0}
  const grandSlots=grandPositions.length
  const grand=grandSlots>0
  return {ownMin,ownMax,totalMin,totalMax,frontMin,frontGroups,frontMask:(1<<frontGroups.length)-1,banned,unique,allowed,supportPositions,forms,grandPositions,grandSlots,grand,requireFront:true,unsupported,supported:!unsupported.length,phaseScript:script}
}
export function restrictSpecialGlobalRows(source,rules,servants) {
  const byId=new Map(servants.map(s=>[s.id,s])),ids=[]
  for(let i=0;i<source.rows.length;i++){
    const row=source.rows[i];if(globalTraitMatch(row,rules.banned)||rules.allowed&&!globalTraitMatch(row,rules.allowed))continue
    if(rules.forms[row.id]){const s=byId.get(row.id),keys=(s?.forms||[]).filter(f=>rules.forms[row.id].includes(f.costumeId)).map(f=>f.key);if(!keys.includes(row.form))continue}
    ids.push(i)
  }
  const project=g=>({...g,rates:ids.map(i=>g.rates[i]),...(g.parts?{parts:g.parts.map(project)}:{})})
  const rows=ids.map(i=>({...source.rows[i],ruleRole:rules.frontGroups.reduce((m,g,j)=>m|(globalTraitMatch(source.rows[i],g.values)?1<<j:0),0)|(rules.grandSlots>1?((({saber:1,archer:2,lancer:3,rider:4,caster:5,assassin:6,berserker:7})[source.rows[i].className]||8)<<8):0)}))
  return {...source,rows,groups:source.groups.map(project),supports:source.supports.map(project),rules,identities:new Set(rows.map(r=>r.id)).size,forms:rows.length}
}
export function specialGuestPlacements(quest,nice,rules) {
  const flags=nice.flags||[],all=nice.supportServants||[],supports=all.map(s=>({...s,id:s.id,svtId:s.svt.id,traits:(s.detailTraits||s.traits||[]).map(t=>Number(t.id??t)),name:s.name&&s.name!=='NONE'?s.name:s.svt.name,required:(s.followerFlags||[]).includes('fixedNpc')}))
  const noList=flags.includes('noSupportList'),npcOnly=nice.isNpcOnly||noList,allFixed=flags.includes('supportOnlyBattle'),multi=flags.includes('supportSvtMultipleSet')
  if(allFixed)return [supports.map((s,i)=>({...s,position:s.script?.eventDeckIndex||i+1}))]
  const fixed=supports.filter(s=>s.script?.eventDeckIndex),replace=supports.filter(s=>!s.script?.eventDeckIndex&&(s.followerFlags||[]).includes('isMySvtOrNpc')),normal=supports.filter(s=>!s.script?.eventDeckIndex&&!(s.followerFlags||[]).includes('isMySvtOrNpc'))
  const base=fixed.map(s=>({...s,position:s.script.eventDeckIndex})),out=[]
  const forced=normal.filter(s=>s.required),normalChoices=forced.length?forced:normal
  const mustNormal=normalChoices.length>0&&(npcOnly||forced.length>0),allowFriend=!npcOnly&&!quest.noSupport&&!flags.includes('eventDeckNoSupport')&&!forced.length&&!flags.includes('supportOnlyForceBattle')
  // A forced guest with a deck index is an additional guest, so a regular
  // friend can coexist unless the phase explicitly disables its selection.
  const choices=[...(allowFriend?[{friend:true,name:'好友助战',svtId:0,traits:[]}]:[]),...normalChoices]
  if(!mustNormal&&!allowFriend)choices.unshift(null)
  if(!choices.length)choices.push(null)
  const pos=rules.supportPositions?.length===1&&rules.supportPositions[0]===6?[1,2,3,4,5,6]:rules.supportPositions
  function replacements(at,list){if(at===replace.length){for(const pick of choices){if(!pick){out.push(list);continue}for(const position of pos){if(list.some(s=>s.position===position))continue;out.push([...list,{...pick,position}])}}return}
    replacements(at+1,list)
    if(multi||!list.some(s=>(s.followerFlags||[]).includes('isMySvtOrNpc')))for(let position=1;position<=6;position++){if(list.some(s=>s.position===position))continue;replacements(at+1,[...list,{...replace[at],position}])}
  }
  replacements(0,base)
  return out.filter(list=>list.length<=6&&new Set(list.map(s=>s.position)).size===list.length)
}
