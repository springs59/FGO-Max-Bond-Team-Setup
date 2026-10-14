import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import 'fake-indexeddb/auto'
import {bundle,matrixPlan,inputs,hash} from './quest-matrix-plan.mjs'
import {validateRecord,createJsonQueryBatch,importQueries,readQuery} from '../src/solver/query-library.js'
import {oracleParty} from '../src/bond-oracle.js'
import {matchRosterForm} from '../src/filter.js'
import {servantBondForms} from '../src/recommend.js'
const root='generated/quest-matrix',indexBytes=fs.readFileSync(root+'/index.json'),index=JSON.parse(indexBytes)
Date.now=()=>index.startedAt
const cases=new Map(['CN','JP'].map(region=>{const b=bundle(region),p=matrixPlan(b,Math.floor(index.startedAt/1000));return [region,{b,p,describers:new Map(p.quests.map(q=>[q.id+':'+q.phase,createJsonQueryBatch('bond',inputs(b,q,p.domains[0].filters[0]))]))}]}))
const ledgerPath=root+'/.work/verified-files.json'
const sourceHash=hash(['scripts/verify-quest-matrix.mjs','src/solver/query-library.js','src/recommend.js','src/filter.js','src/bond-oracle.js'].map(p=>fs.readFileSync(p)).join(''))
let ledger={sourceHash,entries:{}}
try{const old=JSON.parse(fs.readFileSync(ledgerPath));if(old.sourceHash===sourceHash)ledger=old}catch{}
const expected=new Map()
for(const job of index.jobs){
  if(job.status!=='complete')continue
  const {p,describers}=cases.get(job.region),domain=p.domains.find(d=>d.key===job.domain),model=p.models.find(m=>m.key===job.model)
  if(!domain||!model)throw Error('Matrix snapshot/domain mismatch')
  for(const q of model.quests)for(const filter of domain.filters){const d=await describers.get(q.id+':'+q.phase)({filter});expected.set(d.queryId,{description:d,q,filter,region:job.region})}
}
let records=0,queries=0,files=0,imports=0,reusedFiles=0
for(const file of index.files){
  const data=fs.readFileSync(file.path);if(data.length!==file.size||hash(data)!==file.sha256)throw Error('File integrity failed '+file.path)
  const prior=ledger.entries[file.path]
  if(prior?.sha256===file.sha256&&prior.records===file.records){
    for(const id of prior.queryIds){if(!expected.delete(id))throw Error('Cached query alias mismatch');queries++}
    records+=prior.records;files++;reusedFiles++;continue
  }
  const lines=gunzipSync(data).toString('utf8').trimEnd().split('\n'),header=JSON.parse(lines.shift())
  if(header.format!=='fgo-local-query-results'||header.version!==1||lines.length!==file.records)throw Error('Archive count/header mismatch')
  const queryIds=[]
  for(let at=0;at<lines.length;at+=64){const batch=lines.slice(at,at+64).map(JSON.parse);await Promise.all(batch.map(validateRecord))
    for(const r of batch)if(r.kind==='bond'){
      const e=expected.get(r.queryId);if(!e)throw Error('Query key mismatch');expected.delete(r.queryId);queryIds.push(r.queryId)
      const {b}=cases.get(e.region),plan=r.value
      if(!plan.ok||plan.costUsed>95||plan.resultStatus?.optimality!=='search-complete'||oracleParty(e.q.bond,false,plan.slots).total!==plan.total)throw Error('Winner oracle/proof failed')
      for(const slot of plan.slots.filter(s=>s.filled&&!s.isSupport)){const svt=b.servants.find(s=>s.id===slot.svtId),form=svt&&servantBondForms(svt).find(f=>f.key===(slot.svtArtKey==='d'?'default':slot.svtArtKey||'default'))
        if(!form||!matchRosterForm(svt,form,e.filter))throw Error('Winner outside filter')}
      queries++
      if(queries%251===1){const blob=new Blob([JSON.stringify(header)+'\n'+JSON.stringify(r)+'\n']);await importQueries(blob);if((await readQuery(e.description))?.total!==plan.total)throw Error('Production cache lookup failed');imports++}
    }
    records+=batch.length
  }
  files++;ledger.entries[file.path]={sha256:file.sha256,records:file.records,queryIds}
  fs.mkdirSync(root+'/.work',{recursive:true});fs.writeFileSync(ledgerPath+'.tmp',JSON.stringify(ledger));fs.renameSync(ledgerPath+'.tmp',ledgerPath)
  if(files%100===0)console.log(JSON.stringify({files,records,queries,reusedFiles}))
}
if(expected.size)throw Error('Exact aliases missing')
if(records!==Object.values(index.kinds).reduce((n,x)=>n+x,0))throw Error('Total count mismatch')
const report={passed:true,indexSha256:hash(indexBytes),completed:index.completed,planned:index.planned,files,records,queries,productionImports:imports,reusedFiles,partial:index.completed!==index.planned}
fs.writeFileSync(root+'/verified-index.json',indexBytes);fs.writeFileSync(root+'/verification.json',JSON.stringify(report)+'\n');console.log(JSON.stringify(report))
