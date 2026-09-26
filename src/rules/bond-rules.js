import { extraPassiveApplies, isWindowOpen, questFriendshipApplies, unixNow } from '../bond/activity.js'

function num(value) {
  return Number(value) || 0
}

export function toBondEffect(src, { servantId = 0, quest = null, now, active = true } = {}) {
  const rate = num(src && src.rate)
  const party = src && src.target === 'ptFull'
  return {
    source: (src && src.type) || 'extraPassive',
    eventId: num(src && src.eventId),
    questId: num(quest && quest.id),
    servantId: num(servantId),
    selfBonus: party ? 0 : rate,
    partyBonus: party ? rate : 0,
    startedAt: num(src && src.startedAt),
    endedAt: num(src && src.endedAt),
    condQuestId: num(src && src.condQuestId),
    condQuestPhase: num(src && src.condQuestPhase),
    isExcepted: Boolean(src && src.isExcepted),
    name: (src && src.name) || '',
    label: (src && src.label) || '',
    skillId: num(src && src.skillId),
    target: party ? 'ptFull' : 'self',
    questScope: (src && src.questScope) || '',
    active: Boolean(active),
  }
}

function catalogBag({ catalog, extraPassives, questFriendships }) {
  if (catalog && (catalog.extraPassives || catalog.questFriendships)) return catalog
  return {
    extraPassives: extraPassives || [],
    questFriendships: questFriendships || [],
  }
}

export function bondEffectsForServant({ servantId, catalog, extraPassives, questFriendships, quest = null, now } = {}) {
  const ts = now == null ? unixNow() : unixNow(now)
  const bag = catalogBag({ catalog, extraPassives, questFriendships })
  const sid = num(servantId)
  const out = []
  for (const rec of bag.extraPassives || []) {
    if (num(rec.servantId) !== sid) continue
    if (!num(rec.eventId)) continue
    if (!isWindowOpen(rec.startedAt, rec.endedAt, ts)) continue
    out.push(
      toBondEffect(
        { ...rec, type: rec.type || 'extraPassive' },
        { servantId: sid, quest, now: ts, active: extraPassiveApplies(rec, quest, ts) },
      ),
    )
  }
  for (const rec of bag.questFriendships || []) {
    if (!isWindowOpen(rec.startedAt, rec.endedAt, ts)) continue
    const ids = rec.targetIds || []
    if (ids.length && !ids.includes(sid)) continue
    out.push(
      toBondEffect(
        { ...rec, type: 'questFriendship', target: 'self' },
        { servantId: sid, quest, now: ts, active: questFriendshipApplies(rec, sid, quest, ts) },
      ),
    )
  }
  return out
}

export function servantReceives(effects) {
  return (effects || []).filter(
    (row) => (row.selfBonus || 0) > 0 || (row.partyBonus || 0) > 0 || row.source === 'questFriendship',
  )
}

export function servantProvides(effects) {
  return (effects || []).filter((row) => (row.partyBonus || 0) > 0)
}

export function formatEffectWindow(effect, now) {
  const ts = now == null ? unixNow() : unixNow(now)
  const start = num(effect && effect.startedAt)
  const end = num(effect && effect.endedAt)
  return {
    startedAt: start,
    endedAt: end,
    active: Boolean(effect && effect.active) && (!start || ts >= start) && (!end || ts <= end),
  }
}

function ceRate(fn, mlb, isSupport) {
  const raw = isSupport && fn.followerRate != null ? num(fn.followerRate) : num(fn.rate)
  return raw / 1000
}

export function ceBondEffects(ce, { mlb = true, isSupport = false } = {}) {
  const out = []
  for (const skill of (ce && ce.skills) || []) {
    const needLimit = num(skill.condLimitCount)
    const theoretical = !needLimit || mlb
    for (const fn of skill.funcs || []) {
      const rate = ceRate(fn, mlb, isSupport)
      if (!rate && !num(fn.add)) continue
      const party = fn.target === 'ptFull'
      const ownRate = num(fn.rate) / 1000
      const supportRate = fn.followerRate != null ? num(fn.followerRate) / 1000 : ownRate
      out.push({
        source: 'craftEssence',
        eventId: num(fn.eventId),
        questId: 0,
        servantId: 0,
        selfBonus: party ? 0 : rate,
        partyBonus: party ? rate : 0,
        startedAt: 0,
        endedAt: 0,
        condQuestId: 0,
        condQuestPhase: 0,
        isExcepted: false,
        name: skill.name || ce.name || '',
        label: skill.name || '',
        skillId: 0,
        target: party ? 'ptFull' : fn.target || 'self',
        questScope: '',
        active: theoretical,
        theoretical,
        add: num(fn.add),
        tvals: fn.tvals || [],
        andTvals: fn.andTvals || [],
        condLimitCount: needLimit,
        ownRate,
        supportRate,
      })
    }
  }
  return out
}
