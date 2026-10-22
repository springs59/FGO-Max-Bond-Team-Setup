import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {buildReport} from './report-all-score-teams-3h.mjs'
const cases=[]
for(const [id,limit] of [['conditional',10000],['dense-zero',1]]){
 const output='test-output/3h-harness/'+id+'/case.json'
 execFileSync(process.execPath,['scripts/run-all-score-teams-3h-case.mjs',id],{env:{...process.env,FGO_SCORE_SHORT_MS:String(limit),FGO_SCORE_LONG_MS:String(limit),FGO_SCORE_3H_OUTPUT:output},stdio:'pipe',timeout:30000})
 const value=JSON.parse(readFileSync(output,'utf8'));assert.equal(value.finished,true);assert.deepEqual(value.errors,[])
 assert.equal(new Set(Object.values(value.cpuMapping)).size,4)
 for(const stage of ['short','long'])for(const row of Object.values(value.stages[stage].models)){assert.equal(row.affinityVerified,true);assert.equal(row.status,id==='conditional'?'complete':'timeout');assert.equal(row.complete,id==='conditional')}
 cases.push(value)
}
const options={ids:['conditional','dense-zero']},valid=buildReport(cases,{status:'passed'},options)
assert.deepEqual(valid.report.errors,[]);assert.equal(valid.report.long.complete,4);assert.equal(valid.report.long.timeout,4)
const missing=buildReport([cases[0]],{status:'passed'},options);assert.ok(missing.report.errors.some(e=>e.includes('缺少条件')))
const contradictory=structuredClone(cases);contradictory[0].stages.long.models.off.best++
assert.ok(buildReport(contradictory,{status:'passed'},options).report.errors.length)
console.log(JSON.stringify({passed:true,coverage:'four pinned cores; independent short/long processes; completed results match; timeouts remain incomplete; missing cases and contradictory scores fail aggregation'}))
