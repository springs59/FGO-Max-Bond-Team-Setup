import fs from 'node:fs'
import {DatabaseSync} from 'node:sqlite'
import {gzipSync,gunzipSync} from 'node:zlib'
import os from 'node:os'
import pathModule from 'node:path'
import {performance} from 'node:perf_hooks'
import {bundle,matrixPlan,inputs,hash} from './quest-matrix-plan.mjs'
import {recommendTeam,servantBondForms} from '../src/recommend.js'
import {buildSolverIndex} from '../src/solver/index.js'
import {canonical,createJsonQueryBatch,sharedPlanOf,QUERY_REVISION} from '../src/solver/query-library.js'
import {solverResultWire} from '../src/solver/cache.js'
import {oracleParty} from '../src/bond-oracle.js'
import {evaluateBondCurve} from '../src/solver/bond-curve.js'
import {createDiskJournal,consumeDiskJournal} from '../src/solver/query-candidate-journal.js'
import {RULE_VERSION} from '../src/rules/versions.js'
const root='generated/quest-matrix',work=root+'/.work'
fs.mkdirSync(work,{recursive:true})
// Mutable SQLite state lives on the executor's local disk. Portable JSONL
// archives plus the atomic index are the recovery source across workspaces.
const databaseFolder=pathModule.join(os.tmpdir(),'fgo-matrix-'+hash(process.cwd()).slice(0,16))
fs.mkdirSync(databaseFolder,{recursive:true})
const lock=new DatabaseSync(databaseFolder+'/lock.sqlite');lock.exec('BEGIN IMMEDIATE')
const db=new DatabaseSync(databaseFolder+'/matrix.sqlite');db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS ids(id TEXT PRIMARY KEY) WITHOUT ROWID; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,json TEXT); CREATE TABLE IF NOT EXISTS meta(id TEXT PRIMARY KEY,json TEXT)')
if(!db.prepare('SELECT count(*) AS n FROM jobs').get().n && fs.existsSync(root+'/index.json')){
  const prior=JSON.parse(fs.readFileSync(root+'/index.json'))
  if(prior.ruleVersion!==RULE_VERSION||prior.queryRevision!==QUERY_REVISION)throw Error('Matrix solver revision changed')
  console.log(JSON.stringify({recovering:prior.completed}))
  db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run('startedAt',JSON.stringify(prior.startedAt))
  for(const [region,digest] of Object.entries(prior.sourceHashes||{}))db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(region,JSON.stringify(digest))
  if(prior.packed||prior.baseArchiveFiles?.length)db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run('baseArchiveFiles',JSON.stringify(prior.packed?prior.files:prior.baseArchiveFiles))
  const restoreId=db.prepare('INSERT OR IGNORE INTO ids VALUES (?)')
  for(const f of prior.files){db.exec('BEGIN IMMEDIATE')
    const data=fs.readFileSync(f.path);if(data.length!==f.size||hash(data)!==f.sha256)throw Error('Recovery archive corrupt')
    for(const line of gunzipSync(data).toString('utf8').trimEnd().split('\n').slice(1)){const row=JSON.parse(line);restoreId.run(row.id)}
    db.exec('COMMIT')
  }
  for(const job of prior.jobs)db.prepare('INSERT INTO jobs VALUES (?,?)').run(job.id,JSON.stringify({...job,files:job.files||[]}))

}
const getMeta=db.prepare('SELECT json FROM meta WHERE id=?'),putMeta=db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)')
let startedAt=JSON.parse(getMeta.get('startedAt')?.json||'null')||Date.now();putMeta.run('startedAt',JSON.stringify(startedAt));Date.now=()=>startedAt
const now=Math.floor(startedAt/1000),nullHash=hash('null'),insert=db.prepare('INSERT OR IGNORE INTO ids VALUES (?)'),jobInsert=db.prepare('INSERT INTO jobs VALUES (?,?)'),jobGet=db.prepare('SELECT json FROM jobs WHERE id=?')
const plans=['CN','JP'].map(region=>{const b=bundle(region),sourceHash=hash(canonical(b)),old=getMeta.get(region)
  if(old&&JSON.parse(old.json)!==sourceHash)throw Error(region+' snapshot changed; create a new matrix')
  putMeta.run(region,JSON.stringify(sourceHash));return matrixPlan(b,now)})
function index(){const jobs=db.prepare('SELECT json FROM jobs ORDER BY id').all().map(x=>JSON.parse(x.json));const kinds={}
  for(const j of jobs)for(const [k,n] of Object.entries(j.kinds))kinds[k]=(kinds[k]||0)+n
  const baseArchiveFiles=JSON.parse(getMeta.get('baseArchiveFiles')?.json||'[]')
  const out={format:'fgo-quest-condition-matrix',version:1,ruleVersion:RULE_VERSION,queryRevision:QUERY_REVISION,startedAt,
    sourceHashes:Object.fromEntries(['CN','JP'].map(region=>[region,JSON.parse(getMeta.get(region).json)])),
    baseArchiveFiles,scope:{mode:'free',costLimit:95,teapot:false,questAvailability:'source-metadata-only; not a live availability guarantee'},
    planned:plans.reduce((n,p)=>n+p.domains.length*p.models.length,0),completed:jobs.length,
    observed:jobs.reduce((n,j)=>n+j.observed,0),curveChecks:jobs.reduce((n,j)=>n+j.curveChecks,0),kinds,
    regions:plans.map(p=>({region:p.region,filters:p.filters,emptyFilters:p.empty,domains:p.domains.length,quests:p.quests,models:p.models.length})),
    files:[...baseArchiveFiles,...jobs.flatMap(j=>j.files)],jobs}
  const temp=root+'/index.json.tmp';fs.writeFileSync(temp,JSON.stringify(out)+'\n');fs.renameSync(temp,root+'/index.json');return out}
function disk(path){const fd=fs.openSync(path,'w+');return {getSize:()=>fs.fstatSync(fd).size,write:(b,{at})=>fs.writeSync(fd,b,0,b.length,at),read:(b,{at})=>fs.readSync(fd,b,0,b.length,at),flush:()=>fs.fsyncSync(fd),truncate:n=>fs.ftruncateSync(fd,n),close:()=>fs.closeSync(fd)}}
const limit=Number(process.env.MATRIX_JOBS||Infinity);let computed=0,lastLog=performance.now()
for(const p of plans){const b=bundle(p.region),solverIndex=buildSolverIndex({...b,formsOf:servantBondForms}),describers=new Map(p.quests.map(q=>[q.id+':'+q.phase,createJsonQueryBatch('bond',inputs(b,q,p.domains[0].filters[0]))]))
  console.log(JSON.stringify({region:p.region,domains:p.domains.length,models:p.models.length,completed:index().completed}))
  for(const model of p.models)for(const domain of p.domains){
    const id=hash(p.region+model.key+domain.key);if(jobGet.get(id))continue
    if(computed>=limit){console.log(JSON.stringify({completed:index().completed,planned:index().planned}));db.close();lock.close();process.exit(0)}
    const quest=model.quests[0],opts=inputs(b,quest,domain.filters[0]),t0=performance.now(),path=work+'/candidates.jsonl',handle=disk(path),journal=createDiskJournal(handle)
    let value
    try {value=recommendTeam({...opts,solverIndex,skipResultCache:true,skipSolutionLookup:true,onComputedCandidate:journal.capture,onSolverProgress:()=>journal.checkpoint()});journal.seal();if(journal.error)throw Error(journal.error)
      if(value.ok){if(value.resultStatus?.optimality!=='search-complete')throw Error('Unproven maximum')
        if(value.costUsed>95||oracleParty(quest.bond,false,value.slots).total!==value.total)throw Error('Independent winner check failed')}
      const job={id,region:p.region,model:model.key,domain:domain.key,observed:0,curveChecks:0,kinds:{},files:[],queries:0,status:value.ok?'complete':'infeasible',total:value.total||0}
      db.exec('BEGIN IMMEDIATE')
      let lines=[JSON.stringify({format:'fgo-local-query-results',version:1,exportedAt:startedAt})+'\n'],bytes=Buffer.byteLength(lines[0]),recordCount=0,part=0
      function flush(){if(!recordCount)return
        const data=gzipSync(lines.join(''),{level:6}),name=`${root}/part-${id}-${String(part++).padStart(3,'0')}.jsonl.gz`,temp=name+'.tmp'
        fs.writeFileSync(temp,data);const fd=fs.openSync(temp,'r');fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(temp,name)
        job.files.push({path:name,size:data.length,sha256:hash(data),records:recordCount});lines=[lines[0]];bytes=Buffer.byteLength(lines[0]);recordCount=0}
      function record(description,payload,text=canonical(payload)){
        if(!insert.run(description.queryId).changes)return
        const r={...description,id:description.queryId,value:payload,createdAt:startedAt,updatedAt:startedAt}
        r.checksum=hash(canonical([r.queryId,r.family,r.kind,r.revision,r.summary]).slice(0,-1)+','+text+']')
        r.bytes=Buffer.byteLength(JSON.stringify(r));const line=JSON.stringify(r)+'\n'
        if(bytes+Buffer.byteLength(line)>16*1024*1024)flush()
        lines.push(line);bytes+=Buffer.byteLength(line);recordCount++;job.kinds[r.kind]=(job.kinds[r.kind]||0)+1
      }
      function fact(kind,payload){const text=canonical(payload),context=hash(text),queryId=`${kind}:r1:${hash(canonical([context,nullHash]))}`
        record({queryId,family:`${kind}:r1:${context}`,kind,revision:1,summary:kind==='shared-plan'?'通用编队 · 不绑定账号':'已计算候选 · '+payload.engine},payload,text)}
      await consumeDiskJournal(handle,async batch=>{
        for(const candidate of batch){job.observed++
          if(candidate.curve?.terms){if(evaluateBondCurve(candidate.curve,candidate.base,{teapot:candidate.teapot}).total!==candidate.total)throw Error('Candidate settlement mismatch')
            for(const base of [0,1,799,800,801,1000,1e9]){const total=candidate.curve.terms.reduce((n,t)=>n+(t.eligible?Number((BigInt(base)*BigInt(t.front)/1000n)*BigInt(t.second)/1000n+BigInt(t.flat)):0),0)
              if(evaluateBondCurve(candidate.curve,base).total!==total)throw Error('Curve mismatch');job.curveChecks++}}
          fact('computed-candidate',candidate);const physical=candidate.plan&&sharedPlanOf(candidate.plan);if(physical)fact('shared-plan',physical)
        }return {added:batch.length}})
      if(job.observed!==journal.stats().records)throw Error('Journal incomplete')
      if(value.ok){const copy=solverResultWire(value)
        for(const q of model.quests)for(const filter of domain.filters){record(await describers.get(q.id+':'+q.phase)({filter},`${p.region} · ${q.name} · B ${q.bond} · COST 95`),copy);job.queries++}}
      flush();job.elapsedMs=Math.round(performance.now()-t0);jobInsert.run(id,JSON.stringify(job));db.exec('COMMIT');handle.close();fs.unlinkSync(path);computed++
      const current=index()
      if(performance.now()-lastLog>10000){console.log(JSON.stringify({completed:current.completed,planned:current.planned,observed:current.observed,curveChecks:current.curveChecks,lastMs:job.elapsedMs}));lastLog=performance.now()}
    } catch(error){try{db.exec('ROLLBACK')}catch{};try{handle.close()}catch{};throw error}
  }
}
const result=index();console.log(JSON.stringify({completed:result.completed,planned:result.planned,observed:result.observed,curveChecks:result.curveChecks}));db.close();lock.close()
