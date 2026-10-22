import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {COHORTS} from './historical-3h-versions.mjs'
import {buildHistoricalReport} from './report-historical-3h.mjs'
import {validatePlan} from './historical-3h-validate.mjs'
import {wideFixture} from './all-score-teams-wide-fixtures.mjs'
import {recommendTeam} from '../src/recommend.js'
const cells=[]
for(const cohort of Object.keys(COHORTS)){
 const output='test-output/historical-3h-harness/conditional-'+cohort+'/cell.json'
 execFileSync(process.execPath,['scripts/run-historical-3h-case.mjs','conditional',cohort],{env:{...process.env,FGO_HISTORY_LIMIT_MS:'10000',FGO_HISTORY_OUTPUT:output},stdio:'pipe',timeout:30000})
 const c=JSON.parse(readFileSync(output));assert.deepEqual(c.errors,[]);assert.equal(c.finished,true)
 for(const r of Object.values(c.models)){assert.equal(r.status,'complete');assert.equal(r.score,4318);assert.equal(r.validated,true);assert.equal(r.affinityVerified,true);assert.equal(r.allScoreTeamsComplete,false)}cells.push(c)
}
const options={ids:['conditional'],allowSmoke:true,limitMs:10000},built=buildHistoricalReport(cells,[],options)
assert.deepEqual(built.report.errors,[]);assert.equal(built.report.distinctQueries,9);assert.equal(built.report.physicalQueries,12)
assert.ok(buildHistoricalReport(cells.slice(1),[],options).report.errors.some(e=>e.includes('Missing')))
const wrong=structuredClone(cells);wrong[0].models.v200.score++;assert.ok(buildHistoricalReport(wrong,[],options).report.errors.length)
const reference={id:'conditional',inputSha256:cells[0].inputSha256,stages:{long:{models:{off:{status:'complete',complete:true,maximumProven:true,best:4319}}}}};const lower=buildHistoricalReport(cells,[reference],options);assert.ok(lower.report.optimalityFindings.length);assert.equal(lower.report.status,'complete-with-correctness-differences');assert.ok(lower.report.records.every(r=>r.sameHostRatio==null))
const o=wideFixture('conditional').opts,p=recommendTeam({...o,aiMode:'off'});p.total++;assert.throws(()=>validatePlan(o,p),/settlement differs/)
const deadlineOutput='test-output/historical-3h-harness/deadline/cell.json'
execFileSync(process.execPath,['scripts/run-historical-3h-case.mjs','CN-open','historical'],{env:{...process.env,FGO_HISTORY_LIMIT_MS:'1',FGO_HISTORY_OUTPUT:deadlineOutput},stdio:'pipe',timeout:30000})
const deadline=JSON.parse(readFileSync(deadlineOutput));assert.deepEqual(deadline.errors,[]);for(const r of Object.values(deadline.models)){assert.equal(r.status,'timeout');assert.equal(r.maximumClaimed,false);assert.equal(r.allScoreTeamsComplete,false)}
console.log(JSON.stringify({passed:true,versions:9,cohorts:3,coverage:'unchanged legacy sources; exact settlement; CPU affinity; true parent deadline; missing-cell and score-mismatch detection; tied completeness remains false'}))
