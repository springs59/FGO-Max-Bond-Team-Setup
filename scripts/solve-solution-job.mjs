import { readFile } from 'node:fs/promises'
import { compactPlan, TOP_N } from '../src/solver/solution-index.js'
import { recommendTeam } from '../src/recommend.js'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const [questId, phase] = process.argv.slice(2).map(Number)
const [quests, servants, ces, bondBonuses, solverIndex] = await Promise.all([
  read('src/data/quests.json'), read('src/data/servants.json'), read('src/data/ces.json'),
  read('src/data/bond-bonuses.json'), read('src/data/solver-index.json'),
])
const quest = quests.find(item => Number(item.id) === questId && (Number(item.phase) || 1) === (phase || 1))
if (!quest) throw new Error(`unknown quest ${questId}:${phase}`)
const extra = { questId, questPhase: phase, questClass: '', questType: 'normal', allowSupport: true,
  eventId: Number(quest.eventId) || 0 }
const rec = recommendTeam({ base: Number(quest.bond), teapot: false, servants, ces, mode: 'free',
  allowSupport: true, questType: 'normal', questClass: '', quest,
  bondBonuses, solverIndex, skipSolutionLookup: true })
if (!rec?.ok) throw new Error(`precompute failed: ${rec?.error || questId}`)
process.stdout.write(JSON.stringify((rec.plans || [rec]).slice(0, TOP_N).map(plan => compactPlan(plan, extra))))
