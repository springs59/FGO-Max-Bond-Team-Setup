import {fork} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {dirname} from 'node:path'
import {createHash} from 'node:crypto'
import os from 'node:os'
import {WIDE_CASE_IDS,wideFixture} from './all-score-teams-wide-fixtures.mjs'
const ids=process.env.FGO_SCORE_WIDE_IDS?.split(',')||WIDE_CASE_IDS,models=['off','baseline','teacher','neural-large']
const output=process.env.FGO_SCORE_WIDE_OUTPUT||'test-output/all-score-wide/matrix.json',normalMs=Number(process.env.FGO_SCORE_NORMAL_MS||15000),stressMs=Number(process.env.FGO_SCORE_STRESS_MS||45000)
const report={schema:1,status:'running',startedAt:new Date().toISOString(),environment:{node:process.version,cpu:os.cpus()[0].model,parallelism:os.availableParallelism()},normalMs,stressMs,
 method:'Fresh child process per cell; sequential rotating AI order; result cache disabled; engine timing includes exact settlement samples and streaming same-order SHA256 of current-best equivalence families (catalog substitutions and constraints retained; not a count of expanded physical teams). No result archive or UI I/O in this engine matrix. Timeouts are incomplete, never passes or proof. Memory includes catalog loading. One run per cell, not statistical model speed ranking.',
 sourceSha256:createHash('sha256').update(readFileSync(new URL('../src/recommend.js',import.meta.url))).digest('hex'),records:[]}
mkdirSync(dirname(output),{recursive:true});const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n')
async function run(id,model,timeout){return new Promise(resolve=>{
 const child=fork(new URL('./all-score-teams-wide-child.mjs',import.meta.url),[id,model,String(timeout)],{execArgv:['--max-old-space-size=768'],stdio:['ignore','ignore','pipe','ipc']})
 let last=null,stderr='',done=false
 const finish=r=>{if(done)return;done=true;clearTimeout(timer);resolve(r)}
 const timer=setTimeout(()=>{child.kill('SIGKILL');finish({...last,id,model,status:'hard-timeout',complete:false,maximumProven:false,error:'Parent deadline while preparation/iteration did not yield'})},timeout+15000)
 child.stderr.on('data',d=>{stderr=(stderr+d.toString()).slice(-3000)})
 child.on('message',m=>{last=m.value;if(m.type==='progress'){report.active=last;save()}else if(m.type==='result')finish(last)})
 child.on('error',e=>finish({id,model,status:'error',error:String(e),complete:false,maximumProven:false}))
 child.on('exit',(code,signal)=>{if(!done)finish({...last,id,model,status:'process-failure',code,signal,error:stderr,complete:false,maximumProven:false})})
 })}
save()
for(let index=0;index<ids.length;index++){
 const id=ids[index],fixture=wideFixture(id),order=models.slice(index%4).concat(models.slice(0,index%4))
 for(const model of order){report.active={id,model,status:'starting'};save();const row=await run(id,model,fixture.stress?stressMs:normalMs);report.records.push(row);delete report.active;save();console.log(JSON.stringify({id,model,status:row.status,ms:Math.round(row.ms||0),best:row.best,tiedTeams:row.tiedTeams,maxRssMiB:Math.round(row.maxRssMiB||0)}))}
 const rows=report.records.filter(r=>r.id===id),finished=rows.filter(r=>r.status==='complete')
 if(finished.length===4&&new Set(finished.map(r=>JSON.stringify([r.best,r.tiedTeams,r.tiedTeamsSha256]))).size!==1){report.status='failed';report.error='Completed model results disagree: '+id;save();throw Error(report.error)}
}
report.status=report.records.some(r=>['error','process-failure','hard-timeout'].includes(r.status))?'failed':'complete-with-timeout-classification';report.endedAt=new Date().toISOString();save()
console.log(JSON.stringify({status:report.status,cells:report.records.length,complete:report.records.filter(r=>r.status==='complete').length,timeouts:report.records.filter(r=>r.status==='timeout').length,output}))
if(report.status==='failed')process.exitCode=1

