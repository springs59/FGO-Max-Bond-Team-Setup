import assert from 'node:assert/strict'
import {mkdtempSync,openSync,writeSync,readSync,fstatSync,fsyncSync,ftruncateSync,closeSync,rmSync,appendFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createDiskJournal,consumeDiskJournal,JOURNAL_BUFFER_BYTES,JOURNAL_BATCH_RECORDS} from './query-candidate-journal.js'
const folder=mkdtempSync(join(tmpdir(),'fgo-disk-journal-'))
function disk(path){const fd=openSync(path,existsSync(path)?'r+':'w+');return {getSize:()=>fstatSync(fd).size,write:(b,{at})=>writeSync(fd,b,0,b.length,at),read:(b,{at})=>readSync(fd,b,0,b.length,at),flush:()=>fsyncSync(fd),truncate:n=>ftruncateSync(fd,n),close:()=>closeSync(fd)}}
try {
 const path=join(folder,'long.jsonl'),handle=disk(path);let clock=1000
 const journal=createDiskJournal(handle,{now:()=>clock}),N=100000
 for(let i=0;i<N;i++){
   clock+=100 // simulated job lasts almost three hours
   journal.capture({engine:'equipment-curve',index:i,curve:{terms:[{front:1200,second:1400,flat:50,eligible:true}]},text:'中😀'.repeat(12)})
   if(i%128===0)assert.ok(journal.stats().bufferedBytes<=JOURNAL_BUFFER_BYTES)
 }
 journal.seal();assert.ok(clock>2*60*60*1000)
 assert.equal(journal.stats().queuedWorkerMessages,0);assert.ok(journal.stats().peakBufferedBytes<=JOURNAL_BUFFER_BYTES)
 let expected=0,peakBatch=0,active=0,maximumActive=0
 const saved=await consumeDiskJournal(handle,async values=>{
   active++;maximumActive=Math.max(maximumActive,active);peakBatch=Math.max(peakBatch,values.length)
   // Real disk input + delayed transactions; the next batch must wait.
   await new Promise(r=>setTimeout(r,1))
   for(const value of values)assert.equal(value.index,expected++)
   active--;return {added:values.length}
 })
 assert.equal(saved.records,N);assert.equal(expected,N);assert.equal(maximumActive,1)
 assert.ok(peakBatch<=JOURNAL_BATCH_RECORDS);handle.close()
 // Interruption keeps complete prefixes; recovery never returns a fabricated
 // completion marker or accepts an unfinished final JSON record.
 appendFileSync(path,'{"engine":"equipment-curve","index":')
 const resumed=disk(path);let recovered=0
 const prefix=await consumeDiskJournal(resumed,async values=>{recovered+=values.length;return {added:0}})
 assert.equal(prefix.incompleteTail,true);assert.equal(recovered,N);resumed.close()
 const bad=join(folder,'failure.jsonl'),f=disk(bad)
 assert.throws(()=>createDiskJournal({...f,write(){throw Error('disk full')}}),/disk full/)
 f.close()
 // Disk-full mid-computation must not abort the solver or mark an incomplete
 // journal complete. A partial write is rolled back to its committed prefix.
 const quota=disk(join(folder,'quota.jsonl'));let writes=0
 const limited={...quota,write(bytes,options){writes++;if(writes===3)throw Error('disk full');return quota.write(bytes.subarray(0,Math.min(bytes.length,100)),options)}}
 // Write the header normally, then fail after a partial candidate batch.
 const journalQuota=createDiskJournal(limited)
 assert.doesNotThrow(()=>{for(let i=0;i<200;i++)journalQuota.capture({index:i,text:'x'.repeat(100)})})
 assert.match(journalQuota.error,/disk full/)
 journalQuota.seal();let quotaCount=0
 await consumeDiskJournal(quota,async values=>{quotaCount+=values.length;return {added:values.length}})
 assert.equal(quotaCount,0);quota.close()
} finally {rmSync(folder,{recursive:true,force:true})}
console.log('Disk candidate journal: 100,000 real disk records, >2-hour simulated job, fixed RAM budget, one slow transaction at a time and interrupted-prefix recovery passed')
