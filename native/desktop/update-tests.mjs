import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,stat,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import policy from './update-policy.cjs'
import updater from './updater.cjs'
import {buildUpdate} from '../../scripts/build-native-update.mjs'
import {softwareView} from '../shared/software-ui.js'
const {Updater,request}=updater,root=await mkdtemp(join(tmpdir(),'fgo-update-'))
try {
  const bytes=Buffer.from('fake verified installer'), apk=Buffer.from('fake APK')
  await writeFile(join(root,'FGO-Bond-Windows-0.1.10.exe'),bytes);await writeFile(join(root,'FGO-Bond-Android-0.1.10.apk'),apk)
  const manifest=await buildUpdate(root,'0.1.10',11,'说明 <script>display as text</script>')
  assert.equal(policy.compare('0.1.10','0.1.9'),1);assert.equal(policy.compare('1.0.0','0.99.99'),1)
  for(const v of ['0.1.01','0.1.10-beta','NaN','0.1.9007199254740992'])assert.throws(()=>policy.compare(v,'0.1.0'))
  for(const mutate of [m=>m.prerelease=true,m=>delete m.assets.android,m=>m.assets.windows.url='https://example.com/bad.exe',m=>m.assets.windows.sha256='bad',m=>m.assets.windows.name='../bad.exe',m=>m.releaseUrl+='?test',m=>m.androidCode=0]) {const m=structuredClone(manifest);mutate(m);assert.throws(()=>policy.validate(m))}
  assert.equal(policy.allowedUrl('http://github.com/springs59/FGO-Max-Bond-Team-Setup/releases/'),false)
  assert.equal(policy.allowedUrl('https://user:pass@release-assets.githubusercontent.com/asset'),false)
  await assert.rejects(request(async()=>new Response(null,{status:302,headers:{location:'https://evil.example/file'}}),policy.FEED),/非仓库/)
  let installed=0,requests=[],interrupt=true
  const fetch=async(url,options)=>{
    requests.push({url,range:options?.headers?.Range})
    if(url===policy.FEED)return new Response(JSON.stringify(manifest))
    if(interrupt){interrupt=false;let i=0;return new Response(new ReadableStream({pull(c){if(i++===0)c.enqueue(bytes.subarray(0,8));else c.error(new Error('network interrupted'))}}))}
    const offset=Number(options?.headers?.Range?.match(/bytes=(\d+)-/)?.[1]||0)
    return new Response(bytes.subarray(offset),{status:offset?206:200,headers:offset?{'content-range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`}:{}})
  }
  const dir=join(root,'profile','software-updates'),account=join(root,'profile','account.json');await mkdir(join(root,'profile'));await writeFile(account,'private account preserved')
  const u=new Updater({version:'0.1.9',dir,fetch,install:async()=>{installed++}})
  await u.apply();assert.equal(installed,0)
  await u.check();assert.equal(u.status().state,'available');assert.equal(requests.length,1,'checking must not download')
  await u.download();assert.equal(u.status().state,'error');assert.equal((await stat(join(dir,manifest.assets.windows.name+'.part'))).size,8)
  await u.download();assert.equal(u.status().state,'ready');assert.equal(requests.at(-1).range,'bytes=8-');assert.equal(installed,0)
  const restored=new Updater({version:'0.1.9',dir,fetch:async()=>{throw new Error('offline')},install:async()=>{installed++}})
  await restored.restore();assert.equal(restored.status().state,'ready');await restored.check();assert.equal(restored.status().state,'ready','cached update is available offline')
  await writeFile(join(dir,manifest.assets.windows.name),'tampered')
  await restored.apply();assert.equal(installed,0);assert.equal(restored.status().state,'error')
  await u.download();assert.equal(u.status().state,'ready');await u.apply();assert.equal(installed,1)
  assert.equal(await readFile(account,'utf8'),'private account preserved')
  const current=new Updater({version:'0.1.11',dir,fetch,install:async()=>{installed++}})
  await current.restore();await current.check();assert.equal(current.status().state,'current');await current.download();assert.equal(installed,1)
  assert.equal(softwareView(current.status()).download,false,'older release never offers download')
  const bad={...manifest,assets:{...manifest.assets,windows:{...manifest.assets.windows,sha256:'0'.repeat(64)}}}
  const corrupt=new Updater({version:'0.1.9',dir:join(root,'bad'),fetch:async url=>new Response(url===policy.FEED?JSON.stringify(bad):bytes),install:async()=>{installed++}})
  await corrupt.check();await corrupt.download();assert.equal(corrupt.status().state,'error');assert.match(corrupt.status().error,/校验失败/);await assert.rejects(stat(join(root,'bad',manifest.assets.windows.name+'.part')))
  const failed=new Updater({version:'0.1.9',dir:join(root,'failed'),fetch:async url=>new Response(url===policy.FEED?JSON.stringify(manifest):bytes),install:async()=>{throw new Error('installer failed')}})
  await failed.check();await failed.download();await failed.apply();assert.equal(failed.status().state,'error');assert.match(failed.status().error,/installer failed/)
  const held=new Updater({version:'0.1.9',dir:join(root,'held'),fetch:async url=>{
    if(url===policy.FEED)return new Response(JSON.stringify(manifest))
    return new Response(new ReadableStream({start(c){c.enqueue(bytes.subarray(0,5))},cancel(){}}))
  },install:async()=>{}})
  await held.check()
  // Pausing cancels the request; production fetch aborts its response stream too.
  const abortFetch=held.fetch;held.fetch=async(url,opts)=>{const response=await abortFetch(url,opts);if(url!==policy.FEED){const original=response.body.getReader();return new Response(new ReadableStream({async pull(c){try{const read=await Promise.race([original.read(),new Promise((_,reject)=>opts.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}))]);if(read.done)c.close();else c.enqueue(read.value)}catch(e){c.error(e)}}}))}return response}
  const pending=held.download();await new Promise(r=>setTimeout(r,20));held.pause();await pending;assert.equal(held.status().state,'paused')
  for(const state of ['available','downloading','verifying','ready','paused','permission','error']) {
    const s=softwareView({state,currentVersion:'0.1.9',latestVersion:'0.1.10'},true)
    assert.equal(s.install,['ready','permission'].includes(state));assert.equal(s.pause,state==='downloading')
  }
  console.log('Software updater: release policy, no downgrade, interrupted resume, offline ready cache, integrity rejection, installer errors, pause and account preservation passed')
} finally {await rm(root,{recursive:true,force:true})}
