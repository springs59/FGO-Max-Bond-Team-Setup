import assert from 'node:assert/strict'
import { IDBFactory, IDBKeyRange, IDBDatabase, IDBObjectStore } from 'fake-indexeddb'
import { recommendTeam } from '../src/recommend.js'
globalThis.indexedDB=new IDBFactory();globalThis.IDBKeyRange=IDBKeyRange
const library=await import('../src/solver/query-library.js?device=one')
const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i===6?1:i?16:3,traitIds:[100]}))
const account={servants:servants.slice(0,6).map(s=>({id:s.id,bondLv:1,bondCap:10})),ces:[],masterLv:100}
const opts={servants,ces:[],account,mode:'account',base:1000,costLimit:20,useInventoryCurveSolver:true,accountProfileId:'private-profile-a'}
const description=await library.describeQuery('bond',opts,'test')
const first=recommendTeam(opts)
assert.equal(first.total,2480)
// The solver result contains self-referential plan lists; its worker clone is
// the persisted wire format, not the original graph.
const {cloneSolverResult}=await import('../src/solver/cache.js')
assert.equal((await library.saveQuery(description,cloneSolverResult(first))).saved,true)
const shared=await library.sharedPlans(opts)
assert.ok(shared.length)
assert.ok(shared.every(p=>!JSON.stringify(p).includes('bondLv')&&!JSON.stringify(p).includes('2480')))
const freeSeeds=await library.sharedPlans({...opts,mode:'free',account:null,base:987})
assert.ok(freeSeeds.length,'free and account queries use one scheme bank')
const harmless=await library.describeQuery('bond',{...opts,accountProfileId:'private-profile-b',account:{...account,QP:999,updatedAt:123,masterLv:180}})
assert.equal(harmless.queryId,description.queryId,'profile identity, currency and timestamps cannot split queries')
const enlarged={...opts,accountProfileId:'different-owner',account:{...account,servants:servants.map(s=>({id:s.id,bondLv:1,bondCap:10}))}}
const nextDescription=await library.describeQuery('bond',enlarged)
assert.notEqual(nextDescription.queryId,description.queryId)
assert.equal(await library.readQuery(nextDescription),null)
const progress=[]
const seeded=recommendTeam({...enlarged,solverAudit:{defaultDp:true},reusePlans:shared,onSolverProgress:p=>progress.push(p)})
const cold=recommendTeam({...enlarged,solverAudit:{defaultDp:true}})
assert.equal(seeded.total,3600);assert.equal(seeded.total,cold.total)
assert.equal(seeded.resultStatus.reusedPlans||0,0,'ordinary queries ignore library incumbents')
assert.ok(progress.every(p=>p.bestScore<=seeded.total))
const called=recommendTeam({...enlarged,reuseOnly:true,reusePlans:shared})
assert.equal(called.ok,true);assert.equal(called.total,2480)
assert.equal(called.resultStatus.optimality,'candidate')
const unavailable=recommendTeam({...opts,account:{...account,servants:[{id:106,bondLv:1,bondCap:10}]},reuseOnly:true,reusePlans:shared})
assert.equal(unavailable.ok,false,'manual call rejects unavailable members')
// A deliberately illegal cheap-plan incumbent must not prune a legal search.
const illegal={...shared[0],slots:shared[0].slots.map((s,i)=>i<5?{...s,filled:true,isSupport:false,svtId:101+i}:s)}
const illegalResult=recommendTeam({...enlarged,solverAudit:{defaultDp:true},reusePlans:[illegal]})
assert.equal(illegalResult.total,cold.total)
assert.equal((await library.saveQuery(nextDescription,cloneSolverResult(seeded))).saved,true)
const observations=[]
recommendTeam({...opts,solverAudit:{defaultDp:true},onComputedCandidate:value=>observations.push(value)})
assert.ok(observations.some(c=>c.total<first.total))
assert.ok((await library.saveComputedCandidates(observations)).added>0)
assert.equal((await library.saveComputedCandidates(observations)).added,0,'identical observed candidates merge')
const aggregated=await library.aggregateLibrary()
assert.equal(aggregated.groups.find(g=>g.kind==='computed-candidate').count,new Set(observations.map(library.canonical)).size)
const archive=await library.exportQueries()
assert.match(archive.name,/\.jsonl$/)
assert.equal(archive.count,(await library.listQueries()).length)
const text=await archive.blob.text()
assert.equal(text[0],'{','exported file is plain UTF-8 data')
const whole=await library.exportQueries([description.queryId])
assert.equal(whole.count,archive.count,'legacy subset arguments cannot narrow the exported library')
assert.equal((await whole.blob.text()).trim().split('\n').length,archive.count+1)
assert.ok(!text.includes('private-profile-a')&&!text.includes('different-owner'))
const lines=text.trim().split('\n'), rows=lines.slice(1).map(x=>JSON.parse(x))
const candidateRows=rows.filter(r=>r.kind==='computed-candidate')
assert.equal(candidateRows.length,new Set(observations.map(library.canonical)).size)
assert.ok(candidateRows.some(r=>r.value.total<first.total),'single full backup includes non-best results')
const sharedRows=rows.filter(r=>r.kind==='shared-plan')
assert.ok(sharedRows.length)
assert.ok(sharedRows.every(r=>Object.keys(r.value).join(',')==='ok,slots'))
// New IndexedDB instance represents a second installation with no accounts.
globalThis.indexedDB=new IDBFactory()
const other=await import('../src/solver/query-library.js?device=two')
const merged=await other.importQueries(archive.blob)
assert.equal(merged.added,rows.length)
assert.equal((await other.readQuery(nextDescription)).total,3600)
assert.ok((await other.sharedPlans({...opts,mode:'free',account:null})).length)
assert.equal((await other.importQueries(archive.blob)).duplicates,rows.length)
const before=await other.listQueries()
const changed={...rows.find(r=>r.kind==='bond'),value:{ok:true,total:10}}
changed.checksum=await other.fingerprint([changed.queryId,changed.family,changed.kind,changed.revision,changed.summary,changed.value])
const conflict=await other.importQueries(new Blob([lines[0]+'\n'+JSON.stringify(changed)+'\n']))
assert.equal(conflict.conflicts,1)
assert.equal((await other.listQueries()).length,before.length+1)
assert.equal(await other.readQuery(changed),null,'conflicting imported answers require a fresh calculation')
const original=rows.find(r=>r.id===changed.queryId)
assert.equal((await other.saveQuery({queryId:changed.queryId,family:changed.family,kind:changed.kind,revision:changed.revision,summary:changed.summary},original.value)).saved,true)
assert.equal((await other.readQuery(changed)).total,original.value.total,'a fresh calculation restores exact reuse')
const newQuery=await other.describeQuery('equipment',{newConditions:true})
const valid={...newQuery,id:newQuery.queryId,value:{ok:true},createdAt:Date.now(),updatedAt:Date.now()}
valid.checksum=await other.fingerprint([valid.queryId,valid.family,valid.kind,valid.revision,valid.summary,valid.value])
const corrupt={...changed,checksum:'0'.repeat(64)}
await assert.rejects(other.importQueries(new Blob([lines[0]+'\n'+JSON.stringify(valid)+'\n'+JSON.stringify(corrupt)+'\n'])),/校验/)
assert.equal(await other.readQuery(newQuery),null,'a late corrupt row must abort the whole import')
const privatePlan={...sharedRows[0],value:{...sharedRows[0].value,accountId:'no'}}
privatePlan.checksum=await other.fingerprint([privatePlan.queryId,privatePlan.family,privatePlan.kind,privatePlan.revision,privatePlan.summary,privatePlan.value])
await assert.rejects(other.importQueries(new Blob([lines[0]+'\n'+JSON.stringify(privatePlan)+'\n'])),/非编队/)
console.log('Global plans: free/account sharing, inventory revalidation, safe warm bounds, portable atomic merge and corruption rejection passed')

// The old 10,000-row ceiling required splitting one library across files.
// Older compressed archives with >10,000 observations remain importable.
const header=lines[0]+'\n',repeated=[header]
for(let i=0;i<10001;i++)repeated.push(JSON.stringify(candidateRows[i%candidateRows.length])+'\n')
const largeFile=await new Response(new Blob(repeated).stream().pipeThrough(new CompressionStream('gzip'))).blob()
const largeMerge=await other.importQueries(largeFile)
assert.equal(largeMerge.total,10001)
assert.equal(largeMerge.duplicates,10001)
assert.equal((await other.aggregateLibrary()).groups.find(g=>g.kind==='computed-candidate').count,candidateRows.length)
console.log('Aggregate archive: one plain full-library file, all observed candidates, content deduplication and >10,000-row atomic import passed')

const oldRow={...rows.find(r=>r.kind==='bond')}
oldRow.revision=1;oldRow.queryId=oldRow.queryId.replace(/:r\d+:/,':r1:');oldRow.id=oldRow.queryId;oldRow.family=oldRow.family.replace(/:r\d+:/,':r1:')
oldRow.checksum=await other.fingerprint([oldRow.queryId,oldRow.family,oldRow.kind,oldRow.revision,oldRow.summary,oldRow.value])
assert.equal((await other.importQueries(new Blob([header+JSON.stringify(oldRow)+'\n']))).added,1,'2.0.1 archives still import')
assert.ok((await other.listQueries()).some(r=>r.id===oldRow.id))
assert.equal(await other.readQuery(oldRow),null,'old archive coverage cannot masquerade as a complete new archive')

// Bounded bulk writes preserve dates and roll back a failed physical batch.
globalThis.indexedDB=new IDBFactory()
const bulk=await import('../src/solver/query-library.js?device=bulk')
const makePlans=(start,n)=>Array.from({length:n},(_,i)=>({ok:true,slots:shared[0].slots.map((slot,j)=>j?{...slot}:{...slot,svtId:start+i})}))
const bulkPlans=makePlans(10000,150),transaction=IDBDatabase.prototype.transaction
let writeTransactions=0
try {
  IDBDatabase.prototype.transaction=function(names,mode,...rest){if(mode==='readwrite')writeTransactions++;return transaction.call(this,names,mode,...rest)}
  await bulk.collectSharedPlans({ok:true,allPlans:bulkPlans})
} finally {IDBDatabase.prototype.transaction=transaction}
assert.equal(writeTransactions,2,'150 schemes use two bounded atomic write batches')
assert.equal((await bulk.listQueries('shared-plan')).length,150)
const oldPhysical=(await bulk.listQueries('shared-plan'))[0]
const physicalDb=await new Promise((resolve,reject)=>{const r=indexedDB.open('fgo-local-query-results-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
await new Promise((resolve,reject)=>{
  const tx=physicalDb.transaction(['results','meta'],'readwrite')
  for(const name of ['results','meta']){const store=tx.objectStore(name),r=store.get(oldPhysical.id);r.onsuccess=()=>store.put({...r.result,createdAt:99})}
  tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)
})
await bulk.collectSharedPlans({ok:true,allPlans:[...bulkPlans,...bulkPlans]})
assert.equal((await bulk.listQueries('shared-plan')).find(r=>r.id===oldPhysical.id).createdAt,99)
assert.equal((await bulk.listQueries('shared-plan')).length,150,'repeated physical schemes are not duplicated')
const put=IDBObjectStore.prototype.put,failedDescription=await bulk.describeQuery('equipment',{quotaProbe:true})
try {
  IDBObjectStore.prototype.put=function(record,...rest){
    if(record.kind==='shared-plan'&&record.value?.slots?.[0]?.svtId===20003)throw new DOMException('disk full','QuotaExceededError')
    return put.call(this,record,...rest)
  }
  const failed=await bulk.saveQuery(failedDescription,{ok:true,total:1,allPlans:makePlans(20000,150)})
  assert.equal(failed.saved,false,'a failed batch cannot publish an exact query answer')
}finally{IDBObjectStore.prototype.put=put;physicalDb.close()}
assert.equal(await bulk.readQuery(failedDescription),null)
assert.equal((await bulk.listQueries('shared-plan')).length,150,'all partial writes in the failed batch roll back')
const bulkBackup=await bulk.exportQueries()
assert.equal(bulkBackup.count,150)
console.log('Bulk physical schemes: bounded transactions, creation-date preservation, content deduplication and atomic quota rollback passed')

globalThis.indexedDB=new IDBFactory()
const atomicFacts=await import('../src/solver/query-library.js?device=atomic-facts')
const add=IDBObjectStore.prototype.add
let inserted=0
try {
  IDBObjectStore.prototype.add=function(record,...rest){
    if(record.kind==='computed-candidate'&&++inserted===2)throw new DOMException('disk full','QuotaExceededError')
    return add.call(this,record,...rest)
  }
  await assert.rejects(atomicFacts.saveComputedCandidates(observations),/disk full/)
}finally{IDBObjectStore.prototype.add=add}
assert.equal((await atomicFacts.listQueries()).length,0,'a synchronous insertion failure rolls back the entire candidate batch')
assert.ok((await atomicFacts.saveComputedCandidates(observations)).added>0)
const immutableBefore=await atomicFacts.listQueries()
assert.equal((await atomicFacts.saveComputedCandidates(observations)).added,0)
assert.deepEqual(await atomicFacts.listQueries(),immutableBefore,'atomic duplicate inserts preserve all original metadata')
console.log('Immutable facts: atomic insert/deduplication, unchanged metadata and quota rollback passed')


globalThis.indexedDB=new IDBFactory()
const completed=await import('../src/solver/query-library.js?device=completed')
const completedDescription=await completed.describeQuery('bond',opts,'completed-search')
const finishedValue=cloneSolverResult(first)
const completion={saved:true,name:'completed-probe.jsonl',records:observations.length,bytes:12345}
assert.equal((await completed.stageCompletedQuery(completedDescription,finishedValue,completion)).saved,true)
assert.equal(await completed.readQuery(completedDescription),null,'a staged complete search is not a complete archive cache hit')
assert.equal((await completed.listQueries()).length,0,'temporary completion proofs never appear in a backup')
const partial=await completed.promoteCompletedQuery(completion.name,{records:completion.records-1,bytes:completion.bytes,incompleteTail:false})
assert.equal(partial.saved,false)
assert.equal(await completed.readQuery(completedDescription),null,'an incomplete prefix must never promote an exact answer')
await completed.saveComputedCandidates(observations)
assert.equal((await completed.promoteCompletedQuery(completion.name,{records:completion.records,bytes:completion.bytes,incompleteTail:false})).saved,true)
assert.equal((await completed.readQuery(completedDescription)).total,first.total,'recovery reuses completed mathematical work')
assert.equal((await completed.promoteCompletedQuery(completion.name,{records:completion.records,bytes:completion.bytes,incompleteTail:false})).missing,true,'promotion is idempotent')
assert.ok(!(await (await completed.exportQueries()).blob.text()).includes('@completed-query:'))
console.log('Completed search: durable staging, hidden unfinished cache, incomplete-prefix rejection, recovery promotion and idempotence passed')

// Fact blocks are a storage detail, never the public backup format. A block
// insertion failure must roll back every per-record metadata pointer as well.
globalThis.indexedDB=new IDBFactory()
const blocked=await import('../src/solver/query-library.js?device=blocked')
try {
  IDBObjectStore.prototype.add=function(record,...rest){
    if(record.format==='fgo-immutable-facts')throw new DOMException('block disk full','QuotaExceededError')
    return add.call(this,record,...rest)
  }
  await assert.rejects(blocked.saveComputedCandidates(observations),/block disk full/)
}finally{IDBObjectStore.prototype.add=add}
assert.equal((await blocked.listQueries()).length,0,'payload quota rolls back every metadata pointer')
await blocked.saveComputedCandidates(observations)
const blockDb=await new Promise((resolve,reject)=>{const r=indexedDB.open('fgo-local-query-results-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
const stored=async()=>new Promise((resolve,reject)=>{const r=blockDb.transaction('results').objectStore('results').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
const payloads=await stored(),blocks=payloads.filter(r=>r.format==='fgo-immutable-facts')
assert.ok(blocks.length&&blocks.length<payloads.length+observations.length)
assert.ok(blocks.every(r=>Object.keys(JSON.parse(r.records)).length<=256&&new TextEncoder().encode(r.records).length<=2*1024*1024))
assert.ok(!(await blocked.listQueries()).some(r=>'factBlock' in r||'factIndex' in r),'public metadata excludes internal storage addresses')
const blockCount=blocks.length
assert.equal((await blocked.saveComputedCandidates(observations)).added,0)
assert.equal((await stored()).filter(r=>r.format==='fgo-immutable-facts').length,blockCount,'duplicates do not write another payload block')
const blockedBackup=await blocked.exportQueries(),blockedText=await blockedBackup.blob.text()
assert.ok(!blockedText.includes('@fact-block:')&&!blockedText.includes('fgo-immutable-facts'),'backup still contains individual canonical records')
assert.equal(blockedText.trim().split('\n').length,blockedBackup.count+1)
const normalized=text=>text.trim().split('\n').slice(1).map(JSON.parse).map(r=>{const {createdAt,updatedAt,bytes,...body}=r;return JSON.stringify(body)}).sort()
// Existing imported individual rows and new payload blocks coexist and dedup.
const nativeRows=blockedText.trim().split('\n').slice(1).map(JSON.parse)
assert.equal((await blocked.importQueries(new Blob([blockedText]))).duplicates,nativeRows.length)
await blocked.collectSharedPlans({ok:true,allPlans:nativeRows.filter(r=>r.kind==='shared-plan').map(r=>r.value)})
assert.deepEqual(normalized(await (await blocked.exportQueries()).blob.text()),normalized(blockedText),'recency refresh leaves every candidate and physical payload unchanged')
assert.equal((await stored()).filter(r=>r.format==='fgo-immutable-facts').length,blockCount,'recency updates reuse immutable blocks')
const conflicted={...nativeRows.find(r=>r.kind==='computed-candidate'),summary:'different verified summary'}
conflicted.checksum=await blocked.fingerprint([conflicted.queryId,conflicted.family,conflicted.kind,conflicted.revision,conflicted.summary,conflicted.value])
assert.equal((await blocked.importQueries(new Blob([header+JSON.stringify(conflicted)+'\n']))).conflicts,1,'an imported conflicting fact retains the packed primary and the individual variant')
assert.equal((await blocked.exportQueries()).count,nativeRows.length+1)
const primary=nativeRows.find(r=>r.kind==='shared-plan')
assert.deepEqual(await blocked.readSharedPlan(primary.id),primary.value)
// Reopen through an uncached module: a missing payload must fail closed, even
// when all metadata rows remain and look like a complete archive.
const missing=blocks.find(b=>Object.values(JSON.parse(b.records)).some(r=>r.id===primary.id))
await new Promise((resolve,reject)=>{const tx=blockDb.transaction('results','readwrite');tx.objectStore('results').delete(missing.id);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)})
const reopened=await import('../src/solver/query-library.js?device=missing-block')
await assert.rejects(reopened.readSharedPlan(primary.id),/存储块/)
await assert.rejects(reopened.exportQueries(),/存储块/)
blockDb.close()
console.log('Fact payload blocks: bounded storage, atomic quota rollback, zero duplicate blocks, portable per-record backup, recency, conflict preservation and missing-block rejection passed')
