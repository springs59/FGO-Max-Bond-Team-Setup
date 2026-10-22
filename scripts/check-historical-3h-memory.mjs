import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {memoryBudget,classifyExit,processPeakRssMiB,peakRssFromStatus} from './historical-3h-memory.mjs'
import {RECOVERY_COHORTS} from './historical-3h-versions.mjs'
import {mergeRecovery} from './historical-3h-merge-recovery.mjs'
const a=memoryBudget({processes:2,profile:'paired-auto',totalMiB:16384})
assert.equal(a.heapMiB,6144);assert.ok(a.heapMiB*2+a.reserveMiB<16384)
const b=memoryBudget({processes:2,profile:'paired-auto',totalMiB:16384,cgroupMiB:8192})
assert.equal(b.heapMiB,2560);assert.ok(b.heapMiB*2+b.reserveMiB<8192)
assert.throws(()=>memoryBudget({processes:4,profile:'paired-auto',totalMiB:16384}),/at most two/)
assert.throws(()=>memoryBudget({processes:2,profile:'paired-auto',totalMiB:4096}),/Insufficient/)
assert.equal(classifyExit('FATAL ERROR: JavaScript heap out of memory'),'memory-limit');assert.equal(classifyExit(''),'process-error')
assert.equal(peakRssFromStatus('Name:\tnode\nVmHWM:\t 65536 kB\n'),64);assert.equal(peakRssFromStatus('Name:\n'),0);assert.ok(processPeakRssMiB(process.pid)>=0)
assert.equal(Object.keys(RECOVERY_COHORTS).length,8);for(const pair of Object.values(RECOVERY_COHORTS)){assert.equal(pair.length,2);assert.ok(pair.includes('current-off'))}
if(process.env.FGO_ORIGINAL_REPORT){
 const original=JSON.parse(readFileSync(process.env.FGO_ORIGINAL_REPORT)),all=original.records.filter(r=>r.cohort==='models'||!r.version.startsWith('current-'))
 // Deliberately missing recovery data must never turn the original failure green.
 const missing=mergeRecovery(original,{errors:[],records:[]});assert.equal(missing.status,'failed');assert.ok(missing.errors.some(e=>e.includes('Missing')))
 assert.equal(all.length,135)
 // Explicit synthetic timeout rows exercise report assembly, not performance.
 // They are never saved as query results or used in the public report.
 const synthetic=all.filter(r=>['CN-open','JP-open'].includes(r.id)).map(r=>({...r,status:'timeout',validated:false,maximumClaimed:false,memory:{profile:'paired-auto',heapMiB:6144}}))
 const merged=mergeRecovery(original,{errors:[],records:synthetic});assert.deepEqual(merged.errors,[]);assert.equal(merged.records.length,135);assert.equal(merged.preservedQueries,117);assert.equal(merged.recoveredQueries,18)
 const changed=structuredClone(synthetic);changed[0].inputSha256='changed';assert.ok(mergeRecovery(original,{errors:[],records:changed}).errors.some(e=>e.includes('input changed')))
}
console.log(JSON.stringify({passed:true,tests:'16GiB and cgroup-limited memory budgets; four-process rejection; low-memory rejection; proven V8 OOM classification; two-process paired cohorts; missing recovery data stays failed',default16GiBHeapMiB:a.heapMiB}))
