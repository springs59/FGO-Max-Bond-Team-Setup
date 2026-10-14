import fs from 'node:fs'
import {bundle,matrixPlan,hash} from './quest-matrix-plan.mjs'
import {canonical} from '../src/solver/query-library.js'
const index=JSON.parse(fs.readFileSync(process.argv[2]||'generated/quest-matrix/index.json'))
Date.now=()=>index.startedAt
const order={},sourceHashes={}
for(const [regionIndex,region] of ['CN','JP'].entries()){
  const b=bundle(region);sourceHashes[region]=hash(canonical(b))
  if(index.sourceHashes?.[region]&&index.sourceHashes[region]!==sourceHashes[region])throw Error('Snapshot changed')
  const p=matrixPlan(b,Math.floor(index.startedAt/1000))
  for(const [modelIndex,m] of p.models.entries())for(const [domainIndex,d] of p.domains.entries())order[hash(region+m.key+d.key)]=[regionIndex,modelIndex,domainIndex]
}
console.log(JSON.stringify({order,sourceHashes}))
