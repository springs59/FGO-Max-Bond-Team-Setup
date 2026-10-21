import {fork} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {gunzipSync,brotliDecompressSync} from 'node:zlib'
import os from 'node:os'
import {makeScenario} from '../scenario-ai/cases/index.mjs'
import {serializable} from '../scenario-ai/cases/common.mjs'

const work=resolve(process.argv[2]),archive=resolve(process.argv[3]||'.'),replay=process.env.FGO_INFERENCE_CASES
const only=process.env.FGO_INFERENCE_STAGE
const configs={off:{root:'query',aiMode:'off',queryModel:'baseline'},
 H_query:{root:'query',queryModel:'baseline'},H_domain:{root:'domain',queryModel:'baseline'},
 T_query:{root:'query',queryModel:'teacher'},T_domain:{root:'domain',queryModel:'teacher'},
 N_query:{root:'query',queryModel:'neural-large'},N_domain:{root:'domain',queryModel:'neural-large'},
 F_raw:{root:'framework-raw',queryModel:'baseline'},F_memo:{root:'framework-memo',queryModel:'baseline'}}
const scenarios=['general','tight-cost','coverage','event','six-own','pinned','inventory','scale']
const old=replay?[]:JSON.parse(readFileSync(archive+'/original-cases.json','utf8'))
const pick=id=>{const c=structuredClone(old.find(c=>c.id===id));if(!c)throw Error(id);return c}
const generated=(scenario,seed,split)=>{const c=makeScenario(scenario,seed,split);const opts=serializable(c.opts);opts.allSupportAlternatives=seed%2===0;return{id:c.id,kind:'core',tier:'normal',scenario,opts}}
let cases=[]
if(replay){const raw=readFileSync(replay);cases=JSON.parse(replay.endsWith('.gz')?gunzipSync(raw):replay.endsWith('.br')?brotliDecompressSync(raw):raw.toString('utf8'))}
else{
for(let i=0;i<8;i++)cases.push({...generated(scenarios[i],121000000+i*1000000,'validation'),stage:'calibration'})
for(const id of ['request-CN-30-false','request-CN-240-false','scale-CN-120','scale-JP-Infinity','historical-25','special-1','special-4','special-10'])cases.push({...pick(id),stage:'calibration'})
for(let i=0;i<8;i++)for(const [j,split]of ['sealed','ood'].entries())cases.push({...generated(scenarios[i],131000000+i*1000000+j,split),stage:'holdout'})
for(const id of ['request-JP-Infinity-false','limited-mlb-pins','capacity-empty','unreachable-high','special-0','special-2','special-3','special-6','special-7','special-9','special-11','infeasible'])cases.push({...pick(id),stage:'holdout'})
// Explicit multi-support and general-search cases exercise changing domains.
for(let i=0;i<6;i++){
 const c=pick('special-11');c.id='new-multiple-support-'+i;c.stage=i<4?'holdout':'calibration';c.opts.useInventoryCurveSolver=i%2===0
 if(i>=4){c.opts.base=1593;c.opts.costLimit=26}
 c.opts.quest={supportPolicy:i%2?'system':'either',supportServants:[0,1,2].map((_,j)=>({id:99000+j,svtId:99000+j,name:'NPC'+j,traitIds:[100+j],equips:[]}))}
 cases.push(c)
}
// A support's fixed CE changes the model input, unlike identical empty NPC
// loadouts which correctly reuse one cached domain. Kept as a separate,
// explicitly supplemental diagnostic cohort, not the original holdout.
for(let i=0;i<8;i++){
 const c=pick('special-11');c.id='changed-support-equipment-'+i;c.stage=i<4?'domain-calibration':'domain-holdout'
 c.opts.base=(i<4?[815,1593,2400,10000]:[1000,1877,3001,12000])[i%4];c.opts.costLimit=i<4?(i%2?26:72):(i%2?37:80);c.opts.useInventoryCurveSolver=i%2===0
 c.opts.quest={supportPolicy:i%2?'system':'either',supportServants:[0,1,2].map(j=>{
  const ce={id:980000+j,name:'Diagnostic fixed CE '+j,cost:0,skills:[{condLimitCount:0,funcs:[{target:'ptFull',rate:(i<4?[0,100,500]:[0,150,750])[j],add:0,eventId:0,tvals:[],andTvals:[]}]}]}
  return{id:99000+j,svtId:99000+j,name:'NPC'+j,traitIds:[100+j],equips:[{ce,ceId:ce.id,ceMlb:true}]}
 })}
 cases.push(c)
}
for(const c of old.filter(c=>c.tier==='stress'))cases.push({...c,stage:'stress'})
}
for(const c of cases){c.sha256=createHash('sha256').update(JSON.stringify(c.opts)).digest('hex')}
mkdirSync(work+'/results',{recursive:true})
writeFileSync(work+'/cases.json',JSON.stringify(cases)+'\n')
const selected=cases.filter(c=>!only||c.stage===only)
const out=work+'/results/'+(only||'all')+'.json'
const report={schema:1,status:'running',startedAt:new Date().toISOString(),configs,
 manifest:JSON.parse(readFileSync(work+'/runtime-manifest.json','utf8')),
 method:{cache:false,sequential:true,rotatingOrder:true,warmups:2,rounds:5,stressRounds:1,
 ordinaryDeadlineMs:60000,stressDeadlineMs:15000,selectionUses:'calibration only; holdout and stress are confirmation, never used for selection',
 timing:'solverMs excludes import, IPC and independent validation; requestMs includes IPC/result copying, excludes independent validation',
 memory:'per-case child maxRSS includes imports, input and all rounds; stopped peaks unknown'},
 environment:{node:process.version,cpu:os.cpus()[0].model,platform:process.platform,arch:process.arch,cores:os.availableParallelism(),memoryMax:readFileSync('/sys/fs/cgroup/memory.max','utf8').trim(),cpuMax:readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim()},
 cases:selected.map(({opts,...c})=>c),records:[]}
const persist=()=>writeFileSync(out,JSON.stringify(report)+'\n')
persist()
let serial=0
async function start(key,c){
 const config=configs[key],p=fork(new URL('./child.mjs',import.meta.url),[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced'})
 const h={p,dead:false,stderr:''};p.stderr.on('data',x=>h.stderr=(h.stderr+x).slice(-2000))
 h.ready=await new Promise((yes,no)=>{
  const timer=setTimeout(()=>{h.dead=true;p.kill('SIGKILL');no(Error('init timeout'))},30000)
  p.once('message',m=>{clearTimeout(timer);m.type==='ready'?yes(m):no(Error(JSON.stringify(m)))})
  p.once('exit',()=>{h.dead=true;clearTimeout(timer);no(Error('init process exit '+h.stderr))})
  p.send({type:'init',root:work+'/variants/'+config.root,kind:c.kind,queryModel:config.queryModel})
 });return h
}
async function run(h,key,c,round){
 if(h.dead)return{key,round,status:'not-run-after-stop'}
 const id=++serial,began=performance.now()
 return new Promise(yes=>{
  let done=false
  const finish=m=>{if(done)return;done=true;clearTimeout(timer);h.p.off('message',receive);h.p.off('exit',exit);const{wireResult,...safe}=m;yes({key,round,...safe,roundTripMs:performance.now()-began})}
  const timer=setTimeout(()=>{h.dead=true;h.p.kill('SIGKILL');finish({status:'deadline',observedMs:performance.now()-began})},c.tier==='stress'?15000:60000)
  const receive=m=>{if(m.id===id)finish(m)}
  const exit=(code,signal)=>{h.dead=true;finish({status:'process-exit',code,signal,stderr:h.stderr})}
  h.p.on('message',receive);h.p.once('exit',exit)
  h.p.send({id,opts:c.opts,aiMode:configs[key].aiMode||'on'})
 })
}
const heartbeat=setInterval(persist,5000)
try{
 for(const [index,c]of selected.entries()){
  const row={id:c.id,stage:c.stage,kind:c.kind,tier:c.tier,sha256:c.sha256,startup:{},warmups:[],runs:[]}
  report.active=row;persist();const hosts={}
  try{
   for(const key of Object.keys(configs)){try{hosts[key]=await start(key,c);row.startup[key]=hosts[key].ready}catch(e){row.startup[key]={error:String(e)}}}
   for(let round=c.tier==='stress'?0:-2;round<(c.tier==='stress'?1:5);round++){
    const keys=Object.keys(configs),offset=(index+round+keys.length)%keys.length
    keys.push(...keys.splice(0,offset))
    for(const key of keys){report.active.latest={key,round};persist();const r=hosts[key]?await run(hosts[key],key,c,round):{key,round,status:'init-error'};(round<0?row.warmups:row.runs).push(r);persist()}
   }
  }finally{for(const h of Object.values(hosts))h.p.kill('SIGKILL')}
  delete row.latest
  const ok=row.runs.filter(r=>r.status==='ok')
  row.complete=ok.length===Object.keys(configs).length*(c.tier==='stress'?1:5)
  row.objectivesAgree=new Set(ok.map(r=>JSON.stringify(r.facts))).size<=1
  row.alternativesAgree=new Set(ok.filter(r=>r.alternatives).map(r=>JSON.stringify(Object.entries(r.alternatives).sort(([a],[b])=>a.localeCompare(b))))).size<=1
  row.nativeCallsValid=ok.every(r=>r.key==='off'?r.inferenceCalls===0:!r.key.endsWith('_query')||r.inferenceCalls<=1)
  row.noCacheHits=ok.every(r=>!r.cacheHit)
  report.records.push(row);delete report.active;persist()
  console.log(JSON.stringify({finished:report.records.length,total:selected.length,id:c.id,complete:row.complete,agree:row.objectivesAgree,alternatives:row.alternativesAgree,calls:row.nativeCallsValid,errors:row.runs.filter(r=>r.status==='error').map(r=>({key:r.key,error:r.error}))}))
  if(!row.objectivesAgree||!row.alternativesAgree||!row.nativeCallsValid||!row.noCacheHits||row.runs.some(r=>r.status==='error'))throw Error('correctness gate '+c.id)
 }
 report.status='complete';report.endedAt=new Date().toISOString()
}finally{clearInterval(heartbeat);persist()}
