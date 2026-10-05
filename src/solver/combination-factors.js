import { ceMilliLive } from './solver-index.js'
import { activityEffectKey } from './activity-template.js'
import { RULE_VERSION } from '../rules/versions.js'

export const COMBINATION_FACTOR_VERSION = 1

// A product grammar, not a list of top teams. No identity is discarded when
// equal effect vectors are interned. Restrictions apply before expansion.
export function buildCombinationFactors({ servants, ces, formsOf, version = {} }) {
  const vectors = [], vectorByKey = new Map(), members = []
  for (const svt of servants) {
    for (const form of formsOf(svt)) {
      const rates = ces.map(ce => [true, false].flatMap(mlb =>
        [false, true].map(support => ceMilliLive(ce, form, support, mlb))))
      const key = JSON.stringify(rates)
      if (!vectorByKey.has(key)) { vectorByKey.set(key, vectors.length); vectors.push(rates) }
      members.push({ svt: svt.id, art: form.key, cost: form.cost ?? svt.cost,
        className: svt.className, rarity: form.rarity ?? svt.rarity,
        attribute: form.attribute || svt.attribute, traits: form.traitIds || [],
        effect: vectorByKey.get(key) })
    }
  }
  return { version: COMBINATION_FACTOR_VERSION, ruleVersion: RULE_VERSION,
    baseDataVersion: version.baseDataVersion || version.dataVersion || '',
    coverage: 'lossless-factor-domain', resultCoverage: 'requires-exact-expansion',
    grammar: { ownPositions: [1, 2, 3, 4, 5, 6], emptyAllowed: true,
      distinctServantIds: true, oneFormPerServant: true,
      ceStates: ['empty', 'unmlb', 'mlb'], ownCeInventory: 'query-input',
      support: 'query-input', accountBondState: 'query-input',
      grandAndNonBondEquipment: 'live-catalog-fallback' },
    ces: ces.map(ce => ce.id), vectors, members }
}

export function buildFactorActivities({ activityScores, templates = {}, baseDataVersion }) {
  const scenarios = [], byQuest = {}, seen = new Map()
  for (const [quest, bonuses] of Object.entries(activityScores.byQuest || {})) {
    const key = activityEffectKey(bonuses)
    if (!seen.has(key)) {
      seen.set(key, scenarios.length)
      scenarios.push({ template: templates[quest] || '', effects: JSON.parse(key) })
    }
    byQuest[quest] = seen.get(key)
  }
  return { version: COMBINATION_FACTOR_VERSION, ruleVersion: RULE_VERSION,
    baseDataVersion, activityState: activityScores.activityState, scenarios, byQuest }
}

export function factorsMatch(factors, version) {
  return factors?.version === COMBINATION_FACTOR_VERSION && factors.ruleVersion === RULE_VERSION &&
    factors.baseDataVersion === (version?.baseDataVersion || version?.dataVersion)
}

export function projectFactorMembers(factors, { servants, accepts = () => true, mode, account }) {
  const byId = new Map(servants.map(svt => [svt.id, svt]))
  const owned = new Set((account?.servantsOwned || account?.servants || []).map(rec => Number(rec.id)))
  const members = factors.members.filter(member => byId.has(member.svt) &&
    (mode !== 'account' || account?.virtual || owned.has(member.svt)) && accepts(member, byId.get(member.svt)))
  const allowed = new Map()
  for (const member of members) {
    if (!allowed.has(member.svt)) allowed.set(member.svt, new Set())
    allowed.get(member.svt).add(member.art)
  }
  return { members, servants: servants.filter(svt => allowed.has(svt.id)).map(svt =>
    ({ ...svt, solverFactorForms: [...allowed.get(svt.id)] })) }
}
