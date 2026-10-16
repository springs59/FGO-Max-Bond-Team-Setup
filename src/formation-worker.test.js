import assert from 'node:assert/strict'
import {solveProjectedGlobal} from './solver/global-curve-expand.js'
const messages=[]
globalThis.self={postMessage:m=>messages.push(m)}
await import('./solver/formation-review-worker.js')
const source={rows:[{id:1,form:'default',cost:0,self:0,party:0},{id:2,form:'default',cost:3,self:200,party:0}],groups:[],supports:[{flat:0,rates:[0,0],items:[]}],guestPartyMax:0}
const options={cost:6,portraitCap:0,capped:0,layout:0,support:-1,requiredIds:[]}
await self.onmessage({data:{kind:'solve',source,options}})
assert.deepEqual(messages.find(m=>m.kind==='solved').bank.records,solveProjectedGlobal(source,options).records)
console.log('Original formation worker: exact solver parity passed')
