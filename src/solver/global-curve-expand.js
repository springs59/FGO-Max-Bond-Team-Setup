// Project identity constraints before any equivalence or dominance reduction.
// The generator retains each equipment multiset and support effect separately;
// global frontier pruning is optional and never used for the all-results stream.
export function projectGlobalDomain(source, requiredIds=[]) {
  const required=new Set(requiredIds.map(Number)),byVector=new Map()
  for(let i=0;i<source.rows.length;i++) {
    const r=source.rows[i],key=JSON.stringify([source.groups.map(g=>g.rates[i]),source.supports.map(g=>g.rates[i]),r.self,r.party,r.ruleRole||0])
    if(!byVector.has(key))byVector.set(key,new Map())
    const map=byVector.get(key),old=map.get(r.id)
    if(old===undefined||r.cost<source.rows[old].cost)map.set(r.id,i)
  }
  const indices=[]
  for(const map of byVector.values()) {
    const all=[...map.values()].sort((a,b)=>source.rows[a].cost-source.rows[b].cost||source.rows[a].id-source.rows[b].id)
    indices.push(...all.filter(i=>required.has(source.rows[i].id)),...all.filter(i=>!required.has(source.rows[i].id)).slice(0,6))
  }
  indices.sort((a,b)=>source.rows[a].id-source.rows[b].id||a-b)
  for(const id of required)if(!indices.some(i=>source.rows[i].id===id))throw Error(`从者 ${id} 不在当前场景资料中`)
  return {...source,rows:indices.map(i=>source.rows[i]),groups:source.groups.map(g=>({...g,rates:indices.map(i=>g.rates[i])})),supports:source.supports.map(g=>({...g,rates:indices.map(i=>g.rates[i]),...(g.parts?{parts:g.parts.map(p=>({...p,rates:indices.map(i=>p.rates[i])}))}:{})})),requiredIds:[...required]}
}
export function globalMemberPositions(c) {
  if(c.at(-1)?.ownPositions)return c.at(-1).ownPositions
  const n=c[3],nf=c[4],k=c[5],fc=c[0]===2?2:3,nb=n-k-nf
  const positions=[...Array(nf).keys(),...Array.from({length:nb},(_,i)=>3+i)]
  let f=nf,b=3+nb
  for(let j=0;j<k;j++)positions.push(f<fc?f++:b++)
  return positions
}
const dominates=(a,b,n)=>a.cost<=b.cost&&a.a.slice(0,n).every((v,i)=>v>=b.a[i])
function insertProfile(list,p,n) {
  for(const q of list)if(dominates(q,p,n))return
  let j=0;for(const q of list)if(!dominates(p,q,n))list[j++]=q
  list.length=j;list.push(p)
}
export function createGlobalExpansion(source,{requiredIds=[],cost=168,portraitCap=6,capped=-1,layout=-1,support=-1,supportIndices=null,supportFrontierOnly=false}={}) {
  requiredIds=[...new Set(requiredIds.map(Number))]
  if(requiredIds.length>6)throw Error('最多选定六名己方从者')
  const meta=projectGlobalDomain(source,requiredIds),required=new Set(requiredIds),R=meta.rows.length
  const rules=meta.rules||{},grand=rules.grandSlots??(rules.grand?1:0)
  const maxK=capped<0?5:capped,cache=new Map(),stats={equipment:0,rosters:0,curves:0,cacheHits:0}
  const layouts=[0,1,2].filter(l=>layout<0||layout===l).filter(l=>!rules.layouts||rules.layouts.includes(l)).filter(l=>required.size<=Math.min(l?5:6,rules.ownMax??6,(rules.totalMax??6)-(l?1:0)))
  const byId=new Map(),costs=[...new Set(meta.rows.map(r=>r.cost))]
  meta.rows.forEach((r,i)=>{if(!byId.has(r.id))byId.set(r.id,[]);byId.get(r.id).push(i)})
  function roster(rates,nmax,budget,banned=[]) {
    const key=nmax+':'+budget+':'+rates.join(',')+':'+banned.join(',')
    if(cache.has(key)){stats.cacheHits++;return cache.get(key)}
    stats.rosters++
    const choices=new Map()
    const role=r=>meta.rows[r].ruleRole||0,signature=(rows,n,k)=>rows.slice(0,n-k).map(role).join(',')+':'+rows.slice(n-k,n).map(role).sort((a,b)=>b-a).join(',')
    for(const[id,indices]of byId) {
      if(banned.includes(id))continue
      const xs=[]
      for(const r of indices) {
        if(xs.some(q=>role(q)===role(r)&&meta.rows[q].cost<=meta.rows[r].cost&&rates[q]>=rates[r]))continue
        for(let j=xs.length-1;j>=0;j--)if(role(r)===role(xs[j])&&meta.rows[r].cost<=meta.rows[xs[j]].cost&&rates[r]>=rates[xs[j]])xs.splice(j,1)
        xs.push(r)
      }
      choices.set(id,xs)
    }
    const keep=new Set(required)
    for(const cost of costs)for(const category of new Set(meta.rows.map(r=>r.ruleRole||0))) {
      const ranked=[]
      for(const[id,xs]of choices){let best=-1;for(const r of xs)if(role(r)===category&&meta.rows[r].cost<=cost&&(best<0||rates[r]>rates[best]))best=r;if(best>=0)ranked.push({id,rate:rates[best]})}
      ranked.sort((a,b)=>b.rate-a.rate||a.id-b.id)
      for(const x of ranked.slice(0,nmax))keep.add(x.id)
    }
    const cheap=[]
    for(const[id,xs]of choices){cheap.push({id,cost:Math.min(...xs.map(i=>meta.rows[i].cost))});if(meta.rows[xs[0]].party)keep.add(id)}
    cheap.sort((a,b)=>a.cost-b.cost||a.id-b.id);for(const x of cheap.slice(0,nmax))keep.add(x.id)
    let dp=new Map([['0,0,0',{n:0,k:0,party:0,list:[{cost:0,a:[],rows:[]}]}]])
    for(const[id,xs]of choices) {
      if(!keep.has(id))continue
      const next=new Map()
      if(!required.has(id))for(const[key,s]of dp)next.set(key,{...s,list:s.list.slice()})
      function put(n,k,party,p) {const key=[n,k,party,signature(p.rows,n,k)].join(',');if(!next.has(key))next.set(key,{n,k,party,list:[]});insertProfile(next.get(key).list,p,n-k)}
      for(const s of dp.values()) {
        const {n,k,party}=s;if(n===nmax)continue
        for(const prev of s.list)for(const r of xs) {
          const c=prev.cost+meta.rows[r].cost;if(c>budget)continue
          const live=n-k,a=prev.a.slice(),rows=prev.rows.slice();let at=live
          rows.splice(live,0,r)
          while(at>0&&(role(rows[at-1])<role(r)||role(rows[at-1])===role(r)&&a[at-1]<rates[r])){a[at]=a[at-1];rows[at]=rows[at-1];at--}
          a[at]=rates[r];rows[at]=r;put(n+1,k,party+meta.rows[r].party,{cost:c,a,rows})
          if(k<maxK){const caps=[...prev.rows.slice(live),r].sort((a,b)=>role(b)-role(a));put(n+1,k+1,party+meta.rows[r].party,{cost:c,a:prev.a.slice(),rows:[...prev.rows.slice(0,live),...caps]})}
        }
      }
      dp=next
    }
    const result=[...dp.values()].filter(s=>(s.n>s.k||s.n===0&&rules.ownMin===0)&&(capped<0||s.k===capped))
    // Budget is fixed per expansion. A cache entry at the maximum available
    // roster budget is reusable for every CE multiset below that ceiling.
    // Keep memory bounded during a full equipment enumeration. Cache eviction
    // only repeats a deterministic calculation; it cannot remove a result.
    if(cache.size>=(grand>1?64:4096))cache.delete(cache.keys().next().value)
    cache.set(key,result);return result
  }
  const counts=meta.groups.map(()=>0),rate=Array(R).fill(0)
  function* evaluate(flat,ceCost,equipped,rewardGroup=-1,rewardCounts=null) {
    const freeCount=rewardCounts?rewardCounts.reduce((s,n)=>s+n,0):(rewardGroup>=0?1:0)
    stats.equipment++
    for(const l of layouts)for(let si=0;si<meta.supports.length;si++) {
      if(supportIndices&&!supportIndices.includes(si))continue
      if((!l&&si)||support>=0&&(!l||si!==support))continue
      if(supportFrontierOnly&&l&&support<0&&meta.precomputedSupports&&!meta.precomputedSupports.includes(si))continue
      const sup=meta.supports[si];if(sup.layout!=null&&sup.layout!==l)continue
      const seatCap=sup.freePositions?.length??(l?5:6),external=sup.external?.length??(l?1:0),nmax=Math.min(seatCap,rules.ownMax??6,(rules.totalMax??6)-external),fc=sup.freePositions?.filter(i=>i<3).length??(l===2?2:3),bc=seatCap-fc
      if(equipped-freeCount>nmax)continue
      const combined=rate.map((v,r)=>v+sup.rates[r]+meta.rows[r].self),offset=Math.min(...combined)
      for(let r=0;r<R;r++)combined[r]-=offset
      // Uniform universal bonus does not change scalar profile dominance.
      const states=roster(combined,nmax,cost,sup.bannedIds||[])
      for(const s of states) {
        const {n,k,party}=s,live=n-k;if(n<Math.max(rules.ownMin??1,equipped-freeCount,(rules.totalMin||0)-external)||n<required.size)continue
        for(const p of s.list) {
          if(p.cost+ceCost>cost)continue
          for(let guest=0;guest<(l&&meta.guestPartyMax?2:1);guest++) {
            const a=p.a.map(x=>x+1000+offset+party+250*k+guest*meta.guestPartyMax)
            const seen=new Set()
            for(let mask=0;mask<2**live;mask++) {
              let nf=0;for(let i=0;i<live;i++)if(mask&(1<<i))nf++
              if(nf>fc||live-nf>bc)continue
              for(let cm=0;cm<((rules.frontMask||rules.grandSlots>1)?2**k:1);cm++){
              const coeff=Array(6).fill(0),ri=Array(6).fill(0);let f=0,b=3
              for(let i=0;i<live;i++){const at=mask&(1<<i)?f++:b++;coeff[at]=a[i];ri[at]=p.rows[i]}
              let legal=true;for(let i=live;i<n;i++){const front=(rules.frontMask||rules.grandSlots>1)?Boolean(cm&(1<<(i-live))):f<fc;if(front&&f>=fc||!front&&b>=3+bc){legal=false;break}const at=front?f++:b++;ri[at]=p.rows[i]}
              if(!legal)continue
              if(rules.requireFront&&l!==2&&f===0)continue
              if(f+(sup.external?.filter(x=>x.position<=3).length??(l===2?1:0))<(rules.frontMin||1))continue
              const frontRole=ri.slice(0,3).reduce((m,r,i)=>m|((i<f)?(meta.rows[r].ruleRole||0):0),sup.satisfiedMask||0)
              if((frontRole&(rules.frontMask||0))!==(rules.frontMask||0))continue
              const key=coeff.join(',')
              if(seen.has(key))continue
              const extra={}
              if((rules.frontMask||rules.grandSlots>1)&&!sup.freePositions)extra.ownPositions=[...Array(f).keys(),...Array.from({length:b-3},(_,i)=>3+i)]
              if(sup.freePositions){const positions=[...Array(f).keys()].map(i=>sup.freePositions.filter(j=>j<3)[i]).concat([...Array(b-3).keys()].map(i=>sup.freePositions.filter(j=>j>=3)[i])),old=[...Array(f).keys(),...Array.from({length:b-3},(_,i)=>3+i)],co=coeff.slice(),rs=ri.slice();coeff.fill(0);ri.fill(0);old.forEach((at,j)=>{coeff[positions[j]]=co[at];ri[positions[j]]=rs[at]});extra.ownPositions=positions}
              if(rewardGroup>=0){extra.rewardGroup=rewardGroup;if(rules.grandPositions?.length){const positions=extra.ownPositions||globalMemberPositions([l,si,flat/50,n,nf,k]);if(!positions.some(at=>rules.grandPositions.includes(at+1)))continue}}
              if(rewardCounts){extra.rewardCounts=rewardCounts.slice();const positions=extra.ownPositions||globalMemberPositions([l,si,flat/50,n,nf,k]),classes=new Map();for(const at of positions)if(rules.grandPositions.includes(at+1)){const cl=meta.rows[ri[at]].ruleRole>>8;classes.set(cl,Math.min(cl===8?2:1,(classes.get(cl)||0)+1))}if([...classes.values()].reduce((s,n)=>s+n,0)<freeCount)continue}
              if(!sup.freePositions&&l&&rules.supportPosition&&rules.supportPosition!==(l===2?3:6)){
                const free=Array.from({length:6},(_,i)=>i).filter(i=>i!==rules.supportPosition-1),old=globalMemberPositions([l,si,flat/50,n,nf,k]),positions=old.map(i=>free.filter(j=>(j<3)===(i<3))[old.filter(j=>(j<3)===(i<3)).indexOf(i)]),co=coeff.slice(),rs=ri.slice();coeff.fill(0);ri.fill(0);old.forEach((at,j)=>{coeff[positions[j]]=co[at];ri[positions[j]]=rs[at]});extra.ownPositions=positions
              }
              seen.add(key);stats.curves++
              yield [l,si,flat/50,n,nf,k,guest,p.cost+ceCost,...coeff,...ri,...counts,...(Object.keys(extra).length?[extra]:[])]
              }
            }
          }
        }
      }
    }
  }
  function* walk(g,remaining,flat,ceCost,equipped) {
    if(ceCost>cost+(grand?grand*Math.max(0,...meta.groups.flatMap(g=>g.items.map(x=>x.cost))):0)||flat>portraitCap*50)return
    if(g===meta.groups.length||remaining===0){
      if(ceCost<=cost)yield* evaluate(flat,ceCost,equipped)
      if(grand>1){const free=counts.map(()=>0);function* rewards(j,left,saved){if(j===counts.length){if(free.some(Boolean)&&ceCost-saved<=cost)yield* evaluate(flat,ceCost-saved,equipped,-1,free);return}const group=meta.groups[j];let subtotal=0;for(let k=0;k<=Math.min(left,counts[j]);k++){free[j]=k;yield* rewards(j+1,left-k,saved+subtotal);if(k<counts[j]){const item=group.items[counts[j]-1-k];if(!item.rewardEligible)break;subtotal+=item.cost}}free[j]=0}yield* rewards(0,grand,0)}
      else if(grand)for(let j=0;j<counts.length;j++)if(counts[j]&&meta.groups[j].items[counts[j]-1].rewardEligible){const saved=meta.groups[j].items[counts[j]-1].cost;if(ceCost-saved<=cost)yield* evaluate(flat,ceCost-saved,equipped,j)}
      return
    }
    const group=meta.groups[g];let subtotal=0,max=Math.min(remaining,group.items.length)
    if(group.flat)max=Math.min(max,Math.floor((portraitCap*50-flat)/group.flat))
    for(let k=0;k<=max;k++) {
      counts[g]=k;yield* walk(g+1,remaining-k,flat+k*group.flat,ceCost+subtotal,equipped+k)
      if(k<group.items.length)subtotal+=group.items[k].cost
      for(let r=0;r<R;r++)rate[r]+=group.rates[r]
    }
    for(let r=0;r<R;r++)rate[r]-=(max+1)*group.rates[r]
    counts[g]=0
  }
  const maxOwn=Math.max(0,...layouts.map(l=>Math.min(l?5:6,rules.ownMax??6,(rules.totalMax??6)-(l?1:0))))+grand
  return {meta,stats,iterate:()=>walk(0,maxOwn,0,0,0)}
}
export function solveProjectedGlobal(source,options={},onProgress=null) {
  const expansion=createGlobalExpansion(source,{...options,supportFrontierOnly:true}),bins=new Map();let last=Date.now()
  for(const c of expansion.iterate()) {
    options.onComputedRecord?.(c,expansion.meta)
    const key=[c[0],c[1],c[2],c[5],c[6]].join(',');if(!bins.has(key))bins.set(key,[])
    const list=bins.get(key),p={cost:c[7],a:c.slice(8,14),c}
    insertProfile(list,p,6)
    if(onProgress&&Date.now()-last>300){last=Date.now();onProgress({...expansion.stats})}
  }
  return {meta:expansion.meta,records:[...bins.values()].flatMap(xs=>xs.map(p=>p.c)),stats:expansion.stats}
}
