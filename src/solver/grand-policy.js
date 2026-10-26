import {traitMatches} from '../quest-party-constraints.js'

export const accountGrandIds=account=>new Set((account?.servants||[]).filter(s=>s.isGrand===true||s.isGrand===1||s.isGrand==='1').map(s=>Number(s.id)))

// Missing designation changes the recommendation scope, never the account.
// Existing eligible Grands take precedence over upgrade proposals.
export function grandCandidatePolicy(rows,opts,{enabled=false,required=false,rules=[]}={}){
 const actual=accountGrandIds(opts.account),known=opts.mode==='account'&&!!opts.account&&!opts.account.virtual
 if(!enabled||!known)return {grandIds:known?[...actual]:[],grandIdsKnown:known,grandSuggestionIds:[]}
 const available=rows.filter(r=>actual.has(r.svt.id))
 const missing=rules.filter(rule=>!available.some(r=>traitMatches(r,rule.values)))
 const recommendAll=!available.length&&!rules.length
 const proposed=rows.filter(r=>!actual.has(r.svt.id)&&(recommendAll||missing.some(rule=>traitMatches(r,rule.values))))
 return {grandIds:[...new Set([...available,...proposed].map(r=>r.svt.id))],grandIdsKnown:true,
  grandSuggestionIds:[...new Set(proposed.map(r=>r.svt.id))],grandRecommendationRequired:required||rules.length>0}
}

export function markGrandRecommendation(plan,opts){
 if(!plan?.slots||opts.mode!=='account'||!opts.account||opts.account.virtual)return plan
 const actual=accountGrandIds(opts.account)
 const choices=plan.slots.filter(s=>s.filled&&!s.isSupport&&s.isGrand&&!actual.has(Number(s.svtId)))
 if(!choices.length){delete plan.grandRecommendation;return plan}
 plan.grandRecommendation=grandRecommendationFor(choices)
 return plan
}

export function grandRecommendationFor(choices){
 if(!choices.length)return null
 const candidates=choices.map(s=>({svtId:s.svtId,position:s.position,name:s.label||String(s.svtId)}))
 return {requiresSelection:true,candidates,
  text:'需先选择冠位：'+candidates.map(s=>s.name+'（'+s.position+'号位）').join('、')+'；以下收益按完成该冠位选择后计算，账号原冠位记录保持不变。'}
}
