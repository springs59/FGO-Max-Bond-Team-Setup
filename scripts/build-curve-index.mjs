import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { writeIfChanged } from './write-if-changed.mjs'
import { isPlayableServant, ceHasBondGain } from '../src/game-data.js'
import { servantBondForms, hydrateSolutionHits } from '../src/recommend.js'
import { buildCombinationFactors, buildFactorActivities } from '../src/solver/combination-factors.js'
import { compileBondCurve, curveKey, BOND_CURVE_VERSION } from '../src/solver/bond-curve.js'
import { activityEffectKey, activityTemplateOf } from '../src/solver/activity-template.js'
import { liveBondBonusCatalog } from '../src/bond/bonus.js'
import { RULE_VERSION } from '../src/rules/versions.js'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const [servants, ces, quests, version, bonuses, activity, solutions] = await Promise.all([
  read('src/data/servants.json'), read('src/data/ces.json'), read('src/data/quests.json'),
  read('src/data/version.json'), read('src/data/bond-bonuses.json'),
  read('generated/activity-score-index.json'), read('generated/solution-index.json'),
])
const factors = buildCombinationFactors({ servants: servants.filter(isPlayableServant),
  ces: ces.filter(ceHasBondGain), formsOf: servantBondForms, version })
const codePaths = ['src/bond.js', 'src/atlas.js', 'src/recommend.js', 'src/bond/bonus.js',
  'src/solver/bond-curve.js', 'src/solver/combination-factors.js']
const rulesDigest = createHash('sha256').update((await Promise.all(codePaths.map(path => readFile(path)))).join('\n')).digest('hex')
factors.rulesDigest = rulesDigest
const templates = Object.fromEntries(quests.map(quest => [
  `${quest.id}:${quest.phase || 1}`, activityTemplateOf(liveBondBonusCatalog(bonuses, quest)),
]))
const factorActivity = buildFactorActivities({ activityScores: activity, templates,
  baseDataVersion: factors.baseDataVersion })
const bank = { version: BOND_CURVE_VERSION, ruleVersion: RULE_VERSION, rulesDigest,
  baseDataVersion: factors.baseDataVersion, activityState: activity.activityState,
  coverage: 'candidate-only', curves: [], scenarios: [] }
const curveIds = new Map(), scenarioMap = new Map()
for (const row of solutions.queries) {
  const quest = quests.find(q => q.id === row.questId && (q.phase || 1) === row.questPhase)
  if (!quest) throw new Error(`missing curve quest ${row.questId}`)
  const effectKey = activityEffectKey(activity.byQuest[`${quest.id}:${quest.phase || 1}`] || {})
  const key = JSON.stringify([row.questType, row.questClass, true, effectKey])
  if (!scenarioMap.has(key)) {
    const scenario = { key, template: row.template, questType: row.questType,
      questClass: row.questClass, allowSupport: true, effectKey,
      coverage: 'candidate-only', candidates: [] }
    scenarioMap.set(key, { scenario, seen: new Set() }); bank.scenarios.push(scenario)
  }
  const { scenario, seen } = scenarioMap.get(key)
  for (const compact of row.plans) {
    const body = JSON.stringify(compact.slots)
    if (seen.has(body)) continue
    seen.add(body)
    const [plan] = hydrateSolutionHits([compact], { servants, ces, base: 0,
      bondBonuses: bonuses, quest, allowSupport: true, bond15Aura: true })
    if (!plan) throw new Error(`invalid curve plan ${row.questId}`)
    const curve = compileBondCurve(plan.slots)
    const signature = curveKey(curve)
    if (!curveIds.has(signature)) { curveIds.set(signature, bank.curves.length); bank.curves.push(curve) }
    scenario.candidates.push({ plan: compact, curveId: curveIds.get(signature),
      conditions: { questType: row.questType, allowSupport: true,
        account: 'recompile-bond-and-ce-states', activityEffectKey: effectKey } })
  }
}
await writeIfChanged('generated/combination-factors.json', JSON.stringify(factors) + '\n')
await writeIfChanged('generated/factor-activities.json', JSON.stringify(factorActivity) + '\n')
await writeIfChanged('generated/curve-index.json', JSON.stringify(bank) + '\n')
console.log(`curve index: ${factors.members.length} identity/forms, ${factors.vectors.length} effect vectors, ${bank.curves.length} curves, ${bank.scenarios.length} scenarios; candidate results require exact search`)
