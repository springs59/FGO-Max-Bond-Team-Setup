import { writeIfChanged } from './write-if-changed.mjs'
import { mkdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { compactPlan, emptySolutionIndex, queryKeyOf, TOP_N } from '../src/solver/solution-index.js'
import { resolveCurrentActivity } from '../src/rules/index.js'
import { liveBondBonusCatalog } from '../src/bond/bonus.js'
import { recommendTeam } from '../src/recommend.js'
import { hydrateSolutionHits, paretoByCost } from '../src/recommend.js'
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
const eventTimeoutMs = Math.max(1000, Number(process.env.SOLUTION_INDEX_EVENT_TIMEOUT_MS) || 180000)
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
  if (!classFilter.length) {
    const now = resolved.now
    for (const quest of [...quests].sort((a, b) => Number(b.bond) - Number(a.bond))) {
      if (!Number(quest.eventId) || !Number(quest.bond) || questLimits(quest).questType !== 'normal') continue
      if ((Number(quest.openedAt) && now < Number(quest.openedAt)) ||
          (Number(quest.closedAt) && now > Number(quest.closedAt))) continue
      jobs.push({ quest, questClass: '', questType: 'normal', eventId: Number(quest.eventId) })
    }
  }
}

const index = emptySolutionIndex()
index.activityState = resolved.activityState
index.gameDataVersion = (await loadJson('src/data/version.json', {})).dataVersion || ''
index.baseDataVersion = (await loadJson('src/data/version.json', {})).baseDataVersion || index.gameDataVersion
index.baseFingerprint = (await loadJson('generated/manifest.json', {})).baseFingerprint || ''
index.topN = TOP_N
const solvedBases = new Map()
let reusedCount = 0
const skipped = []
const equivalentEventGroups = new Map()

function mapPlans(plans, extra) {
  return plans.map(plan => ({ ...plan, questId: extra.questId,
    planKey: `${extra.questId}#${plan.planKey.split('#').slice(1).join('#')}` }))
}

for (const job of jobs) {
  const started = Date.now()
  const live = liveBondBonusCatalog(bondBonuses, job.quest)
  const hasBonus = Boolean(live.extraPassives.length || live.questFriendships.length)
  const bonusSignature = hasBonus ? JSON.stringify([live.extraPassives, live.questFriendships]) : ''
  if (hasBonus) {
    const groupKey = `${job.questType}:unrestricted:${bonusSignature}`
    if (!equivalentEventGroups.has(groupKey)) equivalentEventGroups.set(groupKey, [])
    equivalentEventGroups.get(groupKey).push(job.quest)
  }
  const extra = {
    questId: job.quest.id,
    questPhase: job.quest.phase,
    questClass: '',
    questType: job.questType,
    teapot: false,
    allowSupport: true,
    eventId: job.eventId || 0,
  }
  const previous = (previousIndex?.version === index.version ||
    (!hasBonus && previousIndex?.version === 5)) &&
    (previousIndex.baseDataVersion || previousIndex.gameDataVersion) === index.baseDataVersion &&
    (!hasBonus || previousIndex.activityState === index.activityState) &&
    previousIndex.queries?.find((row) =>
      (previousIndex.version === index.version ? row.key === queryKeyOf(extra) :
        row.questClass === extra.questClass && row.questType === extra.questType &&
        Number(row.eventId) === Number(extra.eventId)) &&
      row.questId === job.quest.id && row.base === Number(job.quest.bond) && row.plans?.length)
  // Ordinary answers survive activity changes when no bonus applies. Event
  // answers can only be reused while the materialized activity state matches.
  if (previous) {
    queries.push({ ...previous, key: queryKeyOf(extra), questPhase: Number(job.quest.phase) || 1 })
    reusedCount += 1
    continue
  }
  const previousTimedOut = hasBonus && index.baseFingerprint &&
    previousIndex?.baseFingerprint === index.baseFingerprint &&
    (previousIndex?.baseDataVersion || previousIndex?.gameDataVersion) === index.baseDataVersion &&
    previousIndex?.activityState === index.activityState &&
    previousIndex?.skippedEventQueries?.some(row => row.questId === job.quest.id &&
      Number(row.questPhase) === (Number(job.quest.phase) || 1) && Number(row.base) === Number(job.quest.bond))
  if (previousTimedOut) {
    skipped.push({ questId: job.quest.id, questPhase: Number(job.quest.phase) || 1,
      base: Number(job.quest.bond) })
    continue
  }
  const key = `${job.quest.bond}:${job.questType}:unrestricted:${bonusSignature}`
  let rec = solvedBases.get(key)
  if (rec === undefined && hasBonus) {
    console.log(`solution-index solve event base ${job.quest.bond} ${job.quest.id}:${job.quest.phase || 1}`)
    const worker = spawnSync(process.execPath,
      ['scripts/solve-solution-job.mjs', String(job.quest.id), String(job.quest.phase || 1)],
      { encoding: 'utf8', timeout: eventTimeoutMs, maxBuffer: 16 * 1024 * 1024 })
    if (worker.error?.code === 'ETIMEDOUT') {
      rec = null
      console.log(`solution-index event time budget ${eventTimeoutMs}ms reached at base ${job.quest.bond}`)
    } else if (worker.error || worker.status !== 0) {
      throw new Error(`event precompute failed ${job.quest.id}: ${worker.error || worker.stderr}`)
    } else {
      rec = JSON.parse(worker.stdout)
    }
    solvedBases.set(key, rec)
  } else if (rec === undefined) {
    console.log(`solution-index solve base ${job.quest.bond} unrestricted`)
    rec = recommendTeam({
      base: Number(job.quest.bond), teapot: false, servants, ces, mode: 'free',
      allowSupport: true, questType: job.questType, questClass: '', quest: job.quest,
      bondBonuses, solverIndex, skipSolutionLookup: true,
    })
    solvedBases.set(key, rec)
  }
  if (rec === null) {
    skipped.push({ questId: job.quest.id, questPhase: Number(job.quest.phase) || 1, base: Number(job.quest.bond) })
    continue
  }
  if (!Array.isArray(rec) && !rec?.ok) throw new Error(`precompute failed: ${rec?.error || job.quest.id}`)
  const plans = Array.isArray(rec) ? mapPlans(rec, extra) :
    (rec.plans || [rec]).slice(0, TOP_N).map((plan) => compactPlan(plan, extra))
  queries.push({
    key: queryKeyOf(extra),
    questId: job.quest.id,
    questPhase: Number(job.quest.phase) || 1,
    base: Number(job.quest.bond),
    questClass: extra.questClass,
    questType: extra.questType,
    eventId: extra.eventId,
    plans,
  })
  console.log(`solution-index mapped ${job.eventId ? 'event' : job.questClass || 'vault'} ${job.quest.id}:${job.quest.phase || 1} base ${job.quest.bond} plans ${plans.length} ${Date.now() - started}ms`)
}

// A base-specific search can miss a plan found by another search with the
// same activity rules. Recalculate the shared candidates for each quest's own
// base before publishing a default recommendation.
for (const group of equivalentEventGroups.values()) {
  const groupKeys = new Set(group.map(quest => `${quest.id}:${Number(quest.phase) || 1}`))
  const rows = queries.filter(row => groupKeys.has(`${row.questId}:${row.questPhase}`))
  if (rows.length < 2) continue
  const candidates = [...new Map(rows.flatMap(row => row.plans)
    .map(plan => [plan.planKey.split('#').slice(1).join('#'), plan])).values()]
  for (const row of rows) {
    const quest = group.find(item => item.id === row.questId && (Number(item.phase) || 1) === row.questPhase)
    const rescored = hydrateSolutionHits(candidates, {
      servants, ces, base: row.base, teapot: false, bondBonuses, quest,
      bond15Aura: true, questType: row.questType, questClass: row.questClass, allowSupport: true,
    })
    const frontier = paretoByCost(rescored).slice(0, TOP_N)
    row.plans = frontier.map(plan => compactPlan(plan, {
      questId: row.questId, questPhase: row.questPhase, questClass: row.questClass,
      questType: row.questType, allowSupport: true, eventId: row.eventId,
    }))
  }
}

index.queries = queries
index.skippedEventQueries = skipped
if (resolveCurrentActivity({ catalog: bondBonuses }).activityState !== index.activityState) {
  throw new Error('activity changed during precomputation; retry with the new activity state')
}
await mkdir('generated', { recursive: true })
await writeIfChanged('generated/solution-index.json', JSON.stringify(index) + '\n')
console.log(`solution-index queries ${queries.length} skippedEvents=${skipped.length} reused=${reusedCount} topN ${TOP_N} light=${skipHeavy ? 1 : 0}`)
