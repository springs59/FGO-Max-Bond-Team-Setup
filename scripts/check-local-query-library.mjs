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
assert.ok(seeded.resultStatus.reusedPlans>0)
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
oldRow.revision=1;oldRow.queryId=oldRow.queryId.replace(':r2:',':r1:');oldRow.id=oldRow.queryId;oldRow.family=oldRow.family.replace(':r2:',':r1:')
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
