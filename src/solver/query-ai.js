// One learned decision for the WHOLE query. Candidate ranking below is a
// fixed arithmetic rule, not repeated evaluation of a neural/tree model.
export const QUERY_FEATURES = Array.from({length:16},(_,i)=>`mean${i}`).concat(['logEquipment','logServants'])
export const QUERY_PROFILES = [
  {name:'balanced',effect:2,coverage:1,cost:1,live:1,upperFactor:1},
  {name:'economy',effect:1,coverage:0.5,cost:3,live:1,upperFactor:4},
  {name:'effect',effect:4,coverage:0.5,cost:0.25,live:1,upperFactor:0.5},
  {name:'coverage',effect:1.5,coverage:3,cost:0.5,live:2,upperFactor:2},
]

export function queryFeatures(equipment=[],servants=[]) {
  const result=Array(16).fill(0),n=equipment.length+servants.length
  for(const x of [...equipment,...servants])for(let j=0;j<16;j++)result[j]+=x[j]/Math.max(1,n)
  return result.concat([Math.log1p(equipment.length),Math.log1p(servants.length)])
}

export function validQueryPolicy(policy) {
  if(policy?.format!==1||!Array.isArray(policy.features)||policy.features.join('|')!==QUERY_FEATURES.join('|'))return false
  let count=0
  function valid(node,depth) {
    if(!node||++count>127||depth>6)return false
    if(Object.hasOwn(node,'profile'))return Number.isInteger(node.profile)&&node.profile>=0&&node.profile<QUERY_PROFILES.length
    return Number.isInteger(node.feature)&&node.feature>=0&&node.feature<QUERY_FEATURES.length&&Number.isFinite(node.threshold)&&
      valid(node.left,depth+1)&&valid(node.right,depth+1)
  }
  return valid(policy.tree,0)
}

export function inferQueryPolicy(policy,features) {
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
