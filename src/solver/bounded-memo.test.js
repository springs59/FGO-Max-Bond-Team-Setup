import assert from 'node:assert/strict'
import {BoundedMemo} from './bounded-memo.js'
import {recommendTeam,comparePlans} from '../recommend.js'
const cache=new BoundedMemo({entries:4,bytes:32,weight:()=>8})
for(let i=0;i<100000;i++)cache.set(String(i),i)
assert.equal(cache.size,4);assert.equal(cache.bytes,32);assert.equal(cache.get('0'),undefined)
assert.equal(cache.get('99996'),99996);cache.set('new',7);assert.equal(cache.get('99997'),undefined)
const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:3,cost:i%3+1,traitIds:[100+i%2]}))
for(const allowSupport of [true,false])for(const costLimit of [3,10,20]){
 const opts={servants,ces:[],base:815,costLimit,allowSupport,skipResultCache:true}
 const large=recommendTeam({...opts,solverAudit:{ub:false,compression:false,dominance:false}})
 const tiny=recommendTeam({...opts,solverAudit:{ub:false,compression:false,dominance:false,memoEntries:1,seenEntries:1}})
 assert.equal(tiny.ok,large.ok)
 if(tiny.ok){assert.equal(tiny.total,large.total);assert.equal(tiny.costUsed,large.costUsed);assert.equal(comparePlans(tiny,large),0)}
}
console.log('Bounded memo: 100,000 inserts stay bounded; forced eviction preserves exact objectives in 6 constrained searches')
