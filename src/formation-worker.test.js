import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import 'fake-indexeddb/auto'
import {receiveWorkerPort} from './worker-transport.js'
import {describeQuery,readQuery,aggregateLibrary} from './solver/query-library.js'
import {temporaryQueries} from './solver/query-temporary.js'
import {solveProjectedGlobal} from './solver/global-curve-expand.js'
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'fgo-formation-consent-')),locked=new Set(),messages=[]
function file(name){return {kind:'file',async createSyncAccessHandle(){
  if(locked.has(name))throw new DOMException('busy','NoModificationAllowedError')
  const filename=path.join(folder,name),fd=fs.openSync(filename,fs.existsSync(filename)?'r+':'w+');locked.add(name)
  let closed=false
  return {getSize:()=>fs.fstatSync(fd).size,write:(b,{at})=>fs.writeSync(fd,b,0,b.length,at),read:(b,{at})=>fs.readSync(fd,b,0,b.length,at),flush:()=>fs.fsyncSync(fd),truncate:n=>fs.ftruncateSync(fd,n),close(){if(closed)return;closed=true;fs.closeSync(fd);locked.delete(name)}}
}}}
const directory={getFileHandle:async name=>file(name),async *entries(){for(const n of fs.readdirSync(folder))yield [n,file(n)]},removeEntry:async name=>fs.rmSync(path.join(folder,name))}
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>directory})}}})
globalThis.self={postMessage(message){if(message.transport)receiveWorkerPort(message.port).then(m=>messages.push(m));else messages.push(message)}}
const source={rows:[{id:1,form:'default',cost:0,self:0,party:0},{id:2,form:'default',cost:3,self:200,party:0}],groups:[],supports:[{flat:0,rates:[0,0],items:[]}],guestPartyMax:0}
const options={cost:6,portraitCap:0,capped:0,layout:0,support:-1,requiredIds:[]}
try {
  const description=await describeQuery('formation-actual',[source,options,[]],'编队精确核实'),cold=solveProjectedGlobal(source,options)
  await import('./solver/formation-review-worker.js')
  await self.onmessage({data:{kind:'solve',source,options,description}})
  const result=messages.find(m=>m.kind==='solved')
  assert.ok(result,result&&JSON.stringify(result))
  assert.deepEqual(result.bank.records,cold.records)
  assert.equal((await aggregateLibrary()).count,0)
  assert.equal(await readQuery(description),null)
  let pending=await temporaryQueries({directory});assert.equal(pending.entries.length,1)
  const saved=await temporaryQueries({directory,action:'save',name:pending.entries[0].name})
  assert.equal(saved.exact,true);assert.ok(saved.records>0)
  assert.deepEqual((await readQuery(description)).bank.records,cold.records)
  const before=(await aggregateLibrary()).count
  await self.onmessage({data:{kind:'solve',source,options:{...options,cost:5}}})
  pending=await temporaryQueries({directory});await temporaryQueries({directory,action:'discard',name:pending.entries[0].name})
  assert.equal((await aggregateLibrary()).count,before)
} finally {fs.rmSync(folder,{recursive:true,force:true})}
console.log('Real formation worker: solver parity, observed disk candidates, explicit exact promotion and discard preservation passed')
