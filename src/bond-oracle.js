// Independent bond oracle. Constants come from MEMORY.md / game two-stage floor.
// Do not import src/bond.js — this layer exists to catch shared formula bugs.

const FRONT_OWN_MILLI = 200
const SUPPORT_FRONT_MILLI = 40
const BOND15_MILLI = 250
const PORTRAIT_FLAT = 50

function toMilli(pct) {
  return Math.round((Number(pct) || 0) * 1000)
}

function floorMul(value, milli) {
  if (!milli) return value
  return Math.floor((value * (1000 + milli)) / 1000)
}

export function oracleDescribe(slots, opts = {}) {
  const filled = (slots || []).filter((slot) => slot.filled)
  const support = filled.find((slot) => slot.isSupport)
  const supportInFront = Boolean(support && support.position <= 3)
  const auraOn = opts.bond15Aura !== false
  const bond15Count = auraOn ? filled.filter((slot) => slot.bond15 && !slot.isSupport).length : 0
  const supportTea = support ? Number(support.supportTea) || 0 : 0
  return { supportInFront, bond15Count, supportTea, filledCount: filled.length }
}

export function oracleSlot(base, teapot, slot, party) {
  if (slot.isSupport) {
    return emptyOracle(slot.position, 'support')
  }
  if (slot.bondMaxed) {
    return emptyOracle(slot.position, slot.bond15 ? 'bond15-max' : 'bond-max')
  }

  let frontMilli = 0
  if (slot.position <= 3) frontMilli += FRONT_OWN_MILLI
  if (party.supportInFront) frontMilli += SUPPORT_FRONT_MILLI

  let secondMilli = 0
  secondMilli += toMilli(slot.lunch)
  secondMilli += toMilli(slot.teaSelf)
  secondMilli += toMilli(party.supportTea)
  secondMilli += toMilli(slot.holmes)
  secondMilli += toMilli(slot.condCe)
  secondMilli += toMilli(slot.eventPassive)
  secondMilli += toMilli(slot.customPercent)
  const auraCount =
    party.bond15Count && slot.bond15 && !slot.isSupport ? party.bond15Count - 1 : party.bond15Count || 0
  if (auraCount) secondMilli += auraCount * BOND15_MILLI
  for (const line of slot.ceLines || []) {
    if (line && line.pct) secondMilli += toMilli(line.pct)
  }

  const afterFront = floorMul(base, frontMilli)
  const afterRate = floorMul(afterFront, secondMilli)
  const flat = slot.portrait ? PORTRAIT_FLAT : 0
  return {
    position: slot.position,
    eligible: true,
    reason: '',
    afterFront,
    afterRate,
    flat,
    frontMilli,
    secondMilli,
    final: (afterRate + flat) * (teapot ? 2 : 1),
  }
}

function emptyOracle(position, reason) {
  return {
    position,
    eligible: false,
    reason,
    afterFront: 0,
    afterRate: 0,
    flat: 0,
    frontMilli: 0,
    secondMilli: 0,
    final: 0,
  }
}

export function oracleParty(base, teapot, slots, opts = {}) {
  if (!Number.isInteger(base) || base < 0) {
    return { ok: false, error: 'invalid base', results: [], total: 0 }
  }
  const party = oracleDescribe(slots, opts)
  const results = (slots || []).filter((slot) => slot.filled).map((slot) => oracleSlot(base, teapot, slot, party))
  return {
    ok: true,
    error: '',
    ...party,
    results,
    total: results.reduce((sum, row) => sum + row.final, 0),
  }
}
