export const PORTRAIT_FLAT = 50
export const FRONT_BONUS = 0.2
export const SUPPORT_FRONT_SHARE = 0.04
export const BOND15_BONUS = 0.25

function isNonNegInt(value) {
  return Number.isInteger(value) && value >= 0
}

export function describeCase(slots, opts = {}) {
  const filled = slots.filter((slot) => slot.filled)
  const support = filled.find((slot) => slot.isSupport)
  const supportInFront = Boolean(support && support.position <= 3)
  const auraOn = opts.bond15Aura !== false

  const parts = []
  if (supportInFront) {
    parts.push('当前情况：助战在前排，己方前排 +20% 再叠 +4%，后排 +4%。')
  } else {
    parts.push('当前情况：前排己方 +20%，后排 0%。')
  }
  parts.push('空位不参与 15 绊人数与礼装光环。')
  if (filled.length === 1) {
    parts.push('只上场 1 人，按单人编队核算。')
  }
  return {
    text: parts.join(''),
    supportInFront,
    filledCount: filled.length,
    bond15Count: auraOn ? filled.filter((slot) => slot.bond15 && !slot.isSupport).length : 0,
    supportTea: support ? Number(support.supportTea) || 0 : 0,
  }
}

function percentLines(slot, party) {
  const lines = []

  if (slot.position <= 3) {
    lines.push({ key: 'front', label: '前排', pct: FRONT_BONUS })
  }
  if (party.supportInFront) {
    lines.push({ key: 'front-share', label: '助战前排', pct: SUPPORT_FRONT_SHARE })
  }

  const lunch = Number(slot.lunch) || 0
  if (lunch) lines.push({ key: 'lunch', label: '午餐', pct: lunch })

  const teaSelf = Number(slot.teaSelf) || 0
  if (teaSelf) lines.push({ key: 'tea-self', label: '午茶（自己）', pct: teaSelf })

  if (party.supportTea) {
    lines.push({ key: 'tea-support', label: '午茶（助战）', pct: party.supportTea })
  }

  const holmes = Number(slot.holmes) || 0
  if (holmes) lines.push({ key: 'holmes', label: '芙尔摩斯', pct: holmes })

  const condCe = Number(slot.condCe) || 0
  if (condCe) lines.push({ key: 'cond', label: '条件礼装', pct: condCe })

  const eventPassive = Number(slot.eventPassive) || 0
  if (eventPassive) lines.push({ key: 'event', label: '活动被动', pct: eventPassive })

  const auraCount =
    party.bond15Count && slot.bond15 && !slot.isSupport ? party.bond15Count - 1 : party.bond15Count
  if (auraCount) {
    lines.push({
      key: 'bond15',
      label: `15绊 ×${auraCount}`,
      pct: auraCount * BOND15_BONUS,
    })
  }

  const customPercent = Number(slot.customPercent) || 0
  if (customPercent) {
    lines.push({ key: 'custom', label: '自定义', pct: customPercent })
  }

  for (const line of slot.ceLines || []) {
    if (line.pct) lines.push(line)
  }

  return lines
}

function isFrontLine(line) {
  return line.key === 'front' || line.key === 'front-share'
}

function rateMilli(pct) {
  return Math.round((Number(pct) || 0) * 1000)
}

function applyRate(value, milli) {
  if (!milli) return value
  return Math.floor((value * (1000 + milli)) / 1000)
}

export function calcSlot(base, teapot, slot, party) {
  if (slot.isSupport) {
    return emptyResult(slot, 'support', '助战本人不拿羁绊')
  }
  if (slot.bondMaxed) {
    return emptyResult(
      slot,
      slot.bond15 ? 'bond15-max' : 'bond-max',
      slot.bond15 ? '15绊本人满级拿不到羁绊' : '已达羁绊上限，本人拿不到羁绊',
    )
  }

  const lines = percentLines(slot, party)
  const frontPct = lines.filter(isFrontLine).reduce((sum, line) => sum + line.pct, 0)
  const addRate = lines.filter((line) => !isFrontLine(line)).reduce((sum, line) => sum + line.pct, 0)
  const percentSum = frontPct + addRate
  const flat = slot.portrait ? PORTRAIT_FLAT : 0
  const afterFront = applyRate(base, rateMilli(frontPct))
  const afterRate = applyRate(afterFront, rateMilli(addRate))
  const beforeTeapot = afterRate + flat
  const teapotMul = teapot ? 2 : 1

  return {
    position: slot.position,
    filled: true,
    eligible: true,
    reason: '',
    reasonText: '',
    lines,
    frontPct,
    addRate,
    percentSum,
    afterFront,
    afterRate,
    flat,
    beforeTeapot,
    teapotMul,
    final: beforeTeapot * teapotMul,
  }
}

function emptyResult(slot, reason, reasonText) {
  return {
    position: slot.position,
    filled: true,
    eligible: false,
    reason,
    reasonText,
    lines: [],
    frontPct: 0,
    addRate: 0,
    percentSum: 0,
    afterFront: 0,
    afterRate: 0,
    flat: 0,
    beforeTeapot: 0,
    teapotMul: 1,
    final: 0,
  }
}

export function calcParty(base, teapot, slots, opts = {}) {
  if (!isNonNegInt(base)) {
    return {
      ok: false,
      error: '请输入非负整数作为关卡基础羁绊',
      caseText: '请输入非负整数作为关卡基础羁绊',
      results: [],
    }
  }

  const party = describeCase(slots, opts)
  const results = slots
    .filter((slot) => slot.filled)
    .map((slot) => calcSlot(base, teapot, slot, party))

  return {
    ok: true,
    error: '',
    caseText: party.text,
    supportInFront: party.supportInFront,
    filledCount: party.filledCount,
    bond15Count: party.bond15Count,
    results,
  }
}
