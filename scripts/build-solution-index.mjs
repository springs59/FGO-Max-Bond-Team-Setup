import { writeIfChanged } from './write-if-changed.mjs'
import { mkdir, readFile } from 'node:fs/promises'
import { compactPlan, emptySolutionIndex, queryKeyOf, TOP_N } from '../src/solver/solution-index.js'
import { resolveCurrentActivity } from '../src/rules/index.js'
import { liveBondBonusCatalog } from '../src/bond/bonus.js'
import { recommendTeam } from '../src/recommend.js'
import { questKindOf, questLimits } from '../src/game-data.js'

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (fallback !== undefined) return fallback
    throw err
  }
}

const skipHeavy = process.env.SOLUTION_INDEX_LIGHT === '1'
const servants = await loadJson('src/data/servants.json', [])
const ces = await loadJson('src/data/ces.json', [])
const quests = await loadJson('src/data/quests.json', [])
const bondBonuses = await loadJson('src/data/bond-bonuses.json', {
  extraPassives: [],
  questFriendships: [],
  events: [],
})
const solverIndex = await loadJson('src/data/solver-index.json', null)
const previousIndex = await loadJson('generated/solution-index.json', null)
const resolved = resolveCurrentActivity({ catalog: bondBonuses })

const trainClasses = ['saber', 'archer', 'lancer', 'rider', 'caster', 'assassin', 'berserker']
const queries = []
const classFilter = (process.env.SOLUTION_INDEX_CLASSES || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const activeTrainClasses = classFilter.length ? trainClasses.filter((cls) => classFilter.includes(cls)) : trainClasses

function pickTrain(questClass) {
  const list = (quests || []).filter(
    (quest) => questKindOf(quest) === 'train' && questLimits(quest).questClass === questClass && Number(quest.bond) > 0,
  )
  list.sort((a, b) => (Number(b.bond) || 0) - (Number(a.bond) || 0))
  return list[0] || null
}

function pickVault() {
  const list = (quests || []).filter((quest) => questKindOf(quest) === 'vault' && Number(quest.bond) > 0)
  list.sort((a, b) => (Number(b.bond) || 0) - (Number(a.bond) || 0))
  return list[0] || null
}

const jobs = []
if (!skipHeavy) {
  for (const questClass of activeTrainClasses) {
    const quest = pickTrain(questClass)
    if (!quest) continue
    jobs.push({ quest, questClass, questType: 'normal', eventId: 0 })
  }
  const vault = pickVault()
  if (vault && !classFilter.length) jobs.push({ quest: vault, questClass: '', questType: 'normal', eventId: 0 })
}

const index = emptySolutionIndex()
index.activityState = resolved.activityState
index.gameDataVersion = (await loadJson('src/data/version.json', {})).dataVersion || ''
index.topN = TOP_N
const solvedBases = new Map()
let reusedCount = 0

for (const job of jobs) {
  const started = Date.now()
  const live = liveBondBonusCatalog(bondBonuses, job.quest)
  // A quest-specific campaign cannot share a generic answer. Its materialized
  // servant bonuses remain available through the solver index instead.
  if (live.extraPassives.length || live.questFriendships.length) continue
  const extra = {
    questId: job.quest.id,
    questClass: '',
    questType: job.questType,
    teapot: false,
    allowSupport: true,
    eventId: job.eventId || 0,
  }
  const previous = previousIndex?.version === index.version &&
    previousIndex.gameDataVersion === index.gameDataVersion &&
    previousIndex.queries?.find((row) => row.key === queryKeyOf(extra) &&
      row.questId === job.quest.id && row.base === Number(job.quest.bond) && row.plans?.length)
  // This builder only stores bonus-free ordinary quests. The activity state
  // can change without changing their inputs or the resulting optimal plans.
  if (previous) {
    queries.push(previous)
    reusedCount += 1
    continue
  }
  const key = `${job.quest.bond}:${job.questType}:unrestricted`
  let rec = solvedBases.get(key)
  if (!rec) {
    console.log(`solution-index solve base ${job.quest.bond} unrestricted`)
    rec = recommendTeam({
      base: Number(job.quest.bond), teapot: false, servants, ces, mode: 'free',
      allowSupport: true, questType: job.questType, questClass: '', quest: job.quest,
      bondBonuses, solverIndex, skipSolutionLookup: true,
    })
    solvedBases.set(key, rec)
  }
  if (!rec || !rec.ok) throw new Error(`precompute failed: ${rec?.error || job.quest.id}`)
  const plans = (rec.plans || [rec]).slice(0, TOP_N).map((plan) => compactPlan(plan, extra))
  queries.push({
    key: queryKeyOf(extra),
    questId: job.quest.id,
    base: Number(job.quest.bond),
    questClass: extra.questClass,
    questType: extra.questType,
    eventId: extra.eventId,
    plans,
  })
  console.log(`solution-index mapped ${job.questClass || 'vault'} base ${job.quest.bond} plans ${plans.length} ${Date.now() - started}ms`)
}

index.queries = queries
if (resolveCurrentActivity({ catalog: bondBonuses }).activityState !== index.activityState) {
  throw new Error('activity changed during precomputation; retry with the new activity state')
}
await mkdir('generated', { recursive: true })
await writeIfChanged('generated/solution-index.json', JSON.stringify(index) + '\n')
console.log(`solution-index queries ${queries.length} reused=${reusedCount} topN ${TOP_N} light=${skipHeavy ? 1 : 0}`)
