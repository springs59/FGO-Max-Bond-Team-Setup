import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { get, commitStage, readActiveData } from '../shared/store.js'
import { digest, validateManifest, UPDATE_URL } from '../shared/manifest.js'
const root=new URL('../../',import.meta.url)
const original=JSON.parse(readFileSync(new URL('generated/native-data-manifest.json',root)))
let manifest=structuredClone(original), corrupted=false, calls=[]
const payloads=new Map(manifest.files.map(f=>[f.path,new Uint8Array(readFileSync(new URL(f.path,root)))]))
globalThis.location={protocol:'app:',hostname:'fgo'}
globalThis.fetch=async input=>{
  const url=String(input);calls.push(url)
  if(url===UPDATE_URL||url.endsWith('native-data-manifest.json'))return new Response(JSON.stringify(manifest))
  const path=manifest.files.find(f=>url.endsWith('/'+f.path))?.path
  assert.ok(path,'only known data paths are fetched')
  return new Response(corrupted&&path==='src/data/version.json'?'interrupted':payloads.get(path))
}
let terminal
const run=async command=>{
  const finished=new Promise(resolve=>{terminal=resolve})
  self.onmessage({data:command});const result=await finished;await wait(0);return result
}
globalThis.self={postMessage:s=>{if(['done','error'].includes(s.state))terminal(s)}}
await import('../shared/task-worker.js')
let result=await run({offline:true})
assert.equal(result.state,'done',result.error)
assert.equal((await get('meta','active')).id,original.id)
assert.equal((await get('files','src/data/solver-index.json')).data.region,'CN')
assert.equal((await get('files','src/data/jp/bundle.json')).data.solverIndex.region,'JP')
assert.ok(result.logs.some(x=>x.text.includes('国服')))
assert.ok(result.logs.some(x=>x.text.includes('日服')))
const oldPage=await readActiveData('app://fgo/src/data/version.json')
calls=[];result=await run({})
assert.equal(result.state,'done');assert.equal(calls.length,1,'unchanged manifest avoids downloads and recomputation')
const path='src/data/version.json', nextVersion={...JSON.parse(new TextDecoder().decode(payloads.get(path))),nativeTest:1}
const nextBytes=new TextEncoder().encode(JSON.stringify(nextVersion))
payloads.set(path,nextBytes)
manifest=structuredClone(manifest)
const changed=manifest.files.find(f=>f.path===path);changed.size=nextBytes.length;changed.sha256=await digest(nextBytes)
manifest.id=await digest(new TextEncoder().encode(JSON.stringify(manifest.files)))
corrupted=true;result=await run({})
assert.equal(result.state,'error')
assert.equal((await get('meta','active')).id,original.id,'bad download does not publish partial data')
assert.equal((await get('files',path)).data.nativeTest,undefined)
assert.equal((await get('meta','checkpoint')).id,manifest.id)
corrupted=false;calls=[];result=await run({})
assert.equal(result.state,'done',result.error)
assert.equal(calls.length,2,'resume reuses all valid staged files')
assert.equal((await get('files',path)).data.nativeTest,1)
assert.equal((await readActiveData('app://fgo/src/data/version.json')).nativeTest,oldPage.nativeTest,'one page never mixes old and new generations')
assert.equal((await get('meta','checkpoint')),undefined)
await assert.rejects(commitStage(original,{state:'done'}))
assert.equal((await get('meta','active')).id,manifest.id,'failed transaction leaves last generation intact')
assert.throws(()=>validateManifest({...manifest,runtime:999}))
assert.throws(()=>validateManifest({...manifest,files:[...manifest.files,{...manifest.files[0],path:'src/data/../../secrets.json'}]}))
assert.throws(()=>validateManifest({...manifest,files:[...manifest.files,manifest.files[0]]}))
console.log('Native data: both regions, offline precompute, no-op updates, checksum rejection, resumable staging, atomic publish and stable page snapshot passed')
