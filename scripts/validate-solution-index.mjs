import { readFile } from 'node:fs/promises'
import { hydrateSolutionHits } from '../src/recommend.js'
import { resolveCurrentActivity } from '../src/rules/activity-rules.js'
import { SOLUTION_INDEX_VERSION, queryKeyOf } from '../src/solver/solution-index.js'
import { liveBondBonusCatalog } from '../src/bond/bonus.js'
import { activityTemplateOf, activityEffectKey } from '../src/solver/activity-template.js'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const [index, quests, servants, ces, bondBonuses, version, activity] = await Promise.all([
  read('generated/solution-index.json'), read('src/data/quests.json'), read('src/data/servants.json'),
  read('src/data/ces.json'), read('src/data/bond-bonuses.json'), read('src/data/version.json'),
  read('generated/activity-score-index.json'),
])
if (index.version !== SOLUTION_INDEX_VERSION ||
    (index.baseDataVersion || index.gameDataVersion) !== (version.baseDataVersion || version.dataVersion) ||
    index.activityState !== resolveCurrentActivity({ catalog: bondBonuses }).activityState) {
  throw new Error('solution index version or activity state is stale')
}
const seen = new Set()
const eventGroups = new Map()
let checked = 0
for (const row of index.queries || []) {
  const quest = quests.find(item => Number(item.id) === Number(row.questId) &&
    (Number(item.phase) || 1) === (Number(row.questPhase) || 1))
  if (!quest || Number(quest.bond) !== Number(row.base) || !row.plans?.length || seen.has(row.key)) {
    throw new Error(`invalid or duplicate query ${row.key}`)
  }
  seen.add(row.key)
  const live = liveBondBonusCatalog(bondBonuses, quest)
  const template = activityTemplateOf(live)
  if ((row.template || 'ordinary') !== template) throw new Error(`template mismatch ${row.key}`)
  const wasSkipped = (index.skippedEventQueries || []).some(item => item.questId === row.questId &&
    (Number(item.questPhase) || 1) === row.questPhase && Number(item.base) === row.base)
  if (Boolean(row.complete === false) !== wasSkipped) throw new Error(`completion marker mismatch ${row.key}`)
  if (Number(row.eventId)) {
    const signature = JSON.stringify([row.questType, row.questClass, template,
      activityEffectKey(activity.byQuest?.[`${row.questId}:${row.questPhase}`] || {})])
    if (!eventGroups.has(signature)) eventGroups.set(signature, [])
    eventGroups.get(signature).push({ row, quest })
  }
  if (row.key !== queryKeyOf({ questId: quest.id, questPhase: quest.phase, questClass: row.questClass,
    questType: row.questType, allowSupport: true, eventId: quest.eventId })) {
    throw new Error(`query key mismatch ${row.key}`)
  }
  const results = hydrateSolutionHits(row.plans, { servants, ces, base: row.base, teapot: false,
    bondBonuses, quest, bond15Aura: true, questType: row.questType,
    questClass: row.questClass, allowSupport: true })
  if (results.length !== row.plans.length) throw new Error(`cannot hydrate ${row.key}`)
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].total !== row.plans[i].score || results[i].costUsed !== row.plans[i].cost) {
      throw new Error(`precomputed score/cost differs from live settlement ${row.key} plan ${i}`)
    }
    checked += 1
  }
}
for (const group of eventGroups.values()) {
  if (group.length < 2) continue
  const candidates = [...new Map(group.flatMap(({ row }) => row.plans)
    .map(plan => [plan.planKey.split('#').slice(1).join('#'), plan])).values()]
  for (const { row, quest } of group) {
    const scores = hydrateSolutionHits(candidates, { servants, ces, base: row.base, teapot: false,
      bondBonuses, quest, bond15Aura: true, questType: row.questType,
      questClass: row.questClass, allowSupport: true })
    if (scores.some(plan => plan.total > row.plans[0].score)) {
      throw new Error(`equivalent quest candidate outranks published recommendation ${row.key}`)
    }
  }
}
console.log(`solution-index validated ${index.queries.length} queries and ${checked} plans`)
