import assert from 'node:assert/strict'
import { analyzeSnapshot, mergeJpTraits, validateSnapshot } from './game-data.js'

{
  const cn = [{ id: 100, traitIds: [1], forms: [{ key: 'default', traitIds: [1] }] }]
  const jp = [{ id: 100, traitIds: [1, 2654], forms: [{ key: 'default', traitIds: [2654] }] }]
  const out = mergeJpTraits(cn, jp)
  assert.deepEqual(out[0].traitIds, [1, 2654])
  assert.deepEqual(out[0].forms[0].traitIds, [1, 2654])
}

{
  const cn = [{ id: 100, traitIds: [1], forms: [{ key: 'default', traitIds: [1] }] }]
  const jp = [
    {
      id: 100,
      traitIds: [1],
      forms: [
        { key: 'default', traitIds: [1] },
        { key: 'a3', name: '灵基 3', traitIds: [1, 9] },
      ],
    },
  ]
  const out = mergeJpTraits(cn, jp)
  assert.equal(out[0].forms.some((form) => form.key === 'a3'), true)
}

{
  const servants = Array.from({ length: 400 }, (_, i) => ({
    id: i + 1,
    traitIds: i < 24 ? [2654] : [],
  }))
  const ces = ['迦勒底之晨', '检查报告', '手稿之翼', '秘密任务', '至诚的一针'].map((name, i) => ({
    id: i + 1,
    name,
  }))
  const check = validateSnapshot(servants, ces)
  assert.equal(check.ok, true)
  const analysis = analyzeSnapshot(servants, ces, { region: 'CN', jpServantCount: 12 })
  assert.equal(analysis.ok, true)
  assert.equal(analysis.jpServantCount, 12)
  assert.equal(analysis.livingHuman, 24)
}

console.log('game-data tests passed')
