import assert from 'node:assert/strict'
import { parseAccount } from './account.js'
import { recommendTeam } from './recommend.js'
import { getEffectiveBondBonus, liveBondBonusCatalog } from './bond/bonus.js'
import { questPartyRules } from './quest-party-rules.js'
import { configurationSweepDomain, iterateConfigurationSweep } from './solver/configuration-sweep.js'
import { enrichQuestBond } from '../scripts/enrich-quest-bond.mjs'
import { loadPhasePartyMetadata } from '../scripts/quest-party-source.mjs'

const unavailableParty = await loadPhasePartyMetadata({ npcFollower: [{}] }, async () => { throw Error('Nice HTTP 404；已尝试 1 次') })
assert.equal(unavailableParty.npcSupportCount, 1)
assert.equal(unavailableParty.partyMetadataComplete, undefined)
assert.equal(questPartyRules(unavailableParty).supported, false)
await assert.rejects(loadPhasePartyMetadata({ npcFollower: [{}] }, async () => { throw Error('Nice HTTP 503') }), /503/)
assert.equal((await loadPhasePartyMetadata({}, async () => { throw Error('must not fetch') })).partyMetadataComplete, true)
const account = parseAccount({ cache: { replaced: {
  userSvtCollection: [{ svtId: 100100, status: 2, friendshipRank: 5 }],
  userSvt: [{ id: 1, svtId: 100100, limitCount: 2, lv: 50 }, { id: 2, svtId: 9401970, limitCount: 0, lv: 1 }],
  userSvtLeader: [{ svtId: 100100, limitCount: 4, lv: 120 }, { svtId: 200100, limitCount: 4, lv: 120 }],
  userEventDeck: [{ eventId: 123, deckInfo: { svtId: 9401970, limitCount: 4, lv: 100 } }],
  userQuestRecord: [{ deckJson: { svtId: 300100, limitCount: 4, lv: 100 } }],
  userEvent: [{ eventId: 123, value: '100100', updatedAt: 10 }, { eventId: 456, value: '200100', updatedAt: 20 }],
} } })
assert.deepEqual(account.servants.map(s => s.id), [100100])
assert.equal(account.servants[0].maxAscension, 2)
assert.equal(account.ces[0].count, 1)
assert.equal(account.ces[0].mlb, false)
assert.equal(account.eventState.selectionStatus, 'unavailable')
assert.equal('value' in account.eventState.events[0], false)
const passive = { type: 'extraPassive', servantId: 100100, skillId: 88001, eventId: 123,
  target: 'self', rate: 1, startedAt: 1, endedAt: 2145888000 }
const catalog = { extraPassives: [passive], questFriendships: [], events: [{ id: 123, startedAt: 1, endedAt: 100 }] }
assert.equal(getEffectiveBondBonus({ servantId: 100100, catalog, quest: { eventId: 123 }, now: 101 }).self, 0)
assert.equal(liveBondBonusCatalog(catalog, { eventId: 123 }, 101).extraPassives.length, 0)
assert.equal(getEffectiveBondBonus({ servantId: 100100, catalog, quest: { eventId: 456 }, now: 50 }).self, 0)
assert.equal(getEffectiveBondBonus({ servantId: 100100, catalog, quest: { eventId: 123 }, now: 50 }).self, 1)
const restriction = { restriction: { type: 'mySvtNum', rangeType: 'equal', targetVals: [6] } }
const rows = await enrichQuestBond([{ id: 1, phase: 1, name: '六人关卡', bond: 123, flags: ['noSupportList'] }],
  async () => ({ id: 1, phase: 1, bond: 100, restrictions: [restriction], npcSupportCount: 0 }))
assert.deepEqual(rows[0].restrictions[0].restriction.targetVals, [6])
assert.equal(questPartyRules(rows[0]).noSupport, true)
assert.equal(questPartyRules({ restrictions: [{ restriction: { type: 'mySvtNum', rangeType: 'equal', targetVals: [3] } }] }).supported, false)
assert.equal(questPartyRules({ flags: ['noSupportList'], npcSupportCount: 1 }).supported, false)
const roster = Array.from({ length: 6 }, (_, i) => ({ id: 100100 + i * 100, collectionNo: i + 1,
  name: `成员${i + 1}`, className: 'saber', rarity: 1, cost: 3, traitIds: [], forms: [] }))
const opts = { base: 100, servants: roster, ces: [], mode: 'free', costLimit: 100,
  allowSupport: true, quest: rows[0], solverAudit: { memo: false, ub: false, compression: false } }
const plan = recommendTeam(opts)
assert.equal(plan.ok, true, plan.error)
assert.equal(plan.slots.filter(s => s.filled && !s.isSupport).length, 6)
assert.equal(plan.slots.some(s => s.filled && s.isSupport), false)
assert.equal(recommendTeam({ ...opts, servants: roster.slice(0, 5) }).ok, false)
assert.equal(recommendTeam({ ...opts, quest: { restrictions: [{ restriction: { type: 'individuality' } }] } }).ok, false)
const config = { supportPosition: 0, slots: roster.map(s => ({ filled: true, svtId: s.id, selfEvent: 0, ceId: 0, ceMlb: true })) }
const domain = configurationSweepDomain(config, { eventLevels: [0, 50, 100], ceStates: [{ ceId: 1, ceMlb: true }, { ceId: 2, ceMlb: false }] })
assert.equal(domain.count, 6n ** 6n)
const combos = [...iterateConfigurationSweep(config, { eventLevels: [0, 50, 100] })]
assert.equal(combos.length, 729)
assert.equal(new Set(combos.map(c => c.slots.map(s => s.selfEvent).join(','))).size, 729)
assert.ok(combos.some(c => c.slots.every(s => s.selfEvent === 100)))
assert.ok(combos.some(c => c.slots[0].selfEvent === 100 && c.slots[1].selfEvent === 100 && c.slots[2].selfEvent === 50))
assert.equal(configurationSweepDomain({ ...config, supportPosition: 6 }, { eventLevels: [0, 50, 100] }).count, 243n)
assert.throws(() => configurationSweepDomain({ ...config, slots: config.slots.map((s, i) => i === 5 ? { ...s, svtId: 0 } : s) }, { ownSix: true }), /真实从者/)
console.log('activity coverage, historical isolation, owned inventory and six-own party checks passed')

// No support means up to six OWN slots, not a six-member lower bound.
const holes = [1, 3, 6].map(position => ({ position, empty: true }))
const sparse = recommendTeam({ ...opts, quest: { flags: ['noSupportList'], npcSupportCount: 0 }, slotPins: holes })
assert.equal(sparse.ok, true, sparse.error)
assert.equal(sparse.slots.filter(s => s.filled).length, 3)
for (const pin of holes) assert.equal(sparse.slots[pin.position - 1].filled, false)
assert.equal(sparse.slots.some(s => s.isSupport), false)
const one = recommendTeam({ ...opts, servants: roster.slice(0, 1), quest: { flags: ['noSupportList'] } })
assert.equal(one.ok, true, one.error)
assert.equal(one.slots.filter(s => s.filled).length, 1)
const supportCe = { id: 9409990, name: '固定系统礼装', collectionNo: 999, cost: 12, skills: [
 { condLimitCount: 0, funcs: [{ target: 'ptFull', rate: 100, add: 0, tvals: [] }] },
 { condLimitCount: 4, funcs: [{ target: 'ptFull', rate: 500, add: 0, tvals: [] }] },
] }
const npcQuest = { flags: ['noSupportList'], npcSupportCount: 1, partyMetadataComplete: true,
 restrictions: [{ restriction: { type: 'fixedSupportPosition', targetVals: [1] } }],
 supportServants: [{ id: 1, svtId: 700100, name: '固定系统从者', required: true, releaseConditions: [],
  equips: [{ ceId: supportCe.id, ceMlb: false, ce: supportCe }] }] }
const npc = recommendTeam({ ...opts, quest: npcQuest, allowSupport: false, servants: roster.slice(0, 3) })
assert.equal(npc.ok, true, npc.error)
assert.equal(npc.slots[0].isSupport, true)
assert.equal(npc.slots[0].svtId, 700100)
assert.equal(npc.slots[0].ceId, supportCe.id)
assert.equal(npc.slots[0].ceMlb, false)
assert.equal(npc.slots.filter(s => !s.isSupport).some(s => s.ceId === supportCe.id), false)
assert.equal(npc.output.supportInFront, true)
assert.equal(recommendTeam({ ...opts, quest: npcQuest, slotPins: [{ position: 1, empty: true }] }).ok, false)
assert.equal(recommendTeam({ ...opts, quest: { ...npcQuest, supportServants: [{ ...npcQuest.supportServants[0], releaseConditions: [{ type: 'questClear', targetId: 99 }] }] } }).ok, false)
console.log('empty pins, optional own-slot counts and fixed NPC support checks passed')

assert.equal(npc.total, 386)
assert.equal(sparse.total, 320)
