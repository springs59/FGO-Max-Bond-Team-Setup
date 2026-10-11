// The anonymous layer enumerates effects, never servant identities. Conditional
// hits are independent hypotheses here; the data layer checks realizability.
export function effectType(g,item,support=false){
 const rate=Math.round((item.nominalRate??Math.max(0,...g.rates)/10)*10),flat=g.flat||0
 return {key:flat?'portrait':`${g.kind==='conditional'?'c':'u'}${rate}`,rate,flat,conditional:!flat&&g.kind==='conditional',cost:support?0:item.cost}
}
export function anonymousCatalog(meta){
 const map=new Map();for(const g of meta.groups)for(const item of g.items){const t=effectType(g,item),key=t.key;if(!map.has(key))map.set(key,{...t,items:[]});map.get(key).items.push({cost:item.cost,name:item.name,id:item.id})}
 const types=[...map.values()].sort((a,b)=>b.rate-a.rate||a.flat-b.flat);types.forEach(t=>t.items.sort((a,b)=>a.cost-b.cost||a.id-b.id));return types
}
export function anonymousSupports(meta){
 const map=new Map(),supports=meta.rules?.generic?meta.supports.map((s,i)=>({...s,_index:i})):meta.supports.flatMap((s,i)=>(meta.rules?.layouts||[0,1,2]).map(layout=>({...s,_index:i,layout,external:Array.from({length:layout?1:0},()=>({friend:true})),freePositions:Array.from({length:layout?5:6},(_,i)=>layout===2&&i>=2?i+1:i),frontShare:layout===2?40:0})))
 for(const s of supports){const ext=s.external?.length??(s.layout?1:0);if(!s.layout&&s.items.length)continue;const ts=[];for(const p of s.layout?(s.parts||[s]):[]){if(!p.items.length)continue;ts.push(effectType(p,p.items[0],true))}
  const front=(s.freePositions||[]).filter(i=>i<3).length,back=(s.freePositions||[]).filter(i=>i>=3).length,key=JSON.stringify([s.layout,front,back,s.frontShare||0,ext,ts.map(t=>t.key).sort(),[0,1].map(b=>(meta.rules?.grandPositions||[]).filter(p=>(p<=3?0:1)===b&&(s.freePositions||[]).includes(p-1)).length)]);if(!map.has(key))map.set(key,{layout:s.layout,front,back,frontShare:s.frontShare||0,external:ext,types:ts,label:!ext?'无助战':`${ext} 名助战／客将；${(s.frontShare||0)/40} 名前排；`+ts.map(t=>t.flat?'肖像 +'+t.flat:(t.conditional?'限定':'无限定')+' +'+t.rate/10+'%').join('＋'),freePositions:s.freePositions,id:map.size,indices:[]});map.get(key).indices.push(s._index)
 }return [...map.values()]
}
export function effectValue(c,B){return c.terms.reduce((sum,t)=>sum+Math.floor(Math.floor(B*t.first/1000)*t.second/1000)+c.flat,0)}
export function* anonymousConfigurations(meta,{cost=113,reserve=0,portraitCap=10,capped=-1,layout=-1,support=-1}={}){
 const types=anonymousCatalog(meta),rules=meta.rules||{},supports=anonymousSupports(meta)
 for(const sup of supports){if(layout>=0&&sup.layout!==layout||support>=0&&!sup.indices.includes(support))continue;const maxOwn=Math.min(rules.ownMax??6,(rules.totalMax??6)-sup.external,sup.front+sup.back),minOwn=Math.max(rules.ownMin??1,(rules.totalMin??1)-sup.external)
  for(let n=minOwn;n<=maxOwn;n++){const freeMax=rules.grandSlots??(rules.grand?1:0),capacity=n+Math.min(n,freeMax)
   const counts=types.map(()=>0)
   function* equipment(j,left){if(j===types.length){const items=types.flatMap((t,i)=>t.items.slice(0,counts[i])),maxFree=Math.min(n,freeMax,items.length),sorted=items.map(i=>i.cost).sort((a,b)=>b-a),sum=sorted.reduce((s,v)=>s+v,0),flat=types.reduce((s,t,i)=>s+t.flat*counts[i],0)+sup.types.reduce((s,t)=>s+t.flat,0),base=1000+types.reduce((s,t,i)=>s+(!t.conditional?t.rate*counts[i]:0),0)+sup.types.reduce((s,t)=>s+(!t.conditional?t.rate:0),0),owned=counts.reduce((s,v)=>s+v,0)
    if(flat-sup.types.reduce((s,t)=>s+t.flat,0)>50*portraitCap)return
    // Empty and partially filled free slots are retained for browsing. The
    // envelope may omit a costlier assignment with the same anonymous effect.
    for(let free=Math.max(0,owned-n);free<=maxFree;free++){const ceCost=sum-sorted.slice(0,free).reduce((s,v)=>s+v,0);if(ceCost+reserve>cost)continue
     const dimensions=types.flatMap((t,i)=>t.conditional&&counts[i]?[{key:'own-'+t.key,rate:t.rate,count:counts[i],source:'己方'}]:[]);sup.types.forEach((t,i)=>{if(t.conditional)dimensions.push({key:'support-'+i,rate:t.rate,count:1,source:'助战'})})
     for(let k=0;k<=Math.max(0,Math.min(5,n-1));k++){if(capped>=0&&k!==capped)continue;const live=n-k
      for(let nf=0;nf<=Math.min(live,sup.front);nf++){const nb=live-nf;if(nb>sup.back)continue;for(let capFront=Math.max(0,k-(sup.back-nb));capFront<=Math.min(k,sup.front-nf);capFront++){const totalFront=nf+capFront;if(totalFront+sup.frontShare/40<(rules.frontMin??1))continue
       const eligible=rules.grandPositions?.length?Math.min(totalFront,(sup.freePositions||[]).filter(p=>p<3&&rules.grandPositions.includes(p+1)).length)+Math.min(n-totalFront,(sup.freePositions||[]).filter(p=>p>=3&&rules.grandPositions.includes(p+1)).length):n;if(free>eligible)continue;
       yield {n,k,nf,nb,capFront,cost:ceCost+reserve,ceCost,reserve,normal:owned-free,free,counts:[...counts],types,support:sup,flat,base:base+250*k,dimensions,terms:Array.from({length:live},(_,i)=>({first:(i<nf?1200:1000)+sup.frontShare,second:base+250*k+dimensions.reduce((s,d)=>s+d.rate*d.count,0),hits:dimensions.map(d=>d.count)}))}
      }}
     }
    }return}
    const t=types[j];for(let c=0;c<=Math.min(left,t.items.length,t.flat?portraitCap:Infinity);c++){counts[j]=c;yield* equipment(j+1,left-c)}counts[j]=0
   }yield* equipment(0,capacity)
  }
 }
}
// Distinct front/back multisets exhaust the integer hit-count space. Every
// vector is realizable by independent hypothetical binary target columns.
export function* anonymousDistributions(config){
 const vectors=[];function dims(i,hits){if(i===config.dimensions.length){vectors.push([...hits]);return}for(let v=config.dimensions[i].count;v>=0;v--){hits.push(v);dims(i+1,hits);hits.pop()}}dims(0,[])
 function* multisets(n,start=0,list=[]){if(!n){yield list;return}for(let i=start;i<vectors.length;i++)yield* multisets(n-1,i,[...list,vectors[i]])}
 for(const f of multisets(config.nf))for(const b of multisets(config.nb)){const terms=[...f,...b].map((hits,i)=>({first:(i<config.nf?1200:1000)+config.support.frontShare,second:config.base+hits.reduce((s,v,j)=>s+v*config.dimensions[j].rate,0),hits}));yield {...config,terms}}
}
export function anonymousDistributionCount(c){const v=c.dimensions.reduce((s,d)=>s*(d.count+1),1);const choose=(n,k)=>{let x=1;for(let i=1;i<=k;i++)x=x*(n-k+i)/i;return Math.round(x)};return choose(v+c.nf-1,c.nf)*choose(v+c.nb-1,c.nb)}
export function anonymousEffectKey(c){return JSON.stringify([c.n,c.k,c.nf,c.cost,c.flat,c.normal,c.free,c.types.map((t,i)=>[t.key,c.counts[i]]),c.support,c.terms.map(t=>[t.first,t.second,t.hits])])}
export function anonymousSummary(c){const map=new Map();for(const t of c.terms){const text=c.dimensions.map((d,i)=>`${d.source}${d.rate/10}% 命中 ${t.hits[i]}/${d.count} 张`).join('，')||'无范围限定礼装';const key=(t.first>=1200?'前排':'后排')+'：'+text;map.set(key,(map.get(key)||0)+1)}return [...map].map(([s,n])=>`${n} 人 · ${s}`).join('；')}
export function anonymousEnvelopeBank(meta,options={}){
 const fronts=new Map(),types=anonymousCatalog(meta);let enumerated=0
 for(const c of anonymousConfigurations(meta,options)){if(options.acceptConfiguration&&!options.acceptConfiguration(c))continue;enumerated++;const second=c.terms[0]?.second||0,key=JSON.stringify([c.n,c.k,c.nf,c.flat,c.support.layout,c.support.frontShare,c.support.id]),list=fronts.get(key)||[];if(list.some(q=>q.cost<=c.cost&&(q.terms[0]?.second||0)>=second))continue;fronts.set(key,[...list.filter(q=>!(c.cost<=q.cost&&second>=(q.terms[0]?.second||0))),c])}
 const configs=[...fronts.values()].flat(),supports=[],supportIds=new Map(),records=configs.map(c=>{const ownFlat=c.types.reduce((s,t,j)=>s+t.flat*c.counts[j],0),key=JSON.stringify([c.support.frontShare,c.flat-ownFlat]);if(!supportIds.has(key)){supportIds.set(key,supports.length);supports.push({frontShare:c.support.frontShare,flat:c.flat-ownFlat})}const r=[c.support.layout,supportIds.get(key),ownFlat/50,c.n,c.nf,c.k,0,c.cost,...Array(6).fill(0),...Array(6).fill(0)];for(let i=0;i<c.terms.length;i++)r[8+(i<c.nf?i:3+i-c.nf)]=c.terms[i].second;return r})
 return {records,meta:{supports},configs,types,enumerated}
}
export function packAnonymousBank(bank){
 const supports=[],ids=new Map(),configurations=bank.configs.map(c=>{const key=JSON.stringify(c.support);if(!ids.has(key)){ids.set(key,supports.length);supports.push(c.support)}return [c.n,c.k,c.nf,c.capFront,c.cost,c.ceCost,c.normal,c.free,c.flat,c.base,ids.get(key),...c.counts]})
 return {records:bank.records,meta:bank.meta,types:bank.types,supports,configurations,enumerated:bank.enumerated,budget:168,portraitCap:10}
}
export function unpackAnonymousBank(p,{cost=113,reserve=0,portraitCap=10,capped=-1,layout=-1,support=-1}={}){
 const configs=[],records=[];p.configurations.forEach((v,i)=>{const [n,k,nf,capFront,ceBudget,ceCost,normal,free,flat,base,si,...counts]=v,sup=p.supports[si],portraits=counts.reduce((s,x,j)=>s+(p.types[j].flat?x:0),0);if(ceBudget+reserve>cost||portraits>portraitCap||capped>=0&&k!==capped||layout>=0&&sup.layout!==layout||support>=0&&!sup.indices.includes(support))return;const dimensions=p.types.flatMap((t,j)=>t.conditional&&counts[j]?[{key:'own-'+t.key,rate:t.rate,count:counts[j],source:'己方'}]:[]);sup.types.forEach((t,j)=>{if(t.conditional)dimensions.push({key:'support-'+j,rate:t.rate,count:1,source:'助战'})});const second=base+dimensions.reduce((s,d)=>s+d.rate*d.count,0),terms=Array.from({length:n-k},(_,j)=>({first:(j<nf?1200:1000)+sup.frontShare,second,hits:dimensions.map(d=>d.count)}));configs.push({n,k,nf,nb:n-k-nf,capFront,cost:ceBudget+reserve,ceCost,reserve,normal,free,flat,base,support:sup,types:p.types,counts,dimensions,terms});const r=[...p.records[i]];r[7]+=reserve;records.push(r)})
 return {configs,records,types:p.types,meta:p.meta,enumerated:p.enumerated}
}
