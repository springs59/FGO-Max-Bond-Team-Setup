import {compilePartyConstraints,partyRowAllowed,validatePartyConstraints} from '../quest-party-constraints.js'
import {availableSystemSupports} from '../quest-party-rules.js'
const positions=[1,2,3,4,5,6]
const npcRow=(s,p)=>({position:p,filled:true,isSupport:true,supportKind:'system',svtId:s.svtId,traitIds:s.detailTraits?.length?s.detailTraits:s.traitIds||[],support:s})
export function* externalPartyLayouts(quest,rules,account,allowSupport=true){
 const all=(quest.supportServants||[]).filter(s=>availableSystemSupports({supportServants:[s]},account).length)
 if((quest.supportServants||[]).some(s=>s.required&&!all.some(a=>a.id===s.id)))return
 const fixed=all.filter(s=>s.script?.eventDeckIndex),replace=all.filter(s=>!s.script?.eventDeckIndex&&(s.followerFlags||[]).includes('isMySvtOrNpc')),
  selectable=all.filter(s=>!s.script?.eventDeckIndex&&!(s.followerFlags||[]).includes('isMySvtOrNpc'))
 const base=fixed.map(s=>npcRow(s,Number(s.script.eventDeckIndex)))
 if(new Set(base.map(s=>s.position)).size!==base.length||base.some(s=>!positions.includes(s.position)||!partyRowAllowed(s,s.position,rules)))return
 const noList=(quest.flags||[]).includes('noSupportList'),allFixed=(quest.flags||[]).includes('supportOnlyBattle')
 if(allFixed){yield base.length?base:all.map((s,i)=>npcRow(s,Number(s.script?.eventDeckIndex)||i+1));return}
 const forced=selectable.filter(s=>s.required),choices=forced.length?[forced]:selectable.map(s=>[s])
 if((quest.flags||[]).includes('supportSvtMultipleSet')&&selectable.length>1){
  const optional=selectable.filter(s=>!s.required),limit=Math.min(6-base.length,rules.totalMax-rules.ownMin-base.length)
  choices.length=0
  function subsets(at,list){if(list.length>limit)return;if(at===optional.length){if(list.length)choices.push(list);return}subsets(at+1,list);subsets(at+1,[...list,optional[at]])}
  subsets(0,forced)
 }
 const npcOnly=quest.isNpcOnly||noList||(quest.flags||[]).includes('supportOnlyForceBattle')||quest.supportPolicy==='system'
 const friendAllowed=!rules.noSupport&&!npcOnly&&!forced.length&&allowSupport
 if(friendAllowed)choices.unshift([{friend:true}])
 if(!forced.length&&!npcOnly&&!rules.requiresSupport)choices.unshift([])
 if(!choices.length&&(!npcOnly||base.length||replace.length))choices.push([])
 if(rules.noSupport){if(!base.length){yield [];return}choices.splice(0,choices.length,[])}
 function* place(list,at,items){
  if(at===items.length){yield list;return}
  const s=items[at],seats=s.friend?rules.supportPositions:rules.supportPositions
  for(const p of seats)if(!list.some(x=>x.position===p)){
   const row=s.friend?{position:p,filled:true,isSupport:true,supportKind:'friend',friend:true,svtId:0,traitIds:[]}:npcRow(s,p)
   if(partyRowAllowed(row,p,rules))yield* place([...list,row],at+1,items)
  }
 }
 function* replacements(at,list){
  if(at===replace.length){for(const choice of choices)yield* place(list,0,choice);return}
  const s=replace[at]
  if(!s.required)yield* replacements(at+1,list)
  for(const p of positions)if(!list.some(x=>x.position===p)){
   const row=npcRow(s,p);if(partyRowAllowed(row,p,rules))yield* replacements(at+1,[...list,row])
  }
 }
 yield* replacements(0,base)
}
export function prepareQuestPartyDomain(opts,prepareBase,onDomain){
 const quest=opts.quest||{},rules=compilePartyConstraints(quest)
 if((quest.flags||[]).includes('supportOnlyBattle')&&!quest.supportServants?.length)return {ok:false,error:'全队固定助战缺少预设编队详情，请更新关卡数据。'}
 if(!rules.supported)return {ok:false,error:'该关卡含尚未支持或资料不完整的编成限制：'+rules.unsupported.join('、')}
 if((quest.npcSupportCount||0)>0&&!quest.supportServants?.length)return {ok:false,error:'该关卡缺少系统助战详情，请先更新关卡数据。'}
 if((quest.supportServants||[]).some(s=>s.required&&!availableSystemSupports({supportServants:[s]},opts.account).length))return {ok:false,error:'关卡必选系统助战未解锁或缺少可验证的解锁状态。'}
 const collision=rules.seatRules.find(rule=>rule.kind==='required'&&rule.source==='own'&&rule.seats.length===1&&(quest.supportServants||[]).some(s=>s.required&&Number(s.script?.eventDeckIndex)===rule.seats[0]))
 if(collision)return {ok:false,error:'关卡位置元数据存在冲突：必选己方从者与固定 NPC 同指 '+collision.seats[0]+' 号位，位置参数语义尚待核验；暂不返回可能非法的队伍。'}
 const forcedKeys=new Map(),servants=(opts.servants||[]).map(s=>{
  const limits=rules.costumes[s.id];if(!limits)return s
  const forms=(s.forms||[]).filter(f=>limits.includes(Number(f.costumeId))||!f.key.startsWith('c')&&limits.includes(Number(f.key.slice(1))))
  if(!forms.length)return s
  forcedKeys.set(s.id,new Set(forms.map(f=>f.key)));return s
 })
 const missing=Object.keys(rules.costumes).filter(id=>servants.some(s=>s.id===Number(id))&&!forcedKeys.has(Number(id)))
 if(missing.length)return {ok:false,error:'关卡强制形象缺少对应图鉴资料：'+missing.join('、')+'。请更新图鉴。'}
 const unlock=list=>(list||[]).map(r=>({...r,unlockedCostumes:[...(r.unlockedCostumes||[]),...[...(forcedKeys.get(r.id)||[])].filter(k=>k.startsWith('c')).map(k=>Number(k.slice(1)))]}))
 const account=opts.account?{...opts.account,servants:unlock(opts.account.servants),...(opts.account.raw?{raw:{...opts.account.raw,servants:unlock(opts.account.raw.servants)}}:{})}:opts.account
 const supportPins=(opts.slotPins||[]).filter(p=>!p.svtId&&(p.ceId||p.ceRewardId)&&opts.allowSupport!==false)
 const ownPins=(opts.slotPins||[]).filter(p=>!supportPins.includes(p))
 const cleanQuest={...quest,flags:[],restrictions:[],noSupport:true,supportServants:[],npcSupportCount:0,partyMetadataComplete:false,systemSupport:null,systemSupports:null,partyScript:{},isNpcOnly:false}
 let base
 const prepared=prepareBase({...opts,_basicParty:true,_allowEmptyParty:true,servants,account,quest:cleanQuest,
  allowSupport:false,lockSupportCeId:0,slotPins:ownPins,questType:'normal',grandPosition:0,costLimit:rules.infiniteCost?null:opts.costLimit,scoreTeamPrepareOnly:true,onScoreTeamDomain:d=>{base=d}})
 if(!prepared.ok)return prepared
 base.rows=base.rows.filter(r=>!forcedKeys.has(r.svt.id)||forcedKeys.get(r.svt.id).has(r.form.key))
 // A mandatory exact form is a phase override, not an account unlock mutation.
 const externalCes=(quest.supportServants||[]).flatMap(s=>(s.equips||[]).map(e=>e.ce).filter(Boolean))
 const allCes=[...(opts.ces||[]),...externalCes]
 const factory=function*(){
  for(const layout of externalPartyLayouts(quest,rules,opts.account,opts.allowSupport!==false)){
   if(layout.length>rules.totalMax||layout.length+rules.ownMax<rules.totalMin)continue
   if(supportPins.some(pin=>!layout.some(s=>s.friend&&s.position===Number(pin.position))))continue
   if(ownPins.some(pin=>layout.some(s=>s.position===Number(pin.position))&&(pin.svtId||pin.empty)))continue
   yield layout
  }
 }
 const byNpc=new Map((quest.supportServants||[]).map(s=>[s.id,s]))
 const d={...base,partyConstraints:rules,externalLayoutFactory:factory,supportPins,arithmeticBounds:false,minimumOwn:rules.ownMin,
  grand:opts.questType==='grand'||rules.grandPositions.length>0,grandRequired:opts.questType==='grand',grandPosition:Number(opts.grandPosition)||0,
  safeOrdinaryUpper:base.arithmeticBounds===true&&!(opts.bondBonuses?.extraPassives?.length||opts.bondBonuses?.questFriendships?.length),supportCes:base.supportCes,lockSupportCeId:Number(opts.lockSupportCeId)||0,
  hydrate:packed=>{
   const external=(packed.external||[]).map(s=>s.friend?{position:s.p,friend:true}:npcRow(byNpc.get(s.npc),s.p)),plan=base.hydrateParty(packed,{...quest,external},allCes)
   if(!plan||!validatePartyConstraints(plan.slots,rules))return null
   plan.questType=opts.questType||'normal';plan.useSupport=external.length>0
   for(const slot of plan.slots){slot.anySvt=false;slot.altSvtIds=[];slot.altSvtForms=[]}
   return plan
  },annotatePlans:()=>{},seed:()=>null}
 onDomain(d)
 return {ok:true,prepared:true}
}
