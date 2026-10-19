export function completionFilterBounds(entries,frontCap,backCap,flat,isLive,requiredSeats,
  required,{budget,base,aura}={}) {
  const width=backCap+1,size=(frontCap+1)*width,n=entries.length
  const requiredCost=new Float64Array(n+1)
  const price=Number.isSafeInteger(budget)&&budget>0?Math.floor(base*(frontCap+backCap)/budget):0
  const prices=price>0&&Number.isSafeInteger(price*2*budget)?[price,price*2].filter(p=>
    entries.every(([,choices])=>choices.every(x=>Number.isSafeInteger(p*x.cost)&&
      Number.isSafeInteger(x.f+(isLive(x.row)?flat:0)-p*x.cost)&&
      Number.isSafeInteger(x.b+(isLive(x.row)?flat:0)-p*x.cost)))):[]
  const priced=prices.map(()=>Array(n+1)),auraSuffix=aura>0?Array(n+1):null
  if(auraSuffix)auraSuffix[n]=new Float64Array(size)
  for(const suffix of priced)suffix[n]=new Float64Array(size)
  for(let i=n-1;i>=0;i--){
    const [id,choices]=entries[i]
    requiredCost[i]=requiredCost[i+1]+(required.has(id)?Math.min(...choices.map(x=>x.cost)):0)
    const rewards=prices.map(p=>{
      let f=0,b=0
      for(const x of choices){const add=isLive(x.row)?flat:0
        f=Math.max(f,x.f+add-p*x.cost);b=Math.max(b,x.b+add-p*x.cost)}
      return [f,b]
    })
    const contribution=auraSuffix?Math.max(0,...choices.map(x=>x.row.contribution)):0
    const suffixes=[...priced,...(auraSuffix?[auraSuffix]:[])]
    for(let j=0;j<suffixes.length;j++){
      const suffix=suffixes[j],after=suffix[i+1],next=after.slice()
      const [fValue,bValue]=j<priced.length?rewards[j]:[contribution,contribution]
      for(let f=0;f<=frontCap;f++)for(let b=0;b<=backCap;b++){
        const at=f*width+b
        if(f&&requiredSeats[id]!=='back')next[at]=Math.max(next[at],fValue+after[at-width])
        if(b&&requiredSeats[id]!=='front')next[at]=Math.max(next[at],bValue+after[at-1])
      }
      suffix[i]=next
    }
  }
  return {requiredCost,aura:auraSuffix,priced,prices}
}
