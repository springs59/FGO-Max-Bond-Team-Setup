import {CONTEXT_FEATURES,appendQueryContext,validNeural,neuralProfile} from './query-neural.js'
// One learned decision for the WHOLE query. Candidate ranking below is a
// fixed arithmetic rule, not repeated evaluation of a neural/tree model.
export const QUERY_FEATURES = Array.from({length:16},(_,i)=>`mean${i}`).concat(['logEquipment','logServants']).concat(['equipment','servant'].flatMap(k=>Array.from({length:16},(_,i)=>`${k}Mean${i}`))).concat(['equipment','servant'].flatMap(k=>[0,3,4,10,11].map(i=>`${k}Max${i}`))).concat(CONTEXT_FEATURES.map(x=>'ctx_'+x))
export const QUERY_PROFILES = [
  {name:'balanced',effect:2,coverage:1,cost:1,live:1,upperFactor:1},
  {name:'economy',effect:1,coverage:0.5,cost:3,live:1,upperFactor:4},
  {name:'effect',effect:4,coverage:0.5,cost:0.25,live:1,upperFactor:0.5},
  {name:'coverage',effect:1.5,coverage:3,cost:0.5,live:2,upperFactor:2},
  {name:'budget-balanced',effect:1,coverage:1,cost:2,live:2,upperFactor:2},
  {name:'economy-5',effect:1,coverage:0.5,cost:5,live:1,upperFactor:4},
  {name:'economy-8',effect:1,coverage:0.5,cost:8,live:1,upperFactor:4},
  {name:'effect-8',effect:8,coverage:0.5,cost:0.1,live:1,upperFactor:0.5},
  {name:'wide-balanced',effect:2,coverage:4,cost:1,live:2,upperFactor:1},
  {name:'effect-coverage',effect:4,coverage:2,cost:0.5,live:2,upperFactor:1},
  {name:'minimum-cost',effect:0.5,coverage:0.25,cost:12,live:1,upperFactor:4},
  {name:'wide-coverage',effect:1,coverage:6,cost:0.5,live:3,upperFactor:2},
]

export function queryFeatures(equipment=[],servants=[],context={}) {
  const result=Array(16).fill(0),n=equipment.length+servants.length
  for(const x of [...equipment,...servants])for(let j=0;j<16;j++)result[j]+=x[j]/Math.max(1,n)
  const means=[equipment,servants].flatMap(xs=>{
    const values=Array(16).fill(0)
    for(const x of xs)for(let j=0;j<16;j++)values[j]+=x[j]/Math.max(1,xs.length)
    return values
  })
  const maxima=[equipment,servants].flatMap(xs=>[0,3,4,10,11].map(j=>{
    let value=0;for(const x of xs)value=Math.max(value,x[j]);return value
  }))
  return result.concat([Math.log1p(equipment.length),Math.log1p(servants.length)],means,maxima,appendQueryContext(equipment,servants,context))
}

export function validQueryPolicy(policy) {
  if(policy?.format===2)return !Object.hasOwn(policy,'tree')&&validNeural(policy,QUERY_FEATURES,QUERY_PROFILES.length)
  if(policy?.format!==1||!Array.isArray(policy.features)||![18,60,84].includes(policy.features.length)||policy.features.join('|')!==QUERY_FEATURES.slice(0,policy.features.length).join('|'))return false
  let count=0
  function valid(node,depth) {
    if(!node||++count>127||depth>6)return false
    if(Object.hasOwn(node,'profile'))return Number.isInteger(node.profile)&&node.profile>=0&&node.profile<(policy.features.length===18?4:QUERY_PROFILES.length)
    return Number.isInteger(node.feature)&&node.feature>=0&&node.feature<policy.features.length&&Number.isFinite(node.threshold)&&
      valid(node.left,depth+1)&&valid(node.right,depth+1)
  }
  return valid(policy.tree,0)
}

export function inferQueryPolicy(policy,features) {
  if(policy.format===2)return Object.freeze({...QUERY_PROFILES[neuralProfile(policy,features)]})
  let node=policy.tree
  for(let depth=0;depth<=6;depth++){
    if(Object.hasOwn(node,'profile'))return Object.freeze({...QUERY_PROFILES[node.profile]})
    node=features[node.feature]<=node.threshold?node.left:node.right
  }
  throw Error('Invalid query policy depth')
}

// This function contains no learned weights or tree traversal. All candidates
// use the single, immutable recipe chosen at the start of the query.
export function fixedQueryPriority(profile,kind,x) {
  const effect=x[0]+x[2]+x[10]+x[11]*x[14]*6+2*x[7]
  const z=profile.effect*effect+profile.coverage*x[3]+profile.live*x[9]-profile.cost*x[4]-2
  return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))
}

export function createQuerySession() {
  return {decision:null,inferenceCalls:0,inferenceMs:0}
}
