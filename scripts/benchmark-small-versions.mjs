import assert from 'node:assert/strict'
import {Worker} from 'node:worker_threads'
import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {smallVersionCases} from './small-version-cases.mjs'
const root=fileURLToPath(new URL('..',import.meta.url))
const output=resolve(root,'../small-version-results');mkdirSync(output,{recursive:true})
const versions={
 v200:{root:resolve(root,'../FGO-small-200'),label:'2.0.0',aiMode:'off'},
 interval:{root:resolve(root,'../FGO-small-interval'),label:'早期区间剪枝版',aiMode:'on'},
 main:{root:resolve(root,'../FGO-small-main'),label:'当前 main / 2.1.2',aiMode:'on'},
 rebuilt:{root,label:'重建框架实验版',aiMode:'on'},
}
const hashes=path=>Object.fromEntries(readdirSync(path+'/src',{recursive:true}).filter(x=>x.endsWith('.js')).sort().map(x=>
 [x,createHash('sha256').update(readFileSync(path+'/src/'+x)).digest('hex')]))
const cases=smallVersionCases(),runs=[],cold=[],diagnostics=[],expected=new Map(),pool=new Map()
const result={schema:1,date:'2026-10-19',environment:{node:process.version,platform:process.platform,arch:process.arch},
 rounds:3,warmups:1,versions:Object.fromEntries(Object.entries(versions).map(([k,v])=>[k,{...v,
  commit:execFileSync('git',['rev-parse','HEAD'],{cwd:v.root,encoding:'utf8'}).trim(),sourceHashes:hashes(v.root)}])),
 reconstructed:true,originalCommitUnavailable:'f91b26f',sixOptimizationCommitUnavailable:'2282983',
 cases,runs,cold,diagnostics}
async function start(version,kind){
 const start=performance.now(),w=new Worker(new URL('./small-version-worker.mjs',import.meta.url),{workerData:{root:versions[version].root,kind}})
 await new Promise((ok,no)=>{w.once('message',ok);w.once('error',no)})
 return {w,startupMs:performance.now()-start}
}
async function query(w,c,version,id,diagnostics=false){
 const start=performance.now()
 const r=await new Promise((ok,no)=>{const fail=e=>{w.off('message',receive);no(e)},receive=r=>{w.off('error',fail);ok(r)}
  w.once('message',receive);w.once('error',fail);w.postMessage({id,opts:c.opts,aiMode:versions[version].aiMode,diagnostics})})
 const roundTripMs=performance.now()-start
 assert.equal(r.status,'ok',c.id+' '+version+': '+r.error)
 const facts={valid:r.valid,facts:r.facts,alternatives:r.alternatives}
 expected.set(c.id,expected.get(c.id)||facts);assert.deepEqual(facts,expected.get(c.id),c.id+' '+version+' objective/coverage')
 return {case:c.id,version,roundTripMs,...r}
}
try{
 for(const version of Object.keys(versions))for(const kind of ['core','worker'])pool.set(version+':'+kind,await start(version,kind))
 for(const c of cases){
  for(let round=-1;round<3;round++){
   const order=Object.keys(versions);for(let i=0;i<(round+1)%4;i++)order.push(order.shift())
   for(const version of order){const r=await query(pool.get(version+':'+c.kind).w,c,version,c.id+':'+version+':'+round)
    if(round>=0)runs.push({...r,round})}
  }
  const med=version=>{const xs=runs.filter(x=>x.case===c.id&&x.version===version).map(x=>x.ms).sort((a,b)=>a-b);return xs[1]}
  console.log(JSON.stringify({case:c.id,label:c.label,ms:Object.fromEntries(Object.keys(versions).map(v=>[v,+med(v).toFixed(2)])),facts:expected.get(c.id)}))
 }
 for(const [key,p] of pool){await p.w.terminate()}pool.clear()
 for(const c of cases)for(const version of ['main','rebuilt']){
  const p=await start(version,c.kind)
  try{diagnostics.push(await query(p.w,c,version,c.id+':diag:'+version,true))}finally{await p.w.terminate()}
 }
 for(let round=0;round<3;round++)for(const c of cases.filter(c=>['request-CN-240-false','request-JP-Infinity-false'].includes(c.id))){
  const order=Object.keys(versions);for(let i=0;i<round;i++)order.push(order.shift())
  for(const version of order){
   const p=await start(version,c.kind)
   try{const r=await query(p.w,c,version,c.id+':cold:'+version+':'+round);cold.push({...r,round,startupMs:p.startupMs})
    console.log(JSON.stringify({cold:c.id,version,round,ms:+r.ms.toFixed(2)}))}finally{await p.w.terminate()}
  }
 }
 for(const [v,meta] of Object.entries(result.versions))assert.deepEqual(hashes(versions[v].root),meta.sourceHashes,v+' product source changed')
 writeFileSync(output+'/raw.json',JSON.stringify(result,null,2)+'\n')
 console.log(output+'/raw.json')
}finally{for(const p of pool.values())await p.w.terminate()}
