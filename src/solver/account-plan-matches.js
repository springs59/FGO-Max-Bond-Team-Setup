import { fingerprint, libraryRevision, sharedPlanPages } from './query-library.js'
import { servantBondForms, formUnlocked, createReuseEvaluator, comparePlans } from '../recommend.js'
import { servantCost } from '../servant-cost.js'
import { curveKey, evaluateBondCurve } from './bond-curve.js'
import { resolveCurrentActivity } from '../rules/activity-rules.js'
import { RULE_VERSION } from '../rules/versions.js'

const PAGE = 128, LEASE_MS = 60000
let opened
function database() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const r = indexedDB.open('fgo-account-plan-matches-v1', 1)
    r.onupgradeneeded = () => {
      for (const name of ['profiles','contexts']) r.result.createObjectStore(name, {keyPath:'id'})
      for (const name of ['plans','curves']) {
        const store = r.result.createObjectStore(name, {keyPath:'id'})
        store.createIndex('scope','scope')
      }
    }
    r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); opened = null }; resolve(r.result) }
    r.onerror = () => reject(r.error)
  })
  return opened
}
async function read(name, key) {
  const db = await database()
  return new Promise((resolve,reject) => {
    const r = db.transaction(name).objectStore(name).get(key)
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
  })
}
async function write(name, rows) {
  const db = await database()
  await new Promise((resolve,reject) => {
    const tx = db.transaction(name,'readwrite')
    for (const row of rows) tx.objectStore(name).put(row)
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
}
async function claimProfile(profile) {
  const db = await database(); let claimed = false
  await new Promise((resolve,reject) => {
    const tx = db.transaction('profiles','readwrite'), store = tx.objectStore('profiles'), r = store.get(profile.id)
    r.onsuccess = () => {
      const old = r.result
      if (old?.signature === profile.signature && old.libraryRevision === profile.libraryRevision &&
          (old.status === 'ready' || old.status === 'building' && Date.now() - old.updatedAt < LEASE_MS)) return
      profile.obsoleteGenerations=[...new Set([...(old?.obsoleteGenerations||[]),...(old?.generation?[old.generation]:[])])]
      store.put(profile); claimed = true
    }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
  return claimed
}
async function updateProfile(profile) {
  const db = await database(); let updated = false
  await new Promise((resolve,reject) => {
    const tx = db.transaction('profiles','readwrite'), store = tx.objectStore('profiles'), r = store.get(profile.id)
    r.onsuccess = () => {if(r.result?.generation === profile.generation){store.put(profile);updated=true}}
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
  return updated
}
async function* pages(name, scope) {
  const db = await database(); let last = ''
  while (true) {
    const range = IDBKeyRange.bound(scope + ':' + last, scope + ':\uffff', !!last)
    const rows = await new Promise((resolve,reject) => {
      const r = db.transaction(name).objectStore(name).getAll(range,PAGE)
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    if (!rows.length) return
    last = rows.at(-1).id.slice(scope.length + 1)
    yield rows
  }
}
// Derived rows can be regenerated. Retire obsolete account generations in
// bounded transactions instead of retaining another complete copy per update.
async function deleteScope(name,scope) {
  const db=await database()
  for(;;){
    const keys=await new Promise((resolve,reject)=>{const r=db.transaction(name).objectStore(name).index('scope').getAllKeys(IDBKeyRange.only(scope),PAGE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    if(!keys.length)return
    await new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');for(const key of keys)tx.objectStore(name).delete(key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  }
}
async function retireContexts(profileId,generation=null){
  const db=await database();let last
  for(;;){
    const rows=await new Promise((resolve,reject)=>{const r=db.transaction('contexts').objectStore('contexts').getAll(last?IDBKeyRange.lowerBound(last,true):undefined,PAGE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    if(!rows.length)return
    last=rows.at(-1).id
    for(const row of rows)if(row.profileId===profileId&&(!generation||row.generation===generation)){
      await deleteScope('curves',row.scope)
      await new Promise((resolve,reject)=>{const tx=db.transaction('contexts','readwrite');tx.objectStore('contexts').delete(row.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
    }
  }
}
export async function retainAccountMatchProfiles(ids){
  const keep=new Set(ids),db=await database()
  const profiles=await new Promise((resolve,reject)=>{const r=db.transaction('profiles').objectStore('profiles').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
  for(const profile of profiles){
    // Free-catalog configurations are independent from imported accounts.
    if(profile.id.startsWith('free:')||keep.has(profile.id))continue
    // Delete the header first: an in-flight builder cannot mark it ready again.
    await new Promise((resolve,reject)=>{const tx=db.transaction('profiles','readwrite');tx.objectStore('profiles').delete(profile.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
    for(const scope of [profile.generation,...(profile.obsoleteGenerations||[])])await deleteScope('plans',scope)
    await retireContexts(profile.id)
  }
}
function profileId(opts) { return opts.accountProfileId || `${opts.mode === 'account' ? 'account' : 'free'}:${opts.region || 'CN'}` }
export async function matchSignature(opts) {
  const account = opts.mode === 'account' ? opts.account : null
  // These are exactly the facts that affect physical membership. CE effects
  // and active bonuses are independently included in each curve-context key.
  return fingerprint({version:1,ruleVersion:RULE_VERSION,region:opts.region || 'CN',
    account:account && {virtual:account.virtual,servants:account.servants,ces:account.ces,
      servantsOwned:account.servantsOwned,craftEssencesOwned:account.craftEssencesOwned},
    servants:(opts.servants || []).map(s => [s.id,s.className,s.attribute,s.rarity,s.cost,s.traitIds,s.forms]),
    ces:(opts.ces || []).map(c => [c.id,c.cost])})
}
function membership(opts) {
  const servants = new Map((opts.servants || []).map(s => [Number(s.id),s]))
  const ces = new Map((opts.ces || []).map(c => [Number(c.id),c]))
  const records = new Map((opts.account?.servants || []).map(s => [Number(s.id),s]))
  const restricted = opts.mode === 'account' && !opts.account?.virtual
  const forms = new Map()
  for (const [id,svt] of servants) for (const form of servantBondForms(svt)) {
    if ((!restricted || records.has(id)) && formUnlocked(form,records.get(id),opts.mode)) forms.set(id + ':' + form.key,form)
  }
  const stock = new Map()
  for (const row of opts.account?.ces || []) {
    const count = Math.max(1,Number(row.count) || 1)
    const mlb = Math.min(count,row.mlbCount == null ? row.mlb ? count : 0 : Math.max(0,Number(row.mlbCount) || 0))
    for (const [flag,n] of [[true,mlb],[false,count-mlb]]) {
      const key = Number(row.id) + ':' + flag
      stock.set(key,(stock.get(key) || 0) + n)
    }
  }
  const legalMember = ([id,key]) => forms.has(Number(id) + ':' + (!key || key === 'd' ? 'default' : key))
  return {
    acceptMetadata:row => !row.members || row.members.every(legalMember),
    match(plan) {
      const used = new Map(); let cost = 0
      const ownIds = new Set()
      for (const slot of plan.slots.filter(s => s.filled)) {
        if (!slot.isSupport) {
          const id = Number(slot.svtId), key = id + ':' + (!slot.svtArtKey || slot.svtArtKey === 'd' ? 'default' : slot.svtArtKey)
          if (!forms.has(key) || ownIds.has(id)) return null
          if (restricted && slot.isGrand && !records.get(id)?.isGrand) return null
          ownIds.add(id); cost += servantCost(servants.get(id),forms.get(key))
        }
        for (const field of ['ceId','ceBondId','ceRewardId']) {
          const id = Number(slot[field]); if (!id) continue
          if (!ces.has(id)) return null
          if (!slot.isSupport && restricted) {
            const mlbField = field === 'ceId' ? 'ceMlb' : field === 'ceBondId' ? 'ceBondMlb' : 'ceRewardMlb'
            const key = id + ':' + (slot[mlbField] !== false), n = (used.get(key) || 0) + 1
            if (n > (stock.get(key) || 0)) return null
            used.set(key,n)
          }
          if (!slot.isSupport && field === 'ceId') cost += Number(ces.get(id).cost) || 0
        }
      }
      return {cost}
    },
  }
}
export async function accountMatchStatus(id) { return read('profiles',id) }

export async function ensureAccountMatches(opts, {onProgress=()=>{}} = {}) {
  const id = profileId(opts), signature = await matchSignature(opts), revision = await libraryRevision()
  const generation = crypto.randomUUID(), test = membership(opts)
  const profile = {id,version:1,signature,libraryRevision:revision,generation,status:'building',
    region:opts.region || 'CN',scanned:0,matched:0,maxCost:0,updatedAt:Date.now(),coverage:'observed-physical-plans'}
  while (true) {
    const old = await read('profiles',id)
    if (old?.signature === signature && old.libraryRevision === revision) {
      if (old.status === 'ready') return old
      if (old.status === 'building' && Date.now() - old.updatedAt < LEASE_MS) {
        onProgress({phase:'account-matching',profileId:id,scanned:old.scanned,matched:old.matched,waiting:true})
        await new Promise(resolve => setTimeout(resolve,100)); continue
      }
    }
    if(await claimProfile(profile))break
  }
  try {
    for await (const page of sharedPlanPages({acceptMetadata:test.acceptMetadata})) {
      const rows = []
      for (const item of page.plans) {
        const hit = test.match(item.plan); if (!hit) continue
        rows.push({id:generation + ':' + item.id,scope:generation,sourceId:item.id,cost:hit.cost,plan:item.plan})
        profile.matched++; profile.maxCost = Math.max(profile.maxCost,hit.cost)
      }
      for (let at=0;at<rows.length;at+=PAGE) await write('plans',rows.slice(at,at+PAGE))
      profile.scanned += page.scanned; profile.updatedAt = Date.now()
      if(!await updateProfile(profile))throw Error('账号匹配已被较新的账号配置替代，请重新开始')
      onProgress({phase:'account-matching',profileId:id,scanned:profile.scanned,matched:profile.matched})
    }
    if ((await read('profiles',id))?.generation !== generation) throw Error('账号匹配配置已更新')
    profile.status = 'ready'; profile.updatedAt = Date.now()
    if(!await updateProfile(profile))throw Error('账号匹配配置已更新')
    for(const scope of profile.obsoleteGenerations||[]){await deleteScope('plans',scope);await retireContexts(id,scope)}
    profile.obsoleteGenerations=[]
    await updateProfile(profile)
    return profile
  } catch (error) {
    await updateProfile({...profile,status:'failed',updatedAt:Date.now(),error:String(error.message || error)})
    throw error
  }
}

function contextConditions(opts) {
  const keys = ['region','quest','questType','questClass','allowSupport','lockSupportCeId','preferSvtIds','lockSvtIds',
    'filter','bond15Aura','optimizeBy','priorities','frontIds','pinCes','spriteMode','pinSprites','slotPins','grandPosition']
  return Object.fromEntries(keys.map(key => [key,opts[key] ?? null]))
}
async function upsertCurves(scope, plans, sourceIds, opts) {
  const db = await database(), prefer = new Set((opts.preferSvtIds || []).map(Number)), lock = new Set((opts.lockSvtIds || []).map(Number))
  const grouped = new Map()
  for (const plan of plans) {
    const preferPositions = plan.slots.filter(s => prefer.has(s.svtId)).map(s => s.position)
    const lockPositions = plan.slots.filter(s => lock.has(s.svtId)).map(s => s.position)
    const signature = JSON.stringify([plan.costUsed,curveKey(plan.curve),preferPositions,lockPositions,plan.bond15Count,
      plan.priorityScore,plan.slots.find(s => s.filled && s.isSupport)?.ceId || 0])
    const id = scope + ':' + signature, sourceId = sourceIds.get(physicalKey(plan))
    if (!sourceId) throw Error('曲线与原始编队标识不一致')
    if (!grouped.has(id)) grouped.set(id,{id,scope,cost:plan.costUsed,curve:plan.curve,preferPositions,lockPositions,
      bond15Count:plan.bond15Count,priorityScore:plan.priorityScore,variants:[],planCount:0,plan:physicalPlan(plan)})
    const row = grouped.get(id); row.planCount++
    if (row.variants.length < 100) row.variants.push(sourceId)
  }
  await new Promise((resolve,reject) => {
    const tx = db.transaction('curves','readwrite'), store = tx.objectStore('curves')
    for (const row of grouped.values()) {
      const r = store.get(row.id)
      r.onsuccess = () => {
        const old = r.result
        store.put(old ? {...old,planCount:old.planCount + row.planCount,variants:[...new Set([...old.variants,...row.variants])].slice(0,100)} : row)
      }
    }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
}
function physicalPlan(plan) {
  return {ok:true,slots:plan.slots.map(s => ({position:s.position,filled:!!s.filled,isSupport:!!s.isSupport,isGrand:!!s.isGrand,
    svtId:s.svtId || 0,svtArtKey:!s.svtArtKey || s.svtArtKey === 'd' ? 'default' : s.svtArtKey,
    ceId:s.ceId || 0,ceMlb:s.ceMlb !== false,ceBondId:s.ceBondId || 0,ceBondMlb:s.ceBondMlb !== false,
    ceRewardId:s.ceRewardId || 0,ceRewardMlb:s.ceRewardMlb !== false}))}
}
const physicalKey = plan => JSON.stringify(physicalPlan(plan))

export async function matchedCurveSeeds(opts, {onProgress=()=>{},limit=100} = {}) {
  const profile = await ensureAccountMatches(opts,{onProgress})
  const contextKey = await fingerprint({version:1,ruleVersion:RULE_VERSION,generation:profile.generation,
    conditions:contextConditions(opts),ces:opts.ces,bonuses:opts.bondBonuses,
    activity:resolveCurrentActivity({catalog:opts.bondBonuses}).activityState})
  let context = await read('contexts',contextKey)
  if (!context || context.status !== 'ready') {
    // Work in a private generation: cancellation never exposes a partial fit.
    const scope = crypto.randomUUID(), evaluate = profile.matched ? createReuseEvaluator({...opts,base:0,teapot:false,costLimit:null}) : () => []
    let scanned = 0, legal = 0
    for await (const page of pages('plans',profile.generation)) {
      const sourceIds = new Map(page.map(row => [physicalKey(row.plan),row.sourceId]))
      const settled = evaluate(page.map(row => row.plan))
      await upsertCurves(scope,settled,sourceIds,opts)
      scanned += page.length; legal += settled.length
      onProgress({phase:'curve-fitting',profileId:profile.id,scanned,matched:profile.matched,legal})
    }
    if((await read('profiles',profile.id))?.generation!==profile.generation)throw Error('账号配置已更新，请重新开始计算')
    if (scanned !== profile.matched) throw Error('账号匹配配置不完整，请重新匹配')
    context = {id:contextKey,scope,status:'ready',scanned,legal,profileId:profile.id,generation:profile.generation,
      libraryRevision:profile.libraryRevision,updatedAt:Date.now(),coverage:'candidate-only'}
    await write('contexts',[context])
  }
  const cost = Number.isInteger(opts.costLimit) && opts.costLimit >= 0 ? opts.costLimit : Infinity
  const best = [], observed = new Map(); let groups = 0
  for await (const page of pages('curves',context.scope)) for (const row of page) {
    const result = evaluateBondCurve(row.curve,opts.base,{teapot:opts.teapot})
    const score = {...row,total:result.total,costUsed:row.cost,costLimit:Number.isFinite(cost)?cost:0,
      optimizeBy:opts.optimizeBy || 'total',
      preferBond:result.results.filter(r => row.preferPositions.includes(r.position)).reduce((n,r) => n+r.final,0),
      lockBond:result.results.filter(r => row.lockPositions.includes(r.position)).reduce((n,r) => n+r.final,0)}
    if (!observed.has(row.cost) || comparePlans(score,observed.get(row.cost)) < 0) observed.set(row.cost,score)
    groups++
    if (row.cost > cost) continue
    best.push(score); best.sort(comparePlans); if (best.length > Math.min(64,limit)) best.pop()
  }
  const selected = best.map(row => row.plan), used = new Set(selected.map(physicalKey))
  for (const row of best) for (const sourceId of row.variants) {
    if (selected.length >= limit) break
    const source = await read('plans',profile.generation + ':' + sourceId)
    if (source && !used.has(physicalKey(source.plan))) {selected.push(source.plan);used.add(physicalKey(source.plan))}
  }
  let winner=null
  const points = [...observed].sort((a,b)=>a[0]-b[0]).map(([x,row]) => {
    if(!winner||comparePlans(row,winner)<0)winner=row
    return {cost:x,total:winner.total}
  })
  return {plans:selected,info:{profileId:profile.id,matched:profile.matched,scanned:context.scanned,legal:context.legal,
    groups,selected:selected.length,contextKey,base:opts.base,costLimit:Number.isFinite(cost)?cost:null,
    coverage:'candidate-only',hasGap:!selected.length || Number.isFinite(cost)&&!observed.has(cost),noCandidate:!selected.length,complete:false,points,
    libraryRevision:profile.libraryRevision,current:profile.libraryRevision === await libraryRevision()}}
}

export async function exportAccountMatchConfig(id) {
  const profile = await read('profiles',id)
  if (!profile) return null
  return {format:'fgo-account-plan-match',version:1,...profile}
}
