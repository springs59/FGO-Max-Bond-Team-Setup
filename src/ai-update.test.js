import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createAiUpdater, verifyAiModel, validateAiManifest, AI_FEED, AI_ROOT, AI_STORAGE_KEY } from './ai-update.js'
import { SEARCH_MODEL } from './solver/ai-model.js'
import { solveInventoryCurves } from './solver/inventory-curve-solver.js'
import { makeSearchCase } from '../scripts/ai-search-cases.mjs'

const baseline = JSON.parse(await readFile(new URL('../ai/manifest.json', import.meta.url)))
const baselineRaw = await readFile(new URL('../ai/baseline.json', import.meta.url), 'utf8')
assert.deepEqual(await verifyAiModel(baseline, baselineRaw), SEARCH_MODEL)
const candidate = { ...structuredClone(SEARCH_MODEL), version: 'test-qualified-model' }
const raw = JSON.stringify(candidate)
const manifest = { ...baseline, sequence: 2, version: candidate.version, qualification: 'passed',
  validation: { passed: true, sealedTestPassed: true }, size: Buffer.byteLength(raw),
  sha256: createHash('sha256').update(raw).digest('hex') }
const map = new Map(), storage = { getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) }
let responseManifest = manifest, responseRaw = raw, failed = false
const requests = []
const fetcher = async (url, options) => {
  requests.push(url)
  assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error')
  if (failed) throw Error('offline')
  assert.ok(url === AI_FEED || url === AI_ROOT + manifest.file)
  return new Response(url === AI_FEED ? JSON.stringify(responseManifest) : responseRaw)
}
const updater = createAiUpdater({ storage, fetcher })
assert.deepEqual(await updater.update(), { changed: true })
assert.equal(updater.model.version, candidate.version)
const restored = createAiUpdater({ storage, fetcher })
assert.deepEqual(await restored.restore(), { restored: true })
assert.equal(restored.model.version, candidate.version)
assert.deepEqual(await restored.update(), { changed: false })
const saved = storage.getItem(AI_STORAGE_KEY)
for (const patch of [
  { qualification: 'candidate' }, { validation: { passed: true, sealedTestPassed: false } },
  { minAppVersion: '2.2.0' }, { maxAppVersion: '2.1.0' }, { file: '../data.json' },
  { file: 'https://other.example/a.json' }, { featureVersion: 2 }, { size: 1024 ** 2 },
]) assert.throws(() => validateAiManifest({ ...manifest, ...patch }))
assert.throws(() => validateAiManifest({ ...manifest, qualification: 'baseline' }))
responseManifest = { ...manifest, sequence: 3 }; responseRaw = raw.slice(0,-5)
await assert.rejects(updater.update(), /摘要/)
assert.equal(storage.getItem(AI_STORAGE_KEY), saved)
assert.equal(updater.model.version, candidate.version)
failed = true; await assert.rejects(updater.update(), /offline/); failed = false
assert.equal(storage.getItem(AI_STORAGE_KEY), saved)
const damaged = JSON.parse(saved); damaged.raw = 'broken'; storage.setItem(AI_STORAGE_KEY, JSON.stringify(damaged))
const corrupt = createAiUpdater({ storage, fetcher })
assert.deepEqual(await corrupt.restore(), { restored: false, fallback: true })
assert.equal(corrupt.model.version, SEARCH_MODEL.version)
storage.setItem(AI_STORAGE_KEY, saved)
responseRaw = raw
const quota = createAiUpdater({ storage: { getItem: storage.getItem, setItem: () => { throw Error('quota') } }, fetcher })
await assert.rejects(quota.update(), /quota/); assert.equal(quota.model.version, SEARCH_MODEL.version)
const broken = structuredClone(candidate); broken.heads.servant.w1[0].pop()
const brokenRaw = JSON.stringify(broken)
await assert.rejects(verifyAiModel({ ...manifest, size: Buffer.byteLength(brokenRaw), sha256: createHash('sha256').update(brokenRaw).digest('hex') }, brokenRaw), /结构/)
// Updated weights still go through the full exact search, rather than returning
// the model proposal. Cross-check scores/COST against AI-off on independent cases.
let feasible = 0
for (let i = 0; i < 24; i++) {
  const opts = makeSearchCase(9800000 + i).opts
  const off = solveInventoryCurves({ ...opts, aiMode: 'off' })
  const on = solveInventoryCurves({ ...opts, aiMode: 'on', aiModel: restored.model })
  assert.equal(Boolean(on), Boolean(off))
  if (off) { feasible++; assert.ok(Number.isFinite(off.score)); assert.ok(Number.isFinite(off.cost)); assert.equal(on.score, off.score); assert.equal(on.cost, off.cost) }
}
assert.ok(feasible >= 12)
restored.reset(); assert.equal(storage.getItem(AI_STORAGE_KEY), null)
assert.equal(restored.model.version, SEARCH_MODEL.version)
console.log('AI updates: source, compatibility, acceptance gate, integrity, persistence, restart, fallback, reset and 24 exact solver checks passed')
