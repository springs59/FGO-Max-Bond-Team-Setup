import { readFile, writeFile } from 'node:fs/promises'
import {
  applyAliases,
  parseMooncellAliases,
  ceHasBondGain,
  slimCes,
  slimServants,
  snapshotQuests,
  mergeGrandQuests,
  mergeJpTraits,
  analyzeSnapshot,
  slimTraits,
} from '../src/game-data.js'
import { SCHEMA_VERSION } from '../src/data-layer.js'
import {
  optionalJpExport,
  pullJson,
  requireCnExport,
  snapshotPublishDecision,
} from '../src/snapshot-guard.js'

const ATLAS = 'https://api.atlasacademy.io'
const REGION = 'CN'
const MOONCELL =
  'https://fgo.wiki/index.php?title=%E5%BE%AE%E4%BB%B6:ServantsList/data&action=raw'

async function pull(path) {
  return pullJson(fetch, `${ATLAS}${path}`)
}

async function pullMooncellAliases() {
  const res = await fetch(MOONCELL)
  if (!res.ok) throw new Error(`mooncell ${res.status}`)
  return parseMooncellAliases(await res.text())
}

async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function loadList(path) {
  const value = await loadJson(path)
  return Array.isArray(value) ? value : []
}

const previousServants = await loadJson('src/data/servants.json')
const previousCes = await loadJson('src/data/ces.json')
const previous = previousServants && previousCes
  ? {
      servants: previousServants,
      ces: previousCes,
      version: await loadJson('src/data/version.json'),
      enemies: await loadList('src/data/enemies.json'),
      traits: await loadList('src/data/traits.json'),
      skills: await loadList('src/data/skills.json'),
      noblePhantasms: await loadList('src/data/noble-phantasms.json'),
    }
  : null

let aliasMap = {}
try {
  aliasMap = await pullMooncellAliases()
} catch (err) {
  console.warn('mooncell aliases skipped', err.message)
}

// basic_servant 含灵衣短名；形态特质需 nice.ascensionAdd.individuality，有则写入 forms.traitIds
const cnServants = slimServants(requireCnExport(await pull(`/export/${REGION}/basic_servant.json`)))
let jpServants = []
try {
  jpServants = slimServants(optionalJpExport(await pull(`/export/JP/basic_servant.json`)))
} catch (err) {
  console.warn('JP servants skipped', err.message)
}
const servants = applyAliases(mergeJpTraits(cnServants, jpServants), aliasMap)
const mashNice = await pull(`/nice/${REGION}/servant/1?lore=false`)
const mash = servants.find((item) => item.collectionNo === 1)
if (mash && mashNice) {
  mash.rarity = mashNice.rarity
  const paladin = new Set(['c800190', 'c800200'])
  const paladinTraits = (mash.traitIds || []).map((id) => (id === 201 ? 202 : id))
  if (!paladinTraits.includes(202)) paladinTraits.push(202)
  mash.forms = (mash.forms || []).map((form) =>
    paladin.has(form.key)
      ? { ...form, rarity: 5, cost: 16, attribute: 'human', traitIds: paladinTraits.slice() }
      : form,
  )
}

const equips = requireCnExport(await pull(`/export/${REGION}/nice_equip.json`))
const ces = slimCes(equips)
const bondCes = ces.filter(ceHasBondGain)

const free = await pull(`/basic/${REGION}/quest/phase/search?type=free`)
const dailyQuery = new URLSearchParams({ spotName: '每日任务' })
const daily = await pull(`/basic/${REGION}/quest/phase/search?${dailyQuery}`)
const quests = snapshotQuests([...(free || []), ...(daily || [])])
if (!quests.length) throw new Error('no quests')
const withGrand = mergeGrandQuests(quests)

const analysis = analyzeSnapshot(servants, ces, {
  region: REGION,
  jpServantCount: jpServants.length,
})
const traits = slimTraits(servants)
const version = {
  schemaVersion: SCHEMA_VERSION,
  dataVersion: analysis.dataVersion,
  sourceVersion: analysis.sourceVersion,
  updatedAt: analysis.updatedAt,
  region: REGION,
}
const candidate = {
  servants,
  ces,
  version,
  enemies: previous ? previous.enemies : [],
  traits,
  skills: previous ? previous.skills : [],
  noblePhantasms: previous ? previous.noblePhantasms : [],
}
const decision = snapshotPublishDecision({ previous, candidate })
if (!decision.ok) {
  console.error(decision.errors.join('\n'))
  throw new Error('snapshot 发布失败，保留上一版')
}
if (!bondCes.length) throw new Error('no bond ces')

if (Object.keys(aliasMap).length) {
  await writeFile('src/data/aliases.json', JSON.stringify(aliasMap) + '\n')
}
await writeFile('src/data/servants.json', JSON.stringify(servants) + '\n')
await writeFile('src/data/ces.json', JSON.stringify(ces) + '\n')
await writeFile('src/data/bond-ces.json', JSON.stringify(bondCes, null, 2) + '\n')
await writeFile('src/data/quests.json', JSON.stringify(withGrand) + '\n')
await writeFile('src/data/metadata.json', JSON.stringify(analysis, null, 2) + '\n')
await writeFile('src/data/traits.json', JSON.stringify(traits) + '\n')
await writeFile('src/data/version.json', JSON.stringify(version, null, 2) + '\n')
for (const name of ['enemies.json', 'skills.json', 'noble-phantasms.json']) {
  try {
    await writeFile(`src/data/${name}`, '[]\n', { flag: 'wx' })
  } catch {
    // keep existing expanded files
  }
}

console.log(
  `snapshot ${servants.length} servants, ${ces.length} ces (${bondCes.length} bond), ${withGrand.length} quests, jp ${jpServants.length}, living ${analysis.livingHuman}, traits ${traits.length}`,
)
