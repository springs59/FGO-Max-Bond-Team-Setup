import assert from 'node:assert/strict'
import {Worker} from 'node:worker_threads'
import {fileURLToPath} from 'node:url'
import {readFileSync,writeFileSync} from 'node:fs'
import {smallVersionCases} from './small-version-cases.mjs'
const root=fileURLToPath(new URL('..',import.meta.url)),file=root+'/../small-version-results/raw.json'
const r=JSON.parse(readFileSync(file)),c=smallVersionCases().find(c=>c.id==='capacity-empty')
assert.ok(!r.cases.some(c=>c.id==='capacity-empty'))
const pool=new Map();let expected
try{
 for(const [version,meta] of Object.entries(r.versions)){
  const w=new Worker(new URL('./small-version-worker.mjs',import.meta.url),{workerData:{root:meta.root,kind:'worker'}})
  await new Promise((ok,no)=>{w.once('message',ok);w.once('error',no)});pool.set(version,w)
 }
 for(let round=-1;round<3;round++){
  const order=Object.keys(r.versions);for(let i=0;i<(round+1)%4;i++)order.push(order.shift())
  for(const version of order){
   const w=pool.get(version),t=performance.now()
   const value=await new Promise((ok,no)=>{w.once('message',ok);w.once('error',no);w.postMessage({id:'capacity:'+version+':'+round,
    opts:c.opts,aiMode:r.versions[version].aiMode})})
   assert.equal(value.status,'ok',JSON.stringify(value));assert.equal(value.valid,true,'capacity plus empty must be feasible')
   assert.equal(value.slots.filter(s=>s.filled&&!s.isSupport).length,5)
   assert.ok(!value.slots.some(s=>s.filled&&s.isSupport))
   assert.equal(value.slots.find(s=>s.position===5).filled,false)
   expected??=value.facts;assert.deepEqual(value.facts,expected,'capacity/empty objective parity')
   if(round>=0)r.runs.push({case:c.id,version,round,roundTripMs:performance.now()-t,...value})
  }
 }
 r.cases.find(c=>c.id==='special-1').label='严格6人＋锁定空位（冲突）'
 r.cases.push(c);r.addedCaseReason='区分严格人数等号与禁止助战但允许空位；额外条件并非按耗时选择。'
 writeFileSync(file,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({case:c.id,facts:expected,checkedFiveOwnAndEmpty:true}))
}finally{for(const w of pool.values())await w.terminate()}
