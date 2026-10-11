const actualHandler=self.onmessage
self.onmessage=e=>{
 if(e.data.kind!=='effects'){actualHandler(e);return}
 try{
  const {theory,options,profiles,meta:effectMeta}=e.data,base=effectMeta.rules.frontMask?anonymousEnvelopeBank(effectMeta,{...options,acceptConfiguration:c=>formationConfigMatches(c,options)}):unpackAnonymousBank(theory,options),configs=[],records=[],supports=[],supportIds=new Map()
  let scanned=0,last=Date.now()
  for(const c of base.configs)if(formationConfigMatches(c,options))for(const v of applyActivityEffects(c,profiles,{envelope:true})){
   const r=[v.support.layout,0,0,v.n,v.nf,v.k,0,v.cost,...Array(12).fill(0)];const support={frontShare:v.support.frontShare,flat:v.flat}
   const key=JSON.stringify(support);let si=supportIds.get(key);if(si==null){si=supports.length;supportIds.set(key,si);supports.push(support)}r[1]=si
   v.terms.forEach((t,i)=>r[8+(i<v.nf?i:3+i-v.nf)]=t.second);configs.push(v);records.push(r);scanned++
   if(Date.now()-last>350){self.postMessage({kind:'effect-progress',scanned});last=Date.now()}
  }
  const meta={supports},envelope=buildGlobalEnvelope(records,meta,{cost:options.cost,portraitCap:10,capped:-1}),ids=[...new Set(envelope.hulls.flatMap(h=>h.map(x=>x[1])))],bank={configs:ids.map(i=>configs[i]),records:ids.map(i=>records[i]),meta,enumerated:base.enumerated,scanned}
  self.postMessage({kind:'effects',bank,envelope:buildGlobalEnvelope(bank.records,meta,{cost:options.cost,portraitCap:10,capped:-1})})
 }catch(err){self.postMessage({kind:'error',message:err.message})}
}
