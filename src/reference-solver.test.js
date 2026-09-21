import assert from 'node:assert/strict'
import { assemblePlan, comparePlans, frontLayouts, mixUpperBound, mixUpperBound0, mixUpperBound2, partyCostOf, recommendTeam } from './recommend.js'
import { formStateKey, loadoutMemoKey } from './solver-pruner.js'
import { objectivesEqual, planObjective, referenceRecommendTeam } from './reference-solver.js'

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

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bestPlan(rec) {
  const pool = rec.allPlans && rec.allPlans.length ? rec.allPlans : rec.plans && rec.plans.length ? rec.plans : [rec]
  return pool.slice().sort(comparePlans)[0]
}

function gotPlan(rec) {
  if (Number.isInteger(rec.focusCost) && rec.focusCost >= 0) return rec
  return bestPlan(rec)
}

{
  const keyA = loadoutMemoKey({ formKey: 'f', frontIds: [1, 2, 3], slotPins: [] })
  const keyB = loadoutMemoKey({ formKey: 'f', frontIds: [4, 5, 6], slotPins: [] })
  assert.notEqual(keyA, keyB)
  const pinA = loadoutMemoKey({ formKey: 'f', slotPins: [{ position: 5, svtId: 9, ceId: 0, ceBondId: 0, ceRewardId: 0 }] })
  const pinB = loadoutMemoKey({ formKey: 'f', slotPins: [{ position: 1, svtId: 9, ceId: 0, ceBondId: 0, ceRewardId: 0 }] })
  assert.notEqual(pinA, pinB)
}

{
  const farmer = svt({ id: 801, name: '己', cost: 3 })
  const tea = ce({ id: 9108, collectionNo: 910, name: '午茶', rate: 50, cost: 5, followerRate: 150 })
  const out = recommendTeam({
    base: 815,
    servants: [farmer],
    ces: [tea],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const farmers = [{ svt: farmer, form: { traitIds: [] } }]
  const ub0 = mixUpperBound0({ farmers, base: 815 })
  const ub1 = mixUpperBound({
    farmers,
    base: 815,
    ownCes: [tea],
    supportCes: [tea],
    useSupport: true,
  })
  const ub2 = mixUpperBound2({
    farmers,
    base: 815,
    ownCes: [tea],
    supportCes: [tea],
    useSupport: true,
  })
  assert.ok(ub0 >= out.total)
  assert.ok(ub1 >= out.total)
  assert.ok(ub2 >= out.total)
}

{
  const a = svt({ id: 811, name: 'A', cost: 3 })
  const b = svt({ id: 812, name: 'B', cost: 3 })
  const lunch = ce({ id: 3308, collectionNo: 330, name: '午餐', rate: 100, cost: 5 })
  const tea = ce({ id: 9109, collectionNo: 910, name: '午茶', rate: 50, cost: 5, followerRate: 150 })
  const opts = {
    base: 815,
    servants: [a, b],
    ces: [lunch, tea],
    mode: 'free',
    allowSupport: true,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  assert.equal(reference.ok, true)
  assert.ok(objectivesEqual(gotPlan(optimized), reference), JSON.stringify({ o: planObjective(gotPlan(optimized)), r: planObjective(reference) }))
}

{
  const saber = svt({ id: 821, name: '钉前', cost: 3 })
  const rider = svt({ id: 822, name: '钉后', cost: 3 })
  const extra = svt({ id: 823, name: '补位', cost: 3 })
  const lunch = ce({ id: 3318, collectionNo: 330, name: '午餐', rate: 100, cost: 5 })
  const opts = {
    base: 815,
    servants: [saber, rider, extra],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    slotPins: [
      { position: 1, svtId: saber.id },
      { position: 5, svtId: rider.id },
    ],
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  assert.equal(reference.ok, true)
  assert.equal(optimized.slots[0].svtId, saber.id)
  assert.equal(optimized.slots[4].svtId, rider.id)
  assert.ok(objectivesEqual(gotPlan(optimized), reference))
}

{
  const rng = mulberry32(20260920)
  let compared = 0
  let ubFail = 0
  for (let n = 0; n < 24; n++) {
    const svtN = 1 + Math.floor(rng() * 3)
    const ceN = 1 + Math.floor(rng() * 3)
    const servants = Array.from({ length: svtN }, (_, i) =>
      svt({
        id: 9000 + n * 10 + i,
        name: `r${n}s${i}`,
        cost: 3 + Math.floor(rng() * 4),
        traitIds: rng() > 0.5 ? [104] : [],
      }),
    )
    const ces = Array.from({ length: ceN }, (_, i) =>
      ce({
        id: 19000 + n * 10 + i,
        collectionNo: 19000 + n * 10 + i,
        name: `r${n}c${i}`,
        rate: 50 + Math.floor(rng() * 3) * 50,
        cost: 3 + Math.floor(rng() * 3),
        traitId: rng() > 0.7 ? 104 : 0,
        followerRate: 50 + Math.floor(rng() * 3) * 50,
      }),
    )
    const opts = {
      base: 500 + Math.floor(rng() * 400),
      teapot: rng() > 0.7,
      servants,
      ces,
      mode: 'free',
      allowSupport: rng() > 0.4,
    }
    const optimized = recommendTeam(opts)
    const reference = referenceRecommendTeam(opts)
    if (!optimized.ok || !reference.ok) continue
    compared += 1
    assert.ok(
      objectivesEqual(gotPlan(optimized), reference),
      `random ${n} ${JSON.stringify({ o: planObjective(gotPlan(optimized)), r: planObjective(reference) })}`,
    )
    const farmers = servants.map((item) => ({ svt: item, form: { traitIds: item.traitIds || [] } }))
    const ub = mixUpperBound({
      farmers,
      base: opts.base,
      teapot: opts.teapot,
      ownCes: ces,
      supportCes: ces,
      useSupport: opts.allowSupport,
    })
    if (ub < gotPlan(optimized).total) ubFail += 1
  }
  assert.ok(compared >= 12, `random compared ${compared}`)
  assert.equal(ubFail, 0)
}

{
  const keyCheap = formStateKey([{ svtId: 1, traitIds: [9], cost: 3 }], [0], [0])
  const keyPricey = formStateKey([{ svtId: 1, traitIds: [9], cost: 16 }], [0], [0])
  assert.notEqual(keyCheap, keyPricey)
}

{
  const hero = svt({
    id: 2101,
    name: '双形态',
    cost: 3,
    traitIds: [11, 12, 13],
    forms: [{ key: 'c1', name: '衣', traitIds: [99], cost: 12, rarity: 3, attribute: 'earth' }],
  })
  const weak1 = ce({ id: 2111, collectionNo: 2111, name: '弱1', rate: 10, cost: 3, traitId: 11 })
  const weak2 = ce({ id: 2112, collectionNo: 2112, name: '弱2', rate: 10, cost: 3, traitId: 12 })
  const weak3 = ce({ id: 2113, collectionNo: 2113, name: '弱3', rate: 10, cost: 3, traitId: 13 })
  const strong = ce({ id: 2114, collectionNo: 2114, name: '强', rate: 500, cost: 3, traitId: 99 })
  const opts = {
    base: 800,
    servants: [hero],
    ces: [weak1, weak2, weak3, strong],
    mode: 'free',
    allowSupport: false,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  assert.equal(reference.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  const own = best.slots.find((slot) => slot.filled && !slot.isSupport)
  assert.equal(own.svtArtKey, 'c1')
  assert.equal(own.ceId, strong.id)
}

{
  const farmer = svt({ id: 2201, name: '填COST', cost: 3 })
  const cheap = ce({ id: 2211, collectionNo: 2211, name: '廉礼', rate: 100, cost: 3 })
  const pricey = ce({ id: 2212, collectionNo: 2212, name: '贵礼', rate: 100, cost: 9 })
  const opts = {
    base: 800,
    servants: [farmer],
    ces: [cheap, pricey],
    mode: 'free',
    allowSupport: false,
    costLimit: 12,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  assert.equal(best.costUsed, 12)
  const own = best.slots.find((slot) => slot.filled && !slot.isSupport)
  assert.equal(own.ceId, pricey.id)
}

{
  const a = svt({ id: 2301, collectionNo: 2301, name: 'A', cost: 3 })
  const b = svt({ id: 2302, collectionNo: 2302, name: 'B', cost: 3 })
  const c = svt({ id: 2303, collectionNo: 2303, name: 'C', cost: 16 })
  const lunch = ce({ id: 2310, collectionNo: 2310, name: '午餐', rate: 100, cost: 5 })
  const opts = {
    base: 800,
    servants: [a, b, c],
    ces: [lunch],
    mode: 'account',
    account: {
      servants: [
        { id: a.id, bondLv: 5, bondCap: 10 },
        { id: b.id, bondLv: 5, bondCap: 10 },
        { id: c.id, bondLv: 15, bondCap: 16 },
      ],
      ces: [{ id: lunch.id, mlb: true }],
    },
    allowSupport: false,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  const ids = best.slots.filter((slot) => slot.filled && !slot.isSupport).map((slot) => slot.svtId).sort()
  assert.ok(ids.includes(c.id), `bond15 servant dropped: ${ids.join(',')}`)
}

{
  const saber = svt({ id: 2401, name: '冠位剑', className: 'saber', cost: 3 })
  const cheap = ce({ id: 2411, collectionNo: 2411, name: '廉', rate: 100, cost: 3 })
  const pricey = ce({ id: 2412, collectionNo: 2412, name: '贵', rate: 100, cost: 12 })
  const opts = {
    base: 800,
    servants: [saber],
    ces: [cheap, pricey],
    mode: 'free',
    allowSupport: false,
    questType: 'grand',
    questClass: 'saber',
    costLimit: 18,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  const grand = best.slots.find((slot) => slot.isGrand)
  assert.ok(grand)
  assert.equal(grand.ceRewardId, cheap.id)
  assert.equal(grand.ceId, pricey.id)
}

{
  const a = svt({ id: 2501, name: '甲', cost: 3 })
  const b = svt({ id: 2502, name: '乙', cost: 3 })
  const lunch = ce({ id: 2510, collectionNo: 2510, name: '午餐', rate: 100, cost: 5 })
  const tea = ce({ id: 2511, collectionNo: 2511, name: '午茶', rate: 50, cost: 5, followerRate: 150 })
  const opts = {
    base: 800,
    servants: [a, b],
    ces: [lunch, tea],
    mode: 'account',
    account: {
      servants: [
        { id: a.id, bondLv: 4, bondCap: 10 },
        { id: b.id, bondLv: 4, bondCap: 10 },
      ],
      ces: [{ id: lunch.id, mlb: true }],
    },
    allowSupport: false,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  const ownIds = best.slots.filter((slot) => slot.filled && !slot.isSupport).map((slot) => slot.ceId).filter(Boolean)
  assert.equal(ownIds.filter((id) => id === lunch.id).length, 1)
  assert.equal(ownIds.includes(tea.id), false)
}

{
  const rng = mulberry32(260920)
  let compared = 0
  let ubFail = 0
  for (let n = 0; n < 12; n++) {
    const svtN = 1 + Math.floor(rng() * 2)
    const servants = Array.from({ length: svtN }, (_, i) =>
      svt({
        id: 26000 + n * 10 + i,
        name: `g${n}s${i}`,
        className: 'saber',
        cost: 3 + Math.floor(rng() * 4),
      }),
    )
    const ces = Array.from({ length: 1 + Math.floor(rng() * 2) }, (_, i) =>
      ce({
        id: 26100 + n * 10 + i,
        collectionNo: 26100 + n * 10 + i,
        name: `g${n}c${i}`,
        rate: 50 + Math.floor(rng() * 2) * 50,
        cost: 3 + Math.floor(rng() * 3),
      }),
    )
    const opts = {
      base: 700,
      servants,
      ces,
      mode: 'free',
      allowSupport: false,
      questType: 'grand',
      questClass: 'saber',
      costLimit: rng() > 0.5 ? 20 + Math.floor(rng() * 20) : null,
    }
    const optimized = recommendTeam(opts)
    const reference = referenceRecommendTeam(opts)
    if (!optimized.ok || !reference.ok) continue
    compared += 1
    assert.ok(
      objectivesEqual(gotPlan(optimized), reference),
      `grand random ${n} ${JSON.stringify({ o: planObjective(gotPlan(optimized)), r: planObjective(reference) })}`,
    )
    const farmers = servants.map((item) => ({ svt: item, form: { traitIds: item.traitIds || [] } }))
    const ub = mixUpperBound({
      farmers,
      base: opts.base,
      ownCes: ces,
      supportCes: ces,
      useSupport: false,
      grand: true,
    })
    if (ub < gotPlan(optimized).total) ubFail += 1
  }
  assert.ok(compared >= 6, `grand compared ${compared}`)
  assert.equal(ubFail, 0)
}

{
  const a = svt({ id: 2701, name: '甲', cost: 3 })
  const b = svt({ id: 2702, name: '乙', cost: 3 })
  const lunch = ce({ id: 2710, collectionNo: 2710, name: '午餐', rate: 100, cost: 5 })
  const opts = {
    base: 800,
    servants: [a, b],
    ces: [lunch],
    mode: 'account',
    account: {
      servants: [
        { id: a.id, bondLv: 4, bondCap: 10 },
        { id: b.id, bondLv: 4, bondCap: 10 },
      ],
      ces: [{ id: lunch.id, mlb: true }, { id: lunch.id, mlb: true }],
    },
    allowSupport: false,
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  const ownIds = best.slots.filter((slot) => slot.filled && !slot.isSupport).map((slot) => slot.ceId).filter(Boolean)
  assert.equal(ownIds.filter((id) => id === lunch.id).length, 2)
}

{
  const saber = svt({ id: 2801, name: '冠位剑', className: 'saber', cost: 3 })
  const tea = ce({ id: 2810, collectionNo: 2810, name: '午茶', rate: 50, cost: 5, followerRate: 150 })
  const lunch = ce({ id: 2811, collectionNo: 2811, name: '午餐', rate: 100, cost: 5 })
  const opts = {
    base: 800,
    servants: [saber],
    ces: [tea, lunch],
    mode: 'free',
    allowSupport: true,
    questType: 'grand',
    questClass: 'saber',
  }
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true)
  const best = gotPlan(optimized)
  assert.ok(objectivesEqual(best, reference), JSON.stringify({ o: planObjective(best), r: planObjective(reference) }))
  const support = best.slots.find((slot) => slot.isSupport)
  assert.ok(support)
  assert.ok(support.ceId)
  assert.ok(support.ceRewardId)
  assert.notEqual(support.ceId, support.ceRewardId)
}

function assertMatchReference(opts, label) {
  const optimized = recommendTeam(opts)
  const reference = referenceRecommendTeam(opts)
  assert.equal(optimized.ok, true, `${label} optimized fail`)
  assert.equal(reference.ok, true, `${label} reference fail`)
  const got = gotPlan(optimized)
  assert.ok(
    objectivesEqual(got, reference),
    `${label} ${JSON.stringify({ o: planObjective(got), r: planObjective(reference) })}`,
  )
  return got
}

{
  const counts = [1, 1, 1, 4, 10, 20]
  for (let n = 1; n <= 6; n++) {
    const farmers = Array.from({ length: n }, (_, i) => ({
      svt: svt({ id: 3000 + i, name: `f${n}${i}` }),
      form: { traitIds: [] },
    }))
    assert.equal(frontLayouts(farmers, [], []).length, counts[n - 1], `frontCombos n=${n}`)
  }
}

{
  const servants = [0, 1, 2, 3].map((i) => svt({ id: 3100 + i, name: `perm${i}`, cost: 3 }))
  const lunch = ce({ id: 3110, collectionNo: 3110, name: '午餐', rate: 100, cost: 5 })
  const farmers = servants.map((item) => ({ svt: item, form: { traitIds: [] } }))
  const common = {
    base: 815,
    teapot: false,
    servants,
    ces: [lunch],
    account: null,
    mode: 'free',
    useSupport: false,
    farmers,
    preferSvts: [],
    questType: 'normal',
    questClass: '',
    costLimit: null,
    grand: false,
    bond15Aura: true,
    lockSvts: [],
    optimizeBy: 'total',
    priorities: [],
    pinCes: [],
    spriteMode: 'bond_first',
    pinSprites: [],
    slotPins: [],
  }
  const totals = []
  for (const frontIdx of [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]) {
    const plan = assemblePlan({
      ...common,
      loadout: { ownNormal: [lunch], ownReward: null, support: null, supportReward: null, frontIdx },
    })
    totals.push(plan.total)
  }
  assert.ok(totals.every((value) => value === totals[0]), `front permutation totals ${totals.join(',')}`)
}

{
  const lunch = ce({ id: 3200, collectionNo: 3200, name: '午餐', rate: 100, cost: 5 })
  for (let n = 1; n <= 6; n++) {
    const servants = Array.from({ length: n }, (_, i) =>
      svt({ id: 3300 + n * 10 + i, name: `lay${n}s${i}`, className: 'saber', cost: 3 }),
    )
    const baseOpts = {
      base: 815,
      servants,
      ces: [lunch],
      mode: 'free',
    }
    assertMatchReference({ ...baseOpts, allowSupport: false }, `front n=${n} no pin`)
    assertMatchReference(
      { ...baseOpts, allowSupport: false, slotPins: [{ position: 1, svtId: servants[0].id }] },
      `front n=${n} front pin`,
    )
    if (n >= 4) {
      assertMatchReference(
        { ...baseOpts, allowSupport: false, slotPins: [{ position: 5, svtId: servants[n - 1].id }] },
        `front n=${n} back pin`,
      )
    }
    assertMatchReference({ ...baseOpts, allowSupport: true }, `front n=${n} support back`)
    assertMatchReference(
      {
        ...baseOpts,
        allowSupport: false,
        slotPins: [{ position: n <= 3 ? 1 : 4, svtId: servants[0].id, ceId: lunch.id }],
      },
      `front n=${n} slot pin`,
    )
    assertMatchReference(
      { ...baseOpts, allowSupport: false, questType: 'grand', questClass: 'saber' },
      `front n=${n} grand`,
    )
  }
}

{
  const cheapSvt = svt({ id: 3401, name: '低COST低羁绊', cost: 3, traitIds: [] })
  const richSvt = svt({ id: 3402, name: '高COST高羁绊', cost: 12, traitIds: [104] })
  const weak = ce({ id: 3411, collectionNo: 3411, name: '弱', rate: 50, cost: 3 })
  const strong = ce({ id: 3412, collectionNo: 3412, name: '强', rate: 200, cost: 9, traitId: 104 })
  const noLimit = assertMatchReference(
    { base: 800, servants: [cheapSvt, richSvt], ces: [weak, strong], mode: 'free', allowSupport: false },
    'cost no limit',
  )
  assert.ok(noLimit.slots.some((slot) => slot.svtId === richSvt.id && slot.ceId === strong.id))

  const capped = assertMatchReference(
    {
      base: 800,
      servants: [cheapSvt, richSvt],
      ces: [weak, strong],
      mode: 'free',
      allowSupport: false,
      costLimit: 6,
    },
    'cost over by many',
  )
  assert.equal(capped.costUsed <= 6, true)
  assert.equal(
    capped.slots.some((slot) => slot.svtId === richSvt.id),
    false,
  )

  const mash = svt({ id: 800100, collectionNo: 1, name: '玛修', cost: 0, rarity: 4 })
  const equal = assertMatchReference(
    {
      base: 800,
      servants: [mash],
      ces: [weak],
      mode: 'free',
      allowSupport: false,
      costLimit: 3,
    },
    'cost equal limit',
  )
  assert.equal(equal.costUsed, 3)

  const overOne = recommendTeam({
    base: 800,
    servants: [cheapSvt],
    ces: [strong],
    mode: 'free',
    allowSupport: false,
    costLimit: 11,
  })
  assert.equal(overOne.ok, true)
  assert.equal(overOne.costUsed <= 11, true)
  assert.equal(
    overOne.slots.some((slot) => slot.ceId === strong.id),
    false,
  )

  const withSupport = assertMatchReference(
    {
      base: 800,
      servants: [cheapSvt],
      ces: [weak, strong],
      mode: 'free',
      allowSupport: true,
    },
    'support cost 0',
  )
  const supportSlot = withSupport.slots.find((slot) => slot.isSupport)
  assert.ok(supportSlot && supportSlot.ceId)
  assert.equal(withSupport.costUsed, partyCostOf(withSupport.slots, [cheapSvt], [weak, strong]))
  assert.equal(withSupport.costUsed, cheapSvt.cost + weak.cost)

  const saber = svt({ id: 3403, name: '冠位剑', className: 'saber', cost: 3 })
  const grand = assertMatchReference(
    {
      base: 800,
      servants: [saber],
      ces: [weak, strong],
      mode: 'free',
      allowSupport: false,
      questType: 'grand',
      questClass: 'saber',
    },
    'grand reward free',
  )
  const grandSlot = grand.slots.find((slot) => slot.isGrand)
  assert.ok(grandSlot)
  assert.ok(grandSlot.ceRewardId)
  const reward = [weak, strong].find((item) => item.id === grandSlot.ceRewardId)
  const normal = [weak, strong].find((item) => item.id === grandSlot.ceId)
  assert.equal(grand.costUsed, saber.cost + (normal ? normal.cost : 0))
  if (reward) assert.notEqual(grand.costUsed, saber.cost + (normal ? normal.cost : 0) + reward.cost)
}

{
  const rng = mulberry32(20260921)
  const sizes = [
    [1, 10, true],
    [2, 10, false],
    [3, 8, false],
    [4, 6, false],
    [5, 4, true],
    [6, 3, false],
    [6, 2, true],
    [4, 5, true],
    [3, 5, true],
    [2, 7, true],
    [5, 3, false],
    [1, 6, true],
    [3, 4, false],
    [4, 4, true],
    [2, 4, true],
    [6, 1, true],
  ]
  let compared = 0
  let ubFail = 0
  for (let n = 0; n < sizes.length; n++) {
    const [svtN, ceN, allowSupport] = sizes[n]
    const servants = Array.from({ length: svtN }, (_, i) =>
      svt({
        id: 35000 + n * 20 + i,
        name: `x${n}s${i}`,
        cost: 3 + Math.floor(rng() * 4),
        traitIds: rng() > 0.5 ? [104] : [],
      }),
    )
    const ces = Array.from({ length: ceN }, (_, i) =>
      ce({
        id: 36000 + n * 20 + i,
        collectionNo: 36000 + n * 20 + i,
        name: `x${n}c${i}`,
        rate: 50 + Math.floor(rng() * 3) * 50,
        cost: 3 + Math.floor(rng() * 3),
        traitId: rng() > 0.7 ? 104 : 0,
        followerRate: 50 + Math.floor(rng() * 3) * 50,
      }),
    )
    const useAccount = n % 4 === 1 && svtN <= 4
    const opts = {
      base: 500 + Math.floor(rng() * 400),
      teapot: rng() > 0.7,
      servants,
      ces,
      mode: useAccount ? 'account' : 'free',
      allowSupport,
      bond15Aura: rng() > 0.3,
    }
    if (rng() > 0.5) opts.costLimit = 20 + Math.floor(rng() * 30)
    if (useAccount) {
      opts.account = {
        servants: servants.map((item) => ({
          id: item.id,
          bondLv: rng() > 0.8 ? 15 : 4 + Math.floor(rng() * 6),
          bondCap: 16,
        })),
        ces: ces.map((item) => ({ id: item.id, mlb: true })),
      }
    }
    const optimized = recommendTeam(opts)
    const reference = referenceRecommendTeam(opts)
    if (!optimized.ok || !reference.ok) continue
    compared += 1
    assert.ok(
      objectivesEqual(gotPlan(optimized), reference),
      `scale random ${n} ${svtN}x${ceN} ${JSON.stringify({ o: planObjective(gotPlan(optimized)), r: planObjective(reference) })}`,
    )
    const farmers = servants.map((item) => ({ svt: item, form: { traitIds: item.traitIds || [] } }))
    const ub = mixUpperBound({
      farmers,
      base: opts.base,
      teapot: opts.teapot,
      ownCes: ces,
      supportCes: ces,
      useSupport: allowSupport,
      bond15Aura: opts.bond15Aura,
      account: opts.account || null,
    })
    if (ub < gotPlan(optimized).total) {
      assert.fail(`scale UB ${n} ${svtN}x${ceN} ub=${ub} total=${gotPlan(optimized).total}`)
    }
  }
  assert.ok(compared >= 12, `scale random compared ${compared}`)
  assert.equal(ubFail, 0)
}

{
  const keys = [
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: false, optimizeBy: 'total', costLimit: 40 }),
    loadoutMemoKey({ formKey: 'f', useSupport: true, grand: false, optimizeBy: 'total', costLimit: 40 }),
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: true, optimizeBy: 'total', costLimit: 40 }),
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: false, optimizeBy: 'prefer', costLimit: 40 }),
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: false, optimizeBy: 'total', costLimit: 41 }),
    loadoutMemoKey({ formKey: 'g', useSupport: false, grand: false, optimizeBy: 'total', costLimit: 40 }),
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: false, optimizeBy: 'total', costLimit: 40, pinCeIds: [9] }),
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: false, optimizeBy: 'total', costLimit: 40, ownCap: 4 }),
    loadoutMemoKey({ formKey: 'f', useSupport: false, grand: false, optimizeBy: 'total', costLimit: 40, bond15Aura: false }),
  ]
  assert.equal(new Set(keys).size, keys.length)
}

{
  const rng = mulberry32(20260922)
  let compared = 0
  let ubFail = 0
  for (let n = 0; n < 48; n++) {
    const svtN = 1 + Math.floor(rng() * 3)
    const ceN = 1 + Math.floor(rng() * 3)
    const servants = Array.from({ length: svtN }, (_, i) =>
      svt({
        id: 37000 + n * 10 + i,
        name: `p0${n}s${i}`,
        cost: 3 + Math.floor(rng() * 5),
        traitIds: rng() > 0.6 ? [104] : [],
      }),
    )
    const ces = Array.from({ length: ceN }, (_, i) =>
      ce({
        id: 38000 + n * 10 + i,
        collectionNo: 38000 + n * 10 + i,
        name: `p0${n}c${i}`,
        rate: 50 + Math.floor(rng() * 3) * 50,
        cost: 3 + Math.floor(rng() * 4),
        traitId: rng() > 0.75 ? 104 : 0,
        followerRate: 50 + Math.floor(rng() * 3) * 50,
      }),
    )
    const opts = {
      base: 600 + Math.floor(rng() * 300),
      teapot: rng() > 0.75,
      servants,
      ces,
      mode: 'free',
      allowSupport: rng() > 0.5,
    }
    if (rng() > 0.45) opts.costLimit = 18 + Math.floor(rng() * 25)
    if (rng() > 0.8 && servants.length) {
      opts.slotPins = [{ position: 1, svtId: servants[0].id }]
    }
    const optimized = recommendTeam(opts)
    const reference = referenceRecommendTeam(opts)
    if (!optimized.ok || !reference.ok) continue
    compared += 1
    assert.ok(
      objectivesEqual(gotPlan(optimized), reference),
      `p0 random ${n} ${JSON.stringify({ o: planObjective(gotPlan(optimized)), r: planObjective(reference) })}`,
    )
    const farmers = servants.map((item) => ({ svt: item, form: { traitIds: item.traitIds || [] } }))
    const ub = mixUpperBound({
      farmers,
      base: opts.base,
      teapot: opts.teapot,
      ownCes: ces,
      supportCes: ces,
      useSupport: opts.allowSupport,
    })
    if (ub < gotPlan(optimized).total) ubFail += 1
  }
  assert.ok(compared >= 24, `p0 random compared ${compared}`)
  assert.equal(ubFail, 0)
}

console.log('reference solver tests passed')
