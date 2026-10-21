import assert from 'node:assert/strict'
import {createScoreTeamStore} from './score-team-store.js'
function directory(){
 const files=new Map()
 return {files,async getFileHandle(name,{create=false}={}){
  if(!files.has(name)){if(!create)throw Error('missing page');files.set(name,new Uint8Array())}
  return {async createSyncAccessHandle(){return {
   write(data,{at}){const old=files.get(name),next=new Uint8Array(Math.max(old.length,at+data.length));next.set(old);next.set(data,at);files.set(name,next);return data.length},
   truncate(n){files.set(name,files.get(name).slice(0,n))},flush(){},close(){}}},
   async getFile(){return {text:async()=>new TextDecoder().decode(files.get(name))}}}
 },async *entries(){for(const name of files.keys())yield [name,{kind:'file'}]},async removeEntry(name){files.delete(name)}}
}
for(const disk of [false,true]){
 const dir=disk?directory():null,store=await createScoreTeamStore({directory:dir,pageSize:7})
 for(let i=0;i<1030;i++)await store.append({score:i%3,packed:{id:i}})
 assert.equal(store.stats(2).bestCount,343);assert.equal(store.stats(2).otherCount,687)
 assert.ok(store.stats(2).peakBufferedRecords<=21,'Disk buffer scales with score buckets, not result count')
 const high=[];for(let offset=0;offset<343;offset+=13)high.push(...(await store.page({bestScore:2,offset,limit:13})).records)
 assert.deepEqual(high.map(r=>r.packed.id),Array.from({length:1030},(_,i)=>i).filter(i=>i%3===2))
 // A newly higher score reclassifies the old best as incidental without loss.
 await store.append({score:4,packed:{id:2000}});await store.seal()
 assert.equal(store.stats(4).otherCount,1030)
 const others=[];for(let offset=0;offset<1030;offset+=17)others.push(...(await store.page({bestScore:4,kind:'other',offset,limit:17})).records)
 assert.equal(new Set(others.map(r=>r.packed.id)).size,1030)
 assert.equal((await store.page({bestScore:4})).records[0].packed.id,2000)
 await assert.rejects(store.append({score:4}),/关闭/)
 await assert.rejects(store.page({bestScore:4,offset:-1}),/无效/)
 await store.dispose();if(disk)assert.equal(dir.files.size,0)
}
console.log('Score-team store: 1031 complete records across pages, disk/memory parity, reclassification, bounded disk buffers and teardown passed')
{
 const store=await createScoreTeamStore({directory:directory(),pageSize:7})
 for(let pass=0;pass<3;pass++)for(let score=0;score<500;score++)await store.append({score,packed:{pass,score}})
 await store.seal();assert.ok(store.stats(499).peakBufferedRecords<=35,'Many distinct scores must not create unbounded partial-page buffers')
 for(let score=0;score<500;score++)assert.deepEqual((await store.page({bestScore:score})).records.map(r=>r.packed.pass),[0,1,2],'Evicting/reopening a partial disk page loses no records')
 await store.dispose()
}
console.log('Score-team store: 1500 records in 500 score buckets survive partial-page eviction/reopening')
{
 const store=await createScoreTeamStore({pageSize:7})
 for(let i=0;i<23;i++)await store.append({score:i%2,packed:{id:i}})
 await store.seal()
 const file=await store.exportFile({bestScore:1,header:{complete:true}}),rows=(await file.text()).trim().split('\n').map(JSON.parse)
 assert.equal(rows.length,24);assert.equal(rows[0].complete,true);assert.equal(rows[0].bestCount,11)
 assert.equal(new Set(rows.slice(1).map(r=>r.packed.id)).size,23,'Export includes every obtained team, not one page')
}
console.log('Score-team export: complete JSONL includes all best and incidental pages')
