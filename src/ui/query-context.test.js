import assert from 'node:assert/strict'
import { queryConditionKey, queryContext, searchStatusLabel } from './query-context.js'

const state = { region: 'CN', mode: 'free', base: '815', costLimit: '116',
  slotPins: [], filter: { bannedIds: [] }, questId: '', accountSavedAt: 0 }
const key = queryConditionKey(state)
for (const [field, value] of Object.entries({ region: 'JP', base: '1000', teapot: true,
  costLimit: '100', questId: '123', allowSupport: false, bond15Aura: false,
  mode: 'account', accountSavedAt: 42, preferIds: [1], lockIds: [2],
  slotPins: [{ position: 1, svtId: 1 }], pinCes: [{ svtId: 1, ceId: 3 }],
  pinSprites: [{ svtId: 1, formKey: 'c1' }], filter: { bannedIds: [1] } })) {
  assert.notEqual(queryConditionKey({ ...state, [field]: value }), key, field)
}
assert.equal(queryConditionKey({ ...state, preferQuery: '呆毛', constraintsOpen: true,
  questBrowseQuery: '冬木', detail: { id: 1 } }), key)
const party = { ...state, slots: [{ svtId: 1, svtArtKey: 'a0', ceId: 2, bondLv: 10 }] }
for (const [field, value] of Object.entries({ svtArtKey: 'a4', ceId: 3, bondLv: 15, ceMlb: false, portrait:true })) {
  assert.notEqual(queryConditionKey({ ...party, slots: [{ ...party.slots[0], [field]: value }] }), queryConditionKey(party))
}
assert.notEqual(queryConditionKey({ ...state, data: { game: { version: { dataVersion: 'new' } } } }), key)

const common = { region: 'CN', mode: 'free', base: '815', costLimit: '116' }
const noQuest = queryContext({ ...common, live: { extraPassives: [{ rate: .5 }] } })
assert.equal(noQuest.bonus, '未应用具体活动关卡加成')
assert.match(noQuest.quest, /未选择关卡/)
const event = queryContext({ ...common, region: 'JP', mode: 'account', quest: { id: 1, name: '活动周回' },
  live: { extraPassives: [{ rate: .5 }] } })
assert.equal(event.region, '日服')
assert.match(event.pool, /账号库存/)
assert.match(event.bonus, /已纳入/)
assert.equal(queryContext({ ...common, quest: { id: 2 } }).bonus, '该关卡无额外活动羁绊加成')
assert.equal(queryContext({ ...common, costLimit: '' }).cost, '不限')
assert.match(searchStatusLabel({ optimality: 'default-query-complete' }), /默认条件/)
assert.match(searchStatusLabel({ optimality: 'search-complete' }), /当前条件/)
assert.match(searchStatusLabel({}), /尚未证明最优/)
assert.match(searchStatusLabel({optimality:'maximum-proven'}), /最高分已证明.*同分队伍尚未收齐/)
const deploymentQuest={id:3,supportServants:[{svtId:90,name:'NONE',required:true,script:{eventDeckIndex:1}}],restrictions:[
 {type:'fixedMySvtIndividualityPositionMain',targetVals:[1],targetVals2:[1]},
 {type:'mySvtNum',rangeType:'below',targetVals:[5]}]}
const deployment=queryContext({...common,quest:deploymentQuest,servants:[{id:90,name:'剧情NPC'},{id:1,name:'必选己方'}]}).deployment
assert.match(deployment[0],/NPC 剧情NPC占 1 号位/)
assert.match(deployment[1],/己方必选己方须在 1–3 号位/)
assert.match(deployment[2],/己方最多 5 人/)
assert.deepEqual(queryContext({...common,quest:{id:4}}).deployment,[])
assert.deepEqual(queryContext(common).deployment,[])
console.log('Query context: condition invalidation, region, inventory and bonus scope passed')
