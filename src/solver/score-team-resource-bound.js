// Integer upper bounds for a whole party's remaining equipment. Unlike a
// per-recipient maximum, each owned copy contributes its gain only once.
// Relaxing wearer, mandatory equipment and inventory correlations upwards is
// safe; a strictly smaller bound may prune, equality must always survive.
export function createEquipmentResourceBound({constant, ownTypes, gainOf, supportGain=0, multiplier=1}) {
  const items=ownTypes.map(type=>({type,gain:gainOf(type),cost:type.cost||0}))
  if (![constant,supportGain,multiplier,...items.flatMap(x=>[x.gain,x.cost,x.type.left])].every(Number.isSafeInteger)||
      supportGain<0||multiplier<1||items.some(x=>x.gain<0||x.cost<0||x.type.left<0)) return null
  const byRatio=items.slice()
  // The exact cross-products must be safe, otherwise omit the budget bound
  // rather than risk an incorrectly ordered fractional relaxation.
  const safeRatios=Number.isSafeInteger(Math.max(0,...items.map(x=>x.gain))*Math.max(0,...items.map(x=>x.cost)))
  if(safeRatios)byRatio.sort((a,b)=>!a.cost||!b.cost?Number(!b.cost)-Number(!a.cost)||b.gain-a.gain:b.gain*a.cost-a.gain*b.cost)
  function largest(remaining,price=0) {
    const top=[]
    for(const x of items){
      const penalty=price*x.cost,value=x.gain-penalty
      if(!Number.isSafeInteger(penalty)||!Number.isSafeInteger(value))return Infinity
      if(value<=0)continue
      for(let copy=0;copy<Math.min(x.type.left,remaining);copy++){
        let at=0;while(at<top.length&&top[at]>=value)at++
        if(at<remaining){top.splice(at,0,value);if(top.length>remaining)top.pop()}
      }
    }
    const sum=top.reduce((n,x)=>n+x,0)
    return Number.isSafeInteger(sum)?sum:Infinity
  }
  return (remaining,budget,knownGain=0)=>{
    if(!Number.isSafeInteger(remaining)||remaining<0||!Number.isSafeInteger(knownGain))return Infinity
    let extra=largest(remaining)
    if(Number.isSafeInteger(budget)&&budget>=0&&remaining&&safeRatios){
      let rest=budget,fractional=0,price=0
      // Fractional knapsack relaxes the slot count, but keeps shared stock
      // and COST. Ceil the fractional item in integer milli-score units.
      for(const x of byRatio){
        if(!x.type.left||!x.gain)continue
        if(!x.cost){fractional+=x.gain*x.type.left;continue}
        const full=Math.min(x.type.left,Math.floor(rest/x.cost))
        fractional+=full*x.gain;rest-=full*x.cost
        if(full<x.type.left){
          const product=rest*x.gain
          if(!Number.isSafeInteger(product)){fractional=Infinity;break}
          fractional+=Math.floor(product/x.cost)+Number(product%x.cost!==0)
          price=Math.floor(x.gain/x.cost);break
        }
      }
      if(Number.isSafeInteger(fractional))extra=Math.min(extra,fractional)
      // Any nonnegative price is admissible. This one also combines COST
      // and slot capacity; it is arithmetic, never an AI-predicted cutoff.
      if(price){
        const penalty=price*budget,priced=largest(remaining,price)+penalty
        if(Number.isSafeInteger(penalty)&&Number.isSafeInteger(priced))extra=Math.min(extra,priced)
      }
    }
    const total=constant+knownGain+supportGain+extra
    if(!Number.isSafeInteger(total))return Infinity
    const value=Math.floor(total/1000)*multiplier
    return Number.isSafeInteger(value)?value:Infinity
  }
}
