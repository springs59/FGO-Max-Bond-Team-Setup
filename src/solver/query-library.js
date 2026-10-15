import { servantBondForms } from '../recommend.js'
import { matchRosterForm } from '../filter.js'
import { resolveCurrentActivity } from '../rules/activity-rules.js'
import { availableSystemSupports } from '../quest-party-rules.js'

// Increment when solver semantics or required archive coverage change. Old archives remain exportable, but
// only results for the current model and identical effective inputs are reused.
export const QUERY_REVISION = 3
const FORMAT = 'fgo-local-query-results'
const KINDS = new Set(['bond', 'farm', 'quest', 'formation-effects', 'formation-actual', 'equipment', 'legacy-bond', 'legacy-formation', 'shared-plan', 'computed-candidate'])
const OMIT = new Set(['account', 'accountProfileId', 'accountProjection', 'solverIndex', 'solutionIndex',
  'factorIndex', 'joinedEffectIndex', 'curveIndex', 'solverAudit', 'onSolverProgress', 'reusePlans', 'reuseOnly', 'skipResultCache', 'onComputedCandidate'])
let opened
let emptyInventoryDigest
// Immutable facts share bounded payload blocks. Per-record metadata remains
// addressable, while one database write replaces hundreds of nested clones.
const FACT_BLOCK_RECORDS = 256
const FACT_BLOCK_BYTES = 2 * 1024 * 1024
const factBlocks = new Map()
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(v => canonical(v) ?? 'null').join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined && typeof value[k] !== 'function')
      .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  }
  return JSON.stringify(value)
}
async function fingerprintText(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
export async function fingerprint(value) { return fingerprintText(canonical(value)) }
function db() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const request = indexedDB.open('fgo-local-query-results-v1', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('results', { keyPath: 'id' })
      const meta = request.result.createObjectStore('meta', { keyPath: 'id' })
      meta.createIndex('family', 'family')
      request.result.createObjectStore('stage', { keyPath: 'id' })
    }
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opened = null; factBlocks.clear() }; resolve(request.result) }
    request.onerror = () => { opened = null; reject(request.error) }
  })
  return opened
}
async function rawGet(store, key) {
  const database = await db()
  return new Promise((resolve, reject) => {
    const r = database.transaction(store).objectStore(store).get(key)
    r.onsuccess = () => {
      try { resolve(r.result) }
      catch (error) { reject(error) }
    }; r.onerror = () => reject(r.error)
  })
}
async function storedRecord(row) {
  if (!row?.factBlock) return row ? rawGet('results', row.id) : undefined
  let entries = factBlocks.get(row.factBlock)
  if (!entries) {
    const block = await rawGet('results', row.factBlock)
    if (block?.format !== 'fgo-immutable-facts' || block.version !== 1 || typeof block.records !== 'string') throw Error('候选存储块缺失或无效')
    entries = JSON.parse(block.records)
    factBlocks.set(row.factBlock, entries)
    while (factBlocks.size > 2) factBlocks.delete(factBlocks.keys().next().value)
  }
  const record = entries[row.factIndex]
  if (!record || record.id !== row.id || record.checksum !== row.checksum) throw Error('候选存储索引与内容不一致')
  // Recency changes do not rewrite an immutable payload block. These fields
  // are excluded from the checksum and retain the original public format.
  return { ...record, createdAt: row.createdAt, updatedAt: row.updatedAt, bytes: row.bytes }
}
async function get(store, key) {
  if (store === 'results' && /^(computed-candidate|shared-plan):/.test(key)) {
    const row = await rawGet('meta', key)
    return row ? storedRecord(row) : rawGet(store, key)
  }
  const row = await rawGet(store, key)
  return store === 'meta' ? unpackMetadata(row) : row
}
const LIBRARY_STATE='@library-state'
export function notifyLibraryChanged() {
  if(typeof BroadcastChannel==='undefined')return
  const channel=new BroadcastChannel('fgo-library-changes-v1')
  channel.postMessage({type:'library-changed'});channel.close()
}
function bumpLibraryRevision(tx) {
  const store=tx.objectStore('meta'),request=store.get(LIBRARY_STATE)
  request.onsuccess=()=>store.put({id:LIBRARY_STATE,revision:(request.result?.revision||0)+1})
}
export async function libraryRevision() {
  return (await rawGet('meta',LIBRARY_STATE))?.revision||0
}
function metadata(record) {
  const { value, ...rest } = record
  if (['computed-candidate','shared-plan'].includes(record.kind)) {
    // Facts already have unique content-addressed primary keys and no account
    // variants. They do not need entries in the query-family search index.
    const { family, ...fact } = rest
    return { ...fact, factFamily: family, ...(record.kind==='shared-plan'?{members:record.value.slots.filter(s=>s.filled&&!s.isSupport).map(s=>[s.svtId,s.svtArtKey])}:{}) }
  }
  return rest
}
function unpackMetadata(record) {
  if (record?.factBlock) {
    const { factBlock, factIndex, ...rest } = record; record = rest
  }
  if (record && typeof record.factFamily === 'string' && ['computed-candidate','shared-plan'].includes(record.kind)) {
    const { factFamily, ...rest } = record; return { ...rest, family: factFamily }
  }
  return record
}
async function commitRecord(record, storeName = 'results') {
  const database = await db()
  await new Promise((resolve, reject) => {
    const pending = storeName === 'results-pending'
    const target = pending ? 'results' : storeName
    const tx = database.transaction(target === 'stage' || pending ? [target] : ['results', 'meta'], 'readwrite')
    tx.objectStore(target).put(record)
    if (target !== 'stage' && !pending) tx.objectStore('meta').put(metadata(record))
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
}
function checksumInput(r) { return [r.queryId, r.family, r.kind, r.revision, r.summary, r.value] }
async function describeFact(kind, text, summary) {
  const context = await fingerprintText(text)
  if (!emptyInventoryDigest) emptyInventoryDigest = fingerprint(null).catch(error => { emptyInventoryDigest = null; throw error })
  const inventory = await emptyInventoryDigest, revision = 1
  return { queryId: `${kind}:r1:${await fingerprint([context, inventory])}`, family: `${kind}:r1:${context}`,
    kind, revision, summary: String(summary).slice(0,240) }
}
function factChecksum(record, text) {
  // Exactly the same canonical tuple as checksumInput(), reusing the already
  // canonical payload instead of walking and sorting all its nested fields.
  return fingerprintText(canonical(checksumInput(record).slice(0,5)).slice(0,-1) + ',' + text + ']')
}
const SHARED_BATCH_SIZE = 128
async function sharedRecords(plans) {
  // The caller supplies at most one bounded batch of fresh physical copies.
  // Hash preparation is parallel; IDs, payloads and checksums stay unchanged.
  return Promise.all(plans.map(async plan => {
    const text = canonical(plan), description = await describeFact('shared-plan', text, '通用编队 · 不绑定账号')
    const record = { ...description, id: description.queryId, value: plan, createdAt: Date.now(), updatedAt: Date.now() }
    record.checksum = await factChecksum(record, text)
    record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
    return record
  }))
}
async function refreshSharedRecords(records) {
  if (!records.length) return
  const database = await db();let changed=false
  await new Promise((resolve, reject) => {
    const tx = database.transaction(['results', 'meta'], 'readwrite')
    const results = tx.objectStore('results'), meta = tx.objectStore('meta')
    for (const record of records) {
      const previous = meta.get(record.id)
      previous.onsuccess = () => {
        try {
          if(!previous.result&&!changed){changed=true;bumpLibraryRevision(tx)}
          record.createdAt = previous.result?.createdAt || record.createdAt
          // Dates are outside the checksum but affect the stored byte count.
          record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
          if (previous.result?.factBlock && previous.result.checksum === record.checksum) {
            meta.put({ ...metadata(record), factBlock: previous.result.factBlock, factIndex: previous.result.factIndex })
          } else { results.put(record); meta.put(metadata(record)) }
        } catch (error) { reject(error); try { tx.abort() } catch {} }
      }
    }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error('通用编队保存中断'))
  })
  if(changed)notifyLibraryChanged()
}
function accountInputs(account) {
  if (!account) return null
  const rows = key => (account[key] || []).map(r => ({ ...r })).sort((a,b) => Number(a.id)-Number(b.id))
  // Login payloads, profile names, timestamps, currency and materials do not
  // affect these queries and must not prevent reuse after an account refresh.
  return { virtual: Boolean(account.virtual), region: account.region || '',
    servants: rows('servants'), ces: rows('ces'), servantsOwned: rows('servantsOwned'), craftEssencesOwned: rows('craftEssencesOwned'),
    rawServants: (account.raw?.servants||[]).map(r=>({...r})).sort((a,b)=>a.id-b.id),
    rawCes: (account.raw?.ces||[]).map(r=>({...r})).sort((a,b)=>a.id-b.id),
    mlb: account.mlb || null, eventState: account.eventState || null }
}
function queryParts(kind, inputs) {
  if (!KINDS.has(kind)) throw Error('未知查询类型')
  let shared = inputs, account = null
  if (['bond','farm','quest'].includes(kind)) {
    shared = Object.fromEntries(Object.entries(inputs).filter(([key]) => !OMIT.has(key)))
    account = inputs.mode === 'account' ? accountInputs(inputs.account) : null
    if (shared.game?.version) shared.game = { ...shared.game, version: { region: shared.game.version.region || '' } }
    shared.activityState = resolveCurrentActivity({ catalog: inputs.bondBonuses }).activityState
    // NPC availability can change with time or quest clears even in free mode.
    shared.availableSystemSupports=availableSystemSupports(inputs.quest||{},inputs.account)
    const now=Math.floor(Date.now()/1000),quest=inputs.quest
    shared.questAvailable=!quest || ((!quest.openedAt||now>=quest.openedAt)&&(!quest.closedAt||now<=quest.closedAt))
  }
  return {shared,account}
}
export async function describeQuery(kind, inputs, summary = '') {
  const {shared,account}=queryParts(kind,inputs)
  // Physical schemes keep their own stable format across solver revisions.
  const revision=['shared-plan','computed-candidate'].includes(kind)?1:QUERY_REVISION
  const context = await fingerprint(shared)
  // Null inventory is immutable and occurs for every public observation and
  // physical plan. Preserve the existing IDs while avoiding one SHA per row.
  if (account === null && !emptyInventoryDigest) emptyInventoryDigest = fingerprint(null).catch(error => { emptyInventoryDigest = null; throw error })
  const inventory = account === null ? await emptyInventoryDigest : await fingerprint(account)
  const family = `${kind}:r${revision}:${context}`
  return { queryId: `${kind}:r${revision}:${await fingerprint([context, inventory])}`,
    family, kind, revision, summary: String(summary).slice(0,240) }
}
// A private JSON snapshot permits reuse of large, static catalog encodings.
// The resulting key is byte-for-byte identical to describeQuery().
export function createJsonQueryBatch(kind,staticInputs) {
  const snapshot=JSON.parse(JSON.stringify(staticInputs)),base=queryParts(kind,snapshot)
  const encoded=new Map(Object.entries(base.shared).map(([key,value])=>[key,canonical(value)]))
  return async(overrides={},summary='')=>{
    const {shared,account}=queryParts(kind,{...snapshot,...overrides})
    const text='{'+Object.keys(shared).sort().filter(k=>shared[k]!==undefined&&typeof shared[k]!=='function')
      .map(k=>JSON.stringify(k)+':'+(shared[k]===base.shared[k]?encoded.get(k):canonical(shared[k]))).join(',')+'}'
    const revision=['shared-plan','computed-candidate'].includes(kind)?1:QUERY_REVISION
    const context=await fingerprintText(text),inventory=await fingerprint(account),family=`${kind}:r${revision}:${context}`
    return {queryId:`${kind}:r${revision}:${await fingerprint([context,inventory])}`,family,kind,revision,summary:String(summary).slice(0,240)}
  }
}

export async function readQuery(description) {
  try {
    const database=await db()
    const [row,meta]=await new Promise((resolve,reject)=>{
      const tx=database.transaction(['results','meta']),requests=['results','meta'].map(name=>tx.objectStore(name).get(description.queryId))
      tx.oncomplete=()=>resolve(requests.map(r=>r.result));tx.onabort=()=>reject(tx.error)
    })
    if (meta?.ambiguous || !row || row.revision !== QUERY_REVISION || row.family !== description.family ||
        row.checksum !== await fingerprint(checksumInput(row))) return null
    return row.value
  } catch { return null }
}
export async function saveQuery(description, value) {
  try {
    const copy = JSON.parse(JSON.stringify(value))
    const previous = await get('meta', description.queryId)
    const record = { ...description, id: description.queryId, value: copy,
      createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now() }
    record.checksum = await fingerprint(checksumInput(record))
    record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
    if (!['shared-plan','computed-candidate'].includes(description.kind)) await collectSharedPlans(copy)
    await commitRecord(record)
    return { saved: true }
  } catch (error) { return { saved: false, error: `本次结果未能保存：${error.message || error}` } }
}
const COMPLETED_QUERY_PREFIX = '@completed-query:'
export async function stageCompletedQuery(description, value, completion) {
  if (!description || !completion?.saved) return { saved: false }
  try {
    const copy = JSON.parse(JSON.stringify(value))
    const previous = await get('meta', description.queryId)
    const record = { ...description, id: description.queryId, value: copy,
      createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now() }
    record.checksum = await fingerprint(checksumInput(record))
    record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
    const pending = { name: completion.name, records: completion.records, bytes: completion.bytes }
    pending.proof = await fingerprint([pending.name, pending.records, pending.bytes, record.checksum])
    await commitRecord({ ...record, id: COMPLETED_QUERY_PREFIX + pending.name, pending }, 'results-pending')
    return { saved: true }
  } catch (error) { return { saved: false, error: String(error.message || error) } }
}
export async function promoteCompletedQuery(name, archive) {
  const key = COMPLETED_QUERY_PREFIX + name, pendingRecord = await get('results', key)
  if (!pendingRecord) return { saved: false, missing: true }
  const { pending, ...body } = pendingRecord
  if (!pending || pending.name !== name || archive.incompleteTail || archive.records !== pending.records || archive.bytes !== pending.bytes ||
      pending.proof !== await fingerprint([name, pending.records, pending.bytes, pendingRecord.checksum])) {
    return { saved: false, error: '候选前缀不完整，本次答案未作为精确缓存' }
  }
  const record = { ...body, id: body.queryId }
  await validateRecord(record)
  await collectSharedPlans(record.value)
  const database = await db()
  await new Promise((resolve, reject) => {
    const tx = database.transaction(['results','meta'], 'readwrite'), results = tx.objectStore('results'), meta = tx.objectStore('meta')
    const previous = meta.get(record.id)
    previous.onsuccess = () => {
      try {
        record.createdAt = previous.result?.createdAt || record.createdAt
        record.updatedAt = Date.now()
        record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
        results.delete(key); results.put(record); meta.put(metadata(record))
      } catch (error) { reject(error); try { tx.abort() } catch {} }
    }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
  return { saved: true }
}

export async function discardCompletedQuery(name) {
  const database=await db()
  await new Promise((resolve,reject)=>{
    const tx=database.transaction('results','readwrite')
    tx.objectStore('results').delete(COMPLETED_QUERY_PREFIX+name)
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)
  })
}

// Content-addressed facts are independent of profiles. Their scores are
// observations, not proof of optimality for another query. Exact answers still
// pass readQuery's full effective-input key; physical plans are revalidated.
export async function saveComputedCandidates(values) {
  const unique = new Map()
  for (const value of values) {
    const copy = JSON.parse(JSON.stringify(value)), text = canonical(copy)
    unique.set(text, copy)
  }
  const records = await Promise.all([...unique.entries()].map(async ([text, copy]) => {
    const description = await describeFact('computed-candidate', text, '已计算候选 · ' + copy.engine)
    const record = { ...description, id: description.queryId, value: copy, createdAt: Date.now(), updatedAt: Date.now() }
    record.checksum = await factChecksum(record, text)
    record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
    return record
  }))
  const plans = new Map()
  for (const value of unique.values()) {
    const plan = value.plan && sharedPlanOf(value.plan)
    if (plan) plans.set(canonical(plan), plan)
  }
  const physical = [...plans.values()]
  for (let at = 0; at < physical.length; at += SHARED_BATCH_SIZE) {
    records.push(...await sharedRecords(physical.slice(at, at + SHARED_BATCH_SIZE)))
  }
  const database = await db()
  let added = 0
  await new Promise((resolve, reject) => {
    const tx = database.transaction(['results','meta'], 'readwrite'), results = tx.objectStore('results'), meta = tx.objectStore('meta')
    try {
      if(physical.length)bumpLibraryRevision(tx)
      let at = 0
      while (at < records.length) {
        const group = [], blockId = '@fact-block:' + crypto.randomUUID()
        let bytes = 0
        while (at < records.length && group.length < FACT_BLOCK_RECORDS) {
          const record = records[at], size = record.bytes + 64
          if (group.length && bytes + size > FACT_BLOCK_BYTES) break
          group.push(record); bytes += size; at++
        }
        const entries = {}; let pending = group.length
        const settle = () => {
          if (--pending || !Object.keys(entries).length) return
          // Only newly inserted records occupy disk. Metadata and payload are
          // in the same transaction: quota failures roll back both, and a
          // terminated Worker can safely retry its retained journal prefix.
          results.add({ id: blockId, format: 'fgo-immutable-facts', version: 1, records: JSON.stringify(entries) })
        }
        for (const [index, record] of group.entries()) {
          const r = meta.add({ ...metadata(record), factBlock: blockId, factIndex: index })
          r.onsuccess = () => {
            try { entries[index] = record; if (record.kind === 'computed-candidate') added++; settle() }
            catch (error) { reject(error); try { tx.abort() } catch {} }
          }
          r.onerror = event => {
            if (event.target.error?.name === 'ConstraintError') {
              event.preventDefault(); event.stopPropagation()
              try { settle() } catch (error) { reject(error); try { tx.abort() } catch {} }
            }
            // Other errors abort the entire batch; no exact cache is published.
          }
        }
      }
    } catch (error) { reject(error); try { tx.abort() } catch {} }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
  return { added }
}
export async function aggregateLibrary() {
  const groups=new Map();let count=0,bytes=0
  for await (const page of pagedMetadata())for(const row of page){
    const group=groups.get(row.kind)||{kind:row.kind,count:0,bytes:0,updatedAt:0}
    group.count++;group.bytes+=row.bytes||0;group.updatedAt=Math.max(group.updatedAt,row.updatedAt)
    groups.set(row.kind,group);count++;bytes+=row.bytes||0
  }
  return {count,bytes,groups:[...groups.values()]}
}
// Only physical composition belongs to the shared library. Account state,
// former scores and query conditions are deliberately excluded from its key.
export function sharedPlanOf(plan) {
  if (!plan?.ok || !Array.isArray(plan.slots) || plan.slots.length !== 6) return null
  const slots = [1,2,3,4,5,6].map(position => {
    const s = plan.slots.find(row => Number(row.position) === position)
    if (!s) throw Error('方案站位不完整')
    return { position, filled: Boolean(s.filled), isSupport: Boolean(s.isSupport), isGrand: Boolean(s.isGrand),
      svtId: Number(s.svtId)||0, svtArtKey: !s.svtArtKey || s.svtArtKey==='d' ? 'default' : String(s.svtArtKey),
      ceId: Number(s.ceId)||0, ceMlb: s.ceMlb !== false,
      ceBondId: Number(s.ceBondId)||0, ceBondMlb: s.ceBondMlb !== false,
      ceRewardId: Number(s.ceRewardId)||0, ceRewardMlb: s.ceRewardMlb !== false }
  })
  if (!slots.some(s=>s.filled&&!s.isSupport)) return null
  return { ok: true, slots }
}
export function plansFromResult(value) {
  const root=value?.bond || value?.team || value
  const plans=[...(root?.allPlans || root?.plans || (root?.ok?[root]:[])),
    ...(value?.candidates || []).map(c=>c.plan).filter(Boolean)]
  return plans
}
export async function collectSharedPlans(value) {
  const seen=new Set()
  let batch=[]
  async function flush() {
    const records = (await sharedRecords(batch)).filter(record => {
      if (seen.has(record.id)) return false
      seen.add(record.id); return true
    })
    batch=[]
    // Refresh recency and preserve creation dates in one atomic transaction,
    // rather than opening separate read/write transactions for every plan.
    await refreshSharedRecords(records)
  }
  for (const source of plansFromResult(value)) {
    const plan=sharedPlanOf(source)
    if (!plan) continue
    batch.push(plan)
    if (batch.length === SHARED_BATCH_SIZE) await flush()
  }
  if (batch.length) await flush()
}
export async function readSharedPlan(id, stored = null) {
  const row=stored ? await storedRecord(stored) : await get('results',id)
  if(row?.kind!=='shared-plan'||row.checksum!==await fingerprint(checksumInput(row)))return null
  return sharedPlanOf(row.value)
}
export async function sharedPlans({mode,account,servants,allowSupport=true,filter=null},limit=64,{maxRows=Infinity}={}) {
  try {
    let scanned=0
    const owned=new Set((account?.servantsOwned||account?.servants||[]).map(s=>Number(s.id)))
    const available=new Set((servants||[]).map(s=>Number(s.id))), out=[]
    const legalForms=new Set((servants||[]).flatMap(s=>servantBondForms(s).filter(f=>matchRosterForm(s,f,filter)).map(f=>s.id+':'+f.key)))
    for await(const page of pagedMetadata('shared-plan'))for (const row of page) {
      if(++scanned>maxRows)return out
      if(row.members?.some(([id,form])=>!legalForms.has(id+':'+form)||mode==='account'&&!account?.virtual&&!owned.has(id)))continue
      const plan=await readSharedPlan(row.id,row)
      if(!plan)continue
      const own=plan.slots.filter(s=>s.filled&&!s.isSupport)
      if(own.some(s=>!available.has(s.svtId)||!legalForms.has(s.svtId+':'+s.svtArtKey)))continue
      if(mode==='account'&&!account?.virtual&&own.some(s=>!owned.has(s.svtId)))continue
      if(!allowSupport&&plan.slots.some(s=>s.filled&&s.isSupport))continue
      out.push(plan);if(out.length>=limit)return out
    }
    return out
  } catch {return []}
}
async function* pagedMetadata(kind=null) {
  const database=await db();let last=null
  while(true){
    const range=last!==null?(kind?IDBKeyRange.bound(last,kind+':\uffff',true):IDBKeyRange.lowerBound(last,true))
      :kind?IDBKeyRange.bound(kind+':',kind+':\uffff'):undefined
    const page=await new Promise((resolve,reject)=>{
      const r=database.transaction('meta').objectStore('meta').getAll(range,256)
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)
    })
    if(!page.length)return
    last=page[page.length-1].id
    yield page.filter(r=>KINDS.has(r.kind)&&(!kind||r.kind===kind)).sort((a,b)=>b.updatedAt-a.updatedAt)
  }
}
async function storageRows(kind = null) {
  if (kind !== null && !KINDS.has(kind)) throw Error('未知查询类型')
  const database = await db()
  return new Promise((resolve,reject) => {
    // Existing content-addressed IDs begin with their kind. Use that primary
    // key range: no database upgrade, account partition or candidate scan.
    const range = kind === null ? undefined : IDBKeyRange.bound(kind + ':', kind + ':\uffff')
    const r = database.transaction('meta').objectStore('meta').getAll(range)
    r.onsuccess = () => resolve(r.result.filter(r=>KINDS.has(r.kind) && (kind === null || r.kind === kind)).sort((a,b) => b.updatedAt-a.updatedAt)); r.onerror = () => reject(r.error)
  })
}
export async function listQueries(kind = null) { return (await storageRows(kind)).map(unpackMetadata) }
export async function relatedQueries(description, limit = 4) {
  try {
    const database = await db()
    const candidates = await new Promise((resolve,reject) => {
      const r = database.transaction('meta').objectStore('meta').index('family').getAll(description.family)
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
    const values = []
    for (const row of candidates.filter(r => r.queryId !== description.queryId).sort((a,b) => b.updatedAt-a.updatedAt).slice(0,limit)) {
      const record = await get('results', row.id)
      if (record && record.checksum === await fingerprint(checksumInput(record))) values.push(record.value)
    }
    return values
  } catch { return [] }
}
let migration
export async function migrateLegacyQueries() {
  if (!migration) migration=(async()=>{
    const database=await db()
    if(await get('meta','@legacy-migration-v1'))return
    for(const [name,store,kind] of [['fgo-solver-results-v1','results','legacy-bond'],['fgo-native-data-v1','cache','legacy-formation']]) {
      const legacy=await new Promise(resolve=>{
        const r=indexedDB.open(name)
        r.onupgradeneeded=()=>r.transaction.abort()
        r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null)
      })
      if(!legacy)continue
      try {
        if(!legacy.objectStoreNames.contains(store))continue
        const keys=await new Promise((resolve,reject)=>{
          const range=kind==='legacy-formation'?IDBKeyRange.bound('formation-review-v3:','formation-review-v3:\uffff'):undefined
          const r=legacy.transaction(store).objectStore(store).getAllKeys(range)
          r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)
        })
        for(const key of keys) {
          let conditions
          if(kind==='legacy-bond'){try{conditions=JSON.parse(key);if(conditions.rev!==21)continue}catch{continue}}
          const description=await describeQuery(kind,{legacyKey:key},kind==='legacy-bond'
            ?`${conditions.region||'CN'} · 旧版推荐 · B ${conditions.base} · COST ${conditions.costLimit||'不限'}`:'旧版编队曲线／核实结果')
          if(await get('meta',description.queryId))continue
          const row=await new Promise((resolve,reject)=>{const r=legacy.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
          if(row?.key!==key||!row.value||(kind==='legacy-bond'&&!row.value.ok))continue
          const saved=await saveQuery(description,row.value)
          if(!saved.saved)throw Error(saved.error)
        }
      } finally {legacy.close()}
    }
    await new Promise((resolve,reject)=>{const tx=database.transaction('meta','readwrite');tx.objectStore('meta').put({id:'@legacy-migration-v1',finished:true});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  })().catch(()=>{migration=null})
  await migration
}
export async function exportQueryStream() {
  const database=await db(),encoder=new TextEncoder(),iterator=pagedMetadata()[Symbol.asyncIterator]()
  const counts=await Promise.all([...KINDS].map(kind=>new Promise((resolve,reject)=>{
    const r=database.transaction('meta').objectStore('meta').count(IDBKeyRange.bound(kind+':',kind+':\uffff'))
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)
  })))
  let first=true,page=[],at=0,emitted=0,archive
  const stream=new ReadableStream({async pull(controller){
    try{
      if(first){first=false;controller.enqueue(encoder.encode(JSON.stringify({format:FORMAT,version:1,exportedAt:Date.now()})+'\n'));return}
      while(at>=page.length){const next=await iterator.next();if(next.done){archive.count=emitted;controller.close();return}page=next.value;at=0}
      const record=await storedRecord(page[at++])
      if(!record||record.checksum!==await fingerprint(checksumInput(record)))throw Error('保存的查询结果校验失败，未完成导出')
      controller.enqueue(encoder.encode(JSON.stringify(record)+'\n'));emitted++
    }catch(error){controller.error(error)}
  }})
  archive={stream,name:`FGO-query-results-${new Date().toISOString().slice(0,10)}.jsonl`,count:counts.reduce((n,x)=>n+x,0)}
  return archive
}
export async function exportQueries() {
  const archive = await exportQueryStream()
  const blob = await new Response(archive.stream,{headers:{'Content-Type':'application/x-ndjson;charset=utf-8'}}).blob()
  return { blob, name: archive.name, count: archive.count }
}
export async function validateRecord(record) {
  if (!record || !KINDS.has(record.kind) || !Number.isInteger(record.revision) || record.revision < 1 ||
      typeof record.summary !== 'string' || record.summary.length > 240 || !record.value ||
      !Number.isFinite(record.createdAt) || !Number.isFinite(record.updatedAt)) throw Error('查询记录格式无效')
  const prefix = `${record.kind}:r${record.revision}:`
  if (!record.queryId?.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(record.queryId.slice(prefix.length)) ||
      !record.family?.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(record.family.slice(prefix.length)) ||
      record.checksum !== await fingerprint(checksumInput(record))) throw Error('查询记录条件或文件完整性校验失败')
  if (record.id !== record.queryId && record.id !== `${record.queryId}~${record.checksum}`) throw Error('查询记录标识无效')
  if (record.kind === 'computed-candidate') {
    if (!['inventory-dp','loadout-score','settled-plan','equipment-curve'].includes(record.value.engine)) throw Error('候选计算类型无效')
    const description = await describeQuery('computed-candidate', record.value, record.summary)
    if (description.queryId !== record.queryId || description.family !== record.family) throw Error('候选内容与标识不一致')
  }
  if (record.kind === 'shared-plan') {
    const clean=sharedPlanOf(record.value)
    if (!clean || canonical(clean)!==canonical(record.value)) throw Error('通用方案含有非编队字段')
    const description=await describeQuery('shared-plan',clean,record.summary)
    if (description.queryId!==record.queryId || description.family!==record.family) throw Error('通用方案标识与编队不一致')
  }
  record.bytes=new TextEncoder().encode(JSON.stringify(record)).length
  return record
}
export async function importQueries(file, { notify = true } = {}) {
  const database = await db(), session = crypto.randomUUID()
  let count = 0, header = false, buffer = '', unpacked = 0, pending=[],pendingBytes=0, validating=[],validatingBytes=0
  async function flushStage(){
    if(!pending.length)return
    const rows=pending;pending=[];pendingBytes=0
    await new Promise((resolve,reject)=>{const tx=database.transaction('stage','readwrite');for(const row of rows)tx.objectStore('stage').put(row);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
  }
  async function flushValidation(){
    if(!validating.length)return
    const rows=validating;validating=[];validatingBytes=0
    await Promise.all(rows.map(validateRecord))
    for(const row of rows){
      const id=`${session}:${count++}`
      if(pending.length&&(pending.length>=256||pendingBytes+row.bytes>2*1024*1024))await flushStage()
      pending.push({id,record:row});pendingBytes+=row.bytes
    }
  }
  const magic = new Uint8Array(await file.slice(0,2).arrayBuffer())
  if (magic[0] === 31 && magic[1] === 139 && typeof DecompressionStream === 'undefined') throw Error('当前 WebView 不支持此压缩备份，请更新系统 WebView')
  const stream = magic[0] === 31 && magic[1] === 139 ? file.stream().pipeThrough(new DecompressionStream('gzip')) : file.stream()
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  async function line(text) {
    if (!text.trim()) return
    const row = JSON.parse(text)
    if (!header) { if (row.format !== FORMAT || row.version !== 1) throw Error('不是受支持的查询结果备份'); header = true; return }
    // Three bytes per UTF-16 unit bounds UTF-8 size without a second encoding.
    const estimate=text.length*3
    if(validating.length&&(validating.length>=64||validatingBytes+estimate>2*1024*1024))await flushValidation()
    validating.push(row);validatingBytes+=estimate
  }
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      unpacked += next.value.length
      if (!Number.isSafeInteger(unpacked)) throw Error('备份大小超出安全范围')
      buffer += decoder.decode(next.value, { stream: true })
      let end
      while ((end=buffer.indexOf('\n'))>=0) { await line(buffer.slice(0,end)); buffer=buffer.slice(end+1) }
      if (buffer.length > 64*1024*1024) throw Error('单条查询记录过大')
    }
    buffer += decoder.decode(); await line(buffer)
    if (!header) throw Error('备份文件为空')
    await flushValidation()
    await flushStage()
    return await new Promise((resolve,reject) => {
      const tx = database.transaction(['results','meta','stage'],'readwrite')
      const results = tx.objectStore('results'), meta = tx.objectStore('meta'), stage = tx.objectStore('stage')
      let added=0, duplicates=0, conflicts=0, i=0, sharedChanged=false
      function next() {
        if (i>=count) { if(sharedChanged)bumpLibraryRevision(tx);return }
        const r = stage.get(`${session}:${i++}`)
        r.onsuccess = () => {
          const incoming = r.result.record, lookup = meta.get(incoming.queryId)
          lookup.onsuccess = () => {
            const existing = lookup.result
            if (existing && (existing.checksum === incoming.checksum || incoming.kind==='shared-plan')) { duplicates++; stage.delete(r.result.id); next(); return }
            // Divergent records for identical conditions are preserved, but
            // their scores are not silently trusted as one exact answer. A
            // fresh calculation clears this marker when it saves the primary.
            if(existing)meta.put({...existing,ambiguous:true})
            const id = existing ? `${incoming.queryId}~${incoming.checksum}` : incoming.queryId
            const variant = results.get(id)
            variant.onsuccess = () => {
              if (variant.result) duplicates++
              else { if(incoming.kind==='shared-plan')sharedChanged=true;const record = {...incoming,id}; results.put(record); meta.put(metadata(record)); added++; if(existing)conflicts++ }
              stage.delete(r.result.id); next()
            }
          }
        }
      }
      next()
      tx.oncomplete = () => {if(sharedChanged&&notify)notifyLibraryChanged();resolve({ added, duplicates, conflicts, total: count })}
      tx.onabort = () => reject(tx.error || Error('合并未完成，原结果库已保留'))
    })
  } finally {
    await reader.cancel().catch(()=>{})
    await new Promise(resolve => { const tx=database.transaction('stage','readwrite'); tx.objectStore('stage').delete(IDBKeyRange.bound(session+':',session+':\uffff')); tx.oncomplete=resolve;tx.onabort=resolve })
  }
}

// Stream the physical bank without loading unrelated payload blocks. Projections
// inspect the compact member metadata first and keep bounded pages in memory.
export async function* sharedPlanPages({acceptMetadata=()=>true}={}) {
  for await(const page of pagedMetadata('shared-plan')){
    const plans=[]
    for(const row of page){
      if(!acceptMetadata(row))continue
      const plan=await readSharedPlan(row.id,row)
      if(plan)plans.push({id:row.id,plan})
    }
    yield {scanned:page.length,plans}
  }
}
