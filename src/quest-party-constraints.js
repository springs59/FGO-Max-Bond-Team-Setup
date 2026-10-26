// Account search rules use structured phase metadata, never quest-name guesses.
// Every predicate is also evaluated on the final physical party.
const six=[1,2,3,4,5,6]
const rec=row=>row.restriction||row
export const QUEST_RESTRICTION_TYPES=Object.freeze(['mySvtNum','svtNum','individuality','supportOnly','fixedSupportPosition','fixedMySvtIndividualitySingle','fixedMySvtIndividualityPositionMain','mySvtOrSupport','uniqueIndividuality','mySvtOrNpc','fixedCostume','activeGrandBoard','fixedSvtIndividualityPositionMain','myGrandSvt'])
export const traitMatches=(row,values)=>values.some(v=>Number(v)===Number(row.svtId??row.svt?.id??row.id)||(row.traitIds||row.form?.traitIds||[]).includes(Number(v)))
export function needsExtendedPartyRules(quest={}){
 const flags=quest.flags||[],supports=quest.supportServants||[]
 return flags.includes('supportOnlyBattle')||flags.includes('supportSvtMultipleSet')||supports.some(s=>s.script?.eventDeckIndex||(s.followerFlags||[]).includes('isMySvtOrNpc')||s.equips?.length>1)||
  (quest.restrictions||[]).some(row=>{const r=rec(row);return !(['mySvtNum','svtNum'].includes(r.type)&&r.rangeType==='equal'&&r.targetVals?.length===1&&Number(r.targetVals[0])===6||r.type==='fixedSupportPosition'&&r.targetVals?.length===1)})
}
export function compilePartyConstraints(quest={}){
 const flags=quest.flags||[],unsupported=[],counts=[],seatRules=[],unique=[],costumes={},grandPositions=[],grandRules=[]
 let ownMin=1,ownMax=6,totalMin=1,totalMax=6,supportOnly=flags.includes('supportOnlyBattle'),supportPositions=six.slice(),requiresSupport=false
 let noSupport=Boolean(quest.noSupport||flags.includes('eventDeckNoSupport')||(flags.includes('noSupportList')||quest.isNpcOnly)&&!quest.supportServants?.length&&!quest.npcSupportCount)
 for(const row of quest.restrictions||[]){
  const r=rec(row),values=(r.targetVals||[]).map(Number),seats=(r.targetVals2||[]).map(Number),range=r.rangeType||'none'
  if(['mySvtNum','svtNum'].includes(r.type)){
   if(!['equal','notEqual','below','above','between'].includes(range)||values.length!==(range==='between'?2:1)||values.some(v=>!Number.isInteger(v)||v<0||v>6)){unsupported.push(r.name||r.type);continue}
   counts.push({own:r.type==='mySvtNum',range,values})
   const lo=range==='equal'||range==='above'||range==='between'?values[0]:0,hi=range==='equal'||range==='below'?values[0]:range==='between'?values[1]:6
   if(r.type==='mySvtNum'){ownMin=Math.max(ownMin,lo);ownMax=Math.min(ownMax,hi);if(hi===0)ownMin=0}else{totalMin=Math.max(totalMin,lo);totalMax=Math.min(totalMax,hi)}
  }else if(r.type==='supportOnly'){supportOnly=true;requiresSupport=true}
  else if(r.type==='fixedSupportPosition'){
   if(!values.length||values.some(v=>!six.includes(v)))unsupported.push(r.name||r.type)
   else{supportPositions=supportPositions.filter(p=>values.includes(p));requiresSupport=true}
  }else if(r.type==='individuality'){
   if(!['equal','notEqual'].includes(range))unsupported.push(r.name||r.type)
   else seatRules.push({kind:'eligible',values,seats:seats.length?seats:six,negate:range==='notEqual',source:'all'})
  }else if(r.type==='fixedMySvtIndividualitySingle')seatRules.push({kind:'eligible',values,seats:six,source:'own'})
  else if(r.type==='fixedMySvtIndividualityPositionMain'){
   // This type requires an owned starting member. targetVals2 is not a
   // universal absolute-seat field: current phases also use [1] alongside
   // an NPC fixed at eventDeckIndex=1, while their game dialog says starting
   // member, not slot 1. Keep that member requirement separate from NPC
   // occupancy and user pins. Do not guess at unseen parameter variants.
   if(seats.length&&!(seats.length===1&&seats[0]===1)&&!(seats.length===3&&new Set(seats).size===3&&seats.every(p=>p>=1&&p<=3))){unsupported.push('未核验的必选首发参数：'+seats.join('/'));continue}
   for(const value of values)seatRules.push({kind:'required',values:[value],seats:[1,2,3],source:'own',deployment:'starting-member'})
  }else if(r.type==='mySvtOrNpc'||r.type==='mySvtOrSupport')seatRules.push({kind:'required',values,seats:seats.length?seats:six,source:r.type==='mySvtOrNpc'?'own-or-npc':'own-or-support'})
  else if(r.type==='fixedSvtIndividualityPositionMain'){
   if(range==='notEqual')seatRules.push({kind:'eligible',values,seats:[1,2,3],negate:true,source:'all'})
   else {seatRules.push({kind:'front-only',values,seats:[1,2,3],source:'all'});for(const value of values)seatRules.push({kind:'required',values:[value],seats:[1,2,3],source:'all'})}
  }else if(r.type==='uniqueIndividuality')unique.push(...values)
  else if(r.type==='fixedCostume')for(const value of values)costumes[value]=[]
  else if(r.type==='activeGrandBoard')grandPositions.push(...values)
  else if(r.type==='myGrandSvt'){
   // Current raid phases require exactly one owned eligible Grand. The two
   // duplicate restrictions supply separate game dialogs, not two members.
   if(range!=='equal'||seats.length||!values.length){unsupported.push('未核验的己方冠位参数');continue}
   if(!grandRules.some(r=>JSON.stringify(r.values)===JSON.stringify(values)))grandRules.push({values,min:1,max:1})
  }
  else unsupported.push(r.name||r.type||'未识别的编成限制')
 }
 const script=quest.partyScript||{}
 for(let i=0;i<(script.overwriteLimitCountSvtIds||[]).length;i++){
  const id=Number(script.overwriteLimitCountSvtIds[i]);(costumes[id]??=[]).push(Number(script.overwriteLimitCounts?.[i]))
 }
 for(const [id,limits] of Object.entries(costumes))if(!limits.length)unsupported.push('缺少强制形象编号：'+id)
 if(totalMax===1&&quest.supportServants?.length&&!counts.some(c=>c.own&&['equal','above','between'].includes(c.range)&&c.values[0]>0)&&!seatRules.some(r=>r.kind==='required'&&r.source==='own'))ownMin=0
 if(supportOnly){ownMin=0;ownMax=0}
 if(noSupport&&requiresSupport)unsupported.push('禁止助战与必选助战相互冲突')
 for(const rule of grandRules)seatRules.push({kind:'required',values:rule.values,seats:grandPositions.length?[...new Set(grandPositions)]:six.slice(),source:'own',grandCapable:true})
 return {extended:true,noSupport,requiresSupport,supportOnly,supportPosition:supportPositions[0]||6,supportPositions,supportPolicy:noSupport?'none':quest.supportPolicy||((flags.includes('noSupportList')||flags.includes('supportOnlyForceBattle'))&&quest.supportServants?.length?'system':(quest.supportServants||[]).length?'either':'friend'),
  ownMin,ownMax,totalMin,totalMax,counts,seatRules,unique:[...new Set(unique)],costumes,grandPositions:[...new Set(grandPositions)],grandRules,infiniteCost:Boolean(script.isInfinityCost),
  unsupported,supported:!unsupported.length,ownCount:ownMin,partyCount:totalMin}
}
// Quest-derived requirements are explanatory, never persistent user pins.
// Identities come from this phase's metadata; no named servant is hardcoded.
export function questDeploymentSummary(quest={},servants=[]){
 const rules=compilePartyConstraints(quest),lines=[],byId=new Map(servants.map(s=>[Number(s.id),s.name]))
 const label=id=>byId.get(Number(id))||'身份/特性 '+id
 for(const npc of quest.supportServants||[]){
  const p=Number(npc.script?.eventDeckIndex)
  if(p)lines.push('副本固定出战：NPC '+(byId.get(Number(npc.svtId))||(npc.name&&npc.name!=='NONE'?npc.name:'从者 '+npc.svtId))+'占 '+p+' 号位')
 }
 for(const rule of rules.seatRules.filter(r=>r.deployment==='starting-member'))lines.push('副本必选首发：己方'+rule.values.map(label).join(' / ')+'须在 1–3 号位，可在空闲首发位安排')
 for(const c of rules.counts){
  const [a,b]=c.values,comparison=c.range==='equal'?'恰好 '+a:c.range==='notEqual'?'不能为 '+a:c.range==='below'?'最多 '+a:c.range==='above'?'至少 '+a:a+'–'+b
  lines.push('副本人数要求：'+(c.own?'己方':'全队')+comparison+' 人')
 }
 if(rules.grandRules.length)lines.push('副本冠位要求：编入 1 名符合指定特性的己方冠位，助战不能替代己方')
 if(lines.length)lines.push('其余成员按配队条件搜索；副本要求仅对当前关卡阶段生效')
 return lines
}
function sourceMatches(row,source){return source==='all'||source==='own'&&!row.isSupport||source==='own-or-npc'&&(!row.isSupport||row.supportKind==='system')||source==='own-or-support'&&(!row.isSupport||row.isSupport)}
export function partyRowAllowed(row,position,rules){
 return rules.seatRules.every(rule=>{
  if(!sourceMatches(row,rule.source))return true
  if(rule.kind==='front-only')return !traitMatches(row,rule.values)||rule.seats.includes(position)
  if(rule.kind!=='eligible'||!rule.seats.includes(position))return true
  return traitMatches(row,rule.values)!==Boolean(rule.negate)
 })
}
export function partyRuleSatisfied(rule,rows){
 return rows.some(row=>rule.seats.includes(row.position)&&sourceMatches(row,rule.source)&&(!rule.grandCapable||row.grandCapable||row.isGrand)&&(rule.source==='own-or-support'&&row.isSupport||traitMatches(row,rule.values)))
}
export function validatePartyConstraints(rows,rules,{pendingGrand=false}={}){
 const filled=rows.filter(r=>r.filled),own=filled.filter(r=>!r.isSupport)
 if(filled.length<rules.totalMin||filled.length>rules.totalMax||own.length<rules.ownMin||own.length>rules.ownMax||!filled.some(r=>r.position<=3))return false
 for(const rule of rules.counts){const n=rule.own?own.length:filled.length,[a,b]=rule.values
  if(!(rule.range==='equal'?n===a:rule.range==='notEqual'?n!==a:rule.range==='below'?n<=a:rule.range==='above'?n>=a:n>=a&&n<=b))return false
 }
 if(filled.some(r=>!partyRowAllowed(r,r.position,rules)))return false
 if(rules.seatRules.some(rule=>rule.kind==='required'&&!partyRuleSatisfied(rule,filled)))return false
 if(rules.unique.some(value=>filled.filter(row=>traitMatches(row,[value])).length>1))return false
 if(!pendingGrand&&rules.grandRules.some(rule=>{const n=own.filter(row=>row.isGrand&&traitMatches(row,rule.values)).length;return n<rule.min||n>rule.max}))return false
 return true
}
