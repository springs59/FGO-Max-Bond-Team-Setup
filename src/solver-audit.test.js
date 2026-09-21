import assert from 'node:assert/strict'
import { comparePlans, mixUpperBound, recommendTeam } from './recommend.js'
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

function ce({ id, collectionNo, name, rate, cost, traitId, followerRate, unmaxRate }) {
  const mlbFn = {
    target: 'ptFull',
    rate,
    add: 0,
    eventId: 0,
    indiv: 0,
    applySupport: null,
    followerRate: followerRate == null ? null : followerRate,
    tvals: traitId ? [{ id: traitId, name: `t${traitId}` }] : [],
    andTvals: [],
  }
  const unmaxFn = { ...mlbFn, rate: unmaxRate == null ? Math.max(10, Math.floor(rate / 5)) : unmaxRate }
  return {
    id,
    collectionNo: collectionNo || id,
    name: name || `ce${id}`,
    rarity: 4,
    cost,
    face: '',
    skills: [
      { name: name || `ce${id}`, condLimitCount: 0, funcs: [unmaxFn] },
      { name: name || `ce${id}`, condLimitCount: 4, funcs: [mlbFn] },
    ],
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

function objectiveTotal(plan) {
  return (plan && plan.ok !== false ? plan.total : 0) || 0
}

{
  const rng = mulberry32(20260921)
  let cases = 0
  let violations = 0
  let ubFail = 0
  let minGap = Infinity
  for (let n = 0; n < 1000; n++) {
    const servants = [
      svt({
        id: 41000 + n,
        name: `u${n}`,
        cost: 3 + (n % 4),
        traitIds: rng() > 0.55 ? [104] : [],
      }),
    ]
    if (n % 5 === 0) {
      servants.push(
        svt({
          id: 51000 + n,
          name: `u${n}b`,
          cost: 3 + ((n + 1) % 4),
          traitIds: rng() > 0.5 ? [104] : [],
        }),
      )
    }
    const ceN = 1 + (n % 2)
    const ces = Array.from({ length: ceN }, (_, i) =>
      ce({
        id: 61000 + n * 3 + i,
        collectionNo: 61000 + n * 3 + i,
        name: `uc${n}${i}`,
        rate: 50 + (n % 3) * 50,
        cost: 3 + ((n + i) % 3),
        traitId: rng() > 0.8 ? 104 : 0,
        followerRate: 50 + ((n + i) % 3) * 50,
      }),
    )
    const opts = {
      base: 500 + (n % 400),
      teapot: n % 7 === 0,
      servants,
      ces,
      mode: 'free',
      allowSupport: n % 3 !== 0,
    }
    if (n % 4 === 1) opts.costLimit = 12 + (n % 20)
    const optimized = recommendTeam(opts)
    const reference = referenceRecommendTeam(opts)
    if (!optimized.ok || !reference.ok) continue
    cases += 1
    const got = gotPlan(optimized)
    assert.ok(
      objectivesEqual(got, reference),
      `audit random ${n} ${JSON.stringify({ o: planObjective(got), r: planObjective(reference) })}`,
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
    const gap = ub - got.total
    if (gap < minGap) minGap = gap
    if (gap < 0) ubFail += 1
  }
  assert.ok(cases >= 800, `audit random cases ${cases}`)
  assert.equal(ubFail, 0)
  assert.equal(violations, 0)
  assert.ok(minGap >= 0, `minGap ${minGap}`)
  console.log(`ub random cases=${cases} violations=${ubFail} minGap=${minGap}`)
}

{
  const a = svt({ id: 701, name: '甲', cost: 3 })
  const b = svt({ id: 702, name: '乙', cost: 3 })
  const c1 = ce({ id: 801, collectionNo: 801, name: '礼1', rate: 100, cost: 3 })
  const c2 = ce({ id: 802, collectionNo: 802, name: '礼2', rate: 50, cost: 3 })
  const base = {
    base: 815,
    mode: 'free',
    allowSupport: false,
    servants: [a],
    ces: [c1],
  }
  const one = recommendTeam(base)
  const twoSvt = recommendTeam({ ...base, servants: [a, b] })
  const twoCe = recommendTeam({ ...base, ces: [c1, c2] })
  const tight = recommendTeam({ ...base, servants: [a, b], ces: [c1, c2], costLimit: 9 })
  const wide = recommendTeam({ ...base, servants: [a, b], ces: [c1, c2], costLimit: 40 })
  assert.ok(one.ok && twoSvt.ok && twoCe.ok && tight.ok && wide.ok)
  assert.ok(objectiveTotal(twoSvt) >= objectiveTotal(one))
  assert.ok(objectiveTotal(twoCe) >= objectiveTotal(one))
  assert.ok(objectiveTotal(wide) >= objectiveTotal(tight))
}

{
  const servants = [svt({ id: 711, name: '甲', cost: 4 }), svt({ id: 712, name: '乙', cost: 4 })]
  const ces = [
    ce({ id: 811, collectionNo: 811, name: '礼1', rate: 100, cost: 5 }),
    ce({ id: 812, collectionNo: 812, name: '礼2', rate: 150, cost: 5, traitId: 104 }),
  ]
  const opts = { base: 700, teapot: false, servants, ces, mode: 'free', allowSupport: true, costLimit: 18 }
  const ref = referenceRecommendTeam(opts)
  const def = recommendTeam(opts)
  const noMemo = recommendTeam({ ...opts, solverAudit: { memo: false } })
  const noUb = recommendTeam({ ...opts, solverAudit: { ub: false } })
  const bothOff = recommendTeam({ ...opts, solverAudit: { memo: false, ub: false } })
  assert.ok(ref.ok && def.ok && noMemo.ok && noUb.ok && bothOff.ok)
  assert.ok(objectivesEqual(gotPlan(def), ref))
  assert.ok(objectivesEqual(gotPlan(noMemo), ref))
  assert.ok(objectivesEqual(gotPlan(noUb), ref))
  assert.ok(objectivesEqual(gotPlan(bothOff), ref))
}

console.log('solver audit tests passed')
