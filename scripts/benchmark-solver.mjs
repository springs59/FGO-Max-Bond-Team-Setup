import { performance } from 'node:perf_hooks'
import { recommendTeam, servantBondForms } from '../src/recommend.js'
import { buildSolverIndex } from '../src/solver/index.js'

function svt(partial) {
  return {
    id: partial.id,
    collectionNo: partial.id,
    name: `svt${partial.id}`,
    className: 'saber',
    attribute: 'earth',
    face: '',
    traitIds: partial.traitIds || [],
    forms: [],
    cost: partial.cost != null ? partial.cost : 4,
    rarity: 3,
  }
}

function ce({ id, rate, cost = 5, traitId }) {
  const fn = {
    target: 'ptFull',
    rate,
    add: 0,
    eventId: 0,
    indiv: 0,
    applySupport: null,
    followerRate: rate,
    tvals: traitId ? [{ id: traitId, name: `t${traitId}` }] : [],
    andTvals: [],
  }
  return {
    id,
    collectionNo: id,
    name: `ce${id}`,
    rarity: 4,
    cost,
    face: '',
    skills: [
      { name: `ce${id}`, condLimitCount: 0, funcs: [{ ...fn, rate: Math.max(10, Math.floor(rate / 5)) }] },
      { name: `ce${id}`, condLimitCount: 4, funcs: [fn] },
    ],
  }
}

const servants = [
  svt({ id: 1, cost: 3, traitIds: [9001] }),
  svt({ id: 2, cost: 4, traitIds: [9001] }),
  svt({ id: 3, cost: 7, traitIds: [9002] }),
  svt({ id: 4, cost: 12, traitIds: [] }),
  svt({ id: 5, cost: 4, traitIds: [9002] }),
  svt({ id: 6, cost: 3, traitIds: [9001, 9002] }),
]
const ces = [
  ce({ id: 11, rate: 100, cost: 1 }),
  ce({ id: 12, rate: 200, cost: 5, traitId: 9001 }),
  ce({ id: 13, rate: 150, cost: 5, traitId: 9002 }),
  ce({ id: 14, rate: 50, cost: 3 }),
]

function time(label, fn) {
  const t0 = performance.now()
  const out = fn()
  const ms = Math.round(performance.now() - t0)
  return { label, ms, ok: Boolean(out && out.ok), total: out && out.total, nodes: out && out.solverStats && out.solverStats.nodes }
}

const rows = [
  time('free-support', () =>
    recommendTeam({ base: 815, servants, ces, mode: 'free', allowSupport: true }),
  ),
  time('free-no-support', () =>
    recommendTeam({ base: 815, servants, ces, mode: 'free', allowSupport: false }),
  ),
  time('cost-cap', () =>
    recommendTeam({ base: 815, servants, ces, mode: 'free', allowSupport: true, costLimit: 40 }),
  ),
]

for (const row of rows) {
  console.log(`${row.label}\t${row.ms}ms\tok=${row.ok}\ttotal=${row.total}\tnodes=${row.nodes}`)
}
if (rows.some((row) => !row.ok)) {
  process.exit(1)
}

const index = buildSolverIndex({ servants, ces, formsOf: servantBondForms })
const heap = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024)

function compare(label, opts) {
  const mem0 = heap()
  const t0 = performance.now()
  const out = recommendTeam(opts)
  const ms = Math.round(performance.now() - t0)
  return {
    label,
    ms,
    ok: Boolean(out && out.ok),
    total: out && out.total,
    nodes: out && out.solverStats && out.solverStats.nodes,
    indexMs: out && out.solverStats && out.solverStats.indexQueryMs,
    heapMb: heap() - mem0,
  }
}

const base = { base: 815, servants, ces, mode: 'free', allowSupport: true, questClass: 'saber' }
const coldLegacy = compare('cold-legacy-bnb', { ...base, solverAudit: { index: false } })
const coldIndex = compare('cold-index-lookup', { ...base, solverIndex: index })
const hotIndex = compare('hot-index-lookup', { ...base, solverIndex: index })
const extreme = compare('extreme-no-class', {
  base: 815,
  servants,
  ces,
  mode: 'free',
  allowSupport: true,
  solverIndex: index,
})

const extra = [coldLegacy, coldIndex, hotIndex, extreme]
for (const row of extra) {
  console.log(
    `${row.label}\t${row.ms}ms\tok=${row.ok}\ttotal=${row.total}\tnodes=${row.nodes}\tindexMs=${row.indexMs || 0}\theapΔ=${row.heapMb}MB`,
  )
}
if (extra.some((row) => !row.ok)) process.exit(1)
if (coldIndex.total !== coldLegacy.total) {
  console.error(`index total ${coldIndex.total} != legacy ${coldLegacy.total}`)
  process.exit(1)
}
