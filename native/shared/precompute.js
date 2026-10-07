import { buildSolverIndex, validateSolverIndex } from '../../src/solver/solver-index.js'
import { buildCombinationFactors } from '../../src/solver/combination-factors.js'
import { servantBondForms } from '../../src/recommend.js'
import { ceHasBondGain } from '../../src/game-data.js'
import { validateRegionalSnapshot } from '../../src/regional-data.js'
export function precomputeRegion(bundle, region) {
  const check = validateRegionalSnapshot(bundle, region)
  if (!check.ok) throw new Error(`${region} 数据校验失败：${check.errors.join('、')}`)
  const { servants, ces, quests, version } = bundle
  const baseVersion = { ...version, dataVersion: version.baseDataVersion || version.dataVersion }
  const solverIndex = buildSolverIndex({ servants, ces, quests: quests.filter(q => !q.eventId), version: baseVersion, formsOf: servantBondForms })
  const valid = validateSolverIndex(solverIndex, { servants, ces, version: baseVersion, formsOf: servantBondForms })
  if (!valid.ok) throw new Error(`${region} 索引校验失败：${valid.errors.join('、')}`)
  const factorIndex = buildCombinationFactors({ servants, ces: ces.filter(ceHasBondGain), formsOf: servantBondForms, version })
  return { solverIndex, factorIndex, servants: servants.length, forms: solverIndex.formCount, ces: ces.length }
}
export function regionCacheKey(bundle, region) {
  return `native1:${region}:${bundle.version?.baseDataVersion || bundle.version?.dataVersion || ''}`
}
