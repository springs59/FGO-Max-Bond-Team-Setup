import {pickCeSkill,ceMatchesServant} from '../atlas.js'
const domainGuidance=new WeakMap()

// Guidance changes visitation order only. These estimates are deliberately
// separate from the proved arithmetic bounds and from exact live settlement.
export function createScoreTeamGuidance(d,{effectFor}={}){
  const source=d.guidanceSource||d
  if(!effectFor&&domainGuidance.has(source))return domainGuidance.get(source)
  const own=new Map(),support=new Map(),rowIndex=new Map()
  const friendAllowed=d.partyConstraints?!d.partyConstraints.noSupport&&d.partyConstraints.supportPolicy!=='system':d.layouts.some(Boolean)
  const supportCards=friendAllowed?d.supportCes:[]
  d.rows.forEach((r,i)=>{rowIndex.set(r,i);for(const physical of r.equivalentRows||[])rowIndex.set(physical,i)})
  const weighted=r=>!r.maxed&&(d.optimizeBy!=='prefer'||d.preferIds.includes(r.svt.id))
  function effect(c,isSupport=false){
    if(effectFor)return effectFor(c,isSupport)
    const cache=isSupport?support:own
    const mlb=isSupport?c.supportMlb!==false:c.accountMlb!==false
    const key=c.id+':'+Number(mlb)
    if(cache.has(key))return cache.get(key)
    const fs=(pickCeSkill(c,mlb)?.funcs||[]).filter(f=>!f.eventId&&(!isSupport||f.applySupport!==0))
    const flat=fs.reduce((n,f)=>n+Math.max(0,f.add||0),0)
    const rates=d.rows.map(r=>fs.reduce((n,f)=>n+(ceMatchesServant(f,r.form.traitIds||[])?Math.max(0,isSupport?(f.followerRate??f.rate??0):(f.rate||0)):0),0))
    const value={rates,flat};cache.set(key,value);return value
  }
  const memberScores=new Map()
  function member(r,cap){
    const key=rowIndex.get(r)+':'+cap
    if(!memberScores.has(key)){
      const i=rowIndex.get(r),ownRate=d.ownCes.map(c=>effect(c).rates[i]).sort((a,b)=>b-a).slice(0,cap+(d.grand?1:0)).reduce((n,v)=>n+v,0)
      const supportRate=supportCards.reduce((n,c)=>Math.max(n,effect(c,true).rates[i]),0)*(d.grand?2:1)
      memberScores.set(key,weighted(r)?Math.max(0,d.base)*(1000+r.self+ownRate+supportRate)/1000:0)
    }
    // A capped aura provider earns nothing itself. Do not rank an entire
    // party of capped providers ahead of the recipients needed to earn bond.
    return memberScores.get(key)+Math.max(0,d.base)*Math.max(0,r.contribution)*Math.max(0,cap-1)/2000
  }
  function rank(cards,picked,isSupport=false){
    return cards.map(c=>({c,score:picked.reduce((n,{r})=>{
      if(!weighted(r))return n
      const e=effect(c,isSupport),i=rowIndex.get(r)
      return n+Math.max(0,d.base)*e.rates[i]/1000+e.flat
    },0)})).sort((a,b)=>b.score-a.score||(a.c.cost||0)-(b.c.cost||0)).map(x=>x.c)
  }
  let prepared=false
  function* prepare(){
    if(prepared)return
    let n=0
    for(const [cards,isSupport] of [[d.ownCes,false],[supportCards,true]])for(const c of cards){effect(c,isSupport);if(++n%32===0)yield {type:'tick'}}
    prepared=true
  }
  const result={member,rank,prepare}
  if(!effectFor)domainGuidance.set(source,result)
  return result
}
