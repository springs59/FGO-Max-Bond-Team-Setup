const roleCache=new WeakMap()
function roleMinimum(meta,mask,banned=[]) {
 if(!mask)return 0
 if(!roleCache.has(meta))roleCache.set(meta,new Map())
 const cache=roleCache.get(meta),key=JSON.stringify([mask,banned]);if(cache.has(key))return cache.get(key)
 const byId=new Map();for(const r of meta.rows||[]){if(banned.includes(r.id))continue;if(!byId.has(r.id))byId.set(r.id,new Set());byId.get(r.id).add((r.ruleRole||0)&mask)}
 let dp=new Map([[0,0]]);for(const forms of byId.values()){const next=new Map(dp);for(const [state,n]of dp)for(const role of forms){const value=state|role;if(n+1<(next.get(value)??Infinity))next.set(value,n+1)}dp=next}
 const result=dp.get(mask)??Infinity;cache.set(key,result);return result
}

export function formationSupports(meta) {
 const r=meta.rules||{},out=[]
 for(let i=0;i<meta.supports.length;i++)for(const layout of r.generic?[meta.supports[i].layout]:(r.layouts||[0,1,2])) {
  const s=meta.supports[i];if(layout===0&&s.items.length)continue
  const ext=s.external||Array.from({length:layout?1:0},()=>({friend:true,position:layout===2?3:6}))
  const free=s.freePositions||Array.from({length:layout?5:6},(_,j)=>layout===2&&j>=2?j+1:j)
  const front=ext.filter(x=>x.position<=3).length
  out.push({index:i,layout,helpers:ext.length,helperFront:front,freeFront:free.filter(p=>p<3).length,freeBack:free.filter(p=>p>=3).length,guests:ext.filter(x=>!x.friend).length,ownCapacity:r.generic&&meta.rows?new Set(meta.rows.filter(row=>!(s.bannedIds||[]).includes(row.id)).map(row=>row.id)).size:6,ownFrontMin:roleMinimum(meta,(r.frontMask||0)&~(s.satisfiedMask||0),s.bannedIds||[])})
 }
 return out
}
export function formationOptions(meta,{own=-1,helpers=-1,helperFront=-1,capped=-1}={}) {
 const r=meta.rules||{},out=[]
 for(const s of formationSupports(meta)) {
  if(helpers>=0&&s.helpers!==helpers||helperFront>=0&&s.helperFront!==helperFront)continue
  const min=Math.max(r.ownMin??1,(r.totalMin??1)-s.helpers),max=Math.min(r.ownMax??6,(r.totalMax??6)-s.helpers,s.freeFront+s.freeBack,s.ownCapacity)
  for(let n=min;n<=max;n++)if(n>=s.ownFrontMin&&s.freeFront>=s.ownFrontMin&&(own<0||n===own)&&(capped<0||capped<n||n===0&&capped===0)&&n+s.helpers<=6&&(Math.min(n,s.freeFront)+s.helperFront>=(r.frontMin??1)))out.push({...s,own:n})
 }
 return out
}
export function validateFormation(meta,o={}) {
 for(const k of ['own','helpers','helperFront','capped'])if(o[k]!=null&&(!Number.isInteger(o[k])||o[k]<-1||o[k]>6))throw Error('编队人数必须是合法整数。')
 if(o.own>=0&&o.helpers>=0&&o.own+o.helpers>6)throw Error('己方与助战合计不能超过6个物理位置。')
 if(o.helpers>=0&&o.helperFront>o.helpers)throw Error('前排助战不能超过助战总人数。')
 if(o.helperFront>3)throw Error('前排最多3个物理位置。')
 if(o.capped>=0&&o.own>0&&o.capped>=o.own)throw Error('至少保留1名己方领取羁绊；满绊人数必须少于己方人数。')
 const feasible=formationOptions(meta,o)
 if(!feasible.length)throw Error('当前人数或助战位置不符合所选特殊编队条件。请调整编队或更换条件模板。')
 return feasible
}
export function formationConfigMatches(c,o) {
 return (o.own<0||c.n===o.own)&&(o.helpers<0||c.support.external===o.helpers)&&(o.helperFront<0||c.support.frontShare/40===o.helperFront)&&(!o.roleLimits||o.roleLimits.some(([index,layout,n,min])=>c.support.indices.includes(index)&&layout===c.support.layout&&n===c.n&&c.nf+c.capFront>=min))
}
export function activityLabel(p) {return `自身+${p.self/10}%／战役+${p.campaign/10}%／提供全队+${p.party/10}%${p.party?'（助战提供'+(p.helperAllowed?'适用':'不适用')+'）':''}`}
export function validateActivities(profiles) {
 let own=0,helpers=0
 for(const p of profiles) {
  for(const k of ['self','campaign','party'])if(!Number.isInteger(p[k])||p[k]<0||p[k]>10000)throw Error('活动加成须为0–1000%，精度0.1%。')
  for(const k of ['own','helpers'])if(!Number.isInteger(p[k])||p[k]<-1||p[k]>6)throw Error('活动对象数量必须为0–6；自动枚举用−1。')
  if(p.available!=null&&p.own>p.available)throw Error('活动对象人数超过此效果档位的现有数量。')
  if(p.helpers>0&&p.party&&!p.helperAllowed)throw Error('此全队加成不接受助战提供，不能分配给助战。')
  own+=Math.max(0,p.own);helpers+=Math.max(0,p.helpers)
 }
 if(own>6||helpers>6)throw Error('各活动档位对象人数合计超过编队容量。')
 return {own,helpers}
}
// Counts are mutually exclusive activity profiles, not stacked identities.
export function* activityMixes(profiles,n,h,{envelope=false}={}) {
 const own=[],helpers=[]
 function* walk(i,left,guest) {
  if(i===profiles.length){yield {own:[...own],helpers:[...helpers],plain:left};return}
  const p=profiles[i],omax=p.own<0?Math.min(left,p.available??n):p.own
  for(let a=p.own<0?0:omax;a<=omax;a++) {
   if(a>left)continue
   const hmax=p.helpers<0?guest:p.helpers
   for(let b=p.helpers<0?0:hmax;b<=hmax;b++) {
    if(b>guest||b&&p.party&&!p.helperAllowed||envelope&&p.helpers<0&&!p.party&&b)continue
    own.push(a);helpers.push(b);yield* walk(i+1,left-a,guest-b);own.pop();helpers.pop()
   }
  }
 }
 yield* walk(0,n,h)
}
export function* applyActivityEffects(c,profiles,{envelope=false}={}) {
 if(!profiles.length){yield c;return}
 for(const mix of activityMixes(profiles,c.n,c.support.external,{envelope})) {
  const counts=[mix.plain,...mix.own],plain={self:0,campaign:0,party:0},types=[plain,...profiles]
  const party=profiles.reduce((sum,p,i)=>sum+p.party*(mix.own[i]+(p.helperAllowed?mix.helpers[i]:0)),0),assigned=[]
  // Identical CE hit vectors in the same band are interchangeable. Preserve
  // every joint CE/activity distribution, while skipping its permutations.
  function* terms(j) {
   if(j===c.terms.length) {
    const result={...c,activity:{profiles,mix,capped:counts.slice(1),cappedPlain:counts[0],party},terms:c.terms.map((t,i)=>({...t,second:t.second+party+types[assigned[i]].self+types[assigned[i]].campaign,activity:assigned[i]?assigned[i]-1:-1}))}
    yield result;return
   }
   const t=c.terms[j],same=j>0&&t.first===c.terms[j-1].first&&JSON.stringify(t.hits)===JSON.stringify(c.terms[j-1].hits),start=same?assigned[j-1]:0
   for(let i=start;i<counts.length;i++)if(counts[i]){counts[i]--;assigned.push(i);yield* terms(j+1);assigned.pop();counts[i]++}
  }
  yield* terms(0)
 }
}
export function activitySummary(c) {
 if(!c.activity)return '无活动加成'
 const a=c.activity,groups=new Map()
 for(const t of c.terms){const p=t.activity<0?null:a.profiles[t.activity],label=(t.first>=1200?'前排':'后排')+'：'+(p?activityLabel(p):'无自身活动／战役加成');groups.set(label,(groups.get(label)||0)+1)}
 const own=a.profiles.map((p,i)=>a.mix.own[i]?`${a.mix.own[i]}名己方（其中${a.capped[i]}名满绊）：${activityLabel(p)}`:'').filter(Boolean),guest=a.profiles.map((p,i)=>a.mix.helpers[i]?`${a.mix.helpers[i]}名助战：${activityLabel(p)}，本人不领取`:'').filter(Boolean)
 return [...own,...guest,...[...groups].map(([s,n])=>`${n}名领取者·${s}`),`全队活动光环合计+${a.party/10}%`].join('；')
}
export function formationEffectKey(c) {
 const tuple=p=>[p.self,p.campaign,p.party,!!p.party&&p.helperAllowed],effects=new Map(),a=c.activity
 if(a)for(let i=0;i<a.profiles.length;i++){const key=JSON.stringify(tuple(a.profiles[i]));if(!effects.has(key))effects.set(key,[0,0,0]);const row=effects.get(key);row[0]+=a.mix.own[i];row[1]+=a.mix.helpers[i];row[2]+=a.capped[i]}
 const members=c.terms.map(t=>[t.first,t.second,t.hits,a&&t.activity>=0?tuple(a.profiles[t.activity]):[0,0,0,false]]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y)))
 return JSON.stringify([c.n,c.k,c.cost,c.normal,c.free,c.flat,c.types.map((t,i)=>[t.key,c.counts[i]]),[c.support.layout,c.support.external,c.support.frontShare,c.support.types.map(t=>[t.key,t.flat,t.rate])],members,[...effects].filter(([,n])=>n.some(Boolean)).sort((x,y)=>x[0].localeCompare(y[0]))])
}
