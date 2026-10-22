import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {CONTENDERS,VERSIONS,pairMatrix,FULL} from './comprehensive-3h-config.mjs'
import {WIDE_CASE_IDS,wideFixture} from './comprehensive-3h-fixtures.mjs'
import {buildComparison} from './report-comprehensive-3h.mjs'
import {memoryBudget,classifyExit} from './historical-3h-memory.mjs'
import {validatePlan} from './comprehensive-3h-validate.mjs'
import {createScoreTeamSearch} from '../src/recommend.js'
assert.equal(Object.keys(VERSIONS).length,18);assert.equal(CONTENDERS.length,17);assert.equal(pairMatrix(WIDE_CASE_IDS).length,255)
assert.ok(memoryBudget({processes:2,profile:'paired-auto',totalMiB:16384}).heapMiB>=2048)
assert.equal(classifyExit('FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory'),'memory-limit')
const root='test-output/comprehensive-harness';mkdirSync(root,{recursive:true})
const limit=10000,cells=[]
function run(id,version,ms,name){
 const output=`${root}/${name||id+'-'+version}/cell.json`
 execFileSync(process.execPath,['scripts/run-comprehensive-3h-pair.mjs',id,version],{env:{...process.env,FGO_COMPARE_LIMIT_MS:String(ms),
  FGO_COMPARE_NO_REPEAT:'1',FGO_COMPARE_OUTPUT:output},stdio:'pipe',timeout:Math.max(ms+10000,30000)})
 return JSON.parse(readFileSync(output,'utf8'))
}
for(const contender of CONTENDERS){
 const c=run('conditional',contender,limit)
 assert.equal(c.finished,true);assert.deepEqual(c.errors,[],contender)
 for(const r of c.rounds[0].rows){assert.equal(r.status,'complete',contender);assert.equal(r.validated,true);assert.equal(r.score,4318);assert.equal(r.affinityVerified,true)
  assert.equal(r.allOptimalCovered,FULL(r.version));assert.equal(r.cpuCore===c.rounds[0].rows.find(x=>x.version!==r.version).cpuCore,false)}
 cells.push(c)
}
const options={ids:['conditional'],limitMs:limit,allowSmoke:process.env.FGO_COMPARE_SMOKE==='1',regression:{status:'passed'},browser:{passed:true,cases:[]}}
const good=buildComparison(cells,options);assert.deepEqual(good.report.errors,[]);assert.equal(good.report.records.length,17)
assert.ok(buildComparison(cells.slice(1),options).report.errors.some(e=>e.includes('Missing pair')))
const bad=structuredClone(cells);bad[0].rounds[0].rows.find(r=>r.version==='group-off').score++
assert.ok(buildComparison(bad,options).report.errors.length,'Contradictory full maxima cannot pass')
const fingerprint=structuredClone(cells),full=fingerprint.find(c=>c.contender==='literal-off')
full.rounds[0].rows.find(r=>r.version==='literal-off').physicalFingerprint='wrong'
assert.ok(buildComparison(fingerprint,options).report.errors.some(e=>e.includes('Recoverable full optimal set differs')))
const timeout=run('CN-open','literal-off',1,'deadline')
for(const r of timeout.rounds[0].rows){assert.equal(r.status,'timeout');assert.equal(r.maximumProvenInUnifiedDomain,false);assert.equal(r.allOptimalCovered,false)}
const q=createScoreTeamSearch({...wideFixture('prefer').opts,aiMode:'off'});let plan
for(const e of q.iterator)if(e.type==='team'){plan=q.hydrate(e.record);validatePlan(wideFixture('prefer').opts,plan);break}
plan.total++;assert.throws(()=>validatePlan(wideFixture('prefer').opts,plan),/settlement differs/)
// Fast all-domain interface probe. These are explicit partial results, never
// performance measurements or substitutes for the formal three-hour run.
const wide=[]
if(process.env.FGO_COMPARE_WIDE_SMOKE!=='0')for(const id of WIDE_CASE_IDS)if(id!=='conditional')for(const contender of CONTENDERS){
 const c=run(id,contender,100,'wide-'+id+'-'+contender)
 assert.equal(c.finished,true)
 for(const r of c.rounds[0].rows){
  assert.equal(r.affinityVerified,true)
  assert.ok(['complete','timeout','error'].includes(r.status),`${id}/${r.version} infrastructure: ${r.error}`)
  if(r.status==='timeout'){assert.equal(r.maximumProvenInUnifiedDomain,false);assert.equal(r.allOptimalCovered,false)}
  if(r.status==='error'&&FULL(r.version))throw Error(`Full interface probe failed: ${id}/${r.version}: ${r.error}`)
 }
 wide.push({id,contender,rows:c.rounds[0].rows.map(r=>({version:r.version,status:r.status,score:r.score??null,validated:r.validated,error:r.error}))})
}
const report={passed:true,variants:18,conditions:15,formalPairs:255,conditionalAdapters:17,
 wideProbes:wide.length,scope:'Adapter and controller tests only; 10-second conditional runs and 100ms interface probes are not pressure results.',
 checks:['exact score/stock/identity validation','two verified distinct CPU cores','adaptive paired memory','strict parent deadline','missing/contradictory/fingerprint mismatch detection','native versus full coverage labels'],wide}
writeFileSync(root+'/summary.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,wide:undefined}))
