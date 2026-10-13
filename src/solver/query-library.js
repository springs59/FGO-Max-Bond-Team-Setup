import { resolveCurrentActivity } from '../rules/activity-rules.js'
import { availableSystemSupports } from '../quest-party-rules.js'

// Increment when solver semantics or required archive coverage change. Old archives remain exportable, but
// only results for the current model and identical effective inputs are reused.
export const QUERY_REVISION = 2
const FORMAT = 'fgo-local-query-results'
const KINDS = new Set(['bond', 'farm', 'quest', 'formation-effects', 'formation-actual', 'equipment', 'legacy-bond', 'legacy-formation', 'shared-plan', 'computed-candidate'])
const OMIT = new Set(['account', 'accountProfileId', 'accountProjection', 'solverIndex', 'solutionIndex',
  'factorIndex', 'joinedEffectIndex', 'curveIndex', 'solverAudit', 'onSolverProgress', 'reusePlans', 'reuseOnly', 'skipResultCache', 'onComputedCandidate'])
let opened
let emptyInventoryDigest
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(v => canonical(v) ?? 'null').join(',') + ']'
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined && typeof value[k] !== 'function')
      .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
  }
  return JSON.stringify(value)
}
export async function fingerprint(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)))
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
function db() {
  if (!opened) opened = new Promise((resolve, reject) => {
    const request = indexedDB.open('fgo-local-query-results-v1', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('results', { keyPath: 'id' })
      const meta = request.result.createObjectStore('meta', { keyPath: 'id' })
      meta.createIndex('family', 'family')
      request.result.createObjectStore('stage', { keyPath: 'id' })
    }
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opened = null }; resolve(request.result) }
    request.onerror = () => { opened = null; reject(request.error) }
  })
  return opened
}
async function get(store, key) {
  const database = await db()
  return new Promise((resolve, reject) => {
    const r = database.transaction(store).objectStore(store).get(key)
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
  })
}
function metadata(record) { const { value, ...rest } = record; return rest }
async function commitRecord(record, storeName = 'results') {
  const database = await db()
  await new Promise((resolve, reject) => {
    const tx = database.transaction(storeName === 'stage' ? ['stage'] : ['results', 'meta'], 'readwrite')
    tx.objectStore(storeName).put(record)
    if (storeName !== 'stage') tx.objectStore('meta').put(metadata(record))
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
}
function checksumInput(r) { return [r.queryId, r.family, r.kind, r.revision, r.summary, r.value] }
const SHARED_BATCH_SIZE = 128
async function sharedRecords(plans) {
  // The caller supplies at most one bounded batch of fresh physical copies.
  // Hash preparation is parallel; IDs, payloads and checksums stay unchanged.
  return Promise.all(plans.map(async plan => {
    const description = await describeQuery('shared-plan', plan, '通用编队 · 不绑定账号')
    const record = { ...description, id: description.queryId, value: plan, createdAt: Date.now(), updatedAt: Date.now() }
    record.checksum = await fingerprint(checksumInput(record))
    record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
    return record
  }))
}
async function refreshSharedRecords(records) {
  if (!records.length) return
  const database = await db()
  await new Promise((resolve, reject) => {
    const tx = database.transaction(['results', 'meta'], 'readwrite')
    const results = tx.objectStore('results'), meta = tx.objectStore('meta')
    for (const record of records) {
      const previous = meta.get(record.id)
      previous.onsuccess = () => {
        try {
          record.createdAt = previous.result?.createdAt || record.createdAt
          // Dates are outside the checksum but affect the stored byte count.
          record.bytes = new TextEncoder().encode(JSON.stringify(record)).length
          results.put(record); meta.put(metadata(record))
        } catch (error) { reject(error); try { tx.abort() } catch {} }
      }
    }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || Error('通用编队保存中断'))
  })
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
export async function describeQuery(kind, inputs, summary = '') {
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
// Content-addressed facts are independent of profiles. Their scores are
// observations, not proof of optimality for another query. Exact answers still
// pass readQuery's full effective-input key; physical plans are revalidated.
export async function saveComputedCandidates(values) {
  const unique = new Map(values.map(value => [canonical(value), value]))
  const records = await Promise.all([...unique.values()].map(async value => {
    const copy = JSON.parse(JSON.stringify(value))
    const description = await describeQuery('computed-candidate', copy, '已计算候选 · ' + copy.engine)
    const record = { ...description, id: description.queryId, value: copy, createdAt: Date.now(), updatedAt: Date.now() }
    record.checksum = await fingerprint(checksumInput(record))
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
    const duplicate = event => {
      if (event.target.error?.name === 'ConstraintError') { event.preventDefault(); event.stopPropagation() }
      // Quota, storage and other failures still abort the entire batch.
    }
    try { for (const record of records) {
      // Immutable content-addressed facts need no read-before-insert roundtrip.
      // add() performs the duplicate check atomically; duplicates leave both
      // the original payload and its timestamps untouched.
      const r = results.add(record)
      r.onsuccess = () => { if (record.kind === 'computed-candidate') added++ }
      r.onerror = duplicate
      // Both stores are written atomically throughout the library. Queue both
      // immutable inserts immediately instead of issuing a metadata write
      // from each success callback (another browser/database roundtrip).
      meta.add(metadata(record)).onerror = duplicate
    }} catch (error) { reject(error); try { tx.abort() } catch {} }
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error)
  })
  return { added }
}
export async function aggregateLibrary() {
  const rows = await listQueries(), groups = new Map()
  for (const row of rows) {
    const group = groups.get(row.kind) || { kind: row.kind, count: 0, bytes: 0, updatedAt: 0 }
    group.count++; group.bytes += row.bytes || 0; group.updatedAt = Math.max(group.updatedAt, row.updatedAt)
    groups.set(row.kind, group)
  }
  return { count: rows.length, bytes: rows.reduce((n,r) => n+(r.bytes||0),0), groups: [...groups.values()] }
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
export async function readSharedPlan(id) {
  const row=await get('results',id)
  if(row?.kind!=='shared-plan'||row.checksum!==await fingerprint(checksumInput(row)))return null
  return sharedPlanOf(row.value)
}
export async function sharedPlans({mode,account,servants,allowSupport=true},limit=64) {
  try {
    const rows=await listQueries('shared-plan')
    const owned=new Set((account?.servantsOwned||account?.servants||[]).map(s=>Number(s.id)))
    const available=new Set((servants||[]).map(s=>Number(s.id))), out=[]
    for (const row of rows) {
      const plan=await readSharedPlan(row.id)
      if(!plan)continue
      const own=plan.slots.filter(s=>s.filled&&!s.isSupport)
      if(own.some(s=>!available.has(s.svtId)))continue
      if(mode==='account'&&!account?.virtual&&own.some(s=>!owned.has(s.svtId)))continue
      if(!allowSupport&&plan.slots.some(s=>s.filled&&s.isSupport))continue
      out.push(plan);if(out.length>=limit)break
    }
    return out
  } catch {return []}
}
export async function listQueries(kind = null) {
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
  // Export is always one complete, uncompressed library file.
  const rows = await listQueries()
  const encoder = new TextEncoder()
  let index = -1
  const stream = new ReadableStream({ async pull(controller) {
    try {
      if (index < 0) { index = 0; controller.enqueue(encoder.encode(JSON.stringify({ format: FORMAT, version: 1, exportedAt: Date.now() })+'\n')); return }
      if (index >= rows.length) { controller.close(); return }
      const record = await get('results', rows[index++].id)
      if (!record || record.checksum !== await fingerprint(checksumInput(record))) throw Error('保存的查询结果校验失败，未完成导出')
      controller.enqueue(encoder.encode(JSON.stringify(record)+'\n'))
    } catch (error) { controller.error(error) }
  } })
  return { stream, name: `FGO-query-results-${new Date().toISOString().slice(0,10)}.jsonl`, count: rows.length }
}
export async function exportQueries() {
  const archive = await exportQueryStream()
  const blob = await new Response(archive.stream,{headers:{'Content-Type':'application/x-ndjson;charset=utf-8'}}).blob()
  return { blob, name: archive.name, count: archive.count }
}
async function validateRecord(record) {
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
export async function importQueries(file) {
  const database = await db(), session = crypto.randomUUID(), keys = []
  let count = 0, header = false, buffer = '', unpacked = 0
  const magic = new Uint8Array(await file.slice(0,2).arrayBuffer())
  if (magic[0] === 31 && magic[1] === 139 && typeof DecompressionStream === 'undefined') throw Error('当前 WebView 不支持此压缩备份，请更新系统 WebView')
  const stream = magic[0] === 31 && magic[1] === 139 ? file.stream().pipeThrough(new DecompressionStream('gzip')) : file.stream()
  const reader = stream.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  async function line(text) {
    if (!text.trim()) return
    const row = JSON.parse(text)
    if (!header) { if (row.format !== FORMAT || row.version !== 1) throw Error('不是受支持的查询结果备份'); header = true; return }
    await validateRecord(row)
    const id = `${session}:${count++}`; keys.push(id)
    await commitRecord({ id, record: row }, 'stage')
  }
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      unpacked += next.value.length
      if (unpacked > 1024*1024*1024) throw Error('解压后的备份超过 1 GB，当前设备无法合并')
      buffer += decoder.decode(next.value, { stream: true })
      let end
      while ((end=buffer.indexOf('\n'))>=0) { await line(buffer.slice(0,end)); buffer=buffer.slice(end+1) }
      if (buffer.length > 64*1024*1024) throw Error('单条查询记录过大')
    }
    buffer += decoder.decode(); await line(buffer)
    if (!header) throw Error('备份文件为空')
    return await new Promise((resolve,reject) => {
      const tx = database.transaction(['results','meta','stage'],'readwrite')
      const results = tx.objectStore('results'), meta = tx.objectStore('meta'), stage = tx.objectStore('stage')
      let added=0, duplicates=0, conflicts=0, i=0
      function next() {
        if (i>=keys.length) return
        const r = stage.get(keys[i++])
        r.onsuccess = () => {
          const incoming = r.result.record, lookup = results.get(incoming.queryId)
          lookup.onsuccess = () => {
            const existing = lookup.result
            if (existing && (existing.checksum === incoming.checksum || incoming.kind==='shared-plan')) { duplicates++; stage.delete(r.result.id); next(); return }
            // Divergent records for identical conditions are preserved, but
            // their scores are not silently trusted as one exact answer. A
            // fresh calculation clears this marker when it saves the primary.
            if(existing)meta.put({...metadata(existing),ambiguous:true})
            const id = existing ? `${incoming.queryId}~${incoming.checksum}` : incoming.queryId
            const variant = results.get(id)
            variant.onsuccess = () => {
              if (variant.result) duplicates++
              else { const record = {...incoming,id}; results.put(record); meta.put(metadata(record)); added++; if(existing)conflicts++ }
              stage.delete(r.result.id); next()
            }
          }
        }
      }
      next()
      tx.oncomplete = () => resolve({ added, duplicates, conflicts, total: count })
      tx.onabort = () => reject(tx.error || Error('合并未完成，原结果库已保留'))
    })
  } finally {
    await reader.cancel().catch(()=>{})
    await new Promise(resolve => { const tx=database.transaction('stage','readwrite'); for(const key of keys)tx.objectStore('stage').delete(key); tx.oncomplete=resolve;tx.onabort=resolve })
  }
}
