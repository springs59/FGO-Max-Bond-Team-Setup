import assert from 'node:assert/strict'
import { analyzeSnapshot, ceHasBondGain, isSvtBondCe, mergeJpTraits, slimBondCes, slimCes, validateSnapshot } from './game-data.js'

{
  const cn = [{ id: 100, traitIds: [1], forms: [{ key: 'default', traitIds: [1] }] }]
  const jp = [{ id: 100, traitIds: [1, 2654], forms: [{ key: 'default', traitIds: [2654] }] }]
  const out = mergeJpTraits(cn, jp)
  assert.deepEqual(out[0].traitIds, [1, 2654])
  assert.deepEqual(out[0].forms[0].traitIds, [1, 2654])
}

{
  const cn = [{ id: 100, traitIds: [1], forms: [{ key: 'default', traitIds: [1] }] }]
  const jp = [
    {
      id: 100,
      traitIds: [1],
      forms: [
        { key: 'default', traitIds: [1] },
        { key: 'a3', name: '第3阶段', traitIds: [1, 9] },
      ],
    },
  ]
  const out = mergeJpTraits(cn, jp)
  assert.equal(out[0].forms.some((form) => form.key === 'a3'), true)
}

{
  const servants = Array.from({ length: 400 }, (_, i) => ({
    id: i + 1,
    traitIds: i < 24 ? [2654] : [],
  }))
  const ces = ['迦勒底之晨', '检查报告', '手稿之翼', '秘密任务', '至诚的一针'].map((name, i) => ({
    id: i + 1,
    name,
  }))
  const check = validateSnapshot(servants, ces)
  assert.equal(check.ok, true)
  const analysis = analyzeSnapshot(servants, ces, { region: 'CN', jpServantCount: 12 })
  assert.equal(analysis.ok, true)
  assert.equal(analysis.jpServantCount, 12)
  assert.equal(analysis.livingHuman, 24)
}

{
  const equips = [
    {
      id: 9401970,
      collectionNo: 330,
      name: '午餐',
      rarity: 4,
      cost: 9,
      face: 'x',
      flag: 'svtEquipManaExchange',
      skills: [
        {
          name: 'a',
          condLimitCount: 4,
          functions: [{ funcType: 'servantFriendshipUp', funcTargetType: 'ptFull', svals: [{ RateCount: 100 }] }],
        },
      ],
    },
    {
      id: 9400010,
      collectionNo: 1,
      name: '顽强',
      rarity: 1,
      cost: 1,
      face: 'y',
      flag: 'normal',
      skills: [{ name: 'b', functions: [{ funcType: 'addState', svals: [{}] }] }],
    },
    {
      id: 9300010,
      collectionNo: 191,
      name: '星之王冠',
      rarity: 4,
      cost: 9,
      face: 'z',
      flag: 'svtEquipFriendShip',
      bondEquipOwner: 100100,
      skills: [],
    },
    {
      id: 9404310,
      collectionNo: 1147,
      name: '活动礼装',
      rarity: 4,
      cost: 9,
      face: 'e',
      flag: 'svtEquipEventReward',
      skills: [
        {
          name: '牵绊获得量提升',
          condLimitCount: 4,
          functions: [
            {
              funcType: 'servantFriendshipUp',
              funcTargetType: 'ptFull',
              svals: [{ RateCount: 400, EventId: 80273 }],
            },
          ],
        },
      ],
    },
    { id: 9, collectionNo: 0, name: '礼装经验值', rarity: 1, cost: 0, skills: [] },
  ]
  const all = slimCes(equips)
  assert.equal(all.length, 4)
  assert.equal(all.some((ce) => ce.name === '顽强'), true)
  assert.equal(ceHasBondGain(all.find((ce) => ce.name === '午餐')), true)
  assert.equal(ceHasBondGain(all.find((ce) => ce.name === '顽强')), false)
  assert.equal(ceHasBondGain(all.find((ce) => ce.name === '活动礼装')), false)
  assert.equal(isSvtBondCe(all.find((ce) => ce.name === '星之王冠')), true)
  assert.equal(isSvtBondCe(all.find((ce) => ce.name === '顽强')), false)
  assert.equal(slimBondCes(equips).length, 1)
}

console.log('game-data tests passed')
