import {parentPort,workerData} from 'node:worker_threads'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {makeDiverseCase,materialize} from './ai-diverse-cases.mjs'
import {solveInventoryCurves} from '../src/solver/inventory-curve-solver.js'
import {recommendTeam} from '../src/recommend.js'
import {SEARCH_MODEL} from '../src/solver/ai-model.js'
let original
if(workerData.baseline)({solveInventoryCurves:original}=await import(pathToFileURL(workerData.baseline+'/src/solver/inventory-curve-solver.js')))
// Observation-only copy. Absolute imports still use unchanged production code.
const sourceUrl=new URL('../src/recommend.js',import.meta.url),source=readFileSync(sourceUrl,'utf8')
const marker='    if(learnedSearch.stats.enabled) {\n      const scores=new Map()'
if(!source.includes(marker))throw Error('General teacher instrumentation marker changed')
const observed=source.replace(marker,"    globalThis.__trainingDomain?.({servants:[...mustRows,...fillerGroups.flat()].map(r=>({id:r.svt.id,form:r.form.key,features:featuresOf(r)})),equipment:[]})\n"+marker)
  .replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(new URL(p,sourceUrl).href))
const dir=join(tmpdir(),'fgo-ai-diverse-probe');mkdirSync(dir,{recursive:true});const file=join(dir,`recommend-${process.pid}-${workerData.slot}.mjs`);writeFileSync(file,observed)
const {recommendTeam:probe}=await import(pathToFileURL(file))
const chosen=result=>result?.ok?result.slots.filter(s=>s.filled&&!s.isSupport).map(s=>({id:s.svtId,form:s.svtArtKey||'default'})):result?.slots?.filter(s=>s.f&&!s.s).map(s=>({id:s.svt,form:s.art||'default'}))||[]
function labels(domain,result,kind){
 const members=chosen(result),equips=result?.slots?.filter(s=>kind==='general'?s.filled&&!s.isSupport:s.f&&!s.s)||[],counts=new Map()
 for(const s of equips){const id=kind==='general'?s.ceId:s.ce,mlb=kind==='general'?s.ceMlb!==false:s.mlb!==false;if(id){const key=id+':'+mlb;counts.set(key,(counts.get(key)||0)+1)}}
 const equipment=(domain?.equipment||[]).map(g=>{const keys=new Set(g.ids.map((id,j)=>id+':'+g.mlb[j]));return {x:g.features,y:[...keys].reduce((n,k)=>n+(counts.get(k)||0),0)/Math.min(6*g.features[14],g.ids.length)}})
 const positive=new Set((domain?.servants||[]).filter(r=>members.some(s=>s.id===r.id&&s.form===(r.form||'default'))).map(r=>JSON.stringify(r.features))),unique=new Map()
 for(const r of domain?.servants||[])unique.set(JSON.stringify(r.features),{x:r.features,y:Number(positive.has(JSON.stringify(r.features)))})
 return {equipment,servant:[...unique.values()]}
}
parentPort.on('message',m=>{try{
 const c=makeDiverseCase(m.split,m.index);let domain
 globalThis.__trainingDomain=m.labels?(d=>{domain=domain?{equipment:[...domain.equipment,...d.equipment],servants:[...domain.servants,...d.servants]}:d}):null
 const model=m.model==='old'?SEARCH_MODEL:m.model,opts=c.kind==='inventory'?materialize(c.opts):c.opts
 const began=performance.now(),result=c.kind==='inventory'?solveInventoryCurves({...opts,aiMode:m.mode||'off',aiModel:model,onAiDomain:m.labels?(d=>domain=d):undefined}):(m.labels?probe:recommendTeam)({...opts,aiMode:m.mode||'off',aiModel:model})
 const ms=performance.now()-began,facts=c.kind==='inventory'?(result?[result.score,result.cost]:null):(result?.ok?[result.total,result.costUsed]:null)
 if(m.parity){const other=c.kind==='inventory'&&original?original(opts):recommendTeam({...opts,aiMode:'off'}),truth=c.kind==='inventory'?(other?[other.score,other.cost]:null):(other?.ok?[other.total,other.costUsed]:null);if(JSON.stringify(facts)!==JSON.stringify(truth))throw Error('Teacher/reference parity failed '+JSON.stringify({facts,truth,id:c.id}))}
 const ai=c.kind==='inventory'?result?.certificate?.ai:result?.resultStatus?.ai
 parentPort.postMessage({id:m.id,status:'ok',case:{id:c.id,split:c.split,index:c.index,family:c.family,kind:c.kind,region:c.region,inputSha256:c.inputSha256,identities:c.opts.servants.length,base:c.opts.base,budget:c.opts.costLimit},facts,ms,ai,
  ...(m.labels&&facts?{labels:labels(domain,result,c.kind),domainRows:domain?.servants?.length||0}:{})})
 }catch(error){parentPort.postMessage({id:m.id,status:'error',error:String(error.stack||error)})}finally{globalThis.__trainingDomain=null}})
parentPort.postMessage({ready:true})
