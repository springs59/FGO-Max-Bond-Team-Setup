import { getEffectiveBondBonus, liveBondBonusCatalog } from '../bond/bonus.js'
import { resolveCurrentActivity } from '../rules/activity-rules.js'

const questKey = quest => `${Number(quest?.id) || 0}:${Number(quest?.phase) || 1}`

export function buildActivityScoreIndex({ quests = [], servants = [], bondBonuses = null, now = Date.now() } = {}) {
  const state = resolveCurrentActivity({ catalog: bondBonuses, now }).activityState
  const ts = Math.floor(Number(now) / 1000)
  const byQuest = {}
  for (const quest of quests) {
    if (Number(quest.openedAt) > ts || (Number(quest.closedAt) && ts > Number(quest.closedAt))) continue
    const live = liveBondBonusCatalog(bondBonuses, quest, now)
    if (!live.extraPassives.length && !live.questFriendships.length) continue
    const bySvt = new Map()
    for (const rec of live.extraPassives) {
      const id = Number(rec.servantId) || 0
      if (!bySvt.has(id)) bySvt.set(id, [])
      bySvt.get(id).push(rec)
    }
    const bonuses = {}
    for (const svt of servants) {
      const bonus = getEffectiveBondBonus({ servantId: svt.id,
        extraPassives: bySvt.get(Number(svt.id)) || [], questFriendships: live.questFriendships,
        quest, now })
      if (bonus.totalSecondLayer || bonus.party) bonuses[svt.id] = bonus
    }
    if (Object.keys(bonuses).length) byQuest[questKey(quest)] = bonuses
  }
  return { activityState: state, byQuest }
}

export function lookupActivityScores(index, quest, catalog, now = Date.now()) {
  if (!index || !quest || index.activityState !== resolveCurrentActivity({ catalog, now }).activityState) return null
  return index.byQuest?.[questKey(quest)] || null
}
