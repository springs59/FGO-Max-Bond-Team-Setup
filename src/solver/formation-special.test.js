import assert from 'node:assert/strict'
import { formationSpecialSource } from './formation-special.js'
import { createGlobalExpansion } from './global-curve-expand.js'
import { formationOptions } from './formation-effects.js'
import { loadPhasePartyMetadata } from '../../scripts/quest-party-source.mjs'
import { questPartyMetadata } from '../quest-party-rules.js'
import { snapshotQuests } from '../game-data.js'

const ce = { id: 101, name: '固定礼装', skills: [{ condLimitCount: 4, funcs: [{ target: 'ptFull', rate: 200, add: 0, tvals: [], andTvals: [] }] }] }
const rows = [{ id: 1, form: 'a', traits: [101] }, { id: 1, form: 'b', traits: [102] }, { id: 2, form: 'a', traits: [101] }]
  .map(r => ({ ...r, cost: 0, className: 'saber', self: 0, party: 0, name: '从者' + r.id }))
const group = { rates: [200, 0, 200], flat: 0, kind: 'conditional', items: [{ id: 1, cost: 2, name: '范围礼装', nominalRate: 20, rewardEligible: true }] }
const source = { region: 'CN', rows, groups: [group], supports: [{ rates: [0, 0, 0], flat: 0, items: [] }, group], guestPartyMax: 0 }
const servants = [{ id: 1, forms: [{ key: 'a', costumeId: 11 }, { key: 'b', costumeId: 12 }] }, { id: 2, forms: [] }]
const npc = { id: 9, svtId: 9, name: '固定客将', traitIds: [101], required: true, followerFlags: ['fixedNpc'], equips: [{ ce, ceMlb: true }] }
const quest = { partyMetadataDetailed: true, partyScript: {}, flags: ['supportOnlyForceBattle'], supportServants: [npc] }
const forced = formationSpecialSource(source, quest, servants)
assert.ok(forced.supports.length)
assert.ok(forced.supports.every(s => s.external.length === 1 && !s.external[0].friend), 'mandatory system support never becomes a freely equipped friend')
assert.ok(forced.supports.every(s => s.parts[0].items[0].id === 101), 'NPC equipment is fixed')
assert.ok(forced.supports.every(s => s.rates.every(rate => rate === 200)), 'fixed CE effects are evaluated from public NPC equipment')
const locked = { ...quest, flags: ['noSupportList', 'supportSvtMultipleSet'], supportServants: [
  { ...npc, script: { eventDeckIndex: 1 } }, { ...npc, id: 10, svtId: 10, script: { eventDeckIndex: 5 } }] }
const multi = formationSpecialSource(source, locked, servants)
assert.ok(multi.supports.every(s => s.external.length === 2 && s.freePositions.join(',') === '1,2,3,5'))
assert.ok(formationOptions(multi).every(o => o.own <= 4 && o.helpers === 2 && o.helperFront === 1))
const costume = formationSpecialSource(source, { ...quest, partyScript: { overwriteLimitCountSvtIds: [1], overwriteLimitCounts: [12] },
  restrictions: [{ restriction: { type: 'fixedCostume', targetVals: [1] } }] }, servants)
assert.ok(costume.rows.filter(r => r.id === 1).every(r => r.form === 'b'))
assert.throws(() => formationSpecialSource(source, { ...quest, partyMetadataDetailed: false }, servants), /缺少完整/)
const expansion = createGlobalExpansion(forced, { cost: 2, capped: 0, supportIndices: [1] })
const records = [...expansion.iterate()]
assert.ok(records.length); assert.ok(records.every(r => r[1] === 1), 'exact verification preserves selected helper shape without renumbering support effects')
const roleForms = { region: 'CN', rows: [{ id: 1, form: 'a', cost: 0, self: 0, party: 0, ruleRole: 0 },
  { id: 1, form: 'b', cost: 0, self: 0, party: 0, ruleRole: 1 }], groups: [],
  supports: [{ rates: [0, 0], flat: 0, items: [] }], guestPartyMax: 0,
  rules: { layouts: [0], ownMin: 1, ownMax: 1, frontMask: 1, frontMin: 1 } }
const roleExpansion = createGlobalExpansion(roleForms, { cost: 0, capped: 0 })
const roleRecords = [...roleExpansion.iterate()]
assert.ok(roleRecords.length, 'an effect-equal form with required front qualification must survive dominance reduction')
assert.ok(roleRecords.every(c => roleExpansion.meta.rows[c[14]].form === 'b'))
const detailed = await loadPhasePartyMetadata({ npcFollower: [{ id: 9 }], mstQuestPhase: { script: { overwriteLimitCountSvtIds: [1], overwriteLimitCounts: [12] } } }, async () => ({
  flags: ['noSupportList'], isNpcOnly: true, supportServants: [{ id: 9, svt: { id: 9 }, name: '客将',
    followerFlags: ['fixedNpc'], script: { eventDeckIndex: 1 }, traits: [{ id: 101 }], detailTraits: [{ id: 102 }], equips: [] }],
  restrictions: [{ restriction: { type: 'fixedCostume', targetVals: [1] }, dialogMessage: '资格说明' }],
}))
const saved = questPartyMetadata(detailed)
assert.equal(saved.partyMetadataDetailed, true); assert.equal(saved.isNpcOnly, true)
assert.equal(saved.supportServants[0].script.eventDeckIndex, 1)
assert.deepEqual(saved.supportServants[0].detailTraits, [102])
assert.equal(saved.partyScript.overwriteLimitCounts[0], 12)
assert.equal(saved.restrictions[0].dialogMessage, '资格说明')
const slim=snapshotQuests([{id:1,phase:1,bond:100,afterClear:'repeatLast',...saved}])[0]
assert.equal(slim.partyMetadataDetailed,true)
assert.deepEqual(slim.partyScript,saved.partyScript)
assert.equal(slim.supportServants[0].script.eventDeckIndex,1)
assert.equal(snapshotQuests([{id:1,phase:1,name:'同名关卡',bond:100,...saved},{id:2,phase:1,name:'同名关卡',bond:100,...saved,partyScript:{overwriteLimitCountSvtIds:[1],overwriteLimitCounts:[99]}}]).length,2,'same-name phases with different party scripts are not collapsed')
console.log('Formation special: mandatory NPCs, fixed equipment, multi-guest seats, forced costumes, helper filtering and updater metadata retention passed')
