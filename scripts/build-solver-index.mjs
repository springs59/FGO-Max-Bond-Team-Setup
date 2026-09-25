import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { servantBondForms } from '../src/recommend.js'
import {
  buildBonusIndex,
  buildCeIndex,
  buildQuestIndex,
  buildServantIndex,
  buildSolverIndex,
  buildSolverMeta,
  solverIndexPublishDecision,
  validateSolverIndex,
} from '../src/solver/index.js'

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (fallback !== undefined) return fallback
    throw err
  }
}

const servants = await loadJson('src/data/servants.json')
const ces = await loadJson('src/data/ces.json', null) || await loadJson('src/data/bond-ces.json')
const quests = await loadJson('src/data/quests.json', [])
const bondBonuses = await loadJson('src/data/bond-bonuses.json', {
  extraPassives: [],
  questFriendships: [],
  events: [],
})
const version = await loadJson('src/data/version.json', null)

const t0 = performance.now()
const servantPart = buildServantIndex({ servants, formsOf: servantBondForms })
const cePart = buildCeIndex({ ces })
const questPart = buildQuestIndex({ quests })
const bonusPart = buildBonusIndex({ bondBonuses })
const index = buildSolverIndex({
  servants,
  ces,
  quests,
  bondBonuses,
  version,
  formsOf: servantBondForms,
})
const durationMs = Math.round(performance.now() - t0)

const check = validateSolverIndex(index, {
  servants,
  ces,
  version,
  formsOf: servantBondForms,
})
const decision = solverIndexPublishDecision(check)
if (!decision.publish) {
  console.error((decision.errors || check.errors || []).join('\n') || 'solver-index 校验失败，保留上一版')
  process.exit(1)
}

const checksum = createHash('sha256').update(JSON.stringify(index)).digest('hex')
const meta = buildSolverMeta({ index, durationMs, checksum })
meta.parts = {
  servants: servantPart.servants.length,
  forms: servantPart.formCount,
  ces: cePart.ces.length,
  quests: questPart.length,
  bonusSelf: Object.keys(bonusPart.selfBySvt).length,
  bonusParty: Object.keys(bonusPart.partyBySvt).length,
}

const dest = 'src/data/solver-index.json'
const metaDest = 'src/data/solver-meta.json'
await writeFile(`${dest}.tmp`, JSON.stringify(index) + '\n')
await writeFile(`${metaDest}.tmp`, JSON.stringify(meta, null, 2) + '\n')
await rename(`${dest}.tmp`, dest)
await rename(`${metaDest}.tmp`, metaDest)

console.log(
  `solver-index v${index.solverIndexVersion} ${index.servantCount} servants, ${index.formCount} forms, ${index.ceCount} ces, ${index.quests.length} quests, cond ${Object.keys(index.condHits || {}).length}, ${durationMs}ms`,
)
