// Additional pre-freeze coverage: single-best target, complementing the
// generated all-support-alternatives scenarios. Never choose using blind data.
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {makeScenario} from '../scenario-ai/cases/index.mjs'
import {serializable} from '../scenario-ai/cases/common.mjs'
const path=process.argv[2],rows=JSON.parse(readFileSync(path,'utf8'))
if(rows.some(c=>c.stage.endsWith('-best')))throw Error('already extended')
const scenarios=['general','tight-cost','coverage','event','six-own','pinned','inventory','scale']
for(const [stage,seedBase]of [['confirm-best',291000000],['blind-best',321000000]]){
 for(const [i,scenario]of scenarios.entries()){
  const seed=seedBase+i*1000000,c=makeScenario(scenario,seed,i%2?'ood':'sealed'),opts=serializable(c.opts)
  opts.allSupportAlternatives=false
  rows.push({id:stage+'-'+c.id,stage,scenario,kind:'core',tier:'normal',opts,
    sha256:createHash('sha256').update(JSON.stringify(opts)).digest('hex')})
 }
}
writeFileSync(path,JSON.stringify(rows)+'\n')
console.log(JSON.stringify({cases:rows.length,added:16}))
