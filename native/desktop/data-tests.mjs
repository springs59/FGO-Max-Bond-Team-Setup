import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'
import { get, put, commitStage, readActiveData } from '../shared/store.js'
import { digest, validateManifest, UPDATE_URL } from '../shared/manifest.js'
import { regionCacheKey, accountProjectionKey, baseCacheKey } from '../shared/precompute.js'
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
const bundle = { region:'CN', version:(await get('files','src/data/version.json')).data, servants:(await get('files','src/data/servants.json')).data,
  ces:(await get('files','src/data/ces.json')).data, quests:(await get('files','src/data/quests.json')).data, traits:(await get('files','src/data/traits.json')).data,
  bondBonuses:(await get('files','src/data/bond-bonuses.json')).data }
const profiles = [100100,100700].map((id,i)=>({id:'profile-'+i,name:'账号'+i,region:'CN',account:{ok:true,region:'CN',servants:[{id,bondLv:5,maxAscension:4}],ces:[]}}))
await put('meta','accountProfiles',{profiles})
calls=[]; result=await run({accountOnly:true})
assert.equal(result.state,'done',result.error)
assert.equal(calls.length,0,'an account-only update uses the active local data')
assert.equal(result.precomputeNeeded,true)
assert.equal(result.accountCount,2)
assert.ok(result.estimate.highMs>=result.estimate.lowMs)
const publicKey=await regionCacheKey(bundle,'CN')
assert.ok((await get('cache',publicKey)).formationDomain.source.rows.length,'background update saves the review domain for local reuse')
for(const p of profiles) { const projected=await get('cache',await accountProjectionKey(publicKey,p)); assert.ok(projected.members.length); const factors=(await get('cache',publicKey)).factorIndex; assert.deepEqual(new Set(projected.members.map(i=>factors.members[i].svt)),new Set(p.account.servants.map(s=>s.id))) }
calls=[]; result=await run({accountOnly:true})
assert.equal(result.precomputeNeeded,false,'unchanged accounts reuse their own projections')
assert.equal(calls.length,0)
const bonusesPath='src/data/bond-bonuses.json', changedBonuses=structuredClone(bundle.bondBonuses)
changedBonuses.questFriendships.push({type:'questFriendship',calcType:'multiplication',rate:.5,allQuests:true,targetIds:[100100],startedAt:1,endedAt:2145888000,name:'native test campaign'})
const bonusBytes=new TextEncoder().encode(JSON.stringify(changedBonuses));payloads.set(bonusesPath,bonusBytes)
const bonusFile=manifest.files.find(f=>f.path===bonusesPath);bonusFile.size=bonusBytes.length;bonusFile.sha256=await digest(bonusBytes)
manifest.id=await digest(new TextEncoder().encode(JSON.stringify(manifest.files)))
const baseBefore=(await get('cache',baseCacheKey(bundle,'CN'))).factorIndex
calls=[]; result=await run({})
assert.equal(result.state,'done',result.error)
assert.equal(calls.length,2,'activity-only change downloads the manifest and affected catalog only')
assert.ok(result.logs.some(x=>x.text.includes('复用礼装索引，更新活动联合效果')))
assert.deepEqual((await get('cache',baseCacheKey(bundle,'CN'))).factorIndex,baseBefore)
assert.equal((await get('files','generated/joined-effects.json')).data.activityScores.byQuest['83951001:1'][100100].totalSecondLayer,.5)
manifest=structuredClone(manifest)
manifest.files=manifest.files.filter(f=>f.path!=='generated/joined-effects.json')
manifest.id=await digest(new TextEncoder().encode(JSON.stringify(manifest.files)))
result=await run({})
assert.equal(result.state,'done',result.error)
assert.equal((await get('files','generated/joined-effects.json')).sourceDataId,manifest.id,'older remote manifests receive a locally derived index in the same atomic commit')
await assert.rejects(commitStage(original,{state:'done'}))
assert.equal((await get('meta','active')).id,manifest.id,'failed transaction leaves last generation intact')
assert.throws(()=>validateManifest({...manifest,runtime:999}))
assert.throws(()=>validateManifest({...manifest,files:[...manifest.files,{...manifest.files[0],path:'src/data/../../secrets.json'}]}))
assert.throws(()=>validateManifest({...manifest,files:[...manifest.files,manifest.files[0]]}))
await put('meta','status',{state:'running',phase:'interrupted',updatedAt:1})
globalThis.BroadcastChannel=class {postMessage() {}}
globalThis.window={fgoDesktop:{onCommand(){}}}
await import('../shared/host.js')
await wait(30)
assert.equal((await get('meta','status')).state,'paused','restart detects stale running task even when automatic updates are disabled')
delete globalThis.window
console.log('Native data: both regions, no-op/account-only/activity-only updates, isolated profiles, estimates, base-factor reuse, checksum rejection, resumable staging, atomic publish and stable page snapshot passed')
