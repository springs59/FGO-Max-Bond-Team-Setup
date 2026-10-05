import { calcParty, rateMilli } from '../bond.js'
import { RULE_VERSION } from '../rules/versions.js'

export const BOND_CURVE_VERSION = 1
const gcd = (a, b) => b ? gcd(b, a % b) : a
const lcm = (a, b) => a / gcd(a, b) * b

// Preserve both floors. Percent sums alone do not define a bond curve.
export function compileBondCurve(slots, { bond15Aura = true } = {}) {
  const output = calcParty(0, false, slots, { bond15Aura })
  const terms = output.results.map(result => {
    const slot = slots.find(row => row.position === result.position)
    return { position: result.position, svtId: Number(slot.svtId) || 0,
      eligible: result.eligible, front: 1000 + rateMilli(result.frontPct),
      second: 1000 + rateMilli(result.addRate), flat: result.flat }
  })
  let period = 1
  for (const term of terms.filter(row => row.eligible)) {
    // T*front/1000 and T*front*second/1e6 must both be integers.
    period = lcm(period, lcm(1000 / gcd(term.front, 1000),
      1000000 / gcd(term.front * term.second, 1000000)))
  }
  return { version: BOND_CURVE_VERSION, ruleVersion: RULE_VERSION,
    terms, period, increment: evaluateBondCurve({ terms }, period).total - evaluateBondCurve({ terms }, 0).total }
}

export function evaluateBondCurve(curve, base, { teapot = false, preferIds = [] } = {}) {
  if (!Number.isSafeInteger(base) || base < 0) throw new Error('curve base must be a nonnegative safe integer')
  const prefer = new Set(preferIds.map(Number))
  const mul = teapot ? 2n : 1n
  const results = (curve.terms || []).map(term => {
    const final = term.eligible ? (((BigInt(base) * BigInt(term.front) / 1000n) *
      BigInt(term.second) / 1000n) + BigInt(term.flat)) * mul : 0n
    if (final > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('curve result exceeds safe integer range')
    return { position: term.position, svtId: term.svtId, eligible: term.eligible, final: Number(final) }
  })
  const total = results.reduce((sum, row) => sum + row.final, 0)
  if (!Number.isSafeInteger(total)) throw new Error('curve total exceeds safe integer range')
  const eligibleCount = results.filter(row => row.eligible).length
  // Gain is reported separately. Total remains the existing ranking objective.
  return { results, total, eligibleCount, baseline: eligibleCount * base,
    gain: total - eligibleCount * base,
    preferBond: results.filter(row => prefer.has(row.svtId)).reduce((sum, row) => sum + row.final, 0) }
}

export function curveKey(curve) {
  return JSON.stringify(curve.terms.map(({ position, eligible, front, second, flat }) =>
    [position, eligible ? 1 : 0, front, second, flat]))
}

// S(q*T+r) = q*increment + S(r). Flat bonuses occur once, not per period.
export function curveResidue(curve, residue) {
  if (!Number.isInteger(residue) || residue < 0 || residue >= curve.period) throw new Error('invalid curve residue')
  const zero = evaluateBondCurve(curve, 0).total
  return { period: curve.period, residue,
    increment: evaluateBondCurve(curve, curve.period).total - zero,
    offset: evaluateBondCurve(curve, residue).total }
}
