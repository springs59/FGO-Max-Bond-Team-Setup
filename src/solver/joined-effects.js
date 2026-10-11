import { buildActivityScoreIndex } from './activity-score-index.js'
import { activityEffectKey, activityTemplateOf } from './activity-template.js'
import { liveBondBonusCatalog } from '../bond/bonus.js'
import { resolveCurrentActivity, liveExtraPassives, liveQuestFriendships } from '../rules/activity-rules.js'
import { RULE_VERSION } from '../rules/versions.js'

export const JOINED_EFFECT_VERSION = 2
export const joinedQuestKey = q => `${Number(q?.id) || 0}:${Number(q?.phase) || 1}`
export function jointRuleKey(q = {}) {
  return JSON.stringify([q.type || '', q.questClass || '', q.flags || [], q.restrictions || [], q.supportServants || [],
    q.npcSupportCount || 0, !!q.partyMetadataComplete, !!q.noSupport, q.supportPolicy || '',
    !!q.partyMetadataDetailed, q.partyScript || null, !!q.isNpcOnly])
}
function open(q, now) { const t = Math.floor(now / 1000); return !(q.openedAt > t || q.closedAt && t > q.closedAt) }
export function jointInputSignature(bundle, region, now = Date.now()) {
  return JSON.stringify([JOINED_EFFECT_VERSION, RULE_VERSION, region,
    bundle.version?.baseDataVersion || bundle.version?.dataVersion || '',
    liveExtraPassives(bundle.bondBonuses, now), liveQuestFriendships(bundle.bondBonuses, now), resolveCurrentActivity({ catalog: bundle.bondBonuses, now }).activityState,
    (bundle.quests || []).filter(q => open(q, now)).map(q => [joinedQuestKey(q), jointRuleKey(q), Number(q.eventId || q.event_id) || 0])])
}
// Update-time union of identity/form CE vectors and applicable activity effects.
// All member indices are retained. These are factors, never a top-team list.
export function buildJoinedEffectIndex({ bundle, factorIndex, region = bundle.region, now = Date.now(), previous = null }) {
  const inputSignature = jointInputSignature(bundle, region, now)
  if (previous?.inputSignature === inputSignature) return previous
  const activityScores = buildActivityScoreIndex({ quests: bundle.quests, servants: bundle.servants, bondBonuses: bundle.bondBonuses, now })
  const scenarios = [], byQuest = {}, questRules = {}, questEvents = {}, seen = new Map()
  let reused = 0
  const previousScenarios = new Map((previous?.scenarios || []).map(s => [s.key, s]))
  for (const q of bundle.quests.filter(q => open(q, now))) {
    const id = joinedQuestKey(q), scores = activityScores.byQuest[id] || {}, rule = jointRuleKey(q)
    const key = JSON.stringify([factorIndex.baseDataVersion, rule, activityEffectKey(scores)])
    if (!seen.has(key)) {
      let scenario = previousScenarios.get(key)
      if (scenario) reused++
      else {
        const groups = new Map()
        factorIndex.members.forEach((member, i) => {
          const bonus = scores[member.svt] || {}
          const tuple = [member.effect, Math.round((bonus.totalSecondLayer || 0) * 1000), Math.round((bonus.party || 0) * 1000), bonus.partyApplySupport === 0 ? 0 : 1]
          const sig = JSON.stringify(tuple)
          if (!groups.has(sig)) groups.set(sig, { effect: tuple, members: [] })
          groups.get(sig).members.push(i)
        })
        scenario = { key, template: activityTemplateOf(liveBondBonusCatalog(bundle.bondBonuses, q, now)), groups: [...groups.values()] }
      }
      seen.set(key, scenarios.length); scenarios.push(scenario)
    }
    byQuest[id] = seen.get(key); questRules[id] = rule; questEvents[id] = Number(q.eventId || q.event_id) || 0
  }
  return { version: JOINED_EFFECT_VERSION, ruleVersion: RULE_VERSION, region,
    baseDataVersion: factorIndex.baseDataVersion, activityState: activityScores.activityState,
    inputSignature, coverage: 'lossless-joint-factors', resultCoverage: 'requires-constrained-exact-search',
    activityScores, scenarios, byQuest, questRules, questEvents, reusedScenarios: reused, memberCount: factorIndex.members.length }
}
export function lookupJoinedEffects(index, { region, version, quest, bondBonuses, now = Date.now() }) {
  if (!index || index.version !== JOINED_EFFECT_VERSION || index.ruleVersion !== RULE_VERSION || index.region !== region ||
    index.baseDataVersion !== (version?.baseDataVersion || version?.dataVersion) ||
    index.activityState !== resolveCurrentActivity({ catalog: bondBonuses, now }).activityState || !open(quest || {}, now)) return null
  const id = joinedQuestKey(quest)
  if (index.questRules[id] !== jointRuleKey(quest) || index.questEvents[id] !== (Number(quest?.eventId || quest?.event_id) || 0)) return null
  const scenario = index.scenarios[index.byQuest[id]]
  return scenario ? { scenario, scores: index.activityScores.byQuest[id] || {} } : null
}
