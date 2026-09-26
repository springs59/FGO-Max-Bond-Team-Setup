import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { compactPlan, emptySolutionIndex, queryKeyOf, TOP_N } from '../src/solver/solution-index.js'
import { resolveCurrentActivity } from '../src/rules/index.js'
import { recommendTeam } from '../src/recommend.js'
import { questKindOf, questLimits } from '../src/game-data.js'
import { FAR_FUTURE } from '../src/bond/activity.js'

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
const resolved = resolveCurrentActivity({ catalog: bondBonuses })

const trainClasses = ['saber', 'archer', 'lancer', 'rider', 'caster', 'assassin', 'berserker']
const queries = []
const classFilter = (process.env.SOLUTION_INDEX_CLASSES || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const skipEventOverlay = process.env.SOLUTION_INDEX_EVENT !== '1'
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

function liveLimitedEventIds() {
  const ids = new Set()
  for (const rec of resolved.extraPassives || []) {
    const eventId = Number(rec.eventId) || 0
    const ended = Number(rec.endedAt) || 0
    if (!eventId || ended >= FAR_FUTURE) continue
    ids.add(eventId)
  }
  return [...ids]
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
  if (!skipEventOverlay) {
    for (const eventId of liveLimitedEventIds()) {
      for (const questClass of activeTrainClasses) {
        const quest = pickTrain(questClass)
        if (!quest) continue
        jobs.push({
          quest: { ...quest, eventId },
          questClass,
          questType: 'normal',
          eventId,
        })
      }
    }
  }
}

const index = emptySolutionIndex()
index.activityState = resolved.activityState
index.topN = TOP_N

for (const job of jobs) {
  const started = Date.now()
  console.log(`solution-index job ${job.questClass || 'vault'} event ${job.eventId || 0}`)
  const rec = recommendTeam({
    base: Number(job.quest.bond) || 815,
    teapot: false,
    servants,
    ces,
    mode: 'free',
    allowSupport: true,
    questType: job.questType,
    questClass: job.questClass,
    quest: job.quest,
    bondBonuses,
    solverIndex,
    skipSolutionLookup: true,
  })
  if (!rec || !rec.ok) continue
  const extra = {
    questId: job.quest.id,
    questClass: job.questClass,
    questType: job.questType,
    teapot: false,
    allowSupport: true,
    eventId: job.eventId || 0,
  }
  const plans = (rec.plans || [rec]).slice(0, TOP_N).map((plan) => compactPlan(plan, extra))
  queries.push({
    key: queryKeyOf(extra),
    questClass: extra.questClass,
    questType: extra.questType,
    eventId: extra.eventId,
    plans,
  })
  console.log(`solution-index job done ${extra.questClass || 'vault'} event ${extra.eventId} plans ${plans.length} ${Date.now() - started}ms`)
}

index.queries = queries
await mkdir('generated', { recursive: true })
await writeFile('generated/solution-index.json', JSON.stringify(index) + '\n')
console.log(`solution-index queries ${queries.length} topN ${TOP_N} light=${skipHeavy ? 1 : 0}`)
