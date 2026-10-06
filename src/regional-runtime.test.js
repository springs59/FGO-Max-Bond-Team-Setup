import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createGameData } from './data-layer.js'
import { validateRegionalSnapshot } from './regional-data.js'
import { recommendTeam } from './recommend.js'

const path = new URL('./data/jp/bundle.json', import.meta.url)
if (!existsSync(path)) {
  console.log('regional runtime: first JP snapshot has not been generated')
} else {
  const jp = JSON.parse(readFileSync(path, 'utf8'))
  const cn = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const cnCes = JSON.parse(readFileSync(new URL('./data/ces.json', import.meta.url), 'utf8'))
  const cnIndex = JSON.parse(readFileSync(new URL('./data/solver-index.json', import.meta.url), 'utf8'))
  assert.equal(validateRegionalSnapshot(jp, 'JP').ok, true)
  const cnMap = new Map(cn.map(s => [s.id, s]))
  const jpOnly = jp.servants.filter(s => !cnMap.has(s.id))
  const cnCeIds = new Set(cnCes.map(c => c.id))
  const different = jp.servants.filter(s => {
    const other = cnMap.get(s.id)
    return other && JSON.stringify([s.forms, s.abilities]) !== JSON.stringify([other.forms, other.abilities])
  })
  const quest = jp.quests.find(q => !q.eventId && q.type === 'free')
  assert.ok(quest, 'JP needs an ordinary verified quest')
  const game = createGameData({ servants: jp.servants, craftEssences: jp.ces, quests: jp.quests, version: jp.version })
  const account = { ok: true, region: 'JP',
    servants: jp.servants.map(s => ({ id: s.id, count: 1, bondLv: 0, bondCap: 10, maxAscension: 4,
      unlockedCostumes: (s.forms || []).filter(f => f.key.startsWith('c')).map(f => Number(f.key.slice(1))) })),
    ces: jp.ces.map(c => ({ id: c.id, count: 5, mlb: true, mlbCount: 1, nonMlbCount: 0 })) }
  const params = { base: quest.bond, servants: jp.servants, ces: jp.ces, game, region: 'JP',
    quest, bondBonuses: jp.bondBonuses, allowSupport: true, costLimit: 116,
    solverAudit: { memo: false } }
  for (const mode of ['free', 'account']) {
    const start = performance.now()
    // Passing the existing CN index must be harmless: JP rebuilds from its own fields.
    const result = recommendTeam({ ...params, mode, account: mode === 'account' ? account : null, solverIndex: cnIndex })
    const duration = performance.now() - start
    assert.equal(result.ok, true, result.error)
    for (const slot of result.slots || []) {
      if (slot.svtId) assert.ok(jp.servants.some(s => s.id === slot.svtId))
      for (const ceId of [slot.ceId, slot.ceBondId, slot.ceRewardId].filter(Boolean))
        assert.ok(jp.ces.some(c => c.id === ceId))
    }
    assert.ok((result.slots || []).some(s => s.svtId), 'must produce an actual team')
    assert.ok(duration < 20000, 'JP ordinary recommendation must finish promptly: ' + duration + 'ms')
    console.log('JP real-catalog ' + mode + ' recommendation: ' + Math.round(duration) + 'ms')
  }
  console.log('regional data audit: JP-only servants=' + jpOnly.length + ', JP-only CEs=' +
    jp.ces.filter(c => !cnCeIds.has(c.id)).length + ', same-ID form/ability differences=' + different.length)
}
