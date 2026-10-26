import {questPartyRules} from './quest-party-rules.js'
import {traitMatches} from './quest-party-constraints.js'

// A query's Grand seat follows a uniquely pinned, account-designated Grand.
// This derives a query constraint; it never changes account designation or
// persists an automatic choice as a manual position.
export function resolveGrandSelection({questType,mode,account,servants=[],grandPosition=0,slotPins=[],frontIds=[],allowSupport=true,quest={}}={}){
 if(questType!=='grand')return {position:0,svtId:0,automatic:false}
 const explicit=Number(grandPosition)||0
 if(explicit>=1&&explicit<=6)return {position:explicit,svtId:0,automatic:false}
 if(mode!=='account'||!account||account.virtual)return {position:0,svtId:0,automatic:false}
 const ids=new Set((account.servants||[]).filter(s=>s.isGrand===true||s.isGrand===1||s.isGrand==='1').map(s=>Number(s.id)))
 const pins=new Map(frontIds.map((id,i)=>[i+1,{position:i+1,svtId:Number(id)}]))
 for(const pin of slotPins)pins.set(Number(pin.position),pin)
 const rules=questPartyRules(quest||{})
 const useSupport=!rules.noSupport&&(rules.requiresSupport||quest?.systemSupport||allowSupport!==false)
 const candidates=[...pins.values()].filter(p=>{
  const id=Number(p.svtId),svt=servants.find(s=>Number(s.id)===id),form=svt?.forms?.find(f=>f.key===p.formKey)
  return !p.empty&&!p.support&&Number(p.position)>=1&&Number(p.position)<=6&&!(useSupport&&Number(p.position)===rules.supportPosition)&&ids.has(id)&&
   (!rules.grandPositions?.length||rules.grandPositions.includes(Number(p.position)))&&
   (rules.grandRules||[]).every(rule=>traitMatches({svtId:id,traitIds:form?.traitIds||svt?.traitIds||[]},rule.values))
 })
 if(candidates.length!==1)return {position:0,svtId:0,automatic:false}
 return {position:Number(candidates[0].position),svtId:Number(candidates[0].svtId),automatic:true}
}
