import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { compactPlan, emptySolutionIndex, queryKeyOf, TOP_N } from '../src/solver/solution-index.js'
import { resolveCurrentActivity } from '../src/rules/index.js'
import { recommendTeam } from '../src/recommend.js'

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

function pickTrain(questClass) {
  const list = (quests || []).filter(
    (quest) => quest.kind === 'train' && quest.questClass === questClass && Number(quest.bond) > 0,
  )
  list.sort((a, b) => (Number(b.bond) || 0) - (Number(a.bond) || 0))
  return list[0] || null
}

const jobs = []
if (!skipHeavy) {
  for (const questClass of trainClasses) {
    const quest = pickTrain(questClass)
    if (!quest) continue
    jobs.push({ quest, questClass, questType: 'normal', teapot: false })
  }
}

const index = emptySolutionIndex()
index.activityState = resolved.activityState
index.topN = TOP_N

for (const job of jobs) {
  const rec = recommendTeam({
    base: Number(job.quest.bond) || 815,
    teapot: job.teapot,
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
    teapot: job.teapot,
    allowSupport: true,
    activityState: resolved.activityState,
  }
  const plans = (rec.plans || [rec]).slice(0, TOP_N).map((plan) => compactPlan(plan, extra))
  queries.push({
    key: queryKeyOf(extra),
    questId: extra.questId,
    questClass: extra.questClass,
    teapot: extra.teapot,
    plans,
  })
}

index.queries = queries
await mkdir('generated', { recursive: true })
await writeFile('generated/solution-index.json', JSON.stringify(index) + '\n')
console.log(`solution-index queries ${queries.length} topN ${TOP_N} light=${skipHeavy ? 1 : 0}`)
