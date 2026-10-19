import { applyRate } from '../bond.js'

export function createFrameworkBound({ rows, vectors, seats, base, cap }) {
  const costs = vectors.map(() => new Map())
  for (const r of rows) {
    const bucket = costs[r.vector]
    bucket.set(r.svt.id, Math.min(bucket.get(r.svt.id) ?? Infinity, r.cost))
  }
  const copies = costs.map(xs => [...xs.values()].sort((a,b) => a-b).slice(0,cap))
  const front = new Float64Array(3), back = new Float64Array(3)
  const insert = (xs, n, value) => {
    for (let j=0; j<n; j++) if (value>xs[j]) {
      for (let k=n-1; k>j; k--) xs[k]=xs[k-1]
      xs[j]=value; break
    }
  }
  return ({ rate, extra, flat, aura, support, supportFlat=0, budget=Infinity, layout=null }) => {
    if (budget<0) return -Infinity
    let best=-Infinity
    for (const l of layout ? [layout] : seats) {
      const f=l.front.length,b=l.back.length
      const frontBase=applyRate(base,l.position>0&&l.position<=3?240:200)
      const backBase=applyRate(base,l.position>0&&l.position<=3?40:0)
      const fixed=flat+(l.position?supportFlat:0)
      const price=Number.isSafeInteger(budget)&&budget>0 ? Math.floor(base*cap/budget) : 0
      let bound=Infinity
      for (const p of price>0 ? [0,price] : [0]) {
        let valid=Number.isSafeInteger(p)
        front.fill(0); back.fill(0)
        for (let i=0; i<vectors.length; i++) {
          const v=vectors[i]
          const second=rate[i]+(extra?.[i]||0)+(l.position?support[i]:0)+v.self+aura-v.aura
          const fv=v.maxed?0:applyRate(frontBase,second)+fixed
          const bv=v.maxed?0:applyRate(backBase,second)+fixed
          if(!Number.isSafeInteger(fv)||!Number.isSafeInteger(bv)){valid=false;break}
          for (const cost of copies[i]) {
            if (cost>budget) break
            if(!Number.isSafeInteger(p*cost)){valid=false;break}
            insert(front,f,fv-p*cost); insert(back,b,bv-p*cost)
          }
        }
        let total=p===0?0:p*budget
        for(let i=0;i<f;i++)total+=front[i]
        for(let i=0;i<b;i++)total+=back[i]
        if(valid&&Number.isSafeInteger(total))bound=Math.min(bound,total)
      }
      best=Math.max(best,bound)
    }
    return best
  }
}
