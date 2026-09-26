import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { servantCost } from './servant-cost.js'
import { slimServants } from './game-data.js'
import { recommendTeam } from './recommend.js'
const catalog = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url)))
const angra = catalog.find(s => s.id === 1100100)
const mash = catalog.find(s => s.id === 800100)
assert.equal(angra.cost, 4, 'committed data must not make Angra free')
assert.equal(servantCost({...angra, cost:undefined}), 4)
assert.equal(servantCost({...angra, cost:0}), 4, 'repair stale snapshot zero')
assert.equal(slimServants([{...angra, cost:undefined}])[0].cost, 4)
assert.equal(servantCost(mash), 0)
assert.equal(servantCost(mash, {cost:16}), 16)
for (const costLimit of [0, 3, 4]) {
 const result = recommendTeam({base:550,servants:[mash,angra],ces:[],costLimit,allowSupport:false,skipSolutionLookup:true})
 assert.equal(result.ok, true)
 const owns = result.slots.filter(s=>s.filled&&!s.isSupport).map(s=>s.svtId)
 assert.equal(owns.includes(angra.id), costLimit >= 4, `COST ${costLimit}`)
 assert.equal(result.costUsed, costLimit >= 4 ? 4 : 0)
}
console.log('servant COST data and budget regression passed')
