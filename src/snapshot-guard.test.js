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
  await assert.rejects(() => pullJson(async () => { throw new Error('offline') }, 'https://x/cn'), /网络失败/)
  await assert.rejects(() => pullJson(async () => ({ ok: false, status: 500 }), 'https://x/cn'), /500/)
  await assert.rejects(
    () =>
      pullJson(async () => ({
        ok: true,
        json: async () => {
          throw new Error('nope')
        },
      }), 'https://x/cn'),
    /JSON 损坏/,
  )
  const data = await pullJson(async () => ({ ok: true, json: async () => [1] }), 'https://x/cn')
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
