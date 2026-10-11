import { ceHasBondGain, isPlayableServant, grandQuestCatalog } from '../game-data.js'
import { servantBondForms } from '../recommend.js'
import { ceMilliLive } from './solver-index.js'
import { pickCeSkill } from '../atlas.js'
import { servantCost } from '../servant-cost.js'
import { factorsMatch } from './combination-factors.js'
import { buildActivityScoreIndex } from './activity-score-index.js'
import { jointInputSignature } from './joined-effects.js'
import { compileGlobalQuestRules, restrictGlobalQuestSource } from './global-quest-rules.js'
import { projectGlobalDomain } from './global-curve-expand.js'
import { formationOptions } from './formation-effects.js'
import { formatTraitCondition } from '../ui/ce-effect-copy.js'
import { formationSpecialSource } from './formation-special.js'

export const FORMATION_DOMAIN_VERSION = 2

// Keep every identity and form. This domain represents the public catalog;
// account inventory, capped identities and pinned slots remain in the account solver.
export function buildFormationDomain(bundle, { now = Date.now(), factorIndex = bundle.factorIndex } = {}) {
  const byId = new Map(bundle.servants.filter(isPlayableServant).map(s => [s.id, s]))
  const factors = factorsMatch(factorIndex, bundle.version) ? factorIndex : null
  const members = factors ? factors.members.filter(m => byId.has(m.svt)) : [...byId.values()].flatMap(s =>
    servantBondForms(s).map(f => ({ svt: s.id, art: f.key, cost: servantCost(s, f), traits: f.traitIds, className: s.className })))
  const rows = members.map(m => ({ id: m.svt, form: m.art, name: byId.get(m.svt).name,
    formLabel: m.art, cost: m.cost, traits: m.traits, className: m.className, self: 0, party: 0, activity: null }))
  const groups = [], supports = [{ rates: rows.map(() => 0), flat: 0, items: [] }]
  const maps = [new Map(), new Map()]
  for (const ce of bundle.ces.filter(ceHasBondGain)) {
    const fs = pickCeSkill(ce, true)?.funcs || [], fn = fs[0]
    if (fs.length !== 1 || fn.eventId || fn.target !== 'ptFull' || fn.rate < 0 ||
        ![0, 50].includes(fn.add || 0) || fn.add && (fn.tvals?.length || fn.andTvals?.length)) {
      throw Error(`礼装 ${ce.name || ce.id} 的效果需要补充曲线规则，请使用主界面配队求解器。`)
    }
    const ci = factors?.ces.indexOf(ce.id) ?? -1
    for (const support of [false, true]) {
      const rates = members.map((m, i) => ci >= 0 ? factors.vectors[m.effect][ci][support ? 1 : 0] :
        ceMilliLive(ce, { traitIds: rows[i].traits }, support, true))
      const flat = support && fn.applySupport === 0 ? 0 : fn.add || 0
      const kind = flat ? 'portrait' : fn.tvals?.length || fn.andTvals?.length ? 'conditional' : 'universal'
      const key = JSON.stringify([rates, flat, kind]), map = maps[Number(support)], list = support ? supports : groups
      if (!map.has(key)) { map.set(key, list.length); list.push({ rates, flat, kind, items: [] }) }
      list[map.get(key)].items.push({ id: ce.id, name: ce.name, cost: ce.cost,
        nominalRate: (support && fn.followerRate != null ? fn.followerRate : fn.rate) / 10,
        condition: formatTraitCondition(fn), rewardEligible: true })
    }
  }
  for (const g of [...groups, ...supports]) g.items.sort((a, b) => a.cost - b.cost || a.id - b.id)
  const source = { region: bundle.region, rows, groups, supports, guestPartyMax: 0,
    identities: byId.size, forms: rows.length }
  const profiles = [], seen = new Set(), unsupported = [], activity = {}
  const add = (rules, scores, label, family = 'normal', specialQuest = null) => {
    const key = JSON.stringify([rules, scores, specialQuest && [specialQuest.partyScript, specialQuest.restrictions, specialQuest.supportServants, specialQuest.flags, specialQuest.isNpcOnly]])
    if (seen.has(key)) return
    seen.add(key)
    const tag = `${bundle.region}-formation-${profiles.length}`, buckets = new Map()
    for (const [id, b] of Object.entries(scores)) {
      const p = { self: Math.round((b.self || 0) * 1000), campaign: Math.round((b.questCampaign || 0) * 1000),
        party: Math.round((b.party || 0) * 1000), helperAllowed: b.partyApplySupport !== 0 }
      const k = JSON.stringify(p)
      if (!buckets.has(k)) buckets.set(k, { ...p, available: 0 })
      if (byId.has(Number(id))) buckets.get(k).available++
    }
    activity[tag] = [...buckets.values()].filter(p => p.available)
    profiles.push({ id: tag, tag, region: bundle.region, family, label, rules, scores, specialQuest })
  }
  add({ layouts: [1, 2], ownMin: 1, ownMax: 5, totalMin: 1, totalMax: 6, requireFront: true }, {}, '基本编队 · 己方1–5人＋好友助战')
  add({ layouts: [0], ownMin: 1, ownMax: 6, totalMin: 1, totalMax: 6, requireFront: true }, {}, '无助战 · 至多己方6人（允许空位）')
  const scores = buildActivityScoreIndex({ ...bundle, now })
  const ts = Math.floor(now / 1000)
  for (const q of bundle.quests) {
    if (q.type === 'grand' || q.questType === 'grand' || q.openedAt > ts || q.closedAt && q.closedAt < ts) continue
    const rules = compileGlobalQuestRules(q)
    const bonus = scores.byQuest[`${q.id}:${q.phase || 1}`] || {}, event = Object.keys(bonus).length > 0
    if (!rules.supported || q.partyMetadataDetailed && q.supportServants?.length) {
      try {
        const special = formationSpecialSource(source, q, bundle.servants)
        add(special.rules, bonus, `特殊编队 · 己方${special.rules.ownMin}–${special.rules.ownMax}人 · 全队${special.rules.totalMin}–${special.rules.totalMax}人 · ${new Set(special.supports.map(s => s.external.length)).size}类客将人数${event ? ' · 当前活动效果 ' + q.eventId : ''}`, 'special', q)
      } catch (error) { unsupported.push({ id: q.id, phase: q.phase || 1, reasons: [error.message] }) }
      continue
    }
    const constrained = rules.totalMax < 6 || rules.totalMin > 1 || rules.ownMin > 1 || rules.supportPosition > 0
    const helpers = rules.layouts[0] === 0 ? '无助战' : rules.layouts.length > 1 ? '好友前／后排' : rules.layouts[0] === 2 ? '前排好友' : '后排好友'
    add(rules, bonus, `${helpers} · 己方${rules.ownMin}–${Math.min(rules.ownMax, rules.layouts[0] ? 5 : 6)}人 · 全队${rules.totalMin}–${rules.totalMax}人${event ? ' · 当前活动效果 ' + (q.eventId || '战役') : ''}${rules.friendOnly ? ' · 好友分支' : ''}`,
      constrained ? 'special' : 'normal')
  }
  for (const q of grandQuestCatalog()) add({ grand: true, questClass: q.questClass, layouts: [0, 1, 2],
    ownMin: 1, ownMax: 6, totalMin: 1, totalMax: 6, requireFront: true }, {}, `冠位 · ${q.questClass}（规则模板）`, 'grand')
  return { version: FORMATION_DOMAIN_VERSION, inputSignature: jointInputSignature(bundle, bundle.region, now),
    source, profiles, activity, unsupported,
    servantForms: bundle.servants.map(s => ({ id: s.id, forms: (s.forms || []).map(f => ({ key: f.key, costumeId: f.costumeId })) })) }
}

export function formationDomainMatches(domain, bundle, now = Date.now()) {
  return domain?.version === FORMATION_DOMAIN_VERSION && domain.inputSignature === jointInputSignature(bundle, bundle.region, now)
}

export function formationScene(domain, tag) {
  const p = domain.profiles.find(p => p.tag === tag)
  if (!p) throw Error('编队模板已失效，请重新打开界面。')
  const base = domain.source, active = { ...base,
    rows: base.rows.map(r => ({ ...r, self: Math.round((p.scores[r.id]?.totalSecondLayer || 0) * 1000),
      party: Math.round((p.scores[r.id]?.party || 0) * 1000), activity: p.scores[r.id] || null })),
    guestPartyMax: Math.max(0, ...Object.values(p.scores).filter(b => b.partyApplySupport !== 0).map(b => Math.round((b.party || 0) * 1000))) }
  const source = p.specialQuest ? formationSpecialSource(active, p.specialQuest, domain.servantForms) : restrictGlobalQuestSource(active, p.rules)
  const meta = projectGlobalDomain(source)
  if (!formationOptions(meta).length) throw Error('当前资料中没有满足此编队条件的身份。')
  return { source, meta, theory: null }
}
