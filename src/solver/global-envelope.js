// Exact all-integer-base envelope, after constraints have been projected.
// Records: layout,support,ownPortraits,n,nFrontLive,nCapped,guestAura,cost,
// six second coefficients, six representative form indices, CE group counts.
const gcd = (a,b) => b ? gcd(b,a%b) : a
const lcm = (a,b) => a/gcd(a,b)*b
export function globalFirstMultiplier(c,meta,i) { return (i<3?1200:1000)+(meta.supports[c[1]].frontShare??(c[0]===2?40:0)) }
export function globalCurveValue(c, meta, base) {
  if(!Number.isSafeInteger(base)||base<0)throw Error('基础羁绊必须为非负安全整数')
  if(base>1000000000) {
    let total=0n
    const flat=BigInt(50*c[2]+meta.supports[c[1]].flat)
    for(let i=0;i<6;i++)if(c[8+i]) {
      const front=BigInt(globalFirstMultiplier(c,meta,i))
      total+=(BigInt(base)*front/1000n)*BigInt(c[8+i])/1000n+flat
    }
    if(total>BigInt(Number.MAX_SAFE_INTEGER))throw Error('总羁绊超过安全整数范围')
    return Number(total)
  }
  let total=0
  const flat=50*c[2]+meta.supports[c[1]].flat
  for(let i=0;i<6;i++)if(c[8+i]) {
    const front=globalFirstMultiplier(c,meta,i)
    total+=Math.floor(Math.floor(base*front/1000)*c[8+i]/1000)+flat
  }
  return total
}
export function buildGlobalEnvelope(records,meta,{cost=168,portraitCap=6,capped=0,layout=-1,support=-1}={}) {
  const ids=[],known=new Map(),info=new Map()
  let period=1
  for(let id=0;id<records.length;id++) {
    const c=records[id]
    if(c[7]>cost||c[2]>portraitCap||(capped>=0&&c[5]!==capped)||
      (layout>=0&&c[0]!==layout)||(support>=0&&(c[0]===0||c[1]!==support)))continue
    let slope=0,error=0,flat=0
    for(let i=0;i<6;i++)if(c[8+i]) {
      const f=globalFirstMultiplier(c,meta,i),s=c[8+i]
      slope+=f*s;error+=s*1000+1000000;flat+=50*c[2]+meta.supports[c[1]].flat
      period=lcm(period,lcm(1000/gcd(f,1000),1000000/gcd(f*s,1000000)))
    }
    const x={id,slope,error,flat,cost:c[7]};ids.push(id);info.set(id,x)
    const old=known.get(flat)
    if(!old||slope>old.slope||(slope===old.slope&&x.cost<old.cost))known.set(flat,x)
  }
  if(!ids.length)return {period:1,hulls:[],ids:[],viable:0}
  // Only one line of a given slope can win at a given residue. Keeping its
  // best intercept here avoids allocating millions of dominated line objects.
  const buckets=Array.from({length:period},()=>new Map())
  let viable=0,residueLines=0
  // Upper bound C(B)<=A_C B+I_C. Every known feasible K satisfies
  // K(B)>=A_K B+I_K-E_K. Exclude C only where those bounds prove it loses.
  for(const id of ids) {
    const x=info.get(id);let lo=0,hi=Infinity
    for(const k of known.values()) {
      const delta=x.slope-k.slope,rhs=(k.flat-x.flat)*1000000-k.error
      if(delta>0)lo=Math.max(lo,Math.ceil(rhs/delta))
      else if(delta<0)hi=Math.min(hi,Math.floor(rhs/delta))
      else if(rhs>0){hi=-1;break}
    }
    if(hi<lo)continue
    viable++
    const length=Number.isFinite(hi)?Math.min(period,hi-lo+1):period
    for(let j=0;j<length;j++) {
      const r=(lo+j)%period
      const slope=x.slope*period/1000000,offset=globalCurveValue(records[id],meta,r),old=buckets[r].get(slope)
      if(!old||offset>old.offset||offset===old.offset&&(x.cost<old.cost||x.cost===old.cost&&id<old.id))buckets[r].set(slope,{id,slope,offset,cost:x.cost})
      residueLines++
    }
  }
  const hulls=buckets.map(bucket=>{
    const lines=[...bucket.values()]
    lines.sort((a,b)=>a.slope-b.slope||b.offset-a.offset||a.cost-b.cost||a.id-b.id)
    const hull=[];let previousSlope=-1
    for(const line of lines) {
      if(line.slope===previousSlope)continue
      previousSlope=line.slope;let start=0
      while(hull.length) {
        const last=hull.at(-1),delta=line.slope-last.slope,num=last.offset-line.offset
        const winsTie=line.cost<last.cost||(line.cost===last.cost&&line.id<last.id)
        start=Math.max(0,winsTie?Math.ceil(num/delta):Math.floor(num/delta)+1)
        if(start>last.start)break
        hull.pop()
      }
      hull.push({...line,start:hull.length?start:0})
    }
    return hull.map(x=>[x.start,x.id])
  })
  return {period,hulls,ids,viable,residueLines}
}
export function globalWinnerAt(envelope,base) {
  if(!Number.isSafeInteger(base)||base<0)throw Error('基础羁绊必须为非负安全整数')
  if(!envelope.ids.length)return null
  const q=Math.floor(base/envelope.period),hull=envelope.hulls[base%envelope.period]
  let lo=0,hi=hull.length
  while(lo<hi){const mid=(lo+hi)>>1;if(hull[mid][0]<=q)lo=mid+1;else hi=mid}
  return hull[lo-1][1]
}
