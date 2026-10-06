import assert from 'node:assert/strict'
import { buildJpSnapshot } from './snapshot-jp-data.mjs'
import { validateRegionalSnapshot } from '../src/regional-data.js'

const servants = Array.from({ length: 401 }, (_, i) => ({
  id: i + 1, collectionNo: i + 1, name: 'JP ' + i, type: 'normal', className: 'saber',
  rarity: 5, cost: 16, traits: [{ id: 102 }], skills: [{ id: 900 + i, name: 'JP skill', skillSvts: [] }],
  ascensionAdd: { overwriteRarity: { ascension: { 4: 5 } } },
}))
const ces = Array.from({ length: 101 }, (_, i) => ({ id: 10000 + i, collectionNo: i + 1, name: 'JP CE ' + i, cost: 12, rarity: 5, skills: [] }))
const quest = (id, type, warId, name = 'Quest ' + id) => ({ id, phase: 1, type, warId, name,
  bond: 10000, openedAt: 1, closedAt: 2145888000, consume: 40, afterClear: type === 'main' ? 'close' : 'repeatLast' })
const event = { id: 9001, type: 'eventQuest', name: 'JP current event', warIds: [701], startedAt: 1, endedAt: Date.now() / 1000 + 86400 }
const calls = []
const exports = {
  nice_servant: servants, basic_servant: servants, nice_equip: ces,
  nice_event: [event], basic_event: [event], basic_war: [{ id: 700, name: 'カルデアゲート' }],
}
async function pull(path) {
  calls.push(path)
  assert.ok(path.includes('/JP/'), 'every private read must target JP: ' + path)
  const file = path.match(/\/export\/JP\/(.+)\.json$/)?.[1]
  if (file) return exports[file]
  if (path.includes('type=free')) return [quest(1, 'free', 1)]
  if (path.includes('type=main')) return [quest(2, 'main', 1), quest(5, 'main', 1, 'Zero bond scene')]
  if (path.includes('warId=701')) return [quest(4, 'event', 701)]
  if (path.includes('warId=700')) return [{ ...quest(3, 'daily', 700, '剣の修練場'), warLongName: 'カルデアゲート' }]
  const raw = path.match(/\/raw\/JP\/quest\/(\d+)\/(\d+)$/)
  assert.ok(raw, 'unexpected read: ' + path)
  const id = Number(raw[1])
  return { mstQuestPhase: { questId: id, phase: Number(raw[2]), friendshipExp: id === 5 ? 0 : 800 + id } }
}
const enrichFormPassives = async (rows, region) => { assert.equal(region, 'JP'); return rows }
const first = await buildJpSnapshot({ pull, enrichFormPassives })
assert.equal(validateRegionalSnapshot(first, 'JP').ok, true)
assert.equal(first.servants.length, 401)
assert.equal(first.ces.length, 101)
assert.equal(first.quests.length, 4)
assert.ok(first.quests.every(q => q.bond === 800 + q.id && q.region === 'JP'))
assert.equal(first.quests.find(q => q.id === 4).eventId, 9001)
assert.equal(first.questBrowserIndex.region, 'JP')
assert.equal(first.questBrowserIndex.quests[2].afterClear, 'close')
assert.equal(first.servants[0].abilities[0].name, 'JP skill')
assert.equal(first.servants[0].forms.find(f => f.key === 'a4').rarity, 5)
assert.equal(first.bondBonuses.region, 'JP')
assert.ok(calls.some(c => c.includes('warId=700')))
calls.length = 0
const second = await buildJpSnapshot({ pull, enrichFormPassives, previous: first })
assert.equal(second.version.dataVersion, first.version.dataVersion)
assert.equal(second.version.updatedAt, first.version.updatedAt)
assert.ok(!calls.some(c => c === '/raw/JP/quest/1/1'), 'verified JP ordinary bonds may be reused')
assert.ok(calls.includes('/raw/JP/quest/4/1'), 'event bonds must refresh')
await assert.rejects(buildJpSnapshot({ pull: async path => path === '/export/JP/nice_equip.json' ? [] : pull(path), enrichFormPassives }), /JP export missing/)
console.log('JP snapshot: independent sources, forms, CEs, events, raw bond including zero scenes, cache and fail-closed refresh passed')
