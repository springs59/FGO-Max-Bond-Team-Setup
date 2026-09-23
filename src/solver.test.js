import assert from 'node:assert/strict'
import { applyCraftEssences } from './atlas.js'
import { calcParty } from './bond.js'
import { comparePlans, createState15, mixUpperBound, mixUpperBound0, mixUpperBound2, recommendTeam, state15Milli, warmStartMix } from './recommend.js'
import {
  ceDominates,
  ceHitMatrixFromCands,
  comboCount,
  eachCombination,
  eachPrefixCombos,
  formIdOf,
  groupCandsByEffect,
  pruneDominatedCands,
  remainingCostFeasible,
} from './solver-pruner.js'
import { ceFillUpperBound, partyBranchUpperBound } from './solver-pruner.js'

function svt(partial) {
  return {
    id: partial.id,
    collectionNo: partial.collectionNo || partial.id,
    name: partial.name || `svt${partial.id}`,
    className: partial.className || 'saber',
    attribute: 'earth',
    face: '',
    traitIds: partial.traitIds || [],
    forms: partial.forms || [],
    cost: partial.cost != null ? partial.cost : 3,
    rarity: partial.rarity || 3,
    atk: partial.atk || 0,
    hp: partial.hp || 0,
  }
}

function ce({ id, collectionNo, name, rate, cost, traitId, followerRate, target = 'ptFull' }) {
  const fn = {
    target,
    rate,
    add: 0,
    eventId: 0,
    indiv: 0,
    applySupport: null,
    followerRate: followerRate == null ? null : followerRate,
    tvals: traitId ? [{ id: traitId, name: `t${traitId}` }] : [],
    andTvals: [],
  }
  return {
    id,
    collectionNo: collectionNo || id,
    name: name || `ce${id}`,
    rarity: 4,
    cost,
    face: '',
    skills: [{ name: name || `ce${id}`, condLimitCount: 4, funcs: [fn] }],
  }
}

{
  const nine = Array.from({ length: 9 }, (_, i) =>
    ce({
      id: 8001 + i,
      collectionNo: 8001 + i,
      name: `条件${i + 1}`,
      rate: i === 8 ? 500 : 200,
      cost: 5,
      traitId: i === 8 ? 9009 : 9001,
    }),
  )
  const a = svt({ id: 11, name: 'A', traitIds: [9001], cost: 3 })
  const b = svt({ id: 12, name: 'B', traitIds: [9001], cost: 3 })
  const c = svt({ id: 13, name: 'C', traitIds: [9009], cost: 3 })
  const out = recommendTeam({
    base: 1000,
    servants: [a, b, c],
    ces: nine,
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.ceId === 8009), '第 9 张条件礼装必须可被选中')
}

{
  const a = ce({ id: 7001, collectionNo: 1, name: '贵10', rate: 100, cost: 12 })
  const b = ce({ id: 7002, collectionNo: 2, name: '廉5a', rate: 50, cost: 3 })
  const c = ce({ id: 7003, collectionNo: 3, name: '廉5b', rate: 50, cost: 3 })
  const mash = svt({ id: 800100, collectionNo: 1, name: '玛修', traitIds: [], cost: 0, rarity: 4 })
  const out = recommendTeam({
    base: 1000,
    servants: [mash],
    ces: [a, b, c],
    mode: 'free',
    allowSupport: false,
    costLimit: 6,
  })
  assert.equal(out.ok, true)
  const ids = out.slots.filter((slot) => slot.filled && slot.ceId).map((slot) => slot.ceId)
  assert.equal(ids.includes(7001), false)
  assert.ok(ids.includes(7002) || ids.includes(7003))
}

{
  const lunch = ce({ id: 3301, collectionNo: 330, name: '午餐', rate: 100, cost: 5 })
  const farmer = svt({ id: 21, name: '活', traitIds: [2654], cost: 3 })
  const out = recommendTeam({
    base: 815,
    servants: [farmer],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    costLimit: 3,
  })
  assert.equal(out.ok, true)
  assert.equal(out.costUsed <= 3, true)
}

{
  const morning = ce({ id: 21241, collectionNo: 2124, name: '迦勒底之晨', rate: 200, cost: 5, traitId: 2654 })
  const human = svt({
    id: 31,
    name: '人',
    traitIds: [1],
    cost: 3,
    forms: [
      { key: 'default', name: '默认灵基', traitIds: [1] },
      { key: 'c1', name: '灵衣', traitIds: [1, 2654] },
    ],
  })
  const out = recommendTeam({
    base: 815,
    servants: [human],
    ces: [morning],
    mode: 'free',
    allowSupport: false,
    spriteMode: 'bond_first',
  })
  assert.equal(out.ok, true)
  const slot = out.slots.find((item) => item.svtId === human.id)
  assert.ok(slot)
  assert.equal(slot.svtArtKey, 'c1')
}

{
  const aura = svt({ id: 41, name: '光环', traitIds: [], cost: 0, collectionNo: 1 })
  const live = svt({ id: 42, name: '未满', traitIds: [], cost: 3 })
  const lunch = ce({ id: 3302, collectionNo: 331, name: '午餐', rate: 100, cost: 5 })
  const account = {
    ok: true,
    servants: [
      { id: 41, bondLv: 15, bondCap: 15 },
      { id: 42, bondLv: 5, bondCap: 10 },
    ],
    ces: [{ id: 3302, mlb: true }],
  }
  const out = recommendTeam({
    base: 800,
    servants: [aura, live],
    ces: [lunch],
    account,
    mode: 'account',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const liveRow = out.output.results.find((item) => {
    const slot = out.slots.find((s) => s.position === item.position)
    return slot && slot.svtId === 42
  })
  assert.ok(liveRow)
  assert.ok(liveRow.lines.some((line) => line.key === 'bond15'))
  const auraRow = out.output.results.find((item) => {
    const slot = out.slots.find((s) => s.position === item.position)
    return slot && slot.svtId === 41
  })
  assert.ok(!auraRow || !auraRow.eligible)
}

{
  const tea = ce({ id: 9101, collectionNo: 910, name: '午茶', rate: 50, cost: 5, followerRate: 150 })
  const farmer = svt({ id: 51, name: '己方', traitIds: [], cost: 3 })
  const out = recommendTeam({
    base: 815,
    servants: [farmer],
    ces: [tea],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.ok(support)
  const live = out.output.results.find((item) => item.eligible)
  assert.ok(live.lines.some((line) => String(line.label).includes('午茶') || line.pct >= 0.15 || line.pct === 150 || line.pct === 0.15))
}

{
  const cheap = { ce: { id: 1, collectionNo: 1 }, hits: [100, 100], cost: 3 }
  const pricey = { ce: { id: 2, collectionNo: 2 }, hits: [100, 100], cost: 9 }
  assert.equal(ceDominates(cheap, pricey), false)
  assert.equal(ceDominates(pricey, cheap), false)
  const zero = { ce: { id: 3, collectionNo: 3 }, hits: [0, 0], cost: 1 }
  assert.equal(ceDominates(cheap, zero), true)
  const kept = pruneDominatedCands([cheap, pricey, zero])
  assert.equal(kept.length, 2)
}

{
  const a = svt({ id: 61, name: '甲', traitIds: [], cost: 3 })
  const b = svt({ id: 62, name: '乙', traitIds: [], cost: 3 })
  const c1 = ce({ id: 6101, collectionNo: 11, name: '10a', rate: 100, cost: 5 })
  const c2 = ce({ id: 6102, collectionNo: 12, name: '5b', rate: 50, cost: 3 })
  const servants = [a, b]
  const ces = [c1, c2]
  const out = recommendTeam({
    base: 500,
    servants,
    ces,
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)

  let best = 0
  const ceChoices = [null, c1, c2]
  for (const left of ceChoices) {
    for (const right of ceChoices) {
      if (left && right && left.id === right.id) continue
      const slots = [
        {
          position: 1,
          filled: true,
          isSupport: false,
          bond15: false,
          bondMaxed: false,
          lunch: 0,
          teaSelf: 0,
          supportTea: 0,
          holmes: 0,
          condCe: 0,
          eventPassive: 0,
          customPercent: 0,
          portrait: false,
          ceLines: [],
          ceId: left ? left.id : 0,
          ceMlb: true,
          traitIds: [],
        },
        {
          position: 2,
          filled: true,
          isSupport: false,
          bond15: false,
          bondMaxed: false,
          lunch: 0,
          teaSelf: 0,
          supportTea: 0,
          holmes: 0,
          condCe: 0,
          eventPassive: 0,
          customPercent: 0,
          portrait: false,
          ceLines: [],
          ceId: right ? right.id : 0,
          ceMlb: true,
          traitIds: [],
        },
      ]
      applyCraftEssences(slots, ces)
      const party = calcParty(500, false, slots)
      const total = party.results.reduce((sum, item) => sum + (item.eligible ? item.final : 0), 0)
      if (total > best) best = total
    }
  }
  assert.equal(out.total, best)
}

{
  assert.equal(remainingCostFeasible(10, 12, 3), false)
  assert.equal(remainingCostFeasible(10, 12, 2), true)
  assert.equal(remainingCostFeasible(10, null, 99), true)
  const cands = [
    { ce: { id: 1 }, hits: [100, 0], cost: 5 },
    { ce: { id: 2 }, hits: [0, 50], cost: 3 },
  ]
  const matrix = ceHitMatrixFromCands(cands, false)
  assert.deepEqual(matrix[1].ownRate, [100, 0])
  assert.equal(matrix[2].cost, 3)
}

{
  const lunch = ce({ id: 3309, collectionNo: 339, name: '午餐', rate: 100, cost: 5 })
  const cheap = svt({ id: 81, name: '廉', traitIds: [], cost: 3 })
  const pricey = svt({ id: 82, name: '贵', traitIds: [], cost: 16 })
  const out = recommendTeam({
    base: 815,
    servants: [cheap, pricey],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const sizes = new Set(
    (out.plans || []).map((plan) => plan.slots.filter((slot) => slot.filled && !slot.isSupport).length),
  )
  assert.ok(sizes.has(1) && sizes.has(2), '不同人数的 COST 帕累托点都要保留')
  const ub = mixUpperBound({
    farmers: [{ svt: cheap, form: { traitIds: [] } }],
    base: 815,
    ownCes: [lunch],
    useSupport: false,
  })
  const one = (out.plans || []).find(
    (plan) => plan.slots.filter((slot) => slot.filled && !slot.isSupport).length === 1,
  )
  assert.ok(one)
  assert.ok(ub >= one.total)
}

{
  const forms = [
    { svtId: 1, traitIds: [9] },
    { svtId: 2, traitIds: [] },
  ]
  const cands = [
    { ce: { id: 1 }, hits: [100, 0], cost: 5 },
    { ce: { id: 2 }, hits: [0, 50], cost: 3 },
  ]
  const matrix = ceHitMatrixFromCands(cands, false, forms)
  const hit = matrix[1][formIdOf(forms[0])]
  const miss = matrix[1][formIdOf(forms[1])]
  assert.equal(hit.ownRate, 100)
  assert.equal(hit.conditionState, 'hit')
  assert.equal(miss.ownRate, 0)
  assert.equal(miss.conditionState, 'miss')
  assert.ok(hit.matchedEffects.length)
}

{
  const groups = groupCandsByEffect([
    { ce: { id: 1, collectionNo: 1 }, hits: [100], cost: 9 },
    { ce: { id: 2, collectionNo: 2 }, hits: [100], cost: 3 },
    { ce: { id: 3, collectionNo: 3 }, hits: [50], cost: 4 },
  ])
  assert.equal(groups.length, 2)
  assert.equal(groups[0][0].ce.id, 2)
  const picks = []
  eachPrefixCombos(groups, 2, (pick) => picks.push(pick.map((cand) => cand.ce.id).join(',')))
  assert.ok(picks.includes(''))
  assert.ok(picks.includes('2'))
  assert.ok(picks.includes('2,1'))
  assert.ok(picks.includes('3'))
  assert.ok(picks.includes('2,3'))
  assert.ok(picks.includes('1'))
  assert.ok(picks.includes('1,3'))
}

{
  const cheap = svt({ id: 91, name: '廉', traitIds: [], cost: 3 })
  const lunch = ce({ id: 3391, collectionNo: 3391, name: '午餐', rate: 100, cost: 5 })
  const ub0 = mixUpperBound0({ farmers: [{ svt: cheap, form: { traitIds: [] } }], base: 815 })
  const ub1 = mixUpperBound({
    farmers: [{ svt: cheap, form: { traitIds: [] } }],
    base: 815,
    ownCes: [lunch],
    useSupport: false,
  })
  assert.ok(ub0 >= ub1)
}

{
  const aura = svt({ id: 101, name: '光环', traitIds: [], cost: 0, collectionNo: 1 })
  const live = svt({ id: 102, name: '未满', traitIds: [], cost: 3 })
  const account = {
    servants: [
      { id: 101, bondLv: 15, bondCap: 15 },
      { id: 102, bondLv: 5, bondCap: 10 },
    ],
  }
  const state15 = createState15(
    [
      { svt: aura, form: { traitIds: [] } },
      { svt: live, form: { traitIds: [] } },
    ],
    account,
    true,
  )
  assert.equal(state15.supportExcluded, true)
  assert.equal(state15Milli(state15, 101), 0)
  assert.equal(state15Milli(state15, 102), 250)
}

{
  const farmer = svt({ id: 111, name: '活', traitIds: [], cost: 3 })
  const lunch = ce({ id: 3401, collectionNo: 3401, name: '午餐', rate: 100, cost: 5 })
  const ubAll = mixUpperBound2({
    farmers: [{ svt: farmer, form: { traitIds: [] } }],
    base: 815,
    ownCes: [lunch],
    useSupport: false,
  })
  const ubNone = mixUpperBound2({
    farmers: [{ svt: farmer, form: { traitIds: [] } }],
    base: 815,
    ownCes: [lunch],
    useSupport: false,
    remainingCost: 0,
  })
  assert.ok(ubAll >= ubNone)
}

{
  const a = svt({ id: 121, name: 'A', traitIds: [], cost: 3 })
  const b = svt({ id: 122, name: 'B', traitIds: [], cost: 4 })
  const seed = warmStartMix(
    [],
    [
      { svt: a, form: { traitIds: [] } },
      { svt: b, form: { traitIds: [] } },
    ],
    [],
    2,
  )
  assert.equal(seed.ok, true)
  assert.equal(seed.farmers.length, 2)
}

{
  const farmer = svt({ id: 131, name: '战', traitIds: [], cost: 3, atk: 12000 })
  const lunch = ce({ id: 3411, collectionNo: 3411, name: '午餐', rate: 100, cost: 5 })
  const plan = recommendTeam({
    base: 815,
    servants: [farmer],
    ces: [lunch],
    allowSupport: false,
    game: {
      skills: [{ svtId: 131, name: '充能', npCharge: 50, target: 'self' }],
      noblePhantasms: [{ svtId: 131, npMultiplier: 5, npGain: 0.8 }],
    },
  })
  assert.equal(plan.ok, true)
  const slot = plan.slots.find((item) => item.svtId === 131)
  assert.equal(slot.skills[0].npCharge, 50)
  assert.equal(slot.npMultiplier, 5)
  assert.equal(slot.atk, 12000)
}

{
  assert.equal(comboCount(9, 6), 84)
  assert.equal(comboCount(5, 0), 1)
  const picks = []
  eachCombination(['a', 'b', 'c'], 2, (pick) => picks.push(pick.join('')))
  assert.deepEqual(picks, ['ab', 'ac', 'bc'])
}

{
  const others = Array.from({ length: 8 }, (_, i) =>
    svt({ id: 501 + i, collectionNo: 501 + i, name: `前${i + 1}`, traitIds: [9009], cost: 3 }),
  )
  const aura = svt({ id: 509, collectionNo: 509, name: '十五', traitIds: [9009], cost: 3 })
  const lunch = ce({ id: 3501, collectionNo: 3501, name: '午餐', rate: 100, cost: 5 })
  const cond = ce({ id: 3502, collectionNo: 3502, name: '条件', rate: 200, cost: 5, traitId: 9009 })
  const account = {
    ok: true,
    servants: [
      ...others.map((item) => ({ id: item.id, bondLv: 5, bondCap: 10 })),
      { id: 509, bondLv: 15, bondCap: 16 },
    ],
    ces: [
      { id: 3501, mlb: true },
      { id: 3502, mlb: true },
    ],
  }
  const out = recommendTeam({
    base: 800,
    servants: [...others, aura],
    ces: [lunch, cond],
    account,
    mode: 'account',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(
    out.slots.some((slot) => slot.svtId === 509),
    '密度排序靠后的第 9 名 15绊从者必须上场',
  )
}

{
  const twins = Array.from({ length: 7 }, (_, i) =>
    svt({ id: 701 + i, collectionNo: 701 + i, name: `同效${i + 1}`, traitIds: [9011], cost: 16 }),
  )
  const cheap = svt({ id: 708, collectionNo: 708, name: '同效廉', traitIds: [9011], cost: 3 })
  const cond = ce({ id: 3601, collectionNo: 3601, name: '条件', rate: 200, cost: 5, traitId: 9011 })
  const out = recommendTeam({
    base: 800,
    servants: [...twins, cheap],
    ces: [cond],
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(
    out.slots.some((slot) => slot.svtId === 708),
    '同效果更便宜的从者必须保留',
  )
}

{
  const cheap = { ce: { id: 1, collectionNo: 1 }, hits: [100, 100], cost: 3 }
  const pricey = { ce: { id: 2, collectionNo: 2 }, hits: [100, 100], cost: 9 }
  const split = { ce: { id: 4, collectionNo: 4 }, hits: [120, 80], cost: 3 }
  const supportish = { ce: { id: 5, collectionNo: 5 }, hits: [100, 150], cost: 3 }
  assert.equal(ceDominates(cheap, pricey), false)
  assert.equal(ceDominates(cheap, split), false)
  assert.equal(ceDominates(cheap, supportish), false)
  const pinned = { ce: { id: 6, collectionNo: 6 }, hits: [0, 0], cost: 5 }
  assert.equal(ceDominates(cheap, pinned), true)
  const kept = pruneDominatedCands([cheap, pricey, split, supportish, pinned])
  assert.equal(kept.some((cand) => cand.ce.id === 6), false)
  assert.equal(kept.some((cand) => cand.ce.id === 2), true)
  assert.equal(kept.some((cand) => cand.ce.id === 4), true)
}

{
  const groups = groupCandsByEffect([
    { ce: { id: 1, collectionNo: 1 }, hits: [100], cost: 9 },
    { ce: { id: 2, collectionNo: 2 }, hits: [100], cost: 5 },
    { ce: { id: 3, collectionNo: 3 }, hits: [100], cost: 3 },
    { ce: { id: 4, collectionNo: 4 }, hits: [80], cost: 4 },
  ])
  const same = groups.find((group) => group[0].hits[0] === 100)
  assert.ok(same)
  assert.deepEqual(same.map((cand) => cand.ce.id), [3, 2, 1])
  const condA = { ce: { id: 11, collectionNo: 11 }, hits: [200, 0], cost: 5 }
  const condB = { ce: { id: 12, collectionNo: 12 }, hits: [0, 200], cost: 5 }
  const byCond = groupCandsByEffect([condA, condB])
  assert.equal(byCond.length, 2)
}

{
  const live = svt({ id: 1401, name: '刷', cost: 3 })
  const aura = svt({ id: 1402, name: '光', cost: 3 })
  const lunch = ce({ id: 3701, collectionNo: 3701, name: '午餐', rate: 100, cost: 5 })
  function run(bondLv, bondCap) {
    return recommendTeam({
      base: 800,
      servants: [live, aura],
      ces: [lunch],
      mode: 'account',
      account: {
        servants: [
          { id: live.id, bondLv: 5, bondCap: 10 },
          { id: aura.id, bondLv, bondCap },
        ],
        ces: [{ id: lunch.id, mlb: true }],
      },
      allowSupport: false,
      lockSvtIds: [aura.id],
    })
  }
  const cap12 = run(12, 12)
  assert.equal(cap12.ok, true)
  const aura12 = cap12.slots.find((slot) => slot.svtId === aura.id)
  assert.equal(aura12.bondMaxed, true)
  assert.equal(aura12.bond15, false)
  const row12 = cap12.output.results.find((item) => item.position === aura12.position)
  assert.equal(row12.eligible, false)
  const live12 = cap12.output.results.find((item) => {
    const slot = cap12.slots.find((s) => s.position === item.position)
    return slot && slot.svtId === live.id
  })
  assert.equal(live12.lines.some((line) => line.key === 'bond15'), false)

  const mid = run(14, 15)
  const aura14 = mid.slots.find((slot) => slot.svtId === aura.id)
  const row14 = mid.output.results.find((item) => item.position === aura14.position)
  assert.equal(row14.eligible, true)
  assert.equal(aura14.bond15, false)

  const full15 = run(15, 15)
  const aura15 = full15.slots.find((slot) => slot.svtId === aura.id)
  const row15 = full15.output.results.find((item) => item.position === aura15.position)
  assert.equal(row15.eligible, false)
  const live15 = full15.output.results.find((item) => {
    const slot = full15.slots.find((s) => s.position === item.position)
    return slot && slot.svtId === live.id
  })
  assert.ok(live15.lines.some((line) => line.key === 'bond15'))

  const farm16 = run(15, 16)
  const aura156 = farm16.slots.find((slot) => slot.svtId === aura.id)
  const row156 = farm16.output.results.find((item) => item.position === aura156.position)
  assert.equal(row156.eligible, true)
  assert.equal(aura156.bond15, true)

  const max16 = run(16, 16)
  const aura16 = max16.slots.find((slot) => slot.svtId === aura.id)
  const row16 = max16.output.results.find((item) => item.position === aura16.position)
  assert.equal(row16.eligible, false)
  assert.equal(aura16.bond15, true)
  const live16 = max16.output.results.find((item) => {
    const slot = max16.slots.find((s) => s.position === item.position)
    return slot && slot.svtId === live.id
  })
  assert.ok(live16.lines.some((line) => line.key === 'bond15'))
}

{
  const cheap = { ce: { id: 1, collectionNo: 1 }, hits: [100, 100], cost: 3, fixedAdd: 0 }
  const pricey = { ce: { id: 2, collectionNo: 2 }, hits: [100, 100], cost: 9, fixedAdd: 0 }
  const mixed = { ce: { id: 3, collectionNo: 3 }, hits: [200, 0], cost: 3 }
  const supportish = { ce: { id: 4, collectionNo: 4 }, hits: [100, 150], cost: 3 }
  const fixed = { ce: { id: 5, collectionNo: 5 }, hits: [100, 100], cost: 3, fixedAdd: 50 }
  const cond = { ce: { id: 6, collectionNo: 6 }, hits: [100, 0], cost: 3, conditionState: 'hit' }
  const pinned = { ce: { id: 7, collectionNo: 7 }, hits: [0, 0], cost: 5 }
  assert.equal(ceDominates(cheap, pricey), false)
  assert.equal(ceDominates(pricey, cheap), false)
  assert.equal(ceDominates(cheap, mixed), false)
  assert.equal(ceDominates(cheap, supportish), false)
  assert.equal(ceDominates(cheap, fixed), false)
  assert.equal(ceDominates(cheap, cond), false)
  assert.equal(ceDominates(cheap, pinned), true)
  const kept = pruneDominatedCands([cheap, pricey, mixed, supportish, fixed, cond, pinned])
  assert.equal(kept.some((cand) => cand.ce.id === 7), false)
  assert.equal(kept.length, 6)
}

{
  const cheap = svt({ id: 1601, collectionNo: 1601, name: '同效廉', traitIds: [9021], cost: 3 })
  const pricey = svt({ id: 1610, collectionNo: 1610, name: '同效贵', traitIds: [9021], cost: 16 })
  const out = recommendTeam({
    base: 800,
    servants: [cheap, pricey],
    ces: [],
    mode: 'free',
    allowSupport: false,
    costLimit: 16,
  })
  assert.equal(out.ok, true)
  const own = out.slots.find((slot) => slot.filled && !slot.isSupport)
  assert.equal(own && own.svtId, pricey.id)
}

{
  const a = svt({ id: 1701, collectionNo: 1701, name: '甲', traitIds: [9022], cost: 3, rarity: 3 })
  const b = svt({ id: 1702, collectionNo: 1702, name: '乙', traitIds: [9022], cost: 3, rarity: 5 })
  const lunch = ce({ id: 1710, collectionNo: 1710, name: '午餐', rate: 100, cost: 5 })
  const out = recommendTeam({
    base: 800,
    servants: [a, b],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    costLimit: 3,
    priorities: [{ type: 'rarity', operator: '>=', value: 5, weight: 20, enabled: true }],
  })
  assert.equal(out.ok, true)
  const own = out.slots.find((slot) => slot.filled && !slot.isSupport)
  assert.equal(own && own.svtId, b.id)
}

{
  const farmer = svt({ id: 1801, name: '前排', cost: 3 })
  const tea = ce({ id: 1810, collectionNo: 1810, name: '午茶', rate: 50, cost: 5, followerRate: 150 })
  const out = recommendTeam({
    base: 815,
    servants: [farmer],
    ces: [tea],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const live = out.output.results.find((item) => item.eligible)
  assert.ok(live)
  const front = live.lines.find((line) => line.key === 'front')
  assert.ok(front)
  assert.equal(front.pct, 0.2)
  assert.equal(live.lines.some((line) => line.key === 'front-share'), false)
  const farmers = [{ svt: farmer, form: { traitIds: [] } }]
  const ub = mixUpperBound({ farmers, base: 815, ownCes: [tea], supportCes: [tea], useSupport: true })
  assert.ok(ub >= out.total)
}

{
  const copies = Array.from({ length: 40 }, (_, i) =>
    svt({ id: 9100 + i, collectionNo: 9100 + i, name: `同${i}`, traitIds: [9011], cost: 16 }),
  )
  const cheap = svt({ id: 9199, collectionNo: 1, name: '廉', traitIds: [9011], cost: 3 })
  const cond = ce({ id: 9201, collectionNo: 9201, name: '条件', rate: 200, cost: 5, traitId: 9011 })
  const t0 = Date.now()
  const out = recommendTeam({
    base: 800,
    servants: [...copies, cheap],
    ces: [cond],
    mode: 'free',
    allowSupport: false,
  })
  assert.ok(Date.now() - t0 < 5000, '同效果从者不应穷举全部编号')
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === 9199))
}

{
  const forms = []
  for (let i = 0; i < 5; i++) {
    forms.push({ svt: svt({ id: 1, cost: 3 }), form: { traitIds: [] } })
    forms.push({ svt: svt({ id: 2, cost: 3 }), form: { traitIds: [] } })
  }
  const milliOn = () => 100
  const ubManyForms = partyBranchUpperBound({
    selected: [],
    leftover: forms,
    need: 5,
    base: 815,
    milliOn,
    useSupport: false,
  })
  const ubTwo = partyBranchUpperBound({
    selected: [],
    leftover: forms.slice(0, 2),
    need: 2,
    base: 815,
    milliOn,
    useSupport: false,
  })
  assert.equal(ubManyForms, ubTwo)
}

{
  const ub = ceFillUpperBound({
    add: [100, 100],
    leftoverCands: [
      { hits: [200, 0], cost: 5 },
      { hits: [0, 200], cost: 5 },
    ],
    left: 1,
    base: 815,
    useSupport: false,
    maxed: [false, false],
    auraMilli: [0, 0],
  })
  assert.ok(ub > 0)
}

{
  const many = Array.from({ length: 12 }, (_, i) =>
    svt({ id: 4001 + i, collectionNo: 4001 + i, name: `异效${i}`, traitIds: [9100 + i], cost: 3 }),
  )
  const out = recommendTeam({
    base: 800,
    servants: many,
    ces: [],
    mode: 'free',
    allowSupport: false,
    costLimit: 16,
  })
  assert.equal(out.ok, true)
  const all = out.allPlans || []
  assert.ok(all.length > 0)
  if (all.length > 16) {
    const cutoff = all[15].total || 0
    assert.ok(
      all.slice(15).every((plan) => (plan.total || 0) === cutoff),
      'plans beyond 16 must share the 16th total',
    )
  }
  assert.equal(all.length, (out.plans || []).length)
}

console.log('solver tests passed')
