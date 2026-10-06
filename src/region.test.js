import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { catalogExtrasById, composeRegionCatalog, mergeCatalogById, questLimits } from './game-data.js'
import { normalizeRegion, parseAccountRegion, regionLabel, REGION_CN, REGION_JP } from './region.js'
import { regionalBundle, validateRegionalSnapshot } from './regional-data.js'
import { solverIndexCoversCatalog } from './solver/solver-index.js'
import { solverCacheKey } from './solver/cache.js'
import { recommendTeam } from './recommend.js'
import { loadImportedAccount, saveImportedAccount, clearImportedAccount, loadPlanner, savePlanner } from './user-data.js'
import { questCategory } from './ui/quest-browser.js'

assert.equal(normalizeRegion('jp'), REGION_JP)
assert.equal(normalizeRegion('JP'), REGION_JP)
assert.equal(normalizeRegion('cn'), REGION_CN)
assert.equal(normalizeRegion(''), REGION_CN)
assert.equal(normalizeRegion('na'), REGION_CN)
assert.equal(parseAccountRegion('jp'), REGION_JP)
assert.equal(parseAccountRegion('cn'), REGION_CN)
assert.equal(parseAccountRegion(''), '')
assert.equal(parseAccountRegion('na'), '')
assert.equal(regionLabel('JP'), '日服')
assert.equal(regionLabel('CN'), '国服')

const cnServant = { id: 1, name: '国服', cost: 12, forms: [{ key: 'a3', rarity: 4 }], abilities: [{ id: 11 }] }
const jpServant = { id: 1, name: '日服', cost: 0, forms: [{ key: 'a4', rarity: 5 }], abilities: [{ id: 12 }] }
const jpOnly = { id: 2, name: '日服新从者', cost: 16 }
const cn = { region: 'CN', version: { region: 'CN', questBondSource: 'mstQuestPhase.friendshipExp' },
  servants: [cnServant], ces: [{ id: 9, cost: 9 }], traits: [], quests: [{ id: 100, bond: 815, openedAt: 100 }],
  bondBonuses: { region: 'CN', events: [{ id: 7, startedAt: 100, endedAt: 200 }] } }
const jp = { ...cn, region: 'JP', version: { ...cn.version, region: 'JP' },
  servants: [jpServant, jpOnly], ces: [{ id: 9, cost: 12 }, { id: 10 }],
  quests: [{ id: 100, bond: 915, openedAt: 200 }],
  bondBonuses: { region: 'JP', events: [{ id: 7, startedAt: 200, endedAt: 300 }] } }
const catalogs = { CN: cn, JP: jp }
assert.deepEqual(catalogExtrasById(cn.servants, jp.servants), [jpOnly])
// Generic union still works, but it is never a server selection strategy.
assert.deepEqual(mergeCatalogById(cn.servants, jp.servants), [cnServant, jpOnly])
for (const [region, expected] of Object.entries(catalogs)) {
  const selected = composeRegionCatalog({ region, catalogs, servants: cn.servants, ces: cn.ces, quests: cn.quests })
  assert.equal(selected.available, true)
  assert.deepEqual(selected.servants, expected.servants)
  assert.deepEqual(selected.ces, expected.ces)
  assert.deepEqual(selected.quests, expected.quests)
  assert.equal(regionalBundle(catalogs, region), expected)
  assert.equal(validateRegionalSnapshot(expected, region).ok, true)
}
assert.equal(validateRegionalSnapshot({ ...jp, bondBonuses: cn.bondBonuses }, 'JP').ok, false)
assert.equal(regionalBundle({ JP: cn }, 'JP'), null)
const unavailable = composeRegionCatalog({ region: 'JP', servants: cn.servants, ces: cn.ces,
  quests: cn.quests, extras: { servants: [jpOnly] } })
assert.equal(unavailable.available, false)
assert.deepEqual(unavailable.servants, [])
assert.deepEqual(unavailable.ces, [])
assert.deepEqual(unavailable.quests, [])
assert.notEqual(solverCacheKey({ region: 'CN', gameDataVersion: 'same' }), solverCacheKey({ region: 'JP', gameDataVersion: 'same' }))
assert.equal(recommendTeam({ region: 'JP', mode: 'account', account: { region: 'CN' } }).ok, false)
assert.equal(recommendTeam({ region: 'JP', bondBonuses: cn.bondBonuses }).ok, false)
assert.equal(recommendTeam({ region: 'JP', quest: { region: 'CN' } }).ok, false)
assert.equal(recommendTeam({ region: 'JP', game: { version: { region: 'CN' } } }).ok, false)

const data = new Map()
const store = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
saveImportedAccount({ ok: true, region: 'CN', servants: [{ id: 1 }] }, 1000, store)
assert.equal(loadImportedAccount(1001, store, 'JP'), null)
saveImportedAccount({ ok: true, region: 'JP', servants: [{ id: 2 }] }, 1000, store)
assert.equal(loadImportedAccount(1001, store, 'CN').account.servants[0].id, 1)
assert.equal(loadImportedAccount(1001, store, 'JP').account.servants[0].id, 2)
savePlanner({ region: 'CN', lockIds: [1] }, store)
savePlanner({ region: 'JP', lockIds: [2] }, store)
assert.deepEqual(loadPlanner(store, 'CN').lockIds, [1])
assert.deepEqual(loadPlanner(store, 'JP').lockIds, [2])
clearImportedAccount(store)
assert.equal(loadImportedAccount(1001, store, 'CN'), null)
assert.equal(loadImportedAccount(1001, store, 'JP'), null)

assert.equal(questCategory({ name: '剣の修練場', war: 'カルデアゲート' }), 'daily')
assert.equal(questCategory({ name: '宝物庫の扉を開け', war: 'カルデアゲート' }), 'daily')
assert.equal(questCategory({ name: '冠位研鑽戦 セイバー', war: '冠位戴冠戦' }), 'grand')
assert.deepEqual(questLimits({ name: '剣の修練場' }), { questType: 'normal', questClass: 'saber' })
assert.deepEqual(questLimits({ name: '冠位研鑽戦 セイバー' }), { questType: 'grand', questClass: 'saber' })

const servants = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
const extras = JSON.parse(readFileSync(new URL('./data/jp-extra-servants.json', import.meta.url), 'utf8'))
const index = JSON.parse(readFileSync(new URL('./data/solver-index.json', import.meta.url), 'utf8'))
assert.equal(solverIndexCoversCatalog(index, servants), true)
assert.ok(extras.every(s => !servants.some(c => c.id === s.id)))
// Demonstrate that a CN precomputation cannot cover JP-only identities.
if (extras.length) assert.equal(solverIndexCoversCatalog(index, [...servants, ...extras]), false)
console.log('region: independent catalogs, same-ID forms, events, release roster, accounts, cache and JP quest categories passed')
