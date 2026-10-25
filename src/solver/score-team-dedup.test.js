import assert from 'node:assert/strict'
import {createScoreDedup} from './score-team-dedup.js'
function directory(){
 const files=new Map();let peakRead=0
 return {get peakRead(){return peakRead},files,async getFileHandle(name){if(!files.has(name))files.set(name,new Uint8Array());return {async createSyncAccessHandle(){let closed=false;return {
  read(bytes,{at}){assert.ok(!closed);peakRead=Math.max(peakRead,bytes.length);const n=Math.min(bytes.length,files.get(name).length-at);if(n<=0)return 0;bytes.set(files.get(name).subarray(at,at+n));return n},
  write(bytes,{at}){assert.ok(!closed);const n=Math.min(bytes.length,71),old=files.get(name),next=new Uint8Array(Math.max(old.length,at+n));next.set(old);next.set(bytes.subarray(0,n),at);files.set(name,next);return n},
  truncate(size){assert.ok(!closed);const old=files.get(name),next=new Uint8Array(size);next.set(old.subarray(0,size));files.set(name,next)},close(){closed=true}}}}}}
}
for(const root of [null,directory()]){
 const index=await createScoreDedup(root,{yieldTask:async()=>{}})
 for(let i=0;i<8000;i++)assert.equal(await index.add(JSON.stringify(['组合',i,i%97])),true)
 for(let i=7999;i>=0;i--)assert.equal(await index.add(JSON.stringify(['组合',i,i%97])),false)
 if(root)assert.ok(root.peakRead<=4096,'Rehash and equality checks do not load the whole index')
 index.close()
}
{
 const root=directory(),index=await createScoreDedup(root,{hashBytes:()=>17,yieldTask:async()=>{}})
 for(let i=0;i<80;i++)assert.equal(await index.add('collision-'+i),true,'A hash collision cannot hide a distinct team')
 for(let i=0;i<80;i++)assert.equal(await index.add('collision-'+i),false)
 index.close()
}
console.log('Exact dedup: 8000 unique keys and repeats, bounded OPFS reads, short writes, growth and deliberate hash collisions passed')
