import { buildSolverIndex, validateSolverIndex } from '../../src/solver/solver-index.js'
import { buildCombinationFactors } from '../../src/solver/combination-factors.js'
import { servantBondForms } from '../../src/recommend.js'
import { ceHasBondGain } from '../../src/game-data.js'
import { validateRegionalSnapshot } from '../../src/regional-data.js'
import { buildJoinedEffectIndex, jointInputSignature } from '../../src/solver/joined-effects.js'
import { formUnlocked } from '../../src/recommend.js'
import { digest } from './manifest.js'
import { buildFormationDomain } from '../../src/solver/formation-domain.js'
export function precomputeRegion(bundle, region, { base = null, previousJoint = null, now = Date.now() } = {}) {
  const check = validateRegionalSnapshot(bundle, region)
  if (!check.ok) throw new Error(`${region} 数据校验失败：${check.errors.join('、')}`)
  const { servants, ces, quests, version } = bundle
  const baseVersion = { ...version, dataVersion: version.baseDataVersion || version.dataVersion }
  const solverIndex = base?.solverIndex || buildSolverIndex({ servants, ces, quests: quests.filter(q => !q.eventId), version: baseVersion, formsOf: servantBondForms })
  const valid = validateSolverIndex(solverIndex, { servants, ces, version: baseVersion, formsOf: servantBondForms })
  if (!valid.ok) throw new Error(`${region} 索引校验失败：${valid.errors.join('、')}`)
  const factorIndex = base?.factorIndex || buildCombinationFactors({ servants, ces: ces.filter(ceHasBondGain), formsOf: servantBondForms, version })
  factorIndex.region = region
  const joinedEffectIndex = buildJoinedEffectIndex({ bundle, factorIndex, region, now, previous: previousJoint })
  let formationDomain = null, formationError = ''
  try { formationDomain = buildFormationDomain(bundle, { now, factorIndex, activityScores: joinedEffectIndex.activityScores }) }
  catch (error) { formationError = error.message }
  return { solverIndex, factorIndex, joinedEffectIndex, formationDomain, formationError, servants: servants.length, forms: solverIndex.formCount, ces: ces.length }
}
export function baseCacheKey(bundle, region) {
  return `native3-base:${region}:${bundle.version?.baseDataVersion || bundle.version?.dataVersion || ''}`
}
export async function regionCacheKey(bundle, region, now = Date.now()) {
  return `native6-joint:${region}:${await digest(new TextEncoder().encode(jointInputSignature(bundle, region, now)))}`
}
export async function accountProjectionKey(publicKey, profile) {
  return `native3-account:${publicKey}:${profile.id}:${await digest(new TextEncoder().encode(JSON.stringify(profile.account)))}`
}
export function projectAccountDomain(computed, bundle, profile) {
  if (profile.region !== bundle.region || profile.account.region !== bundle.region) throw Error('账号投影区服不一致。')
  const owned = new Map(profile.account.servants.map(r => [Number(r.id), r]))
  const byId = new Map(bundle.servants.map(r => [Number(r.id), r]))
  const forms = new Map()
  const members = []
  computed.factorIndex.members.forEach((m, i) => {
    const rec = owned.get(m.svt), svt = byId.get(m.svt)
    if (!rec || !svt) return
    if (!forms.has(m.svt)) forms.set(m.svt, servantBondForms(svt))
    const form = forms.get(m.svt).find(f => f.key === m.art)
    if (form && formUnlocked(form, rec, 'account')) members.push(i)
  })
  return { accountId: profile.id, region: profile.region, accountSignature: JSON.stringify(profile.account),
    inputSignature: computed.joinedEffectIndex.inputSignature, members,
    ceInventory: profile.account.ces, coverage: 'account-factor-projection', resultCoverage: 'requires-constrained-exact-search' }
}
