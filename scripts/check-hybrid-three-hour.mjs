import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {buildReport} from './report-hybrid-three-hour.mjs'
const cases=[]
for(const [id,limit] of [['conditional',10000],['dense-zero',1]]){
 const output=`test-output/hybrid-harness/${id}/case.json`
 execFileSync(process.execPath,['scripts/run-hybrid-three-hour.mjs',id,'off'],{
  env:{...process.env,FGO_HYBRID_LIMIT_MS:String(limit),FGO_HYBRID_ROUNDS:'1',FGO_HYBRID_OUTPUT:output},stdio:'pipe',timeout:45000})
 const result=JSON.parse(readFileSync(output,'utf8'));assert.equal(result.finished,true);assert.deepEqual(result.errors,[])
 assert.equal(new Set(result.samples.map(s=>s.cpuCore)).size,2)
 for(const row of result.samples){assert.equal(row.affinityVerified,true);assert.equal(row.status,id==='conditional'?'complete':'timeout');assert.equal(row.maximumProven,id==='conditional')}
 cases.push(result)
}
const ids=['conditional','dense-zero'],models=['off'],report=buildReport(cases,ids,models)
assert.deepEqual(report.errors,[]);assert.equal(report.complete,2);assert.equal(report.timeout,2)
assert.ok(buildReport([cases[0]],ids,models).errors.some(e=>e.includes('Missing pair')))
const broken=structuredClone(cases);broken[0].samples[0].best++
assert.ok(buildReport(broken,ids,models).errors.length)
const missing=structuredClone(cases);missing[0].samples.pop()
assert.ok(buildReport(missing,ids,models).errors.length)
console.log(JSON.stringify({passed:true,checks:'Completed equality; explicit incomplete timeout; missing pairs, missing repeats and contradictory scores rejected; two pinned cores; adaptive heap'}))
