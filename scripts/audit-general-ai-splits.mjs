import { readFileSync,writeFileSync,existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { GENERAL_SPLITS } from './general-ai-cases.mjs'
const folder='experiments/ai-general',train=JSON.parse(readFileSync(folder+'/data/split-audit-train.json'))
const all={train:{exact:new Set(train.exact),near:new Set(train.near),families:new Set(train.families)}}
const report={schema:3,status:'complete',splits:{train:{uniqueInputs:train.exact.length,uniqueNearGroups:train.near.length,families:train.families}},crossSplit:[],violations:[]}
for(const split of ['calibration','validation','test']){
 const path=folder+'/data/'+split+'-runs.jsonl',metaPath=folder+'/reports/'+split+'.json'
 if(!existsSync(path)||!existsSync(metaPath))continue
 const meta=JSON.parse(readFileSync(metaPath));if(meta.status!=='complete')continue
 const bytes=readFileSync(path),rows=bytes.toString().trim().split('\n').map(JSON.parse)
 if(rows.length!==meta.n||new Set(rows.map(r=>r.index)).size!==meta.n||createHash('sha256').update(bytes).digest('hex')!==meta.integrity.sha256)throw Error('Split integrity failed: '+split)
 const exact=new Set(rows.map(r=>r.inputSha256)),near=new Set(rows.map(r=>r.nearSha256)),families=new Set(rows.map(r=>r.structureKey))
 if(rows.some(r=>r.status!=='ok'))throw Error('Failed evaluation rows: '+split)
 all[split]={exact,near,families};report.splits[split]={queries:rows.length,uniqueInputs:exact.size,uniqueNearGroups:near.size,families:[...families],integrityVerified:true}
 if(exact.size!==rows.length||near.size!==rows.length)report.violations.push({split,type:'within-split-repetition',exactDuplicates:rows.length-exact.size,nearDuplicates:rows.length-near.size})
}
const names=Object.keys(all)
for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
 const a=names[i],b=names[j],overlap=kind=>[...all[a][kind]].filter(x=>all[b][kind].has(x)).length
 const row={a,b,exact:overlap('exact'),near:overlap('near'),compositionFamilies:overlap('families')};report.crossSplit.push(row)
 if(row.exact||row.near||row.compositionFamilies)report.violations.push(row)
}
report.plannedFamilies=Object.fromEntries(Object.entries(GENERAL_SPLITS).map(([k,v])=>[k,v.families]))
if(report.violations.length)report.status='failed'
writeFileSync(folder+'/reports/split-audit.json',JSON.stringify(report,null,2)+'\n',{flush:true})
console.log(JSON.stringify(report,null,2));if(report.violations.length)process.exitCode=1
