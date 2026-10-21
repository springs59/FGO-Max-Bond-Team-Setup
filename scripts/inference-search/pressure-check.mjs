import {fork} from 'node:child_process'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import {validatePlan} from '../version-report-validate.mjs'
import {CONFIGS} from './configs.mjs'
const work=process.argv[2],cases=JSON.parse(readFileSync(work+'/cases.json'))
let checks=0,checkpoints=0
for(const key of ['off','H_hybrid','T_branch','N_stalled','F_stalled'])for(const kind of ['core','worker']){
 const c=cases.find(x=>x.kind===kind&&x.stage==='screen'),config=CONFIGS[key]
 const p=fork(new URL('./child.mjs',import.meta.url),[],{stdio:['ignore','ignore','inherit','ipc'],serialization:'advanced'})
 const telemetry=[]
 try{
  await new Promise((resolve,reject)=>{p.once('message',m=>m.type==='ready'?resolve():reject(Error(JSON.stringify(m))));p.send({type:'init',root:work+'/pressure/'+config.root,kind,config,pressure:true})})
  const result=await new Promise((resolve,reject)=>{p.on('message',m=>m.type==='telemetry'?telemetry.push(m):resolve(m));p.once('exit',()=>reject(Error('child exited')));p.send({id:1,opts:c.opts,aiMode:config.aiMode||'on'})})
  assert.equal(result.status,'ok',JSON.stringify(result));assert.equal(result.valid,true)
  if(kind==='worker'&&key!=='off')assert.ok(telemetry.some(m=>m.inferenceCalls>0),'Worker pressure must observe real session inference counts')
  for(const m of telemetry)if(m.checkpoint){validatePlan(c.opts,m.checkpoint,kind==='core');checkpoints++}
  checks++
 }finally{p.kill('SIGKILL')}
}
assert.ok(checkpoints>0)
console.log(JSON.stringify({passed:true,checks,checkpoints}))
