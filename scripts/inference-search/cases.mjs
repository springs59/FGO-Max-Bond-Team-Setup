import {readFileSync,writeFileSync} from 'node:fs'
import {brotliDecompressSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {makeScenario} from '../scenario-ai/cases/index.mjs'
import {serializable} from '../scenario-ai/cases/common.mjs'
const prior=JSON.parse(brotliDecompressSync(readFileSync(process.argv[2])))
const pick=(id,stage)=>({...structuredClone(prior.find(c=>c.id===id)),id:stage+'-archive-'+id,stage,tier:'normal'})
const scenarios=['general','tight-cost','coverage','event','six-own','pinned','inventory','scale']
const rows=[]
function add(scenario,seed,split,stage){const c=makeScenario(scenario,seed,split),opts=serializable(c.opts);opts.allSupportAlternatives=seed%2===0;rows.push({id:stage+'-'+c.id,stage,scenario,kind:'core',tier:'normal',opts})}
for(let i=0;i<8;i++)add(scenarios[i],201000000+i*1000000,'validation','screen')
for(const id of ['validation-coverage-123000000','sealed-six-own-135000000','ood-coverage-133000001','scale-CN-120','request-CN-30-false','request-CN-240-false','special-11','changed-support-equipment-4','historical-25','limited-mlb-pins','unreachable-high','capacity-empty'])rows.push(pick(id,'screen'))
for(let i=0;i<8;i++){
 add(scenarios[i],211000000+i*1000000,'sealed','confirm')
 add(scenarios[i],241000000+i*1000000,'ood','confirm')
}
for(const id of ['request-JP-Infinity-false','special-9','special-7','changed-support-equipment-6','scale-JP-Infinity','stress-six-own'])rows.push(pick(id,'confirm'))
for(let i=0;i<8;i++)add(scenarios[i],271000000+i*1000000,i%2?'ood':'sealed','blind')
for(const c of prior.filter(c=>c.stage==='stress'))rows.push({...c,id:'pressure-'+c.id,stage:'pressure'})
for(const c of rows){c.sha256=createHash('sha256').update(JSON.stringify(c.opts)).digest('hex')}
writeFileSync(process.argv[3],JSON.stringify(rows)+'\n')
console.log(JSON.stringify({cases:rows.length,groups:Object.fromEntries(['screen','confirm','blind','pressure'].map(g=>[g,rows.filter(c=>c.stage===g).length]))}))
