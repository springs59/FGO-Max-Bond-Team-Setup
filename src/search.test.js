import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyAliases } from './game-data.js'
import { loadCes, searchByName, searchServantForms } from './atlas.js'
import { matchedAlias } from './search.js'

const read = name => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8'))
const servants = applyAliases(read('servants'), read('aliases'))
const ces = applyAliases(read('ces'), read('ce-aliases'))
for (const query of ['C呆', 'c呆', 'Ｃ呆', 'C 呆', '术 C呆']) {
  const hits = searchServantForms(servants, query)
  assert.equal(hits[0].collectionNo, 284, query)
  assert.equal(matchedAlias(hits[0], query).toLowerCase(), 'c呆')
}
assert.equal(searchServantForms(servants, 'cba')[0].collectionNo, 215)
assert.equal(searchServantForms(servants, 'ＲＢＡ')[0].collectionNo, 357)
const costume = searchServantForms(servants, '棉被 风王')[0]
assert.equal(costume.collectionNo, 2)
assert.equal(costume.formLabel, '风王结界')
assert.equal(searchServantForms(servants, '284')[0].collectionNo, 284)
assert.equal(searchServantForms(servants, '术 黑呆').length, 0)
assert.equal(searchByName(ces, '黑杯')[0].collectionNo, 48)
assert.equal(matchedAlias(searchByName(ces, '黑杯')[0], '黑杯'), '黑杯')
assert.equal(searchByName(ces, '小蒙娜')[0].collectionNo, 988)
assert.equal(searchByName(ces, '贝拉丽莎')[0].collectionNo, 988)
assert.deepEqual(searchByName(ces, '宝石翁').map(x => x.collectionNo).sort((a,b) => a-b), [34, 1458])
assert.equal(searchByName(ces, '新宝石翁')[0].collectionNo, 1458)
const rank = searchByName([
  { id: 1, name: 'A', aliases: ['黑杯衍生'] },
  { id: 2, name: 'B', aliases: ['黑杯'] },
], '黑杯')
assert.equal(rank[0].id, 2)
// Searches must not expand the inventory / filter pool supplied by the caller.
assert.equal(searchServantForms(servants.filter(x => x.collectionNo === 1), 'C呆').length, 0)
assert.equal(searchByName(ces.filter(x => x.collectionNo === 34), '新宝石').length, 0)
for (const [no, record] of Object.entries(read('ce-aliases'))) {
  assert.equal(ces.find(x => x.collectionNo === Number(no))?.name, record.name)
  assert.ok(record.aliases.length)
}
const jpCe = applyAliases([{ collectionNo: 48, name: '黒の聖杯' }], read('ce-aliases'))
assert.equal(searchByName(jpCe, '黑之圣杯').length, 1)
// Alias metadata never changes the data used to calculate cost or bonuses.
const raw = read('ces').find(x => x.collectionNo === 48)
const { aliases, ...decorated } = ces.find(x => x.collectionNo === 48)
assert.deepEqual(decorated, raw)
const previousFetch = globalThis.fetch
try {
  globalThis.fetch = async url => {
    const name = String(url).split('/').pop().split('?')[0]
    return { ok: ['ces.json', 'ce-aliases.json'].includes(name), json: async () => read(name.replace('.json','')) }
  }
  assert.equal(searchByName(await loadCes(), '黑杯')[0].collectionNo, 48)
  globalThis.fetch = async url => ({ ok: String(url).includes('ces.json'), json: async () => read('ces') })
  assert.equal((await loadCes()).length, read('ces').length)
} finally { globalThis.fetch = previousFetch }
console.log('Alias search: full width, spaces, multiword, forms, CE loading, ranking and inventory boundaries passed')
