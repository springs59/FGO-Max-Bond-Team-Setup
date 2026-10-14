import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import 'fake-indexeddb/auto'
import {receiveWorkerPort} from './worker-transport.js'
import {describeQuery,readQuery,aggregateLibrary} from './solver/query-library.js'
import {temporaryQueries} from './solver/query-temporary.js'
import {recommendTeam} from './recommend.js'
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'fgo-worker-consent-')),locked=new Set(),messages=[]
function file(name){return {kind:'file',async createSyncAccessHandle(){
  if(locked.has(name))throw new DOMException('busy','NoModificationAllowedError')
  const filename=path.join(folder,name),fd=fs.openSync(filename,fs.existsSync(filename)?'r+':'w+');locked.add(name)
  let closed=false
  return {getSize:()=>fs.fstatSync(fd).size,write:(b,{at})=>fs.writeSync(fd,b,0,b.length,at),read:(b,{at})=>fs.readSync(fd,b,0,b.length,at),flush:()=>fs.fsyncSync(fd),truncate:n=>fs.ftruncateSync(fd,n),close(){if(closed)return;closed=true;fs.closeSync(fd);locked.delete(name)}}
}}}
const directory={getFileHandle:async name=>file(name),async *entries(){for(const n of fs.readdirSync(folder))yield [n,file(n)]},removeEntry:async name=>fs.rmSync(path.join(folder,name))}
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>({getDirectoryHandle:async()=>directory})}}})
globalThis.self={postMessage(message){if(message.transport)receiveWorkerPort(message.port).then(m=>messages.push(m));else messages.push(message)}}
const servants=Array.from({length:7},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i===6?1:i?16:3,traitIds:[100]}))
const opts={servants,ces:[],mode:'free',base:1000,costLimit:20,useInventoryCurveSolver:true}
try{
  const description=await describeQuery('bond',opts),cold=recommendTeam({...opts,skipResultCache:true})
  await import('./recommend-worker.js')
  await self.onmessage({data:{id:1,opts}})
  const first=messages.find(m=>m.id===1&&m.type==='result')
  assert.equal(first.ok,true);assert.equal(first.result.value.total,cold.total)
  assert.equal(first.result.value.localResult.temporary,true)
  assert.equal((await aggregateLibrary()).count,0,'worker must not auto-import candidates')
  assert.equal(await readQuery(description),null)
  const list=await temporaryQueries({directory});assert.equal(list.entries.length,1)
  assert.ok(list.entries[0].summary.includes('COST'))
  const saved=await temporaryQueries({directory,action:'save',name:list.entries[0].name})
  assert.equal(saved.exact,true)
  await self.onmessage({data:{id:2,opts}})
  const hit=messages.find(m=>m.id===2&&m.type==='result')
  assert.equal(hit.result.value.localResult.hit,true)
  assert.equal((await temporaryQueries({directory})).entries.length,0,'cache hit creates no temporary task')
  await self.onmessage({data:{id:3,opts:{...opts,base:999}}})
  const next=(await temporaryQueries({directory})).entries[0]
  await temporaryQueries({directory,action:'discard',name:next.name})
  assert.equal(await readQuery(await describeQuery('bond',{...opts,base:999})),null)
  assert.equal((await readQuery(description)).total,cold.total,'discard cannot delete older saved results')
}finally{fs.rmSync(folder,{recursive:true,force:true})}
console.log('Real recommendation worker: cold-solver parity, no automatic save, explicit promotion, cache-hit isolation and discard preservation passed')
