import { createHash } from 'node:crypto'
import { writeIfChanged, stableJson } from './write-if-changed.mjs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { enrichQuestBond } from './enrich-quest-bond.mjs'
import {
  mergeAliasBook,
  parseMooncellAliases,
  ceHasBondGain,
  slimCes,
  slimServants,
  snapshotQuests,
  mergeGrandQuests,
  liveLimitedEventWars,
  stampEventQuests,
  analyzeSnapshot,
  slimTraits,
  catalogExtrasById,
} from '../src/game-data.js'
import { SCHEMA_VERSION } from '../src/data-layer.js'
import {
  optionalJpExport,
  pullJson,
  requireCnExport,
  snapshotPublishDecision,
} from '../src/snapshot-guard.js'
import {
  bondBonusPublishDecision,
  buildBondBonusSnapshot,
  catalogOrEmpty,
} from '../src/bond/snapshot.js'

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
const previousBondBonuses = catalogOrEmpty(await loadJson('src/data/bond-bonuses.json'))
const previousEvents = await loadList('src/data/events.json')

let remoteAliases = {}
try {
  remoteAliases = await pullMooncellAliases()
} catch (err) {
  console.warn('mooncell aliases skipped', err.message)
}

const servantsNice = requireCnExport(await pull(`/export/${REGION}/nice_servant.json`))
const cnBasic = requireCnExport(await pull(`/export/${REGION}/basic_servant.json`))
const basicsById = new Map(cnBasic.map(row => [row.id, row]))
for (const row of servantsNice) {
  if (!Number.isInteger(row.cost) || row.cost < 0) throw new Error(`missing authoritative COST: ${row.id}`)
}
const cnServants = slimServants(servantsNice.map(row => ({ ...basicsById.get(row.id), ...row })))
let jpServants = []
let jpAvailable = false
try {
  const jpNice = optionalJpExport(await pull('/export/JP/nice_servant.json'))
  const jpBasic = new Map(optionalJpExport(await pull('/export/JP/basic_servant.json')).map(row => [row.id, row]))
  jpServants = slimServants(jpNice.map(row => ({ ...jpBasic.get(row.id), ...row })))
  jpAvailable = jpServants.length > 0
} catch (err) {
  console.warn('JP servants skipped', err.message)
}
const servants = cnServants
const jpExtraServants = jpAvailable
  ? catalogExtrasById(cnServants, jpServants)
  : await loadList('src/data/jp-extra-servants.json')

const equips = requireCnExport(await pull(`/export/${REGION}/nice_equip.json`))
const ces = slimCes(equips)
const bondCes = ces.filter(ceHasBondGain)

const free = await pull(`/basic/${REGION}/quest/phase/search?type=free`)
const dailyQuery = new URLSearchParams({ spotName: '每日任务' })
const daily = await pull(`/basic/${REGION}/quest/phase/search?${dailyQuery}`)
if (!(free || []).length && !(daily || []).length) throw new Error('no quests')

async function pullLimitedEventQuests(eventsNice) {
  const rows = liveLimitedEventWars(eventsNice)
  const out = []
  for (const row of rows) {
    const query = new URLSearchParams({ warId: String(row.warId) })
    const list = await pull(`/basic/${REGION}/quest/phase/search?${query}`)
    out.push(...stampEventQuests(list || [], row))
  }
  return out
}

let eventQuestRaw = []

const analysis = analyzeSnapshot(servants, ces, {
  region: REGION,
  jpServantCount: jpServants.length,
  jpExtraServantCount: jpExtraServants.length,
})
const traits = slimTraits(servants)
const version = {
  schemaVersion: SCHEMA_VERSION,
  questBondSource: 'mstQuestPhase.friendshipExp',
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

let bondBonuses = previousBondBonuses
let events = previousEvents.length ? previousEvents : previousBondBonuses.events
try {
  const basicEvents = await pull(`/export/${REGION}/basic_event.json`)
  const eventsNice = await pull(`/export/${REGION}/nice_event.json`)
  const niceEvents = requireCnExport(eventsNice)
  try {
    eventQuestRaw = await pullLimitedEventQuests(niceEvents)
  } catch (err) {
    throw new Error(`event quests snapshot failed: ${err.message}`)
  }
  const candidateBonuses = buildBondBonusSnapshot({
    servantsNice,
    eventsNice: niceEvents,
    basicEvents: Array.isArray(basicEvents) ? basicEvents : [],
  })
  const bonusDecision = bondBonusPublishDecision({
    previous: previousBondBonuses,
    candidate: candidateBonuses,
  })
  if (!bonusDecision.ok) {
    throw new Error(`bond bonuses snapshot rejected: ${bonusDecision.errors.join('; ')}`)
  } else {
    bondBonuses = candidateBonuses
    events = candidateBonuses.events
  }
} catch (err) {
  throw new Error(`snapshot 保留上一版：${err.message}`)
}

const rawQuests = [...(free || []), ...(daily || []), ...eventQuestRaw]
const enrichedQuests = await enrichQuestBond(rawQuests, async (id, phase) => {
  // Raw phase friendshipExp is the authoritative source. Basic phase search
  // incorrectly maps playerExp to bond, and nice details can 404 for old dailies.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = await pull(`/raw/${REGION}/quest/${id}/${phase}`)
      const row = raw?.mstQuestPhase
      return { id: row?.questId, phase: row?.phase, bond: row?.friendshipExp }
    }
    catch (err) { if (attempt === 2) throw err }
  }
})
const quests = snapshotQuests(enrichedQuests)
if (!quests.length) throw new Error('no quests')
const withGrand = mergeGrandQuests(quests)

const aliases = mergeAliasBook(await loadJson('src/data/aliases.json') || {}, remoteAliases, servants)
const staged = [
  ['aliases.json', JSON.stringify(aliases, null, 2) + '\n'],
  ['servants.json', JSON.stringify(servants) + '\n'],
  ['ces.json', JSON.stringify(ces) + '\n'],
  ['bond-ces.json', JSON.stringify(bondCes, null, 2) + '\n'],
  ['quests.json', JSON.stringify(withGrand) + '\n'],
  ['jp-extra-servants.json', JSON.stringify(jpExtraServants) + '\n'],
  ['jp-extra-ces.json', '[]\n'],
  ['jp-extra-quests.json', '[]\n'],
  ['traits.json', JSON.stringify(traits) + '\n'],
  ['bond-bonuses.json', JSON.stringify(bondBonuses, null, 2) + '\n'],
  ['events.json', JSON.stringify(events, null, 2) + '\n'],
]
// Volatile fetch timestamps live separately; versions describe content changes only.
const dataHash = createHash('sha256').update(JSON.stringify(staged.map(([name, text]) => [name, stableJson(JSON.parse(text))]))).digest('hex')
const oldStatus = await loadJson('generated/data-status.json')
const contentChanged = oldStatus?.dataHash !== dataHash || previous?.version?.questBondSource !== version.questBondSource
const checkedAt = new Date().toISOString()
if (contentChanged) {
  analysis.dataVersion = dataHash
  version.dataVersion = dataHash
  staged.push(['metadata.json', JSON.stringify(analysis, null, 2) + '\n'])
  staged.push(['version.json', JSON.stringify(version, null, 2) + '\n'])
}
for (const [name, text] of staged) await writeIfChanged(join('src/data', name), text)
await writeIfChanged('generated/data-status.json', JSON.stringify({
  checkedAt, fetchedAt: checkedAt, dataUpdatedAt: contentChanged ? checkedAt : oldStatus.dataUpdatedAt,
  dataHash, source: ATLAS, region: REGION, jpAvailable,
}, null, 2) + '\n')
for (const name of ['enemies.json', 'skills.json', 'noble-phantasms.json']) {
  try {
    await writeFile(`src/data/${name}`, '[]\n', { flag: 'wx' })
  } catch {
    // keep existing expanded files
  }
}

console.log(
  `snapshot ${servants.length} servants, ${ces.length} ces (${bondCes.length} bond), ${withGrand.length} quests, jp ${jpServants.length}, jp-extra ${jpExtraServants.length}, living ${analysis.livingHuman}, traits ${traits.length}, extraPassives ${bondBonuses.extraPassives.length}, questFriendships ${bondBonuses.questFriendships.length}, events ${events.length}`,
)
