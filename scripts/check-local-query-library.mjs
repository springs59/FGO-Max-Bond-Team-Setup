import assert from 'node:assert/strict'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
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
const archive=await library.exportQueries()
const text=await new Response(archive.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text()
assert.ok(!text.includes('private-profile-a')&&!text.includes('different-owner'))
const lines=text.trim().split('\n'), rows=lines.slice(1).map(x=>JSON.parse(x))
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
