import assert from 'node:assert/strict'
import {mkdtempSync,openSync,writeSync,readSync,fstatSync,fsyncSync,ftruncateSync,closeSync,rmSync,existsSync,appendFileSync,readdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import 'fake-indexeddb/auto'
import {temporaryQueries} from './query-temporary.js'
import {createDiskJournal} from './query-candidate-journal.js'
import {describeQuery,stageCompletedQuery,readQuery,aggregateLibrary} from './query-library.js'
const folder=mkdtempSync(join(tmpdir(),'fgo-user-choice-'))
const locked=new Set()
function file(name){return {kind:'file',async createSyncAccessHandle(){
  if(locked.has(name))throw new DOMException('busy','NoModificationAllowedError')
  const fd=openSync(join(folder,name),existsSync(join(folder,name))?'r+':'w+');locked.add(name);let closed=false
  return {getSize:()=>fstatSync(fd).size,write:(b,{at})=>writeSync(fd,b,0,b.length,at),read:(b,{at})=>readSync(fd,b,0,b.length,at),flush:()=>fsyncSync(fd),truncate:n=>ftruncateSync(fd,n),close(){if(closed)return;closed=true;closeSync(fd);locked.delete(name)}}
}}}
const directory={getFileHandle:async name=>file(name),async *entries(){for(const name of readdirSync(folder))yield [name,file(name)]},removeEntry:async name=>rmSync(join(folder,name))}
const observation={engine:'test',total:100,curve:{terms:[{front:1000,second:1000,flat:0,eligible:true}]},plan:{slots:[]}}
async function journal(name){const handle=await file(name).createSyncAccessHandle();return createDiskJournal(handle)}
try {
  const completed=await journal('complete.jsonl');completed.capture(observation);completed.seal()
  const description=await describeQuery('bond',{mode:'free',base:100})
  assert.equal((await stageCompletedQuery(description,{ok:true,total:100,slots:[]},{saved:true,name:'complete.jsonl',...completed.stats()})).saved,true)
  completed.close()
  assert.equal(await readQuery(description),null,'a completed temporary answer is invisible before consent')
  for(let i=0;i<2;i++)assert.equal((await temporaryQueries({directory})).entries.length,1)
  assert.equal((await aggregateLibrary()).count,0,'listing/restart never silently imports')
  const active=await journal('active.jsonl');active.capture(observation)
  assert.equal((await temporaryQueries({directory})).busy,1)
  await assert.rejects(temporaryQueries({directory,action:'discard',name:'active.jsonl'}),/busy/)
  active.close()
  const saved=await temporaryQueries({directory,action:'save',name:'complete.jsonl'})
  assert.equal(saved.exact,true);assert.equal((await readQuery(description)).total,100)
  assert.equal(existsSync(join(folder,'complete.jsonl')),false)
  const before=(await aggregateLibrary()).count
  await temporaryQueries({directory,action:'discard',name:'active.jsonl'})
  assert.equal((await aggregateLibrary()).count,before,'discard leaves permanent data intact')
  const stopped=await journal('stopped.jsonl');stopped.capture({...observation,total:90});stopped.close()
  appendFileSync(join(folder,'stopped.jsonl'),'{"partial":')
  const partial=await temporaryQueries({directory,action:'save',name:'stopped.jsonl'})
  assert.equal(partial.exact,false);assert.equal(partial.records,1);assert.equal(partial.incompleteTail,true)
  const corrupt=await journal('corrupt.jsonl');corrupt.capture(observation);corrupt.close()
  appendFileSync(join(folder,'corrupt.jsonl'),'invalid\n')
  await assert.rejects(temporaryQueries({directory,action:'save',name:'corrupt.jsonl'}))
  assert.equal(existsSync(join(folder,'corrupt.jsonl')),true,'failed save keeps its recovery file')
  await assert.rejects(temporaryQueries({directory,action:'discard',name:'../other.jsonl'}))
} finally {rmSync(folder,{recursive:true,force:true})}
console.log('Temporary queries: read-only recovery, active locks, explicit save/discard, exact completion proof, stopped prefixes and failed-save retention passed')
