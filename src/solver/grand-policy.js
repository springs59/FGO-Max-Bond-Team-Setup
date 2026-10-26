import {classBucketOf} from './common.js'

export const accountGrandIds=account=>new Set((account?.servants||[]).filter(s=>s.isGrand===true||s.isGrand===1||s.isGrand==='1').map(s=>Number(s.id)))

// Resolve designations from the complete catalog, before any query filters.
// Extra I / II each share one Grand selection bucket.
export function accountGrandClasses(opts){
 const actual=accountGrandIds(opts.account),catalog=new Map((opts.servants||[]).map(s=>[Number(s.id),s]))
 return new Set((opts.account?.servants||[]).filter(s=>actual.has(Number(s.id))).map(s=>classBucketOf(catalog.get(Number(s.id))?.className||s.className)).filter(c=>c!=='unknown'))
}

// Missing designation changes the recommendation scope, never the account.
export function grandCandidatePolicy(rows,opts,{enabled=false,required=false,rules=[]}={}){
 const actual=accountGrandIds(opts.account),known=opts.mode==='account'&&!!opts.account&&!opts.account.virtual
 if(!enabled||!known)return {grandIds:known?[...actual]:[],grandIdsKnown:known,grandSuggestionIds:[],grandRecommendationRequired:enabled&&(required||rules.length>0)}
 const designated=accountGrandClasses(opts)
 const proposed=rows.filter(r=>!actual.has(Number(r.svt.id))&&!designated.has(classBucketOf(r.svt.className)))
 return {grandIds:[...new Set([...actual,...proposed.map(r=>r.svt.id)])],grandIdsKnown:true,
  grandSuggestionIds:[...new Set(proposed.map(r=>r.svt.id))],grandRecommendationRequired:required||rules.length>0}
}

// Build once per immutable query, rather than scanning the catalog per team.
export function createGrandRecommendationMarker(opts){
 if(opts.mode!=='account'||!opts.account||opts.account.virtual)return plan=>plan
 const actual=accountGrandIds(opts.account),designated=accountGrandClasses(opts),catalog=new Map((opts.servants||[]).map(s=>[Number(s.id),s]))
 return plan=>{
  if(!plan?.slots)return plan
  const choices=plan.slots.filter(s=>s.filled&&!s.isSupport&&s.isGrand&&!actual.has(Number(s.svtId))&&!designated.has(classBucketOf(catalog.get(Number(s.svtId))?.className||s.className)))
  if(!choices.length){delete plan.grandRecommendation;return plan}
  plan.grandRecommendation=grandRecommendationFor(choices)
  return plan
 }
}
export const markGrandRecommendation=(plan,opts)=>createGrandRecommendationMarker(opts)(plan)

export function grandRecommendationFor(choices){
 if(!choices.length)return null
 const candidates=choices.map(s=>({svtId:s.svtId,position:s.position,name:s.label||String(s.svtId)}))
 return {requiresSelection:true,candidates,
  text:'需先选择冠位：'+candidates.map(s=>s.name+'（'+s.position+'号位）').join('、')+'；以下收益按完成该冠位选择后计算，账号原冠位记录保持不变。'}
}
