let expansion,iterator,ordinal=0,query=''
function matchesCurve(c,meta,q,id) {
  if(!q)return true
  if(q.startsWith('#'))return q===`#${id}`
  for(let g=0;g<meta.groups.length;g++)for(let j=0;j<c[20+g];j++)if(meta.groups[g].items[j].name.toLocaleLowerCase().includes(q))return true
  if(c[0]&&meta.supports[c[1]].items.some(x=>x.name.toLocaleLowerCase().includes(q)))return true
  return globalMemberPositions(c).some(i=>meta.rows[c[14+i]].name.toLocaleLowerCase().includes(q))
}
self.onmessage=e=>{
  try {
    const m=e.data
    if(m.kind==='solve') {
      const bank=solveProjectedGlobal(m.source,m.options,stats=>self.postMessage({kind:'progress',stats}))
      const envelope=buildGlobalEnvelope(bank.records,bank.meta,m.options)
      self.postMessage({kind:'solved',bank,envelope});return
    }
    if(m.kind==='start') {
      expansion=createGlobalExpansion(m.source,m.options);iterator=expansion.iterate();ordinal=0;query=(m.query||'').trim().toLocaleLowerCase()
      self.postMessage({kind:'meta',meta:expansion.meta})
    }
    if(m.kind==='start'||m.kind==='next') {
      const records=[];let done=false,last=Date.now()
      while(records.length<30) {
        const x=iterator.next();if(x.done){done=true;break}
        const id=ordinal++
        if(matchesCurve(x.value,expansion.meta,query,id))records.push({id,c:x.value})
        if(Date.now()-last>350){last=Date.now();self.postMessage({kind:'scan',stats:{...expansion.stats},scanned:ordinal})}
      }
      self.postMessage({kind:'page',records,scanned:ordinal,done,stats:{...expansion.stats}})
    }
  }catch(e){self.postMessage({kind:'error',message:e.message})}
}
