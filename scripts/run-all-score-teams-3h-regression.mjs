import {spawn,execFileSync} from 'node:child_process'
import {mkdirSync,createWriteStream,existsSync,cpSync} from 'node:fs'
import {resolve} from 'node:path'
import {writeJson} from './all-score-teams-3h-lib.mjs'
const root=resolve('test-output/all-score-3h/regression');mkdirSync(root,{recursive:true})
const commands=[
 ['full-npm','npm',['test']],
 ['native-version','python3',['scripts/test-native-version.py']],
 ['release-parsers','python3',['scripts/verify-native-release.test.py']],
 ['native-upgrade','node',['native/desktop/update-tests.mjs']],
 ['schema','npm',['run','validate-data']],
 ['indexes','node',['scripts/validate-curve-index.mjs']],
 ['independent-oracle','node',['scripts/check-all-score-teams-random.mjs']],
 ['pressure-reporter','node',['scripts/check-all-score-teams-pressure-report.mjs']],
 ['seven-round-benchmark','node',['scripts/benchmark-all-score-teams.mjs']],
 ...['check-workspace-ui','check-team-comparison-ui','check-ai-update-ui','check-task-ui','check-formation-ui','check-query-preview','check-recommend-cache','check-all-score-teams-browser'].map(id=>[id,'node',['scripts/'+id+'.mjs']]),
]
const report={schema:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),status:'running',commands:[]}
for(const [id,command,args] of commands){
 const began=performance.now(),output=createWriteStream(root+'/'+id+'.log')
 const result=await new Promise(resolveResult=>{
  const child=spawn(command,args,{env:{...process.env,FGO_SCORE_ROUNDS:'7',FGO_SCORE_OUTPUT:root+'/benchmark.json',FGO_SCORE_RANDOM_OUTPUT:root+'/random.json'},stdio:['ignore','pipe','pipe']})
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});let done=false
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolveResult(value)}
  const timer=setTimeout(()=>{child.kill('SIGKILL');finish({status:'timeout',error:'Regression command exceeded 15 minutes'})},900000)
  child.on('error',error=>finish({status:'error',error:String(error)}))
  child.on('exit',(code,signal)=>finish({status:code===0?'passed':'failed',code,signal}))
 })
 output.end();report.commands.push({id,command,args,ms:performance.now()-began,...result});writeJson(root+'/summary.json',report);console.log(JSON.stringify(report.commands.at(-1)))
}
for(const [source,name] of [['ui-checks','legacy-ui'],['test-output/all-score-teams','all-score-browser']])if(existsSync(source))cpSync(source,root+'/'+name,{recursive:true})
report.status=report.commands.every(r=>r.status==='passed')?'passed':'failed';report.endedAt=new Date().toISOString();writeJson(root+'/summary.json',report)
if(report.status!=='passed')process.exitCode=1
