import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gzipSync} from 'node:zlib'
import 'fake-indexeddb/auto'
import {downloadQueryMatrix,MATRIX_FEED_URL} from './query-matrix-download.js'
import {describeQuery,saveQuery,exportQueries,readQuery,QUERY_REVISION,collectSharedPlans,importQueries,aggregateLibrary} from './query-library.js'
import {RULE_VERSION} from '../rules/versions.js'
import {digest} from '../../native/shared/manifest.js'
const encoder=new TextEncoder(),description=await describeQuery('bond',{base:123,mode:'free'})
await saveQuery(description,{ok:true,total:321,slots:[]})
const archive=await exportQueries(),data=new Uint8Array(gzipSync(new Uint8Array(await archive.blob.arrayBuffer())))
const part={path:'generated/quest-matrix/part-'+ 'a'.repeat(64)+'-000.jsonl.gz',size:data.length,sha256:await digest(data)}
const index=encoder.encode(JSON.stringify({format:'fgo-quest-condition-matrix',version:1,ruleVersion:RULE_VERSION,queryRevision:QUERY_REVISION,files:[part]}))
const manifest={format:'fgo-quest-matrix-feed',version:1,ruleVersion:RULE_VERSION,queryRevision:QUERY_REVISION,revision:'c'.repeat(40)}
manifest.matrix={path:'generated/quest-matrix/index.json',size:index.length,sha256:await digest(index)}
const revision=manifest.revision,base=`https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/${revision}/`
const calls=[]
const fetchBytes=async(url,limit)=>{calls.push(url);const bytes=url===MATRIX_FEED_URL?encoder.encode(JSON.stringify(manifest)):url===base+manifest.matrix.path?index:url===base+part.path?data:null;assert.ok(bytes);assert.ok(bytes.length<=limit);return bytes}
assert.equal((await downloadQueryMatrix({fetchBytes})).files,1)
assert.equal(calls.length,3);calls.length=0
await downloadQueryMatrix({fetchBytes});assert.equal(calls.length,2,'already imported immutable files skip payload download')
const original=manifest.matrix
delete manifest.matrix
await assert.rejects(downloadQueryMatrix({fetchBytes}),/尚未提供/)
manifest.matrix=original
const bad=new Uint8Array(data);bad[bad.length-1]^=1
const other={...part,path:part.path.replace('a'.repeat(64),'b'.repeat(64))},badIndex=encoder.encode(JSON.stringify({format:'fgo-quest-condition-matrix',version:1,ruleVersion:RULE_VERSION,queryRevision:QUERY_REVISION,files:[other]}))
manifest.matrix={...original,size:badIndex.length,sha256:await digest(badIndex)}
await assert.rejects(downloadQueryMatrix({fetchBytes:async url=>url===MATRIX_FEED_URL?encoder.encode(JSON.stringify(manifest)):url.endsWith('index.json')?badIndex:bad}),/校验失败/)
assert.equal((await readQuery(description)).total,321)
console.log('Optional matrix download: pinned revision, size/hash verification, restart skipping and corrupt-payload preservation passed')

const plans=Array.from({length:641},(_,i)=>({ok:true,slots:Array.from({length:6},(_,position)=>({
  position:position+1,filled:position<3||position===5,isSupport:position===5,svtId:position<3?10000+i*3+position:0,
  ceId:0,ceMlb:true
}))}))
await collectSharedPlans({plans})
const fixture=await exportQueries()
const records=(await fixture.blob.text()).trim().split('\n').slice(1).map(line=>JSON.parse(line)).filter(row=>row.kind==='shared-plan')
assert.equal(records.length,641)
for(const database of await indexedDB.databases())await new Promise((resolve,reject)=>{
  const request=indexedDB.deleteDatabase(database.name)
  request.onsuccess=resolve;request.onerror=()=>reject(request.error)
  request.onblocked=()=>reject(Error('Test fixture database did not close'))
})
await saveQuery(description,{ok:true,total:321,slots:[]})
const header={format:'fgo-local-query-results',version:1}
const backup=rows=>new Blob([JSON.stringify(header)+'\n'+rows.map(row=>JSON.stringify(row)).join('\n')+'\n'])
const before=(await aggregateLibrary()).count
const corruptRows=structuredClone(records)
corruptRows.at(-1).value.slots[0].svtId++
await assert.rejects(importQueries(backup(corruptRows)),/校验失败/)
assert.equal((await aggregateLibrary()).count,before,'late failure cannot commit previously staged pages')
assert.equal((await readQuery(description)).total,321,'failed import preserves existing exact answers')
const packedBackup=new Blob([gzipSync(new Uint8Array(await backup(records).arrayBuffer()))])
const imported=await importQueries(packedBackup)
assert.equal(imported.total,641);assert.equal(imported.added,641)
assert.equal((await aggregateLibrary()).count,before+641)
const repeated=await importQueries(packedBackup)
assert.equal(repeated.added,0);assert.equal(repeated.duplicates,641)
console.log('Large compressed imports: complete tail, duplicate preservation and atomic rollback after staged pages passed')
