import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { makeDiverseCase, materialize, DATA_SHA } from './ai-diverse-cases.mjs'
import { prepareConfig, configFeatures, legalCounts } from './conditioned-config.mjs'
const folder='experiments/ai-conditioned';mkdirSync(folder+'/data',{recursive:true});mkdirSync(folder+'/reports',{recursive:true})
const fixes=['train','validation'].flatMap(split=>{const p=folder+'/data/repaired-'+split+'.jsonl';return existsSync(p)?readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[]})
const report={schema:2,sourceDataSha256:DATA_SHA,sealedTestRead:false,searchTimeLimit:'none',splits:{},features:null}
for(const split of ['train','validation']) {
  const rows=gunzipSync(readFileSync(`experiments/ai-diverse/data/${split}.jsonl.gz`)).toString().trim().split('\n').map(JSON.parse)
  for(const fix of fixes.filter(r=>r.split===split&&r.status==='ok'))rows[rows.findIndex(r=>r.index===fix.index)]=fix
  const output=[];const stats={queries:0,steps:0,unsupportedGeneral:0,infeasible:0,incomplete:[],maskErrors:[]}
  for(const row of rows.sort((a,b)=>a.index-b.index)) {
    if(row.status!=='ok'){stats.incomplete.push(row.index);continue}
    const c=makeDiverseCase(split,row.index)
    if(c.kind!=='inventory'){stats.unsupportedGeneral++;continue}
    if(!row.facts){stats.infeasible++;continue}
    const ctx=prepareConfig(materialize(c.opts))
    const counts=row.labels.equipment.map((g,i)=>Math.round(g.y*Math.min(ctx.cap,ctx.groups[i].items.length)))
    if(counts.length!==ctx.groups.length)throw Error('Teacher group order mismatch')
    const steps=[]
    for(let i=0;i<counts.length;i++) {
      const prefix=counts.slice(0,i),f=configFeatures(ctx,i,prefix),legal=legalCounts(ctx,i,prefix)
      if(!legal.includes(counts[i])){stats.maskErrors.push({index:row.index,i,target:counts[i],legal});continue}
      if(!report.features)report.features=f.names
      if(f.names.join('|')!==report.features.join('|'))throw Error('Feature layout changed')
      if(!f.x.every(Number.isFinite))throw Error('Nonfinite features')
      steps.push({x:f.x,y:counts[i],legal})
    }
    output.push({index:row.index,id:c.id,family:c.family,inputSha256:c.inputSha256,facts:row.facts,counts,steps})
    stats.queries++;stats.steps+=steps.length
    if(stats.queries%500===0)console.log(split,stats.queries)
  }
  const data=gzipSync(output.map(x=>JSON.stringify(x)).join('\n')+'\n')
  writeFileSync(folder+'/data/'+split+'.jsonl.gz',data)
  report.splits[split]={...stats,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}
}
writeFileSync(folder+'/reports/dataset.json',JSON.stringify(report,null,2)+'\n')
if(Object.values(report.splits).some(s=>s.maskErrors.length))throw Error('A legality mask removed a teacher action')
console.log(JSON.stringify(report.splits,null,2))
