import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { verifyAiModel } from '../src/ai-update.js'
import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { makeSearchCase } from './ai-search-cases.mjs'

const directory = resolve(process.argv[2] || 'ai')
const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'))
// Validate the filename before opening anything named by the manifest.
if (!/^[\w-]+\.json$/.test(manifest.file)) throw Error('Invalid model filename')
const raw = await readFile(resolve(directory, manifest.file), 'utf8')
const model = await verifyAiModel(manifest, raw)
let feasible = 0
for (let i = 0; i < 24; i++) {
  const opts = makeSearchCase(9800000 + i).opts
  const off = solveInventoryCurves({ ...opts, aiMode: 'off', allSupportAlternatives: true })
  const on = solveInventoryCurves({ ...opts, aiMode: 'on', aiModel: model, allSupportAlternatives: true })
  assert.equal(Boolean(on), Boolean(off))
  if (!off) continue
  feasible++
  assert.equal(on.score, off.score)
  assert.equal(on.cost, off.cost)
  const alternatives = x => Object.fromEntries(x.plans.map(p => {
    const s = p.slots.find(s => s.s)
    return [(s?.ce || 0) + ':' + (s?.p || 0), [p.score, p.cost]]
  }))
  assert.deepEqual(alternatives(on), alternatives(off))
}
assert.ok(feasible >= 12)
console.log(`AI channel ${manifest.version}: integrity/compatibility and ${feasible} feasible exact domains with all support alternatives passed`)
