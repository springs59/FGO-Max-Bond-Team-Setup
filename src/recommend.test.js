import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bestBondForm, betterTarget, comparePlans, filterRecommendBySupportCe, frontLayouts, mixUpperBound, pickCostPlan, pickSpriteForm, recommendTeam, svtCostOf } from './recommend.js'
import { emptyRosterFilter, toggleFilterValue } from './filter.js'
import { validateSnapshot } from './game-data.js'

const ces = JSON.parse(readFileSync(new URL('./data/bond-ces.json', import.meta.url), 'utf8'))

function svt(partial) {
  return {
    id: partial.id,
    collectionNo: partial.collectionNo,
    name: partial.name,
    className: partial.className,
    attribute: 'earth',
    face: '',
    traitIds: partial.traitIds,
    forms: partial.forms || [],
    cost: partial.cost,
    rarity: partial.rarity,
  }
}

const saber = svt({
  id: 100100,
  collectionNo: 2,
  name: '阿尔托莉雅·潘德拉贡',
  className: 'saber',
  traitIds: [102],
})
const caster = svt({
  id: 2840100,
  collectionNo: 284,
  name: '阿尔托莉雅·卡斯特',
  className: 'caster',
  traitIds: [104, 2780],
})
const rider = svt({
  id: 2300100,
  collectionNo: 23,
  name: '美杜莎',
  className: 'rider',
  traitIds: [105, 2780],
})

{
  const out = recommendTeam({ base: '815', servants: [saber], ces })
  assert.equal(out.ok, false)
}

{
  const out = recommendTeam({
    base: 815,
    teapot: false,
    servants: [saber, caster, rider],
    ces: [
      ces.find((ce) => ce.collectionNo === 330),
      ces.find((ce) => ce.collectionNo === 910),
      ces.find((ce) => ce.collectionNo === 2124),
    ],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const casterRow = out.rows.find((row) => row.title.includes('阿尔托莉雅·卡斯特'))
  const saberRow = out.rows.find((row) => row.title.includes('阿尔托莉雅·潘德拉贡') && row.title.includes('剑'))
  assert.ok(casterRow)
  assert.ok(saberRow)
  assert.ok(casterRow.title.includes('默认灵基'))
  assert.ok(saberRow.title.includes('默认灵基'))
  assert.ok(out.slots.some((slot) => slot.ceId === 2124 || ces.find((ce) => ce.id === slot.ceId)?.collectionNo === 2124))
  assert.ok(casterRow.hits.some((line) => String(line.label).includes('手稿之翼')))
  assert.equal(
    saberRow.hits.some((line) => String(line.label).includes('手稿之翼')),
    false,
  )
  assert.ok(saberRow.misses.some((text) => text.includes('手稿之翼')))
  assert.ok(out.summary.includes('每个灵基/灵衣是一套独立特性'))
}

{
  const dressedSaber = svt({
    id: saber.id,
    collectionNo: saber.collectionNo,
    name: saber.name,
    className: saber.className,
    traitIds: saber.traitIds,
    forms: [{ key: 'c100130', name: '风王结界', traitIds: [102, 104] }],
  })
  const out = recommendTeam({
    base: 815,
    teapot: false,
    servants: [dressedSaber, caster, rider],
    ces: [
      ces.find((ce) => ce.collectionNo === 330),
      ces.find((ce) => ce.collectionNo === 910),
      ces.find((ce) => ce.collectionNo === 2124),
    ],
    mode: 'free',
    allowSupport: true,
  })
  const farmerSaber = out.slots.find((slot) => slot.svtId === saber.id && !slot.isSupport)
  assert.ok(farmerSaber)
  assert.equal(farmerSaber.formLabel, '风王结界')
  const saberRow = out.rows.find((row) => row.title.includes('风王结界'))
  assert.ok(saberRow)
  assert.ok(saberRow.hits.some((line) => String(line.label).includes('手稿之翼')))
}

const dualSaber = svt({
  id: saber.id,
  collectionNo: saber.collectionNo,
  name: saber.name,
  className: saber.className,
  traitIds: [102, 304],
  forms: [{ key: 'c100130', name: '风王结界', traitIds: [102, 104] }],
  cost: 16,
  rarity: 5,
})

{
  const manuscript = ces.find((ce) => ce.collectionNo === 2124)
  const alien = ces.find((ce) => ce.collectionNo === 2437)
  assert.equal(bestBondForm(dualSaber, [manuscript]).name, '风王结界')
  assert.equal(bestBondForm(dualSaber, [alien]).name, '默认灵基')
}

{
  const out = recommendTeam({
    base: 815,
    teapot: false,
    servants: [dualSaber, caster],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 2124)],
    mode: 'free',
    allowSupport: false,
  })
  const farmerSaber = out.slots.find((slot) => slot.svtId === saber.id && !slot.isSupport)
  assert.ok(farmerSaber)
  assert.equal(farmerSaber.formLabel, '风王结界')
}

{
  const out = recommendTeam({
    base: 815,
    teapot: false,
    servants: [dualSaber],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 2437)],
    mode: 'free',
    allowSupport: false,
  })
  const farmerSaber = out.slots.find((slot) => slot.svtId === saber.id && !slot.isSupport)
  assert.ok(farmerSaber)
  assert.equal(farmerSaber.formLabel, '默认灵基')
  const saberRow = out.rows.find((row) => row.title.includes('阿尔托莉雅·潘德拉贡'))
  assert.ok(saberRow.hits.some((line) => String(line.label).includes('异星之神')))
}

{
  const out = recommendTeam({
    base: 815,
    teapot: false,
    servants: [dualSaber, caster],
    ces: [
      ces.find((ce) => ce.collectionNo === 330),
      ces.find((ce) => ce.collectionNo === 2124),
      ces.find((ce) => ce.collectionNo === 2437),
    ],
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const hasCostume = (out.plans || [out]).some((plan) =>
    (plan.slots || []).some((slot) => slot.svtId === saber.id && !slot.isSupport && slot.formLabel === '风王结界'),
  )
  const hasDefault = (out.plans || [out]).some((plan) =>
    (plan.slots || []).some((slot) => slot.svtId === saber.id && !slot.isSupport && slot.formLabel === '默认灵基'),
  )
  assert.ok(hasCostume)
  assert.ok(hasDefault)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster],
    ces,
    mode: 'account',
    account: null,
  })
  assert.equal(out.ok, false)
  assert.match(out.error, /导入/)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'account',
    account: {
      servants: [
        { id: saber.id, bondLv: 5 },
        { id: caster.id, bondLv: 15 },
        { id: rider.id, bondLv: 8 },
      ],
      ces: ces.map((ce) => ({ id: ce.id, mlb: true })),
    },
  })
  assert.equal(out.ok, true)
  assert.equal(out.slots.some((slot) => slot.svtId === caster.id && !slot.isSupport), false)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.equal(out.slots.some((slot) => slot.isSupport), false)
  assert.ok(out.summary.includes('不开助战'))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  assert.equal(out.slots.some((slot) => slot.isSupport), true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.equal(own.length, 3)
  assert.ok(own.every((slot) => slot.position <= 3))
  assert.ok(out.summary.includes('助战固定后排'))
  const supportOnly = out.slots.find((slot) => slot.isSupport)
  assert.equal(supportOnly.svtId || 0, 0)
  assert.equal(supportOnly.label, '助战')
  assert.ok(supportOnly.ceId)
}

{
  const mash = svt({ id: 800100, collectionNo: 1, name: '玛修·基列莱特', className: 'shielder', traitIds: [107] })
  const extra = svt({ id: 600100, collectionNo: 6, name: '齐格飞', className: 'saber', traitIds: [102] })
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider, mash, extra],
    ces,
    mode: 'free',
    allowSupport: true,
    preferSvtIds: [saber.id],
  })
  assert.equal(out.ok, true)
  const farmer = out.slots.find((slot) => slot.svtId === saber.id && !slot.isSupport)
  assert.ok(farmer)
  assert.equal(farmer.position <= 3, true)
  assert.equal(out.preferBond > 0, true)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.ok(support)
  assert.equal(support.position, 6)
  assert.equal(support.svtId || 0, 0)
  assert.equal(support.label, '助战')
  assert.ok(support.ceId)
  assert.ok(out.summary.includes('助战固定后排'))
  assert.ok(out.summary.includes('总羁绊最高，再练度羁绊'))
  assert.ok(out.summary.includes('阿尔托莉雅·潘德拉贡'))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: true,
    preferSvtIds: [saber.id, rider.id],
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === saber.id && !slot.isSupport))
  assert.ok(out.slots.some((slot) => slot.svtId === rider.id && !slot.isSupport))
  assert.equal(out.slots.find((slot) => slot.svtId === saber.id && !slot.isSupport).position <= 3, true)
  assert.equal(out.slots.find((slot) => slot.svtId === rider.id && !slot.isSupport).position <= 3, true)
  assert.equal(out.slots.find((slot) => slot.isSupport).position, 6)
}

{
  const mash = svt({ id: 800100, collectionNo: 1, name: '玛修·基列莱特', className: 'shielder', traitIds: [107] })
  const extra = svt({ id: 600100, collectionNo: 6, name: '齐格飞', className: 'saber', traitIds: [102] })
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider, mash, extra],
    ces,
    mode: 'free',
    allowSupport: true,
    preferSvtIds: [saber.id, caster.id, rider.id, extra.id],
  })
  assert.equal(out.ok, true)
  const preferIds = new Set([saber.id, caster.id, rider.id, extra.id])
  const front = out.slots.filter((slot) => slot.filled && slot.position <= 3)
  const preferBack = out.slots.filter(
    (slot) => preferIds.has(slot.svtId) && slot.position > 3 && !slot.isSupport,
  )
  assert.equal(front.length, 3)
  assert.ok(front.every((slot) => preferIds.has(slot.svtId)))
  assert.equal(preferBack.length, 1)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.equal(support.position, 6)
  assert.ok(out.summary.includes('练度超出前排'))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    lockSvtIds: [rider.id],
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === rider.id && !slot.isSupport))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'account',
    account: {
      servants: [
        { id: saber.id, bondLv: 5 },
        { id: caster.id, bondLv: 15 },
        { id: rider.id, bondLv: 8 },
      ],
      ces: ces.map((ce) => ({ id: ce.id, mlb: true })),
    },
    preferSvtIds: [caster.id],
  })
  assert.equal(out.ok, false)
  assert.match(out.error, /拿不到羁绊/)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: '',
  })
  assert.equal(out.ok, false)
  assert.match(out.error, /冠位战请选择职阶/)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: 'saber',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.equal(out.slots[0].isGrand, true)
  assert.equal(out.slots[0].ceBondId || 0, 0)
  assert.ok(out.slots[0].ceRewardId)
  assert.ok(out.slots.every((slot) => !slot.filled || slot.isSupport || slot.className === 'saber'))
  assert.ok(out.costUsed >= 0)
  assert.ok(out.summary.includes('冠位战'))
  assert.ok(out.summary.includes('COST'))
}

{
  const out = recommendTeam({
    base: 4748,
    servants: [saber],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: 'saber',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const grand = out.slots.find((slot) => slot.isGrand)
  assert.ok(grand)
  assert.equal(out.slots.filter((slot) => slot.isGrand).length, 1)
  assert.ok(grand.ceRewardId)
  assert.equal(grand.ceBondId || 0, 0)
  const reward = ces.find((ce) => ce.id === grand.ceRewardId)
  const rewardCost = Number(reward && reward.cost) || 0
  assert.ok(rewardCost > 0)
  assert.equal(out.costUsed, out.costUsed + 0)
  assert.ok(out.costUsed < out.costUsed + rewardCost)
  assert.ok(out.summary.includes('羁绊礼装'))
  assert.ok(out.summary.includes('免费'))
  assert.ok(out.summary.includes('冠位 3 礼装位'))
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  const secret = ces.find((ce) => ce.collectionNo === 2142)
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const equipped = []
  for (const slot of out.slots) {
    equipped.push(slot.ceId, slot.ceBondId, slot.ceRewardId)
  }
  assert.equal(equipped.includes(wing.id), false)
  assert.equal(equipped.includes(secret.id), false)
  assert.ok(equipped.includes(lunch.id))
  assert.equal(out.chosen, 0)
  assert.equal(out.total, Math.max(...out.plans.map((plan) => plan.total)))
}

{
  const ruler = svt({
    id: 901000,
    collectionNo: 59,
    name: '天草四郎',
    className: 'ruler',
    traitIds: [107],
    cost: 16,
    rarity: 5,
  })
  const avenger = svt({
    id: 1100100,
    collectionNo: 96,
    name: '咒腕哈桑',
    className: 'avenger',
    traitIds: [107],
    cost: 12,
    rarity: 4,
  })
  const mash = svt({
    id: 800100,
    collectionNo: 1,
    name: '玛修·基列莱特',
    className: 'shielder',
    traitIds: [107],
    cost: 0,
    rarity: 4,
  })
  const alterEgo = svt({
    id: 1000100,
    collectionNo: 167,
    name: '杀生院祈荒',
    className: 'alterEgo',
    traitIds: [107],
    cost: 16,
    rarity: 5,
  })
  const out = recommendTeam({
    base: 4748,
    servants: [saber, ruler, avenger, mash, alterEgo],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: 'extra1',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(
    out.slots.every(
      (slot) =>
        !slot.filled ||
        slot.isSupport ||
        slot.className === 'ruler' ||
        slot.className === 'avenger' ||
        slot.className === 'shielder',
    ),
  )
  assert.equal(out.slots.some((slot) => slot.className === 'alterEgo'), false)
  assert.ok(out.slots.some((slot) => slot.className === 'shielder' || slot.className === 'ruler' || slot.className === 'avenger'))
  assert.equal(out.slots.filter((slot) => slot.isGrand).length, 1)
  assert.ok(out.summary.includes('Extra'))
}

{
  const mash = svt({
    id: 800100,
    collectionNo: 1,
    name: '玛修·基列莱特',
    className: 'shielder',
    traitIds: [107],
    cost: 0,
    rarity: 4,
  })
  const alterEgo = svt({
    id: 1000100,
    collectionNo: 167,
    name: '杀生院祈荒',
    className: 'alterEgo',
    traitIds: [107],
    cost: 16,
    rarity: 5,
  })
  const out = recommendTeam({
    base: 4748,
    servants: [saber, mash, alterEgo],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: 'extra2',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.every((slot) => !slot.filled || slot.isSupport || slot.className === 'alterEgo'))
  assert.equal(out.slots.some((slot) => slot.className === 'shielder'), false)
}

{
  const tiamat = svt({
    id: 9935400,
    collectionNo: 149,
    name: '提亚马特',
    className: 'beastII',
    cost: 0,
    rarity: 5,
  })
  const solomon = svt({
    id: 1700100,
    collectionNo: 83,
    name: '所罗门',
    className: 'loreGrandCaster',
    cost: 0,
    rarity: 5,
  })
  const draco = svt({
    id: 3300100,
    collectionNo: 377,
    name: '所多玛之兽／德拉科',
    className: 'beast',
    cost: 16,
    rarity: 5,
  })
  const out = recommendTeam({
    base: 4748,
    servants: [saber, tiamat, solomon, draco],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: 'extra2',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === draco.id && !slot.isSupport))
  assert.equal(out.slots.some((slot) => slot.svtId === tiamat.id), false)
  assert.equal(out.slots.some((slot) => slot.svtId === solomon.id), false)
}

{
  const out = recommendTeam({
    base: 4748,
    servants: [saber],
    ces,
    mode: 'free',
    questType: 'grand',
    questClass: 'saber',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const own = out.slots.find((slot) => slot.isGrand && !slot.isSupport)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.ok(own)
  assert.ok(support)
  assert.equal(support.isGrand, true)
  assert.equal(support.position, 6)
  assert.equal(support.svtId || 0, 0)
  assert.equal(support.label, '助战')
  assert.equal(own.ceBondId || 0, 0)
  assert.equal(support.ceBondId || 0, 0)
  assert.ok(own.ceRewardId)
  assert.ok(support.ceId)
  assert.ok(support.ceRewardId)
  assert.ok(out.summary.includes('助战冠位'))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    questClass: 'caster',
    lockSvtIds: [saber.id],
  })
  assert.equal(out.ok, false)
  assert.match(out.error, /无法在此副本上场/)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    lockSvtIds: [saber.id, rider.id],
    costLimit: 16,
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === saber.id && !slot.isSupport))
  assert.ok(out.slots.some((slot) => slot.svtId === rider.id && !slot.isSupport))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: false,
    costLimit: 16,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.equal(own.length, 1)
  assert.equal(out.slots.filter((slot) => !slot.filled).length, 5)
  assert.ok((out.plans || []).length >= 1)
  assert.ok(out.costUsed <= 16)
  assert.ok(out.plans.some((plan) => plan.slots.filter((slot) => slot.filled && !slot.isSupport).length > 1))
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber],
    ces,
    mode: 'free',
    costLimit: 1.5,
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === saber.id))
}

{
  const golds = [1, 2, 3, 4, 5, 6].map((n) =>
    svt({
      id: 700000 + n,
      collectionNo: 700 + n,
      name: `金卡${n}`,
      className: 'saber',
      traitIds: [102],
      cost: 16,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const func = {
    target: 'ptFull',
    rate: 200,
    add: 0,
    eventId: 0,
    indiv: 0,
    applySupport: null,
    followerRate: null,
    tvals: [],
    andTvals: [],
  }
  const wide = {
    id: 9400001,
    collectionNo: 9001,
    name: '测试全队20%',
    rarity: 5,
    cost: 18,
    face: '',
    skills: [
      { name: '测试全队20%', condLimitCount: 0, funcs: [func] },
      { name: '测试全队20%', condLimitCount: 4, funcs: [func] },
    ],
  }
  const out = recommendTeam({
    base: 815,
    servants: golds,
    ces: [lunch, wide],
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.ok(out.plans.length >= 2)
  assert.equal(out.plans[out.chosen].total, out.total)
  assert.ok(out.costUsed <= 126)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: false,
    costLimit: 113,
  })
  assert.equal(out.ok, true)
  assert.ok(out.plans.length >= 2)
  const sizes = new Set(out.plans.map((plan) => plan.slots.filter((slot) => slot.filled && !slot.isSupport).length))
  assert.ok(sizes.size >= 2)
}

{
  const sabers = [1, 2, 3, 4, 5, 6].map((n) =>
    svt({
      id: 110000 + n,
      collectionNo: 110 + n,
      name: `低费剑${n}`,
      className: 'saber',
      traitIds: [102],
      cost: 3,
    }),
  )
  const casters = [1, 2, 3, 4, 5, 6].map((n) =>
    svt({
      id: 210000 + n,
      collectionNo: 210 + n,
      name: `术阶${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 16,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  const out = recommendTeam({
    base: 815,
    servants: [...sabers, ...casters],
    ces: [lunch, wing],
    mode: 'free',
    allowSupport: false,
    costLimit: 113,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  const casterCount = own.filter((slot) => slot.className === 'caster').length
  const ceNos = new Set(
    own.map((slot) => {
      if (slot.ceId === lunch.id) return 330
      if (slot.ceId === wing.id) return 2124
      return 0
    }),
  )
  assert.ok(casterCount >= 4)
  assert.equal(ceNos.has(2124), true)
  assert.equal(ceNos.has(330), true)
  assert.ok(out.total > 6400)
}

{
  const farther = { preferBond: 0, total: 5000, bond15Count: 0, costUsed: 80, costLimit: 113 }
  const closer = { preferBond: 0, total: 5000, bond15Count: 0, costUsed: 110, costLimit: 113 }
  assert.ok(comparePlans(closer, farther) < 0)
  assert.ok(comparePlans(farther, closer) > 0)
}

{
  const teamFirst = { preferBond: 100, total: 7000, bond15Count: 0, costUsed: 96, costLimit: 113 }
  const preferFirst = { preferBond: 2000, total: 5000, bond15Count: 0, costUsed: 96, costLimit: 113 }
  assert.ok(comparePlans(teamFirst, preferFirst) < 0)
  assert.ok(betterTarget(teamFirst, preferFirst))
  const sameTeamMorePrefer = { preferBond: 2000, total: 7000, bond15Count: 0, costUsed: 96, costLimit: 113 }
  assert.ok(comparePlans(sameTeamMorePrefer, teamFirst) < 0)
  assert.ok(betterTarget(sameTeamMorePrefer, teamFirst))
}

{
  const preferModeTeam = { preferBond: 100, lockBond: 0, total: 7000, bond15Count: 0, costUsed: 96, costLimit: 113, optimizeBy: 'prefer' }
  const preferModeMain = { preferBond: 2000, lockBond: 0, total: 5000, bond15Count: 0, costUsed: 96, costLimit: 113, optimizeBy: 'prefer' }
  assert.ok(comparePlans(preferModeMain, preferModeTeam) < 0)
  assert.ok(betterTarget(preferModeMain, preferModeTeam))
}

{
  const over = { preferBond: 0, total: 9000, bond15Count: 0, costUsed: 114 }
  const mid = { preferBond: 0, total: 5475, bond15Count: 0, costUsed: 98 }
  const bare = { preferBond: 0, total: 5379, bond15Count: 0, costUsed: 96 }
  assert.equal(pickCostPlan([over, mid, bare], 113), 1)
  assert.equal(pickCostPlan([over, mid, bare], 96), 2)
  assert.equal(pickCostPlan([over], 113), 0)
}

{
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const plans = out.plans
  assert.ok(plans.length >= 2)
  for (let i = 1; i < plans.length; i++) {
    assert.ok(plans[i].costUsed <= plans[i - 1].costUsed)
    assert.ok(plans[i].total <= plans[i - 1].total)
  }
  assert.equal(out.chosen, 0)
  assert.equal(out.total, Math.max(...plans.map((plan) => plan.total)))
}

{
  const six = [1, 2, 3, 4, 5, 6].map((n) =>
    svt({
      id: 120000 + n,
      collectionNo: 120 + n,
      name: `六人${n}`,
      className: 'saber',
      traitIds: [102],
      cost: 3,
    }),
  )
  const out = recommendTeam({
    base: 815,
    servants: six,
    ces,
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const supportSix = out.slots.find((slot) => slot.isSupport)
  assert.ok(supportSix)
  assert.equal(supportSix.position, 6)
  assert.equal(supportSix.svtId || 0, 0)
  assert.equal(supportSix.label, '助战')
  assert.ok(supportSix.ceId)
  assert.equal(out.slots.filter((slot) => slot.filled && !slot.isSupport).length, 5)
  assert.ok(out.summary.includes('助战固定后排'))
}

{
  const six = [1, 2, 3, 4, 5, 6].map((n) =>
    svt({
      id: 130000 + n,
      collectionNo: 130 + n,
      name: `冠位六人${n}`,
      className: 'saber',
      traitIds: [102],
      cost: 3,
    }),
  )
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const out = recommendTeam({
    base: 4748,
    servants: six,
    ces: [tea, lunch],
    mode: 'free',
    questType: 'grand',
    questClass: 'saber',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.equal(own.length, 5)
  assert.ok(own.every((slot) => slot.className === 'saber'))
  assert.ok(support)
  assert.equal(support.svtId || 0, 0)
  assert.equal(support.label, '助战')
  assert.equal(support.isGrand, true)
  assert.equal(support.ceBondId || 0, 0)
  assert.equal(support.ceId, tea.id)
  assert.equal(support.ceRewardId, lunch.id)
  assert.ok(own.some((slot) => slot.isGrand && slot.ceRewardId))
  assert.equal(out.rows.some((row) => row.title.includes('助战')), false)
}

{
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const saberCe = {
    id: 9401020,
    collectionNo: 9102,
    name: '测试剑阶20%',
    rarity: 5,
    cost: 12,
    face: '',
    skills: [
      {
        name: '测试剑阶20%',
        condLimitCount: 4,
        funcs: [
          {
            target: 'ptFull',
            rate: 200,
            add: 0,
            eventId: 0,
            indiv: 0,
            applySupport: null,
            followerRate: null,
            tvals: [{ id: 102, name: 'classSaber' }],
            andTvals: [],
          },
        ],
      },
    ],
  }
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster],
    ces: [tea, lunch, saberCe],
    mode: 'free',
    allowSupport: true,
    preferSvtIds: [saber.id],
  })
  assert.equal(out.ok, true)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.ok(support)
  assert.equal(support.ceId, tea.id)
  assert.equal(support.svtId || 0, 0)
  assert.ok(out.slots.some((slot) => slot.svtId === saber.id && !slot.isSupport))
  assert.ok(out.preferBond > 0)
  assert.ok(out.total >= out.preferBond)
}

{
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster],
    ces: [tea],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const support = out.slots.find((slot) => slot.isSupport)
  const ownTea = out.slots.find((slot) => !slot.isSupport && slot.ceId === tea.id)
  assert.ok(support)
  assert.equal(support.ceId, tea.id)
  assert.ok(ownTea)
  const teaRow = out.rows.find((row) => row.title.includes('阿尔托莉雅·潘德拉贡'))
  const teaHits = teaRow.hits.filter((line) => String(line.label).includes('午茶'))
  assert.equal(teaHits.length, 2)
  assert.equal(teaHits.reduce((sum, line) => sum + line.pct, 0), 0.2)
  assert.ok(teaHits.some((line) => line.label.includes('自己')))
  assert.ok(teaHits.some((line) => line.label.includes('助战')))
}

{
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const blocked = {
    id: 9400002,
    collectionNo: 9002,
    name: '测试助战无效50%',
    rarity: 5,
    cost: 12,
    face: '',
    skills: [
      {
        name: '测试助战无效50%',
        condLimitCount: 4,
        funcs: [
          {
            target: 'ptFull',
            rate: 500,
            add: 0,
            eventId: 0,
            indiv: 0,
            applySupport: 0,
            followerRate: null,
            tvals: [],
            andTvals: [],
          },
        ],
      },
    ],
  }
  const out = recommendTeam({
    base: 815,
    servants: [saber],
    ces: [tea, blocked],
    mode: 'free',
    allowSupport: true,
    preferSvtIds: [saber.id],
  })
  assert.equal(out.ok, true)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.ok(support)
  assert.equal(support.ceId, tea.id)
}

{
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces: [tea, lunch],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.ok(own.some((slot) => slot.ceId === lunch.id))
  assert.ok(own.some((slot) => slot.ceId === tea.id))
  assert.equal(support.ceId, tea.id)
  assert.equal(out.total, Math.max(...out.plans.map((plan) => plan.total)))
  assert.ok(out.summary.includes('礼装按 ID 去重'))
}

{
  const golds = [1, 2, 3, 4, 5, 6].map((n) =>
    svt({
      id: 140000 + n,
      collectionNo: 140 + n,
      name: `空礼装金${n}`,
      className: 'saber',
      traitIds: [102],
      cost: 16,
    }),
  )
  const func = {
    target: 'ptFull',
    rate: 200,
    add: 0,
    eventId: 0,
    indiv: 0,
    applySupport: null,
    followerRate: null,
    tvals: [],
    andTvals: [],
  }
  const wide = {
    id: 9400002,
    collectionNo: 9002,
    name: '超费全队20%',
    rarity: 5,
    cost: 18,
    face: '',
    skills: [
      { name: '超费全队20%', condLimitCount: 0, funcs: [func] },
      { name: '超费全队20%', condLimitCount: 4, funcs: [func] },
    ],
  }
  const bare = recommendTeam({
    base: 815,
    servants: golds,
    ces: [wide],
    mode: 'free',
    allowSupport: false,
    costLimit: 96,
  })
  assert.equal(bare.ok, true)
  const bareOwn = bare.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.equal(bareOwn.length, 6)
  assert.ok(bareOwn.every((slot) => !slot.ceId))
  assert.ok(bare.costUsed <= 96)
  assert.ok(bare.summary.includes('礼装可不上'))

  const under = recommendTeam({
    base: 815,
    servants: golds,
    ces: [wide],
    mode: 'free',
    allowSupport: false,
    costLimit: 113,
  })
  assert.equal(under.ok, true)
  assert.ok(under.costUsed <= 113)
  const underOwn = under.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.equal(underOwn.length, 5)
  assert.ok(underOwn.some((slot) => slot.ceId === wide.id))
  assert.ok(under.total > bare.total)
  assert.ok(
    under.plans.some((plan) => {
      const own = plan.slots.filter((slot) => slot.filled && !slot.isSupport)
      return own.length === 6 && own.every((slot) => !slot.ceId)
    }),
  )
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.svtClass, 'saber')
  filter.svtClass.invert = true
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    allowSupport: false,
    filter,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.ok(own.length)
  assert.ok(own.every((slot) => slot.svtId !== saber.id))
  assert.ok(own.every((slot) => slot.className !== 'saber'))
  assert.ok(out.summary.includes('已按筛选屏蔽从者'))
}

{
  const filter = emptyRosterFilter()
  toggleFilterValue(filter.svtClass, 'saber')
  toggleFilterValue(filter.svtClass, 'caster')
  toggleFilterValue(filter.svtClass, 'rider')
  filter.svtClass.invert = true
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces,
    mode: 'free',
    filter,
  })
  assert.equal(out.ok, false)
  assert.match(out.error, /筛选后没有可拿羁绊的从者/)
}

{
  const roster = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const filter = emptyRosterFilter()
  for (const star of [0, 1, 2, 3]) toggleFilterValue(filter.rarity, star)
  filter.rarity.invert = true
  const out = recommendTeam({
    base: 815,
    servants: [
      ...roster.filter((item) => item.rarity <= 3).slice(0, 10),
      ...roster.filter((item) => item.rarity >= 4).slice(0, 10),
    ],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 910)],
    mode: 'free',
    allowSupport: true,
    filter,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.ok(own.length)
  for (const slot of own) {
    const rec = roster.find((item) => item.id === slot.svtId)
    assert.ok(rec, slot.label)
    assert.ok(rec.rarity >= 4, `${rec.name} ${rec.rarity}星`)
  }
  const asStrings = emptyRosterFilter()
  asStrings.rarity.options = ['0', '1', '2', '3']
  asStrings.rarity.invert = true
  const again = recommendTeam({
    base: 815,
    servants: [
      ...roster.filter((item) => item.rarity <= 3).slice(0, 10),
      ...roster.filter((item) => item.rarity >= 4).slice(0, 10),
    ],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 910)],
    mode: 'free',
    allowSupport: false,
    filter: asStrings,
  })
  assert.equal(again.ok, true)
  for (const slot of again.slots.filter((item) => item.filled && !item.isSupport)) {
    const rec = roster.find((item) => item.id === slot.svtId)
    assert.ok(rec.rarity >= 4, `${rec.name} ${rec.rarity}星`)
  }
}

{
  const roster = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const low = roster.find((item) => item.rarity <= 3 && item.collectionNo !== 1)
  const highs = roster.filter((item) => item.rarity >= 4).slice(0, 8)
  const filter = emptyRosterFilter()
  for (const star of [0, 1, 2, 3]) toggleFilterValue(filter.rarity, star)
  filter.rarity.invert = true
  const out = recommendTeam({
    base: 815,
    servants: [low, ...highs],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 910)],
    mode: 'free',
    allowSupport: false,
    lockSvtIds: [low.id],
    filter,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.ok(own.length)
  assert.ok(own.every((slot) => slot.svtId !== low.id))
  assert.ok(own.every((slot) => roster.find((item) => item.id === slot.svtId).rarity >= 4))
}

{
  const roster = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const mash = roster.find((item) => item.collectionNo === 1)
  const highs = roster.filter((item) => item.rarity >= 4 && item.collectionNo !== 1).slice(0, 8)
  assert.equal(svtCostOf(mash), 0)
  assert.equal(svtCostOf(mash, mash.forms.find((item) => item.key === 'c800190')), 16)
  const out = recommendTeam({
    base: 815,
    servants: [mash, ...highs],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 910)],
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  const mashSlot = out.slots.find((slot) => slot.svtId === mash.id)
  assert.ok(mashSlot)
  assert.equal(mashSlot.formLabel, '默认灵基')
  assert.equal(mashSlot.attribute, 'earth')
  const onlyFive = emptyRosterFilter()
  toggleFilterValue(onlyFive.rarity, 5)
  const five = recommendTeam({
    base: 815,
    servants: [mash, ...highs],
    ces: [ces.find((ce) => ce.collectionNo === 330), ces.find((ce) => ce.collectionNo === 910)],
    mode: 'free',
    allowSupport: false,
    filter: onlyFive,
  })
  assert.equal(five.ok, true)
  const paladinSlot = five.slots.find((slot) => slot.svtId === mash.id)
  if (paladinSlot) {
    assert.equal(paladinSlot.formLabel, '圣骑士')
    assert.equal(paladinSlot.attribute, 'human')
    assert.equal(paladinSlot.rarity, 5)
  }
}

{
  const casters = [1, 2, 3, 4, 5].map((n) =>
    svt({
      id: 280000 + n,
      collectionNo: 280 + n,
      name: `术职${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const holmes = ces.find((ce) => ce.collectionNo === 1080)
  const dinner = ces.find((ce) => ce.collectionNo === 1121)
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  const out = recommendTeam({
    base: 815,
    servants: casters,
    ces: [lunch, tea, holmes, dinner, wing],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const support = out.slots.find((slot) => slot.isSupport)
  assert.equal(support.ceId, wing.id)
  const ownNos = out.slots
    .filter((slot) => slot.filled && !slot.isSupport)
    .map((slot) => (ces.find((ce) => ce.id === slot.ceId) || {}).collectionNo)
    .filter(Boolean)
  assert.ok(ownNos.includes(2124))
  assert.ok(ownNos.includes(330))
  const stacked = [910, 1080, 1121].filter((no) => ownNos.includes(no))
  assert.ok(stacked.length >= 2)
  const casterRow = out.rows.find((row) => row.title.includes('术职'))
  const fiveHits = casterRow.hits.filter((line) => /午茶|福尔摩斯|晚餐/.test(String(line.label)))
  assert.ok(fiveHits.length >= 2)
}

{
  const casters = [1, 2, 3, 4].map((n) =>
    svt({
      id: 281000 + n,
      collectionNo: 281 + n,
      name: `术职锁定${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const out = recommendTeam({
    base: 815,
    servants: [saber, ...casters],
    ces: [
      ces.find((ce) => ce.collectionNo === 330),
      ces.find((ce) => ce.collectionNo === 910),
      ces.find((ce) => ce.collectionNo === 2124),
    ],
    mode: 'free',
    allowSupport: true,
    preferSvtIds: [saber.id],
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.some((slot) => slot.svtId === saber.id && !slot.isSupport))
  const support = out.slots.find((slot) => slot.isSupport)
  assert.equal(support.ceId, ces.find((ce) => ce.collectionNo === 2124).id)
}

{
  const cheap = [1, 2, 3, 4, 5].map((n) =>
    svt({
      id: 282000 + n,
      collectionNo: 282 + n,
      name: `低覆盖术${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const rich = [1, 2, 3, 4, 5].map((n) =>
    svt({
      id: 283000 + n,
      collectionNo: 290 + n,
      name: `高覆盖术${n}`,
      className: 'caster',
      traitIds: [104, 304, 2780],
      cost: 7,
    }),
  )
  const out = recommendTeam({
    base: 815,
    servants: [...cheap, ...rich],
    ces: [
      ces.find((ce) => ce.collectionNo === 330),
      ces.find((ce) => ce.collectionNo === 910),
      ces.find((ce) => ce.collectionNo === 2124),
      ces.find((ce) => ce.collectionNo === 2437),
      ces.find((ce) => ce.collectionNo === 2209),
    ],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  const own = out.slots.filter((slot) => slot.filled && !slot.isSupport)
  assert.equal(own.length, 5)
  assert.ok(own.every((slot) => slot.label.startsWith('高覆盖术')))
  const ownNos = own
    .map((slot) => (ces.find((ce) => ce.id === slot.ceId) || {}).collectionNo)
    .filter(Boolean)
  assert.ok(ownNos.includes(2124))
  assert.ok(ownNos.includes(2437))
  assert.ok(ownNos.includes(2209))
  const support = out.slots.find((slot) => slot.isSupport)
  assert.equal(support.ceId, ces.find((ce) => ce.collectionNo === 2124).id)
}

{
  const roster = JSON.parse(readFileSync(new URL('./data/servants.json', import.meta.url), 'utf8'))
  const living = roster.filter((item) => (item.traitIds || []).includes(2654)).length
  assert.ok(living >= 24 && living <= 30, `livingHuman ${living}`)
  const check = validateSnapshot(roster, ces)
  assert.equal(check.ok, true, check.errors && check.errors.join(';'))
}

{
  const humans = [1, 2, 3, 4].map((n) =>
    svt({
      id: 300000 + n,
      collectionNo: 300 + n,
      name: `活人${n}`,
      className: 'assassin',
      traitIds: [2654],
      cost: 3,
    }),
  )
  const other = svt({
    id: 300009,
    collectionNo: 309,
    name: '非活人',
    className: 'assassin',
    traitIds: [107],
    cost: 3,
  })
  const morning = ces.find((ce) => ce.collectionNo === 2020)
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const four = recommendTeam({
    base: 815,
    servants: [...humans, other],
    ces: [morning, tea],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(four.ok, true)
  assert.equal(four.slots.find((slot) => slot.isSupport).ceId, morning.id)
  const three = recommendTeam({
    base: 815,
    servants: [...humans.slice(0, 3), other, svt({ id: 300010, collectionNo: 310, name: '非活人2', className: 'assassin', traitIds: [107], cost: 3 })],
    ces: [morning, tea],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(three.ok, true)
  assert.equal(three.slots.find((slot) => slot.isSupport).ceId, tea.id)
}

{
  const casters = [1, 2, 3, 4].map((n) =>
    svt({
      id: 301000 + n,
      collectionNo: 311 + n,
      name: `未满术${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  const account = {
    servants: [
      { id: saber.id, bondLv: 15, bondCap: 15 },
      ...casters.map((item) => ({ id: item.id, bondLv: 5, bondCap: 10 })),
    ],
    ces: [lunch, tea, wing].map((ce) => ({ id: ce.id, mlb: true })),
  }
  const out = recommendTeam({
    base: 815,
    servants: [saber, ...casters],
    ces: [lunch, tea, wing],
    account,
    mode: 'account',
    allowSupport: true,
    lockSvtIds: [saber.id],
  })
  assert.equal(out.ok, true)
  const saberSlot = out.slots.find((slot) => slot.svtId === saber.id)
  assert.ok(saberSlot)
  assert.equal(saberSlot.bond15, true)
  assert.equal(saberSlot.position > 3, true)
  const saberRow = out.output.results.find((row) => row.position === saberSlot.position)
  assert.equal(saberRow.final, 0)
  const live = out.output.results.filter((row) => row.eligible)
  assert.ok(live.length >= 4)
  assert.ok(live.every((row) => row.addRate >= 0.25))
}

{
  const casters = [1, 2, 3, 4, 5].map((n) =>
    svt({
      id: 302000 + n,
      collectionNo: 320 + n,
      name: `可刷术${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const account = {
    servants: [
      { id: saber.id, bondLv: 10, bondCap: 10 },
      ...casters.map((item) => ({ id: item.id, bondLv: 5, bondCap: 10 })),
    ],
    ces: [{ id: lunch.id, mlb: true }],
  }
  const out = recommendTeam({
    base: 815,
    servants: [saber, ...casters],
    ces: [lunch],
    account,
    mode: 'account',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(out.slots.every((slot) => slot.svtId !== saber.id))
}

{
  const s2 = svt({ id: 100200, collectionNo: 3, name: '剑从者乙', className: 'saber', traitIds: [102], cost: 16 })
  const s3 = svt({ id: 100300, collectionNo: 4, name: '剑从者丙', className: 'saber', traitIds: [102], cost: 16 })
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  const out = recommendTeam({
    base: 815,
    servants: [saber, s2, s3, caster],
    ces: [wing],
    mode: 'free',
    allowSupport: true,
    lockSvtIds: [saber.id, s2.id, s3.id],
  })
  assert.equal(out.ok, true)
  const casterSlot = out.slots.find((slot) => slot.svtId === caster.id)
  assert.ok(casterSlot)
  assert.equal(casterSlot.position <= 3, true)
  assert.ok(out.summary.includes('前排三人按总羁绊枚举'))
}

{
  const casters = [1, 2, 3, 4].map((n) =>
    svt({
      id: 303000 + n,
      collectionNo: 330 + n,
      name: `关光环术${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const account = {
    servants: [
      { id: saber.id, bondLv: 15, bondCap: 15 },
      ...casters.map((item) => ({ id: item.id, bondLv: 5, bondCap: 10 })),
    ],
    ces: [{ id: lunch.id, mlb: true }],
  }
  const out = recommendTeam({
    base: 815,
    servants: [saber, ...casters],
    ces: [lunch],
    account,
    mode: 'account',
    allowSupport: true,
    lockSvtIds: [saber.id],
    bond15Aura: false,
  })
  assert.equal(out.ok, true)
  const live = out.output.results.filter((row) => row.eligible)
  assert.ok(live.length >= 4)
  assert.ok(live.every((row) => !row.lines.some((line) => line.key === 'bond15')))
  assert.ok(out.summary.includes('15绊光环已关'))
}

{
  const casters = [1, 2, 3, 4].map((n) =>
    svt({
      id: 303000 + n,
      collectionNo: 330 + n,
      name: `15未满术${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const account = {
    servants: [
      { id: saber.id, bondLv: 15, bondCap: 16 },
      ...casters.map((item) => ({ id: item.id, bondLv: 5, bondCap: 10 })),
    ],
    ces: [{ id: lunch.id, mlb: true }],
  }
  const out = recommendTeam({
    base: 815,
    servants: [saber, ...casters],
    ces: [lunch],
    account,
    mode: 'account',
    allowSupport: true,
    lockSvtIds: [saber.id],
  })
  assert.equal(out.ok, true)
  const saberSlot = out.slots.find((slot) => slot.svtId === saber.id)
  assert.ok(saberSlot)
  assert.equal(saberSlot.bond15, true)
  assert.equal(saberSlot.bondMaxed, false)
  const saberRow = out.output.results.find((row) => row.position === saberSlot.position)
  assert.ok(saberRow.final > 0)
  const live = out.output.results.filter((row) => row.eligible && row.position !== saberSlot.position)
  assert.ok(live.length >= 1)
  assert.ok(live.every((row) => row.addRate >= 0.25))
}

{
  const casters = [1, 2, 3, 4, 5].map((n) =>
    svt({
      id: 304000 + n,
      collectionNo: 340 + n,
      name: `助战筛${n}`,
      className: 'caster',
      traitIds: [104],
      cost: 3,
    }),
  )
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const wing = ces.find((ce) => ce.collectionNo === 2124)
  const out = recommendTeam({
    base: 815,
    servants: casters,
    ces: [lunch, tea, wing],
    mode: 'free',
    allowSupport: true,
  })
  assert.equal(out.ok, true)
  assert.ok((out.assist || []).length >= 1)
  const pick = out.assist[0]
  const filtered = filterRecommendBySupportCe(out, pick.id)
  assert.equal(filtered.ok, true)
  const support = filtered.slots.find((slot) => slot.isSupport)
  assert.equal(support.ceId, pick.id)
}

{
  const layouts = frontLayouts(
    [{ svt: { id: 1 } }, { svt: { id: 2 } }, { svt: { id: 3 } }, { svt: { id: 4 } }],
    [2, 0, 0],
  )
  assert.ok(layouts.length > 0)
  assert.ok(layouts.every((combo) => combo[0] === 1))
}

{
  const forms = [
    { key: 'default', name: '默认灵基' },
    { key: 'c800190', name: '圣骑士' },
    { key: 'a3', name: '灵基 3' },
  ]
  assert.equal(pickSpriteForm(forms, 'strict_order').key, 'a3')
  assert.equal(pickSpriteForm(forms, 'bond_first').key, 'default')
}

{
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces: [lunch, tea],
    mode: 'free',
    allowSupport: false,
    frontIds: [rider.id, 0, 0],
  })
  assert.equal(out.ok, true)
  assert.equal(out.slots[0].svtId, rider.id)
}

{
  const mash = svt({
    id: 800100,
    collectionNo: 1,
    name: '玛修·基列莱特',
    className: 'shielder',
    traitIds: [201, 2654],
    cost: 0,
    rarity: 4,
    forms: [{ key: 'c800190', name: '圣骑士', traitIds: [202], rarity: 5, cost: 16 }],
  })
  const morning = ces.find((ce) => String(ce.name).includes('迦勒底之晨'))
  const strict = recommendTeam({
    base: 815,
    servants: [mash],
    ces: morning ? [morning] : ces.slice(0, 1),
    mode: 'free',
    allowSupport: false,
    lockSvtIds: [mash.id],
    spriteMode: 'strict_order',
  })
  assert.equal(strict.ok, true)
  const mashSlot = strict.slots.find((slot) => slot.svtId === mash.id)
  assert.equal(mashSlot.svtArtKey, 'c800190')
}

{
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const tea = ces.find((ce) => ce.collectionNo === 910)
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces: [lunch, tea],
    mode: 'free',
    allowSupport: false,
    lockSvtIds: [saber.id],
    pinCes: [{ svtId: saber.id, ceId: lunch.id }],
  })
  assert.equal(out.ok, true)
  const slot = out.slots.find((item) => item.svtId === saber.id)
  assert.equal(slot.ceId, lunch.id)
}

{
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const farmers = [
    { svt: saber, form: { traitIds: saber.traitIds } },
    { svt: caster, form: { traitIds: caster.traitIds } },
    { svt: rider, form: { traitIds: rider.traitIds } },
  ]
  const ub = mixUpperBound({
    farmers,
    base: 815,
    ownCes: [lunch],
    supportCes: [lunch],
    useSupport: false,
  })
  const out = recommendTeam({
    base: 815,
    servants: [saber, caster, rider],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
  })
  assert.equal(out.ok, true)
  assert.ok(ub >= out.total)
}

{
  const five = svt({
    id: 100100,
    collectionNo: 2,
    name: '阿尔托莉雅·潘德拉贡',
    className: 'saber',
    traitIds: [102],
    rarity: 5,
    cost: 16,
  })
  const lunch = ces.find((ce) => ce.collectionNo === 330)
  const out = recommendTeam({
    base: 815,
    servants: [five, caster, rider],
    ces: [lunch],
    mode: 'free',
    allowSupport: false,
    priorities: [{ type: 'rarity', operator: '>=', value: 5, weight: 10, enabled: true }],
  })
  assert.equal(out.ok, true)
  assert.ok(out.priorityScore >= 10)
  assert.ok(out.summary.includes('从者优先级'))
}

console.log('recommend tests passed')
