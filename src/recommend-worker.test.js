import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {recommendTeam} from './recommend.js'
import {postRecommendRequest} from './worker-catalog.js'
const messages=[]
globalThis.self={postMessage:m=>messages.push(m)}
await import('./recommend-worker.js')
const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i?16:3,traitIds:[100]}))
const opts={servants,ces:[],mode:'free',base:1000,costLimit:20,useInventoryCurveSolver:true}
const cold=recommendTeam({...opts,skipResultCache:true})
const worker={postMessage:m=>{worker.pending=self.onmessage({data:m})}}
await postRecommendRequest(worker,{id:1,opts});await worker.pending
const result=id=>messages.find(m=>m.id===id&&m.type==='result')
assert.equal(result(1).result.value.total,cold.total)
assert.equal(result(1).result.value.localResult,undefined,'excluded automatic journal/library path is not active')
await postRecommendRequest(worker,{id:2,opts:{...opts,base:1001}});await worker.pending
assert.equal(result(2).result.value.total,recommendTeam({...opts,base:1001,skipResultCache:true}).total)
await postRecommendRequest(worker,{id:3,opts});await worker.pending
assert.equal(result(3).result.value.total,cold.total,'original result cache remains valid')
await self.onmessage({data:{id:4,catalogRef:999,opts:{}}})
assert.equal(messages.find(m=>m.id===4).ok,false)
console.log('Production worker: cold parity, fresh conditions, original cache and catalog error recovery passed')
