import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyAliasDisplayNames, catalogExtrasById, composeRegionCatalog, mergeCatalogById } from './game-data.js'
import { normalizeRegion, parseAccountRegion, regionLabel, REGION_CN, REGION_JP } from './region.js'
import { solverIndexCoversCatalog } from './solver/solver-index.js'

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

{
  const base = [{ id: 1, name: 'cn' }]
  const extra = [{ id: 1, name: 'jp-overlap' }, { id: 2, name: 'jp-only' }]
  assert.deepEqual(catalogExtrasById(base, extra), [{ id: 2, name: 'jp-only' }])
  assert.deepEqual(mergeCatalogById(base, extra), [
    { id: 1, name: 'cn' },
    { id: 2, name: 'jp-only' },
  ])
  const cn = composeRegionCatalog({ region: 'CN', servants: base, ces: [{ id: 9 }], quests: [], extras: { servants: extra } })
  assert.equal(cn.region, 'CN')
  assert.equal(cn.servants.length, 1)
  const jp = composeRegionCatalog({
    region: 'JP',
    servants: base,
    ces: [{ id: 9 }],
    quests: [],
    extras: { servants: extra, ces: [{ id: 10 }] },
  })
  assert.equal(jp.region, 'JP')
  assert.equal(jp.servants.length, 2)
  assert.equal(jp.ces.length, 2)
}

{
  const servants = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const extras = JSON.parse(readFileSync(new URL('./data/jp-extra-servants.json', import.meta.url), 'utf8'))
  assert.equal(extras.length > 0, true)
  const cn = composeRegionCatalog({ region: 'CN', servants, extras: { servants: extras } })
  const jp = composeRegionCatalog({ region: 'JP', servants, extras: { servants: extras } })
  assert.equal(cn.servants.length, servants.length)
  assert.equal(jp.servants.length, servants.length + extras.length)
  assert.equal(cn.servants.some((svt) => svt.id === 605100), false)
  assert.equal(jp.servants.some((svt) => svt.id === 605100), true)
  const labeled = applyAliasDisplayNames(extras, JSON.parse(readFileSync(new URL('./data/aliases.json', import.meta.url), 'utf8')))
  const gensai = labeled.find((svt) => svt.id === 605100)
  assert.equal(gensai.name, '剑心')
  const index = JSON.parse(readFileSync(new URL('./data/solver-index.json', import.meta.url), 'utf8'))
  assert.equal(solverIndexCoversCatalog(index, cn.servants), true)
  assert.equal(solverIndexCoversCatalog(index, jp.servants), false)
}

console.log('region tests passed')
