import { ceMilliLive } from './solver-index.js'
import { pickCeSkill } from '../atlas.js'
import { compileSpecialGlobalRules, restrictSpecialGlobalRows, specialGuestPlacements, globalTraitMatch } from './global-special-quest.js'
import { restrictGlobalQuestSource } from './global-quest-rules.js'

// This adapter uses public phase metadata saved by the data updater. Missing
// deck scripts are a blocker, never permission to turn a forced NPC into a friend.
export function formationSpecialSource(base, quest, servants) {
  if (!quest.partyMetadataDetailed) throw Error('特殊编队缺少完整阶段脚本，请先更新数据。')
  const nice = { ...quest, supportServants: (quest.supportServants || []).map(s => ({ ...s,
    svt: { id: s.svtId, name: s.name, className: s.className },
    traits: (s.traitIds || []).map(id => ({ id })), detailTraits: (s.detailTraits || s.traitIds || []).map(id => ({ id })),
    followerFlags: s.followerFlags || (s.required ? ['fixedNpc'] : []),
  })) }
  const rules = compileSpecialGlobalRules(quest, nice, { mstQuestPhase: { script: quest.partyScript || {} } })
  if (!rules.supported) throw Error(rules.unsupported.join('、'))
  const source = restrictSpecialGlobalRows(base, rules, servants), supports = [], zero = () => source.rows.map(() => 0)
  if (rules.grand) source.supports = restrictGlobalQuestSource(source, { grand: true }).supports
  for (const external of specialGuestPlacements(quest, nice, rules)) {
    const fixed = external.filter(s => !s.friend), friend = external.find(s => s.friend)
    const parts = fixed.flatMap(s => (s.equips || []).map(eq => {
      const ce = eq.ce, fn = pickCeSkill(ce, eq.ceMlb)?.funcs?.[0]
      const rates = source.rows.map(r => ceMilliLive(ce, { traitIds: r.traits }, true, eq.ceMlb))
      return { rates, flat: fn?.add || 0, kind: fn?.add ? 'portrait' : new Set(rates).size > 1 ? 'conditional' : 'universal',
        items: [{ id: ce.id, name: ce.name, cost: 0, nominalRate: (fn?.followerRate ?? fn?.rate ?? 0) / 10 }],
        slot: `客将 ${s.name} 固定礼装`, owner: s.svtId, ownerPosition: s.position }
    }))
    const freePositions = Array.from({ length: 6 }, (_, i) => i).filter(i => !external.some(s => s.position === i + 1))
    if (freePositions.length < rules.ownMin || external.length > rules.totalMax || rules.ownMax + external.length < rules.totalMin) continue
    const frontShare = 40 * external.filter(s => s.position <= 3).length
    const satisfiedMask = rules.frontGroups.reduce((mask, g, i) => mask | (!g.ownOnly && fixed.some(s => s.position <= 3 &&
      globalTraitMatch({ id: s.svtId, traits: s.traits }, g.values)) ? 1 << i : 0), 0)
    const bannedIds = [...new Set(source.rows.filter(r => fixed.some(s => globalTraitMatch(r, rules.unique) &&
      globalTraitMatch({ id: s.svtId, traits: s.traits }, rules.unique))).map(r => r.id))]
    const fixedRates = zero(); for (const p of parts) p.rates.forEach((rate, i) => { fixedRates[i] += rate })
    for (const f of friend ? source.supports.filter(f => !f.equipmentCount || f.equipmentCount <= 1 || rules.grandPositions.includes(friend.position)) : [{ rates: zero(), flat: 0, items: [] }]) {
      const ps = [...parts, ...(friend ? (f.parts || [f]).map(p => ({ ...p, slot: p.slot || '好友通常槽', owner: 0, ownerPosition: friend.position })) : [])]
      supports.push({ rates: fixedRates.map((rate, i) => rate + f.rates[i]), flat: parts.reduce((n, p) => n + p.flat, 0) + f.flat,
        items: ps.flatMap(p => p.items), parts: ps, equipmentCount: ps.filter(p => p.items.length).length,
        external: external.map(s => ({ svtId: s.svtId, name: s.name, traits: s.traits, position: s.position, friend: !!s.friend })),
        freePositions, frontShare, satisfiedMask, bannedIds, layout: external.length ? frontShare ? 2 : 1 : 0 })
    }
  }
  if (!supports.length) throw Error('实际客将位置与人数限制没有可验证分支。')
  return { ...source, supports, guestPartyMax: 0, rules: { ...rules, phaseScript: undefined, generic: true, layouts: [0, 1, 2] } }
}
