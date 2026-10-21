import { applyRate } from '../bond.js'

export function createFrameworkBound({ rows, vectors, seats, base, cap, policy=null, stats=null }) {
  const costs = vectors.map(() => new Map())
  for (const r of rows) {
    const bucket = costs[r.vector]
    bucket.set(r.svt.id, Math.min(bucket.get(r.svt.id) ?? Infinity, r.cost))
  }
  const copies = costs.map(xs => [...xs.values()].sort((a,b) => a-b).slice(0,cap))
  const rewards=policy?vectors.map(()=>({f:0,b:0})):null
  const options=policy?copies.flatMap((xs,i)=>xs.map(cost=>({cost,vector:i,f:0,b:0}))):null
  const front = new Float64Array(3), back = new Float64Array(3)
  const insert = (xs, n, value) => {
    for (let j=0; j<n; j++) if (value>xs[j]) {
      for (let k=n-1; k>j; k--) xs[k]=xs[k-1]
      xs[j]=value; break
    }
  }
  return ({ rate, extra, flat, aura, support, supportFlat=0, budget=Infinity, layout=null, threshold=-Infinity }) => {
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
          if(rewards&&p===0){rewards[i].f=fv;rewards[i].b=bv}
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
      // The original bounds run first. Spend one extra pass only when they
      // cannot reject this branch. Any AI-chosen price remains a safe bound:
      // score <= p*budget + sum(top(max(0, reward - p*cost))).
      if(policy&&Number.isSafeInteger(budget)&&budget>0&&Number.isSafeInteger(bound)&&bound>=threshold){
        for(const x of options){x.f=rewards[x.vector].f;x.b=rewards[x.vector].b}
        // Fixed by the one query-level inference. No model call per branch.
        const factor=policy.factor
        const p=Math.floor(Math.max(1,base)*cap/budget*factor)
        if(p>0&&p!==price&&Number.isSafeInteger(p*budget)){
          if(stats)stats.upperPolicyChecks=(stats.upperPolicyChecks||0)+1
          front.fill(0);back.fill(0);let valid=true,total=p*budget
          for(const x of options){
            if(x.cost>budget)continue
            const fv=x.f-p*x.cost,bv=x.b-p*x.cost
            if(!Number.isSafeInteger(p*x.cost)||!Number.isSafeInteger(fv)||!Number.isSafeInteger(bv)){valid=false;break}
            insert(front,f,fv);insert(back,b,bv)
          }
          for(let i=0;i<f;i++)total+=front[i]
          for(let i=0;i<b;i++)total+=back[i]
          if(valid&&Number.isSafeInteger(total)&&total<bound){
            if(stats){stats.upperPolicyImproved=(stats.upperPolicyImproved||0)+1
              if(total<threshold)stats.upperPolicyPruned=(stats.upperPolicyPruned||0)+1}
            bound=total
          }
        }
      }
      best=Math.max(best,bound)
    }
    return best
  }
}
