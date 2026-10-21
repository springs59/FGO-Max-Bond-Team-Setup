// The learned output chooses a nonnegative COST price, never a score cutoff.
// Every price is checked by the same integer Lagrangian upper-bound formula.
export const UPPER_PRICE_FACTORS = [0, 0.25, 0.5, 1, 2, 4, 8, 16]
export const UPPER_PRICE_FEATURES = ['budgetPerSeat','minCost','meanCost','maxCost',
  'costPressure','zeroCostFraction','domainSize','frontSeats','backSeats',
  'maxFront','meanFront','maxBack','meanBack','frontSpread','backSpread','rewardCostRatio']

export function validUpperBoundPolicy(policy) {
  if(policy?.format!==1||!Array.isArray(policy.features)||
    policy.features.join('|')!==UPPER_PRICE_FEATURES.join('|'))return false
  let nodes=0
  function valid(node,depth) {
    if(!node||++nodes>127||depth>6)return false
    if(Object.hasOwn(node,'factor'))return UPPER_PRICE_FACTORS.includes(node.factor)
    return Number.isInteger(node.feature)&&node.feature>=0&&node.feature<UPPER_PRICE_FEATURES.length&&
      Number.isFinite(node.threshold)&&valid(node.left,depth+1)&&valid(node.right,depth+1)
  }
  return valid(policy.tree,0)
}

export function upperPriceFeatures(options,frontCap,backCap,budget,base) {
  let min=Infinity,max=0,cost=0,zero=0,fMax=0,bMax=0,fMin=Infinity,bMin=Infinity,f=0,b=0
  for(const x of options){
    min=Math.min(min,x.cost);max=Math.max(max,x.cost);cost+=x.cost;zero+=Number(x.cost===0)
    fMax=Math.max(fMax,x.f);bMax=Math.max(bMax,x.b);fMin=Math.min(fMin,x.f);bMin=Math.min(bMin,x.b)
    f+=x.f;b+=x.b
  }
  const n=Math.max(1,options.length),cap=frontCap+backCap,unit=Math.max(1,base),mean=cost/n
  return [budget/Math.max(1,cap)/20,(min===Infinity?0:min)/20,mean/20,max/20,
    mean*cap/Math.max(1,budget),zero/n,Math.min(4,n/Math.max(1,cap*4)),frontCap/6,backCap/6,
    fMax/unit,f/n/unit,bMax/unit,b/n/unit,(fMax-(fMin===Infinity?0:fMin))/unit,
    (bMax-(bMin===Infinity?0:bMin))/unit,(fMax+bMax)/unit/Math.max(1,mean)]
}

export function upperPriceFactor(policy,features) {
  let node=policy.tree
  for(let depth=0;depth<=6;depth++){
    if(Object.hasOwn(node,'factor'))return node.factor
    node=features[node.feature]<=node.threshold?node.left:node.right
  }
  return 0
}
