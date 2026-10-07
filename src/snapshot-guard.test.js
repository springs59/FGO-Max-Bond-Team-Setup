import assert from 'node:assert/strict'
import { LIVING_HUMAN_TRAIT } from './game-data.js'
import { SCHEMA_VERSION } from './data-layer.js'
import {
  isCountDrop,
  optionalJpExport,
  parseJsonOrFail,
  pullJson,
  requireCnExport,
  snapshotPublishDecision,
} from './snapshot-guard.js'

const noWait = { wait: async () => {}, onRetry: () => {} }

const CE_NAMES = ['迦勒底之晨', '检查报告', '手稿之翼', '秘密任务', '至诚的一针']

function okBundle(extra = {}) {
  const servants = Array.from({ length: 400 }, (_, i) => ({
    id: i + 1,
    collectionNo: i + 1,
    name: `s${i}`,
    traitIds: i < 24 ? [LIVING_HUMAN_TRAIT] : [],
  }))
  const ces = Array.from({ length: 120 }, (_, i) => ({
    id: 9000 + i,
    name: CE_NAMES[i] || `ce${i}`,
  }))
  return {
    servants,
    ces,
    version: { schemaVersion: SCHEMA_VERSION, updatedAt: '2026-09-21T00:00:00Z' },
    enemies: [],
    traits: [],
    skills: [],
    noblePhantasms: [],
    ...extra,
  }
}

{
  const bad = parseJsonOrFail('{', 'ces')
  assert.equal(bad.ok, false)
  assert.match(bad.error, /JSON 损坏/)
  const good = parseJsonOrFail('{"a":1}', 'ces')
  assert.equal(good.ok, true)
  assert.equal(good.value.a, 1)
}

{
  await assert.rejects(() => pullJson(async () => { throw new Error('offline') }, 'https://x/cn', noWait), /网络失败/)
  await assert.rejects(() => pullJson(async () => ({ ok: false, status: 500 }), 'https://x/cn', noWait), /500/)
  await assert.rejects(
    () =>
      pullJson(async () => ({
        ok: true,
        json: async () => {
          throw new Error('nope')
        },
      }), 'https://x/cn', noWait),
    /JSON 损坏/,
  )
  const data = await pullJson(async () => ({ ok: true, json: async () => [1] }), 'https://x/cn', noWait)
  assert.deepEqual(data, [1])
}

{
  assert.throws(() => requireCnExport([]), /CN 失败/)
  assert.throws(() => requireCnExport(null), /CN 失败/)
  assert.equal(requireCnExport([1]).length, 1)
  assert.deepEqual(optionalJpExport(null), [])
  assert.deepEqual(optionalJpExport([]), [])
  assert.equal(optionalJpExport([1, 2]).length, 2)
}

{
  assert.equal(isCountDrop(1000, 700), true)
  assert.equal(isCountDrop(1000, 900), false)
  assert.equal(isCountDrop(0, 0), false)
}

{
  const previous = okBundle()
  const ok = snapshotPublishDecision({ previous, candidate: okBundle() })
  assert.equal(ok.ok, true)
  assert.equal(ok.keepPrevious, false)
}

{
  const previous = okBundle()
  const half = okBundle({ servants: previous.servants.slice(0, 10), ces: previous.ces.slice(0, 3) })
  const out = snapshotPublishDecision({ previous, candidate: half })
  assert.equal(out.ok, false)
  assert.equal(out.keepPrevious, true)
  assert.ok(out.errors.some((text) => text.includes('从者数') || text.includes('骤降') || text.includes('livingHuman')))
}

{
  const previous = okBundle({
    servants: Array.from({ length: 600 }, (_, i) => ({
      id: i + 1,
      collectionNo: i + 1,
      name: `s${i}`,
      traitIds: i < 24 ? [LIVING_HUMAN_TRAIT] : [],
    })),
  })
  const dropped = okBundle()
  const out = snapshotPublishDecision({ previous, candidate: dropped })
  assert.equal(out.ok, false)
  assert.ok(out.errors.some((text) => text.includes('从者数骤降')))
}

{
  const previous = okBundle()
  const schema = okBundle({
    version: { schemaVersion: SCHEMA_VERSION + 1, updatedAt: '2026-09-21T00:00:00Z' },
  })
  const out = snapshotPublishDecision({ previous, candidate: schema })
  assert.equal(out.ok, false)
  assert.ok(out.errors.some((text) => text.includes('schema 改变')))
}

{
  const missing = snapshotPublishDecision({
    candidate: {
      servants: okBundle().servants,
      ces: okBundle().ces,
      version: { updatedAt: '2026-09-21T00:00:00Z' },
    },
  })
  assert.equal(missing.ok, false)
  assert.ok(missing.errors.some((text) => text.includes('schemaVersion')))
}

{
  const corruptType = snapshotPublishDecision({
    candidate: { ...okBundle(), enemies: {} },
  })
  assert.equal(corruptType.ok, false)
  assert.ok(corruptType.errors.some((text) => text.includes('enemies')))
}

console.log('snapshot guard tests passed')

// The overnight Actions failure was a single transient network error.
{
  const delays = [], warnings = []
  let calls = 0
  const value = await pullJson(async () => {
    calls++
    if (calls === 1) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } })
    if (calls === 2) return { ok: false, status: 503 }
    return { ok: true, json: async () => [42] }
  }, 'https://x/cn', { wait: async ms => delays.push(ms), onRetry: s => warnings.push(s) })
  assert.deepEqual(value, [42])
  assert.equal(calls, 3)
  assert.deepEqual(delays, [1000, 2000])
  assert.match(warnings[0], /ECONNRESET/)
}
{
  let calls = 0
  await assert.rejects(() => pullJson(async () => { calls++; return { ok: false, status: 404 } },
    'https://x/missing', noWait), /HTTP 404.*已尝试 1 次/)
  assert.equal(calls, 1)
}
{
  let calls = 0
  await assert.rejects(() => pullJson(async () => { calls++; throw new Error('offline') },
    'https://x/cn', noWait), /网络失败.*已尝试 4 次/)
  assert.equal(calls, 4)
}
{
  const delays = []
  let calls = 0
  await pullJson(async () => ++calls === 1
    ? { ok: false, status: 429, headers: { get: () => '120' } }
    : { ok: true, json: async () => [] }, 'https://x/rate', { ...noWait, wait: async ms => delays.push(ms) })
  assert.deepEqual(delays, [60000])
}
{
  let calls = 0
  const value = await pullJson(async () => ({ ok: true, json: async () => {
    if (++calls === 1) throw new SyntaxError('truncated body')
    return [1]
  } }), 'https://x/cn', noWait)
  assert.deepEqual(value, [1])
  assert.equal(calls, 2)
}
