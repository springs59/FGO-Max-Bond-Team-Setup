import assert from 'node:assert/strict'
import { enrichQuestBond } from './enrich-quest-bond.mjs'

const rows = [
  { id: 1, phase: 1, name: '第一关', bond: 29690 },
  { id: 1, phase: 2, name: '第一关', bond: 29690 },
  { id: 2, phase: 1, name: '第二关', bond: 22190 },
]
const calls = []
const result = await enrichQuestBond(rows, async (id, phase) => {
  calls.push(`${id}/${phase}`)
  return { id, phase, bond: id === 1 ? 815 : 615, exp: id === 1 ? 29690 : 22190 }
})
assert.deepEqual(calls.sort(), ['1/2', '2/1'])
assert.deepEqual(result.map(row => row.bond), [815, 615])
await assert.rejects(enrichQuestBond(rows, async (id, phase) => ({ id, phase, exp: 29690 })), /invalid authoritative bond/)
console.log('authoritative quest bond enrichment ok')
