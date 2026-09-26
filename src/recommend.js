import { applyRate as applyRateMilli, calcParty } from './bond.js'
import { liveBondBonusCatalog, resolveSlotEventPassives } from './bond/bonus.js'
import { applyCraftEssences, ceMatchesServant, classLabel, pickCeSkill } from './atlas.js'
import { isPlayableServant } from './game-data.js'
import { filterCes, filterServants, matchRosterForm, matchRosterServant, rosterFilterActive } from './filter.js'
import { defaultBondCap, isBond15, isBondMaxed, resolvedBondCap } from './account.js'
import { mainBondOf, priorityScore } from './priority.js'
import { clearSolverPrunerMemo, eachCombination, eachPrefixCombos, formStateKey, groupCandsByEffect, loadoutMemoKey, partyBranchUpperBound, pruneDominatedCands, remainingCostFeasible } from './solver-pruner.js'
import { createAccountData, createGameData, solverInputs } from './data-layer.js'
import { buildSolverIndex, ceMilliLive, hydrateSolverIndex, milliFromIndex, solverIndexCoversCatalog } from './solver/solver-index.js'
import { createSearchState, noteBestPlan, searchProgress } from './solver/search-state.js'
import { readSolverCache, solverCacheKey, writeSolverCache } from './solver/cache.js'
import { applyIndexQuery } from './solver/query.js'
import { emptyQueryStats, filterSolutionHits, querySolutionIndex, TOP_N } from './solver/solution-index.js'

let currentSolverIndex = null
let milliMemo = new Map()

export function blankRecommendSlot(position, filled) {
  return {
    position,
    filled,
    isSupport: false,
    bond15: false,
    bondMaxed: false,
    lunch: 0,
    bondLv: 0,
    bondCap: 10,
    teaSelf: 0,
    supportTea: 0,
    holmes: 0,
    condCe: 0,
    eventPassive: 0,
    customPercent: 0,
    portrait: false,
    label: '',
    svtId: 0,
    face: '',
    className: '',
    attribute: '',
    traitIds: [],
    ceId: 0,
    ceMlb: true,
    isGrand: false,
    ceBondId: 0,
    ceRewardId: 0,
    ceBondMlb: true,
    ceRewardMlb: true,
    ceLines: [],
    ceMiss: '',
    svtQuery: '',
    ceQuery: '',
    svtArts: [],
    svtArtKey: '',
    svtImgOk: true,
    ceImgOk: true,
    formLabel: '默认灵基',
    ceBondQuery: '',
    ceRewardQuery: '',
    ceBondImgOk: true,
    ceRewardImgOk: true,
    spriteReason: '',
    pinned: false,
    anySvt: false,
    altSvtIds: [],
    altSvtForms: [],
  }
}

function mlbFunc(ce) {
  if (!ce) return null
  if (Object.prototype.hasOwnProperty.call(ce, '_mlbFn')) return ce._mlbFn
  const skill = pickCeSkill(ce, true)
  const fn = (skill && skill.funcs && skill.funcs[0]) || null
  ce._mlbFn = fn
  return fn
}

function isPortrait(ce) {
  const fn = mlbFunc(ce)
  return Boolean(fn && fn.add >= 50)
}

export function svtCostOf(svt) {
  if (!svt) return 0
  if (arguments.length > 1 && arguments[1] && arguments[1].cost != null && arguments[1].cost !== '') {
    return Number(arguments[1].cost) || 0
  }
  if (svt.cost != null && svt.cost !== '') return Number(svt.cost) || 0
  if (svt.collectionNo === 1) return 0
  return [0, 3, 4, 7, 12, 16][svt.rarity] ?? 16
}

export function ceCostOf(ce) {
  if (!ce) return 0
  if (ce.cost != null && ce.cost !== '') return Number(ce.cost) || 0
  return [0, 1, 3, 5, 9, 12][ce.rarity] ?? 12
}

export function partyCostOf(slots, servants, ces) {
  const svtMap = new Map((servants || []).map((item) => [item.id, item]))
  const ceMap = new Map((ces || []).map((item) => [item.id, item]))
  let sum = 0
  for (const slot of slots || []) {
    if (!slot.filled || slot.isSupport) continue
    const rec = svtMap.get(slot.svtId)
    const form = rec && slot.svtArtKey ? (rec.forms || []).find((item) => item.key === slot.svtArtKey) : null
    sum += svtCostOf(rec, form)
    sum += ceCostOf(ceMap.get(Number(slot.ceId) || slot.ceId))
  }
  return sum
}

const EXTRA_I = new Set(['ruler', 'avenger', 'moonCancer', 'shielder'])
const EXTRA_II = new Set(['alterEgo', 'foreigner', 'pretender', 'beast', 'unBeast', 'beastEresh', 'unBeastOlgaMarie'])

function classOk(svt, questClass) {
  if (!questClass) return true
  if (!svt) return false
  if (questClass === 'extra1') return EXTRA_I.has(svt.className)
  if (questClass === 'extra2') return EXTRA_II.has(svt.className)
  return svt.className === questClass
}

function isBondCe(ce) {
  const fn = mlbFunc(ce)
  return Boolean(fn && fn.rate > 0 && !fn.eventId)
}

function uniqueCesById(list) {
  const out = []
  const seen = new Set()
  for (const ce of list || []) {
    if (!ce || seen.has(ce.id)) continue
    seen.add(ce.id)
    out.push(ce)
  }
  return out
}

function uniqueCeCands(cands) {
  const out = []
  const seen = new Set()
  for (const cand of cands || []) {
    const ce = cand && cand.ce
    if (!ce || seen.has(ce)) continue
    seen.add(ce)
    out.push(cand)
  }
  return out
}

function hasCondition(fn) {
  return Boolean((fn.tvals && fn.tvals.length) || (fn.andTvals && fn.andTvals.length))
}

function ownedIds(account, key) {
  return new Set(((account && account[key]) || []).map((item) => item.id))
}

function ownedCeCopyCount(account, ceId) {
  const raw = account && account.raw ? account.raw : account
  const recs = ((raw && raw.ces) || []).filter((item) => item && item.id === ceId)
  if (recs.length) return recs.reduce((sum, rec) => sum + Math.max(1, Number(rec.count) || 1), 0)
  const owned = account && account.craftEssencesOwned ? account.craftEssencesOwned.filter((item) => item.id === ceId) : []
  return owned.length
}

function mlbCopyCount(account, ceId) {
  const raw = account && account.raw ? account.raw : account
  const recs = ((raw && raw.ces) || []).filter((item) => item && item.id === ceId)
  if (recs.length) {
    return recs.reduce((sum, rec) => {
      if (rec.mlbCount != null) return sum + Math.max(0, Number(rec.mlbCount) || 0)
      return sum + (rec.mlb ? Math.max(1, Number(rec.count) || 1) : 0)
    }, 0)
  }
  return ownedCeCopyCount(account, ceId)
}

function farmerPool(servants, account, mode) {
  if (account && account.virtual) return servants.slice()
  if (mode !== 'account') return servants.slice()
  const owned = account && account.servantsOwned
    ? new Set(account.servantsOwned.map((item) => item.id))
    : ownedIds(account && account.raw ? account.raw : account, 'servants')
  const raw = account && account.raw ? account.raw : account
  return servants.filter((svt) => {
    if (!owned.has(svt.id)) return false
    if (!svtMaxed(svt, raw)) return true
    return svt.collectionNo === 1 && svtBond15(svt, raw)
  })
}

function cePool(ces, account, mode, supportSlot, filter) {
  const list =
    supportSlot || mode !== 'account' || (account && account.virtual)
      ? ces.filter((ce) => isBondCe(ce) && !isPortrait(ce))
      : (() => {
          const out = []
          const seen = new Set()
          for (const ce of ces || []) {
            if (!ce || seen.has(ce.id)) continue
            seen.add(ce.id)
            if (!isBondCe(ce) || isPortrait(ce)) continue
            const copies = ownedCeCopyCount(account, ce.id)
            const mlbN = Math.min(copies, mlbCopyCount(account, ce.id))
            for (let i = 0; i < copies; i++) out.push({ ...ce, accountMlb: i < mlbN, copyIndex: i })
          }
          return out
        })()
  return filterCes(list, filter)
}

function mlbOf(ce, account, mode, supportSlot) {
  if (supportSlot || mode !== 'account' || !account || account.virtual) return true
  if (ce && Object.prototype.hasOwnProperty.call(ce, 'accountMlb')) return Boolean(ce.accountMlb)
  if (account.mlb && Object.prototype.hasOwnProperty.call(account.mlb, ce.id)) return Boolean(account.mlb[ce.id])
  const raw = account.raw || account
  const rec = (raw.ces || []).find((item) => item.id === ce.id)
  return rec ? Boolean(rec.mlb) : true
}

function recOf(svt, account) {
  if (!account || !svt) return null
  return (account.servants || []).find((item) => item.id === svt.id) || null
}

function accountGrandIds(account) {
  return new Set((account && account.servants ? account.servants : []).filter((item) => item && item.isGrand).map((item) => item.id))
}

function grandSvtIdOf(account, farmers, grand) {
  if (!grand) return 0
  const ids = accountGrandIds(account)
  if (!ids.size) return 0
  const hit = (farmers || []).find((row) => row && row.svt && ids.has(row.svt.id))
  return hit ? hit.svt.id : 0
}

// Returns the explicit grand seat only when the user checked a position.
// 0 (unchecked) means "do not pin": the grand position is decided by gain.
function pinnedGrandSeat(grandPosition, n) {
  const pos = Number(grandPosition) || 0
  if (pos < 1 || pos > n) return -1
  return pos - 1
}

function formIndexOfSvt(forms, svtId) {
  if (!svtId) return -1
  return (forms || []).findIndex((form) => form && form.svtId === svtId)
}

function placeGrandFirst(farmers, account, grand, grandPosition = 0) {
  if (!grand) return farmers
  const ids = accountGrandIds(account)
  if (!ids.size) return farmers
  const i = (farmers || []).findIndex((row) => row && row.svt && ids.has(row.svt.id))
  if (i < 0) return farmers
  const seat = pinnedGrandSeat(grandPosition, (farmers || []).length)
  if (seat < 0) return farmers
  if (i === seat) return farmers
  const next = farmers.slice()
  const [row] = next.splice(i, 1)
  next.splice(Math.min(seat, next.length), 0, row)
  return next
}

function svtMaxed(svt, account) {
  return isBondMaxed(recOf(svt, account))
}

function svtBond15(svt, account) {
  return isBond15(recOf(svt, account))
}

export function formUnlocked(form, rec, mode = 'free') {
  if (mode !== 'account') return true
  if (!form) return true
  const key = form.key || ''
  if (key.startsWith('c')) {
    const costumeId = Number(key.slice(1)) || 0
    return (rec && rec.unlockedCostumes || []).some((id) => Number(id) === costumeId)
  }
  if (rec == null || rec.maxAscension == null || rec.maxAscension === '') return true
  const asc = Number(rec.maxAscension) || 0
  if (key === 'a1' || key === 'ascension_1') return asc >= 1
  if (key === 'a2' || key === 'a3' || key === 'ascension_2') return asc >= 3
  return true
}

function traitsOf(item) {
  if (!item) return []
  if (Array.isArray(item.traitIds)) return item.traitIds
  if (item.form && Array.isArray(item.form.traitIds)) return item.form.traitIds
  return []
}

function findSvts(list, ids) {
  const out = []
  const missing = []
  for (const raw of ids || []) {
    const id = Number(raw)
    const svt = (list || []).find((item) => item.id === id)
    if (svt) out.push(svt)
    else missing.push(id)
  }
  return { out, missing }
}

function missingOnlyFiltered(ids, catalog, filter) {
  if (!rosterFilterActive(filter) || !(ids || []).length) return false
  return ids.every((id) => {
    const svt = (catalog || []).find((item) => item.id === id)
    return svt && !matchRosterServant(svt, filter)
  })
}

function formPinOf(svt, pinSprites) {
  if (!svt) return null
  const pin = (pinSprites || []).find((item) => Number(item && item.svtId) === svt.id)
  if (!pin || !pin.formKey) return null
  return servantBondForms(svt).find((form) => form.key === pin.formKey) || null
}

function sanitizePinSprites(list) {
  const map = new Map()
  for (const pin of list || []) {
    const svtId = Number(pin && pin.svtId) || 0
    const formKey = String((pin && pin.formKey) || '')
    if (!svtId || !formKey) continue
    map.set(svtId, { svtId, formKey })
  }
  return [...map.values()].slice(0, 5)
}

function expandFormRows(svts, filter, spriteMode = 'bond_first', account = null, mode = 'free', pinSprites = []) {
  const out = []
  for (const svt of svts || []) {
    const rec = mode === 'account' ? recOf(svt, account) : null
    const pinned = formPinOf(svt, pinSprites)
    if (pinned) {
      if (!formUnlocked(pinned, rec, mode)) continue
      if (!matchRosterForm(svt, pinned, filter)) continue
      out.push({ svt, form: pinned })
      continue
    }
    if (spriteMode === 'strict_order') {
      const form = formForAnchor(svt, null, filter, 'strict_order', rec, mode, pinSprites)
      if (!matchRosterForm(svt, form, filter)) continue
      out.push({ svt, form })
      continue
    }
    const seen = new Set()
    for (const form of servantBondForms(svt)) {
      if (!formUnlocked(form, rec, mode)) continue
      if (!matchRosterForm(svt, form, filter)) continue
      const sig = [
        form.rarity,
        form.cost,
        form.attribute,
        (form.traitIds || []).slice().sort((a, b) => a - b).join(','),
      ].join('|')
      if (seen.has(sig)) continue
      seen.add(sig)
      out.push({ svt, form })
    }
  }
  return out
}

export function formSpriteRank(form) {
  const key = (form && form.key) || 'default'
  if (key === 'a3' || key === 'a2' || key === 'ascension_2') return 0
  if (key.startsWith('c') || key === 'costume') return 1
  if (key === 'a1' || key === 'ascension_1') return 2
  return 3
}

export function pickSpriteForm(forms, mode = 'bond_first') {
  const list = forms || []
  if (!list.length) return null
  if (mode === 'strict_order') {
    return list.slice().sort((a, b) => formSpriteRank(a) - formSpriteRank(b))[0]
  }
  return list[0]
}

function formForAnchor(svt, ce, filter, spriteMode = 'bond_first', rec = null, mode = 'free', pinSprites = []) {
  const pinned = formPinOf(svt, pinSprites)
  if (pinned && formUnlocked(pinned, rec, mode) && matchRosterForm(svt, pinned, filter)) return pinned
  const forms = servantBondForms(svt).filter((form) => formUnlocked(form, rec, mode))
  const usable = forms.filter((form) => matchRosterForm(svt, form, filter))
  if (!usable.length) return { key: 'default', name: '默认灵基', traitIds: svt.traitIds || [] }
  if (spriteMode === 'strict_order') return pickSpriteForm(usable, 'strict_order')
  if (!ce) return pickSpriteForm(usable, 'bond_first')
  let best = usable[0]
  let bestScore = formScore(best, [ce])
  for (const form of usable.slice(1)) {
    const score = formScore(form, [ce])
    if (score.rate > bestScore.rate || (score.rate === bestScore.rate && score.hits > bestScore.hits)) {
      best = form
      bestScore = score
    }
  }
  return best
}

function orderFarmers(preferRows, lockRows, fillerRows, account) {
  const out = []
  const seen = new Set()
  for (const row of [...preferRows, ...lockRows, ...fillerRows]) {
    if (!row || !row.svt || seen.has(row.svt.id)) continue
    seen.add(row.svt.id)
    out.push(row)
  }
  const live = out.filter((row) => !svtMaxed(row.svt, account))
  const dead = out.filter((row) => svtMaxed(row.svt, account))
  return [...live, ...dead]
}

function layoutSlots(farmers, useSupport, grand, grandSvtId = 0, grandPosition = 0) {
  const slots = [1, 2, 3, 4, 5, 6].map((position) => blankRecommendSlot(position, false))
  const ownCap = useSupport ? 5 : 6
  const seated = (farmers || []).slice(0, ownCap)
  seated.slice(0, 3).forEach((row, index) => applySvt(slots[index], row.svt, row.form))
  seated.slice(3).forEach((row, index) => applySvt(slots[3 + index], row.svt, row.form))
  if (useSupport) applySupportSlot(slots[5], grand)
  if (grand) {
    const grandSlot = pickGrandSlot(slots, grandSvtId, grandPosition)
    if (grandSlot) grandSlot.isGrand = true
  }
  return slots
}

export function sanitizeGrandPosition(raw, useSupport = true) {
  const pos = Number(raw) || 0
  if (pos < 1 || pos > 6) return 0
  if (useSupport && pos === 6) return 0
  return pos
}

function pickGrandSlot(slots, grandSvtId = 0, grandPosition = 0) {
  if (grandPosition) {
    const pinned = (slots || []).find((slot) => !slot.isSupport && slot.position === grandPosition && slot.filled)
    if (pinned) return pinned
  }
  let grandSlot = grandSvtId ? (slots || []).find((slot) => !slot.isSupport && slot.svtId === grandSvtId && slot.filled) : null
  if (!grandSlot) grandSlot = (slots || []).find((slot) => slot.filled && !slot.isSupport && slot.position <= 3)
  return grandSlot || null
}

export function sanitizeSlotPins(raw, useSupport = true) {
  const ownCap = useSupport ? 5 : 6
  const seenPos = new Set()
  const seenSvt = new Set()
  const pins = []
  for (const item of raw || []) {
    const position = Number(item && item.position) || 0
    if (position < 1 || position > 6 || seenPos.has(position)) continue
    seenPos.add(position)
    const svtId = Number(item && item.svtId) || 0
    const ceId = Number(item && item.ceId) || 0
    const ceBondId = Number(item && item.ceBondId) || 0
    const ceRewardId = Number(item && item.ceRewardId) || 0
    const formKey = String((item && item.formKey) || '')
    const supportSlot = Boolean(useSupport && position === 6)
    if (supportSlot) {
      if (!ceId && !ceRewardId) continue
      pins.push({ position, svtId: 0, ceId, ceBondId: 0, ceRewardId, formKey: '', support: true })
      continue
    }
    if (position > ownCap) continue
    if (!svtId) continue
    if (seenSvt.has(svtId)) return { ok: false, error: '站位钉住不能重复从者' }
    seenSvt.add(svtId)
    pins.push({ position, svtId, ceId, ceBondId, ceRewardId, formKey, support: false })
  }
  return { ok: true, pins }
}

function slotPinFrontIds(slotPins, frontIds) {
  return [0, 1, 2].map((pos) => {
    const pinned = (slotPins || []).find((pin) => pin.position === pos + 1 && pin.svtId)
    return (pinned && pinned.svtId) || Number(frontIds && frontIds[pos]) || 0
  })
}

function forceGrandFrontIdx(frontIdx, forms, grandSvtId, grandSeat) {
  const g = formIndexOfSvt(forms, grandSvtId)
  if (g < 0 || grandSeat < 0) return frontIdx
  const next = (frontIdx || []).filter((i) => Number.isInteger(i) && i >= 0)
  if (grandSeat >= 3) return next.filter((i) => i !== g)
  while (next.length < 3) next.push(-1)
  const at = next.indexOf(g)
  if (at !== grandSeat) {
    if (at >= 0) {
      next[at] = next[grandSeat]
      next[grandSeat] = g
    } else {
      next[grandSeat] = g
    }
  }
  const seen = new Set()
  const out = []
  for (const i of next) {
    if (i < 0 || seen.has(i)) continue
    seen.add(i)
    out.push(i)
    if (out.length === 3) break
  }
  return out
}

function bestFrontByGain({ forms, add, state15, maxed, base, useSupport, grandSvtId, grandSeat }) {
  const g = formIndexOfSvt(forms, grandSvtId)
  const second = forms.map((_, i) => add[i] + state15Milli(state15, forms[i].svtId))
  const scored = []
  for (let i = 0; i < forms.length; i++) {
    if (maxed && maxed[i]) continue
    if (i === g && grandSeat >= 3) continue
    const front = applyRateMilli(applyRateMilli(base, useSupport ? 240 : 200), second[i]) + 50
    const back = applyRateMilli(applyRateMilli(base, useSupport ? 40 : 0), second[i]) + 50
    scored.push({ i, gain: front - back })
  }
  scored.sort((a, b) => b.gain - a.gain)
  if (g >= 0 && grandSeat >= 0 && grandSeat < 3) {
    const others = []
    for (const row of scored) {
      if (row.i === g) continue
      others.push(row.i)
      if (others.length >= 2) break
    }
    const need = Math.min(3, forms.length)
    const front = []
    let oi = 0
    for (let pos = 0; pos < need; pos++) {
      if (pos === grandSeat) front.push(g)
      else if (oi < others.length) front.push(others[oi++])
    }
    return front
  }
  return scored.slice(0, 3).map((row) => row.i)
}

function seatGrandAt(seats, list, grandSvtId, grandSeat, slotPins, ownCap) {
  if (!grandSvtId || grandSeat < 0 || grandSeat >= ownCap) return
  const pin = (slotPins || []).find((item) => item.position === grandSeat + 1 && item.svtId)
  if (pin && pin.svtId !== grandSvtId) return
  const cur = seats.findIndex((row) => row && row.svt && row.svt.id === grandSvtId)
  if (cur === grandSeat) return
  const row = cur >= 0 ? seats[cur] : (list || []).find((item) => item && item.svt && item.svt.id === grandSvtId)
  if (!row) return
  if (cur >= 0) {
    const tmp = seats[grandSeat]
    seats[grandSeat] = seats[cur]
    seats[cur] = tmp
    return
  }
  if (seats[grandSeat]) {
    const empty = seats.findIndex((item) => !item)
    const bumped = seats[grandSeat]
    seats[grandSeat] = row
    if (empty >= 0) seats[empty] = bumped
  } else {
    seats[grandSeat] = row
  }
}

function seatOwnFarmers(farmers, useSupport, frontIdx, slotPins, grandSvtId = 0, grandPosition = 0) {
  const ownCap = useSupport ? 5 : 6
  const seats = Array(ownCap).fill(null)
  const list = farmers || []
  const byId = new Map(list.map((row) => [row.svt.id, row]))
  for (const pin of slotPins || []) {
    if (!pin.svtId || pin.position < 1 || pin.position > ownCap) continue
    const row = byId.get(pin.svtId)
    if (row) seats[pin.position - 1] = row
  }
  if (frontIdx && frontIdx.length) {
    frontIdx.forEach((idx, i) => {
      if (i >= 3 || seats[i] || idx < 0 || idx >= list.length) return
      const row = list[idx]
      if (!row || seats.some((seat) => seat && seat.svt.id === row.svt.id)) return
      seats[i] = row
    })
  }
  const used = new Set(seats.filter(Boolean).map((row) => row.svt.id))
  const rest = list.filter((row) => !used.has(row.svt.id))
  let ri = 0
  for (let i = 0; i < ownCap; i++) {
    if (!seats[i] && rest[ri]) seats[i] = rest[ri++]
  }
  const filled = seats.filter(Boolean).length
  const grandSeat = grandSvtId ? pinnedGrandSeat(grandPosition, filled) : -1
  seatGrandAt(seats, list, grandSvtId, grandSeat, slotPins, ownCap)
  return seats
}

function layoutSeatedSlots(seats, useSupport, grand, grandSvtId = 0, grandPosition = 0) {
  const slots = [1, 2, 3, 4, 5, 6].map((position) => blankRecommendSlot(position, false))
  const ownCap = useSupport ? 5 : 6
  for (let i = 0; i < ownCap; i++) {
    const row = seats && seats[i]
    if (row) applySvt(slots[i], row.svt, row.form)
  }
  if (useSupport) applySupportSlot(slots[5], grand)
  if (grand) {
    const grandSlot = pickGrandSlot(slots, grandSvtId, grandPosition)
    if (grandSlot) grandSlot.isGrand = true
  }
  return slots
}

function frontCombos(n) {
  if (n <= 0) return [[]]
  if (n <= 3) return [Array.from({ length: n }, (_, i) => i)]
  const out = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) out.push([i, j, k])
    }
  }
  return out
}

export function frontLayouts(farmers, frontIds, slotPins = []) {
  const n = (farmers || []).length
  const ids = slotPinFrontIds(slotPins, frontIds)
  const backPinned = new Set((slotPins || []).filter((pin) => pin.position >= 4 && pin.svtId).map((pin) => pin.svtId))
  const pins = [0, 1, 2].map((pos) => {
    const id = ids[pos]
    if (!id) return -1
    return (farmers || []).findIndex((row) => row.svt && row.svt.id === id)
  })
  if (pins.some((idx, pos) => ids[pos] && idx < 0)) return []
  const freeN = (farmers || []).filter((row) => row && row.svt && !backPinned.has(row.svt.id)).length
  if (pins.every((idx) => idx < 0) && !backPinned.size) return frontCombos(n)
  const need = Math.min(3, freeN)
  if (pins.some((idx, pos) => idx >= 0 && pos >= need)) return []
  const out = []
  const chosen = []
  function rec() {
    if (chosen.length === need) {
      if (pins.every((idx, pos) => idx < 0 || chosen[pos] === idx)) out.push(chosen.slice())
      return
    }
    for (let i = 0; i < n; i++) {
      if (chosen.includes(i)) continue
      if (backPinned.has(farmers[i].svt.id)) continue
      chosen.push(i)
      rec()
      chosen.pop()
    }
  }
  rec()
  return out
}

function farmersForFront(farmers, frontIdx) {
  const n = (farmers || []).length
  if (!frontIdx || !frontIdx.length || n <= 3) return farmers
  const seen = new Set()
  const front = []
  for (const i of frontIdx) {
    if (i < 0 || i >= n || seen.has(i)) continue
    seen.add(i)
    front.push(farmers[i])
  }
  const back = farmers.filter((_, i) => !seen.has(i))
  return [...front, ...back]
}

export function comparePlans(left, right) {
  const mode = left.optimizeBy || right.optimizeBy || 'total'
  const mainL = mainBondOf(left, mode)
  const mainR = mainBondOf(right, mode)
  if (mainL !== mainR) return mainR - mainL
  const secondL = mode === 'prefer' ? left.total || 0 : left.preferBond || 0
  const secondR = mode === 'prefer' ? right.total || 0 : right.preferBond || 0
  if (secondL !== secondR) return secondR - secondL
  if (left.bond15Count !== right.bond15Count) return left.bond15Count - right.bond15Count
  const gapL = Math.abs((left.costLimit || 0) - (left.costUsed || 0))
  const gapR = Math.abs((right.costLimit || 0) - (right.costUsed || 0))
  if (gapL !== gapR) return gapL - gapR
  return (right.priorityScore || 0) - (left.priorityScore || 0)
}

export function betterTarget(left, right) {
  const mode = left.optimizeBy || right.optimizeBy || 'total'
  const mainL = mainBondOf(left, mode)
  const mainR = mainBondOf(right, mode)
  if (mainL !== mainR) return mainL > mainR
  const secondL = mode === 'prefer' ? left.total || 0 : left.preferBond || 0
  const secondR = mode === 'prefer' ? right.total || 0 : right.preferBond || 0
  if (secondL !== secondR) return secondL > secondR
  if ((left.bond15Count || 0) !== (right.bond15Count || 0)) return (left.bond15Count || 0) < (right.bond15Count || 0)
  return false
}

export function paretoByCost(plans) {
  const bestAt = new Map()
  for (const plan of uniquePlans(plans)) {
    const cost = plan.costUsed || 0
    const prev = bestAt.get(cost)
    if (!prev || comparePlans(plan, prev) < 0) bestAt.set(cost, plan)
  }
  const ordered = [...bestAt.keys()].sort((a, b) => a - b).map((cost) => bestAt.get(cost))
  const out = []
  for (const plan of ordered) {
    if (!out.length || betterTarget(plan, out[out.length - 1])) out.push(plan)
  }
  out.reverse()
  return out
}

export function pickCostPlan(plans, focusCost) {
  if (!plans.length) return 0
  if (!Number.isInteger(focusCost) || focusCost < 0) return 0
  let best = -1
  for (let i = 0; i < plans.length; i++) {
    if ((plans[i].costUsed || 0) > focusCost) continue
    if (best < 0 || comparePlans(plans[i], plans[best]) < 0) {
      best = i
    }
  }
  if (best >= 0) return best
  let minI = 0
  for (let i = 1; i < plans.length; i++) {
    const cost = plans[i].costUsed || 0
    const minCost = plans[minI].costUsed || 0
    if (cost < minCost || (cost === minCost && comparePlans(plans[i], plans[minI]) < 0)) minI = i
  }
  return minI
}

function supportCeIdOf(plan) {
  const slot = (plan.slots || []).find((item) => item.isSupport)
  return slot && slot.ceId ? Number(slot.ceId) : 0
}

function planAssistKey(plan) {
  return `${plan.costUsed || 0}:${supportCeIdOf(plan)}`
}

export function assistCandidates(plans, ces) {
  const best = new Map()
  for (const plan of plans || []) {
    const id = supportCeIdOf(plan)
    if (!id) continue
    const prev = best.get(id)
    if (!prev || plan.total > prev.total) {
      const ce = (ces || []).find((item) => Number(item.id) === id)
      best.set(id, { id, name: (ce && ce.name) || String(id), total: plan.total })
    }
  }
  return [...best.values()].sort((a, b) => b.total - a.total || a.id - b.id)
}

export function filterRecommendBySupportCe(rec, ceId) {
  if (!rec || !rec.ok) return rec
  const all = rec.allPlans || rec.plans || []
  const id = Number(ceId) || 0
  const matched = id ? all.filter((plan) => supportCeIdOf(plan) === id) : all
  if (!matched.length) {
    return {
      ...rec,
      ok: false,
      error: '没有使用该助战礼装的方案',
      lockSupportCeId: id,
      assist: rec.assist,
      allPlans: all,
    }
  }
  const uniq = paretoByCost(matched)
  const best = uniq[0]
  return {
    ...best,
    ok: true,
    error: '',
    plans: keepTopPlans(uniq, best),
    chosen: 0,
    assist: rec.assist,
    allPlans: all,
    lockSupportCeId: id,
  }
}

function hydrateSolutionHits(hits, ctx) {
  const plans = []
  const preferSet = new Set((ctx.preferIds || []).map(Number).filter(Boolean))
  const lockSet = new Set((ctx.lockIds || []).map(Number).filter(Boolean))
  for (const compact of hits || []) {
    const slots = [1, 2, 3, 4, 5, 6].map((position) => blankRecommendSlot(position, false))
    for (const row of compact.slots || []) {
      const pos = Number(row.p || row.position) || 0
      const slot = slots[pos - 1]
      if (!slot) continue
      slot.filled = Boolean(row.f)
      slot.isSupport = Boolean(row.s)
      slot.isGrand = Boolean(row.g)
      slot.svtId = Number(row.svt) || 0
      slot.svtArtKey = row.art || ''
      slot.ceId = Number(row.ce) || 0
      slot.ceBondId = Number(row.bond) || 0
      slot.ceRewardId = Number(row.reward) || 0
      const svt = (ctx.servants || []).find((item) => item.id === slot.svtId)
      if (svt) {
        slot.label = svt.name
        slot.className = svt.className
        slot.face = svt.face
        slot.attribute = svt.attribute
        slot.traitIds = svt.traitIds || []
      }
    }
    applyCraftEssences(slots, ctx.ces)
    resolveSlotEventPassives(slots, { quest: ctx.quest, catalog: ctx.bondBonuses })
    const output = calcParty(ctx.base, ctx.teapot, slots, { bond15Aura: ctx.bond15Aura })
    if (!output.ok) continue
    let preferBond = 0
    let lockBond = 0
    for (const slot of slots) {
      const result = (output.results || []).find((item) => item.position === slot.position)
      if (result && result.eligible) {
        if (preferSet.has(slot.svtId)) preferBond += result.final
        if (lockSet.has(slot.svtId)) lockBond += result.final
      }
    }
    plans.push({
      ok: true,
      error: '',
      slots,
      summary: 'Solution Index 命中后精确结算。',
      total: output.total,
      preferBond,
      lockBond,
      optimizeBy: 'total',
      output,
      useSupport: ctx.allowSupport,
      costUsed: compact.cost || 0,
      questType: ctx.questType,
      questClass: ctx.questClass,
    })
  }
  return plans
}

export function planFingerprint(plan) {
  return (plan.slots || [])
    .map((slot) =>
      slot.filled
        ? `${slot.position}:${slot.svtId}:${slot.svtArtKey || 'd'}:${slot.isSupport ? 1 : 0}:${slot.ceId}:${slot.ceBondId || 0}:${slot.ceRewardId || 0}`
        : `${slot.position}:0`,
    )
    .join('|')
}

function uniquePlans(plans) {
  const seen = new Set()
  const out = []
  for (const plan of plans || []) {
    const key = planFingerprint(plan)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(plan)
  }
  return out
}

const MAX_KEPT_PLANS = TOP_N

function keepTopPlans(plans, chosen, limit = MAX_KEPT_PLANS) {
  const out = []
  const seen = new Set()
  let cutoffTotal = null
  for (const plan of plans || []) {
    const key = planFingerprint(plan)
    if (seen.has(key)) continue
    seen.add(key)
    if (out.length >= limit) {
      if (cutoffTotal == null) cutoffTotal = out[out.length - 1].total || 0
      if ((plan.total || 0) !== cutoffTotal) break
    }
    out.push(plan)
  }
  if (!chosen) return out
  const chosenKey = planFingerprint(chosen)
  if (out.some((plan) => planFingerprint(plan) === chosenKey)) return out
  out.unshift(chosen)
  return out
}

function ceNameOf(ces, id) {
  const ce = (ces || []).find((item) => item.id === id)
  return ce ? ce.name : '礼装'
}

function grandCeLine(slots, ces) {
  const grands = (slots || []).filter((item) => item.isGrand && item.filled)
  if (!grands.length) return ''
  return `${grands
    .map((slot) => {
      const who = slot.isSupport ? '助战冠位' : `冠位 ${slot.label || '从者'}`
      const parts = [who]
      if (slot.ceId) parts.push(`普通礼装 ${ceNameOf(ces, slot.ceId)}`)
      if (!slot.isSupport) parts.push('羁绊礼装为该从者10绊礼装，通关羁绊不加')
      if (slot.ceRewardId) parts.push(`报酬礼装 ${ceNameOf(ces, slot.ceRewardId)}（免费）`)
      return parts.join(' · ')
    })
    .join('。')}。`
}

function condBondCes(available) {
  const seen = new Set()
  const out = []
  for (const ce of available || []) {
    if (!ce) continue
    const fn = mlbFunc(ce)
    if (!fn || !hasCondition(fn) || !(fn.rate > 0)) continue
    const key = condKey(fn)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ce)
  }
  return out
}

function condKey(fn) {
  const tvals = (fn.tvals || []).map((item) => item.id || item.value || item.name).join(',')
  const ands = (fn.andTvals || [])
    .map((group) => (group || []).map((item) => item.id || item.value || item.name).join('+'))
    .join('|')
  return `${fn.rate || 0}:${tvals}:${ands}`
}

function coverCount(row, ces) {
  const form = (row && row.form) || { traitIds: (row && row.svt && row.svt.traitIds) || [] }
  return formScore(form, ces).hits
}

function fillDensity(row, ces) {
  const hits = coverCount(row, ces)
  const cost = svtCostOf(row && row.svt, row && row.form)
  if (cost <= 0) return hits * 1000 + 1
  return hits / cost
}

function byCoverThenCost(rows, ces) {
  return (rows || [])
    .map((row) => ({
      row,
      dens: fillDensity(row, ces),
      cost: svtCostOf(row.svt, row.form),
      no: row.svt.collectionNo,
      form: formRank(row),
    }))
    .sort((a, b) => b.dens - a.dens || a.cost - b.cost || a.no - b.no || a.form - b.form)
    .map((item) => item.row)
}

function uniqueBestRows(rows, ces, account) {
  const seen = new Set()
  const out = []
  for (const row of byCoverThenCost(rows, ces)) {
    const id = row && row.svt && row.svt.id
    if (id == null) continue
    const key = `${id}:${rowEffectSig(row, ces, account)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function rowEffectSig(row, ces, account) {
  const form = (row && row.form) || { traitIds: (row && row.svt && row.svt.traitIds) || [] }
  const rates = (ces || []).map((ce) => ceMilliOn(ce, form, false))
  const maxed = row && row.svt && svtMaxed(row.svt, account) ? 1 : 0
  const b15 = row && row.svt && svtBond15(row.svt, account) ? 1 : 0
  return `${rates.join(',')}:${maxed}:${b15}`
}

// Two servants are interchangeable in a slot when every own and support CE gives
// them the same hit rate, their bond state (maxed / 15-bond aura) matches, and
// their cost matches. Inside a class the objective is identical, so any member
// can fill the slot without changing the plan total.
function interchangeSig(row, ownCes, supportCes, account) {
  const form = (row && row.form) || { traitIds: (row && row.svt && row.svt.traitIds) || [] }
  const rates = []
  for (const ce of ownCes || []) rates.push(ceMilliOn(ce, form, false))
  for (const ce of supportCes || []) rates.push(ceMilliOn(ce, form, true))
  const maxed = row && row.svt && svtMaxed(row.svt, account) ? 1 : 0
  const b15 = row && row.svt && svtBond15(row.svt, account) ? 1 : 0
  return `${rates.join(',')}:${maxed}:${b15}#${svtCostOf(row && row.svt, row && row.form)}`
}

function formKeyOf(row) {
  const key = row && row.form && row.form.key
  return key && key !== 'default' ? key : 'default'
}

function slotFormKey(slot) {
  const key = slot && slot.svtArtKey
  return key && key !== 'default' ? key : 'default'
}

function annotateInterchange(plans, freeRows, ownCes, supportCes, account) {
  if (!plans || !plans.length || !freeRows || !freeRows.length) return plans
  const membersByClass = new Map()
  const rowBySvtForm = new Map()
  for (const row of freeRows) {
    if (!row || !row.svt) continue
    rowBySvtForm.set(`${row.svt.id}:${formKeyOf(row)}`, row)
    const key = interchangeSig(row, ownCes, supportCes, account)
    if (!membersByClass.has(key)) membersByClass.set(key, [])
    const members = membersByClass.get(key)
    if (!members.some((item) => item.svt.id === row.svt.id && formKeyOf(item) === formKeyOf(row))) members.push(row)
  }
  for (const plan of plans) {
    const own = (plan.slots || []).filter((slot) => slot.filled && !slot.isSupport && slot.svtId)
    if (!own.length) continue
    for (const slot of own) {
      const row = rowBySvtForm.get(`${slot.svtId}:${slotFormKey(slot)}`)
      if (!row) continue
      const members = membersByClass.get(interchangeSig(row, ownCes, supportCes, account)) || []
      if (members.length <= 1) continue
       const altSvtIds = []
       const altSvtForms = []
       for (const item of members) {
         const id = item.svt.id
         const form = item.form || { key: 'default', name: '默认灵基' }
         const formKey = formKeyOf(item)
         if (id === slot.svtId && formKey === slotFormKey(slot)) continue
          if (!altSvtForms.some((entry) => entry.id === id && entry.formKey === formKey)) {
            const isDefault = !form.key || form.key === 'default'
            altSvtForms.push({
              id,
              formKey,
              formLabel: isDefault ? '第3阶段' : form.name || '默认灵基',
            })
          }
         if (id === slot.svtId || altSvtIds.includes(id)) continue
         altSvtIds.push(id)
       }
       if (!altSvtForms.length) continue
       slot.anySvt = true
       slot.altSvtIds = altSvtIds
       slot.altSvtForms = altSvtForms
    }
  }
  return plans
}

function compressEquivalentRows(rows, ces, keep, account) {
  const limit = Math.max(1, keep)
  const groups = new Map()
  for (const row of rows || []) {
    const sig = rowEffectSig(row, ces, account)
    if (!groups.has(sig)) groups.set(sig, [])
    groups.get(sig).push(row)
  }
  const out = []
  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        svtCostOf(a.svt, a.form) - svtCostOf(b.svt, b.form) ||
        (a.svt.collectionNo || 0) - (b.svt.collectionNo || 0) ||
        a.svt.id - b.svt.id,
    )
    for (let i = 0; i < group.length && i < limit; i++) out.push(group[i])
  }
  return uniqueBestRows(out, ces, account)
}

function visitHitFillers(hits, miss, m, visit) {
  const n = (hits || []).length
  if (m < 0 || m > n) return
  if (m === 0) {
    visit(miss || [])
    return
  }
  eachCombination(hits, m, (pick) => visit(pick.concat(miss || [])))
}

function formRank(row) {
  const key = row && row.form && row.form.key
  return !key || key === 'default' ? 0 : 1
}

function clusterRowsByEffectCost(rows, ces, account, cap, priorities = []) {
  const limit = Math.max(1, cap)
  const groups = new Map()
  for (const row of rows || []) {
    const key = `${rowEffectSig(row, ces, account)}#${svtCostOf(row.svt, row.form)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const out = []
  for (const group of groups.values()) {
    const byId = new Map()
    for (const row of group) {
      const id = row && row.svt && row.svt.id
      if (id == null || byId.has(id)) continue
      byId.set(id, row)
    }
    const uniq = [...byId.values()]
    uniq.sort(
      (a, b) =>
        priorityScore([b.svt], priorities) - priorityScore([a.svt], priorities) ||
        (a.svt.collectionNo || 0) - (b.svt.collectionNo || 0) ||
        a.svt.id - b.svt.id,
    )
    out.push(uniq.slice(0, limit))
  }
  return out
}

function splitByAnchor(rows, ce) {
  if (!ce) return { hit: (rows || []).slice(), miss: [] }
  const fn = mlbFunc(ce)
  const hit = []
  const miss = []
  for (const row of rows || []) {
    const ok = ceMatchesServant(fn, (row.form && row.form.traitIds) || [])
    if (ok) hit.push(row)
    else miss.push(row)
  }
  return { hit, miss }
}

export function servantBondForms(svt) {
  const base = svt.traitIds || []
  const forms = [
    {
      key: 'default',
      name: '默认灵基',
      traitIds: base.slice(),
      rarity: svt.rarity,
      cost: svtCostOf(svt),
      attribute: svt.attribute,
    },
  ]
  const seen = new Set(['default'])
  for (const form of svt.forms || []) {
    const key = form.key || ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    const traitIds = form.traitIds && form.traitIds.length ? form.traitIds : base
    forms.push({
      key,
      name: form.name || key,
      traitIds: traitIds.slice(),
      rarity: form.rarity != null ? form.rarity : svt.rarity,
      cost: form.cost != null ? form.cost : svtCostOf(svt),
      attribute: form.attribute || svt.attribute,
    })
  }
  for (const item of [
    { key: 'a1', name: '第1阶段' },
    { key: 'a3', name: '第3阶段' },
  ]) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    forms.push({
      key: item.key,
      name: item.name,
      traitIds: base.slice(),
      rarity: svt.rarity,
      cost: svtCostOf(svt),
      attribute: svt.attribute,
    })
  }
  return forms
}

export function bestBondForm(svt, ces) {
  const cond = (ces || []).filter((ce) => hasCondition(mlbFunc(ce)))
  let best = null
  for (const form of servantBondForms(svt)) {
    const score = formScore(form, cond)
    if (!best || score.rate > best.score.rate || (score.rate === best.score.rate && score.hits > best.score.hits)) {
      best = { form, score }
    }
  }
  return best.form
}

function formScore(form, ces) {
  let rate = 0
  let hits = 0
  for (const ce of ces || []) {
    const fn = mlbFunc(ce)
    if (!fn || !hasCondition(fn)) continue
    if (!ceMatchesServant(fn, form.traitIds)) continue
    rate += fn.rate || 0
    hits += 1
  }
  return { rate, hits }
}

function spriteReasonOf(svt, form, ces, pinSprites = [], spriteMode = 'bond_first') {
  if (!svt || !form) return ''
  const pinned = formPinOf(svt, pinSprites)
  if (pinned && pinned.key === form.key) return `已钉形象：${form.name}`
  const key = form.key || 'default'
  if (key === 'default') return ''
  const base = servantBondForms(svt).find((item) => item.key === 'default') || servantBondForms(svt)[0]
  const extra = []
  for (const ce of ces || []) {
    const fn = mlbFunc(ce)
    if (!fn || !hasCondition(fn)) continue
    if (ceMatchesServant(fn, form.traitIds) && !ceMatchesServant(fn, base.traitIds)) extra.push(ce.name)
  }
  if (extra.length) return `${form.name}命中${extra.slice(0, 2).join('、')}`
  if (spriteMode === 'strict_order') return `严格顺序：${form.name}`
  return ''
}

function applySvt(slot, svt, form) {
  const picked = form || { key: 'default', name: '默认灵基', traitIds: svt.traitIds || [] }
  slot.svtId = svt.id
  slot.label = svt.name
  slot.face = svt.face
  slot.className = svt.className
  slot.attribute = picked.attribute || svt.attribute
  slot.rarity = picked.rarity != null ? picked.rarity : svt.rarity
  slot.traitIds = picked.traitIds || []
  const isDefault = !picked.key || picked.key === 'default'
  slot.formLabel = isDefault ? '第3阶段' : picked.name || '默认灵基'
  slot.svtArtKey = picked.key && picked.key !== 'default' ? picked.key : ''
  slot.filled = true
}

function applySupportSlot(slot, grand) {
  slot.filled = true
  slot.isSupport = true
  slot.isGrand = Boolean(grand)
  slot.svtId = 0
  slot.label = '助战'
  slot.face = ''
  slot.className = ''
  slot.attribute = ''
  slot.traitIds = []
  slot.formLabel = ''
  slot.svtArtKey = ''
}

function applyCe(slot, ce, mlb) {
  slot.ceId = ce.id
  slot.ceMlb = mlb
}

function condNeed(fn) {
  const names = []
  for (const trait of fn.tvals || []) names.push(trait.name)
  for (const group of fn.andTvals || []) {
    for (const trait of group) names.push(trait.name)
  }
  return names.join(' + ')
}

export function explainFormBonuses(slot, partySlots, ces, result) {
  const catalog = new Map(ces.map((ce) => [ce.id, ce]))
  const hits = (result && result.lines) || []
  const misses = []
  if (slot.isSupport) {
    return {
      title: `${slot.label || '助战'} · ${classLabel(slot.className)} · ${slot.formLabel}`,
      hits,
      misses,
      final: 0,
      anySvt: false,
      altSvtIds: [],
    }
  }
  for (const wearer of partySlots) {
    if (!wearer.filled) continue
    for (const ceId of [wearer.ceId, wearer.ceBondId, wearer.ceRewardId]) {
      if (!ceId) continue
      const ce = catalog.get(ceId)
      const fn = mlbFunc(ce)
      if (!fn || !hasCondition(fn)) continue
      if (ceMatchesServant(fn, slot.traitIds)) continue
      misses.push(`${ce.name}${wearer.isSupport ? '（助战）' : ''} 未对上（需要 ${condNeed(fn)}，当前灵基没有）`)
    }
  }
  return {
    title: `${slot.label} · ${classLabel(slot.className)} · ${slot.formLabel}${slot.spriteReason ? ` · ${slot.spriteReason}` : ''}`,
    hits,
    misses,
    final: result && result.eligible ? result.final : 0,
    anySvt: Boolean(slot.anySvt),
    altSvtIds: slot.altSvtIds || [],
    altSvtForms: slot.altSvtForms || [],
  }
}

export function recommendTeam(opts = {}) {
  const prevIndex = currentSolverIndex
  try {
    return recommendTeamRun(opts)
  } finally {
    currentSolverIndex = prevIndex
  }
}

function servantCatalogSig(servants) {
  return (servants || [])
    .map((svt) => {
      const forms = (svt.forms || [])
        .map((form) => `${form.key || ''}:${form.cost ?? ''}:${form.attribute || ''}:${(form.traitIds || []).join('.')}`)
        .join(';')
      return `${svt.id}:${svt.cost ?? ''}:${svt.attribute || ''}:${(svt.traitIds || []).join('.')}:${forms}`
    })
    .join(',')
}

function ceCatalogSig(ces) {
  return (ces || []).map((ce) => `${ce.id}:${ce.cost ?? ''}`).join(',')
}

function recommendTeamRun({
  base,
  teapot = false,
  servants = [],
  ces = [],
  account = null,
  mode = 'free',
  allowSupport = true,
  preferSvtIds = [],
  lockSvtIds = [],
  questType = 'normal',
  questClass = '',
  costLimit = null,
  filter = null,
  bond15Aura = true,
  lockSupportCeId = 0,
  optimizeBy = 'total',
  priorities = [],
  frontIds = [],
  pinCes = [],
  spriteMode = 'bond_first',
  pinSprites = [],
  slotPins: slotPinsIn = [],
  game: gameIn = null,
  solverAudit = null,
  solverIndex: solverIndexIn = null,
  solutionIndex: solutionIndexIn = null,
  skipSolutionLookup = false,
  onSolverProgress = null,
  grandPosition: grandPositionIn = 0,
  region: regionIn = '',
  quest = null,
  bondBonuses = null,
} = {}) {
  const optimizeMode = optimizeBy === 'prefer' ? 'prefer' : 'total'
  const useMemo = !solverAudit || solverAudit.memo !== false
  const liveBonuses = liveBondBonusCatalog(bondBonuses, quest)
  const hasLiveBondBonus = liveBonuses.extraPassives.length > 0 || liveBonuses.questFriendships.length > 0
  const useUb = (!solverAudit || solverAudit.ub !== false) && !hasLiveBondBonus
  const useCompression = !solverAudit || solverAudit.compression !== false
  const useDominance = !solverAudit || solverAudit.dominance !== false
  if (!Number.isInteger(base) || base < 0) {
    return { ok: false, error: '请输入非负整数作为关卡基础羁绊' }
  }
  const catalog = (servants || []).filter(isPlayableServant)
  if (solverAudit && solverAudit.index === false) {
    currentSolverIndex = null
  } else {
    const rawIndex = solverIndexCoversCatalog(solverIndexIn, catalog) ? solverIndexIn : null
    currentSolverIndex = hydrateSolverIndex(
      rawIndex ||
        buildSolverIndex({
          servants: catalog,
          ces,
          version: gameIn && gameIn.version,
          formsOf: servantBondForms,
        }),
    )
  }
  milliMemo = new Map()
  clearSolverPrunerMemo()
  servants = rosterFilterActive(filter) ? filterServants(catalog, filter) : catalog
  const focusCost = Number.isInteger(costLimit) && costLimit >= 0 ? costLimit : null
  if (questType === 'grand' && !questClass) {
    return { ok: false, error: '冠位战请选择职阶' }
  }
  if (mode === 'account' && !account) {
    return { ok: false, error: '账号配队请先导入 Chaldea JSON 或登录回包 PHP，或改用自由配队' }
  }
  const preferIds = (preferSvtIds || []).map(Number).filter((id) => id)
  const slotPinCheck = sanitizeSlotPins(slotPinsIn, allowSupport !== false)
  if (!slotPinCheck.ok) return slotPinCheck
  const slotPins = slotPinCheck.pins
  const frontPinIds = slotPinFrontIds(slotPins, frontIds).filter((id) => id)
  if (frontPinIds.length && new Set(frontPinIds).size !== frontPinIds.length) {
    return { ok: false, error: '前排预设不能重复' }
  }
  const pins = sanitizePinSprites(pinSprites)
  const pinSvtIds = (pinCes || []).map((item) => Number(item && item.svtId)).filter((id) => id)
  const pinSpriteIds = pins.map((pin) => pin.svtId)
  const slotPinSvtIds = slotPins.map((pin) => pin.svtId).filter((id) => id)
  const lockIds = [...new Set([...(lockSvtIds || []).map(Number), ...frontPinIds, ...pinSvtIds, ...pinSpriteIds, ...slotPinSvtIds].filter((id) => id))]
  if (preferIds.length > 5) return { ok: false, error: '练度从者最多 5 名' }
  if (lockIds.length > (allowSupport !== false ? 5 : 6)) return { ok: false, error: '锁定超出编队上限' }
  const banSvtIds = (filter && filter.banSvtIds) || []
  const banCeIds = (filter && filter.banCeIds) || []
  if ([...preferIds, ...lockIds].some((id) => banSvtIds.some((item) => Number(item) === id))) {
    return { ok: false, error: '练度或锁定从者在屏蔽名单里' }
  }
  if ((pinCes || []).some((pin) => banCeIds.some((item) => Number(item) === Number(pin && pin.ceId)))) {
    return { ok: false, error: '钉选礼装在屏蔽名单里' }
  }
  const mergedPinCes = [...(pinCes || [])]
  for (const pin of slotPins) {
    if (pin.svtId && pin.ceId) mergedPinCes.push({ svtId: pin.svtId, ceId: pin.ceId })
    if (pin.ceId && banCeIds.some((item) => Number(item) === pin.ceId)) {
      return { ok: false, error: '钉选礼装在屏蔽名单里' }
    }
    if (pin.svtId && pin.formKey) pins.push({ svtId: pin.svtId, formKey: pin.formKey })
  }
  pinCes = mergedPinCes
  const supportCePin = slotPins.find((pin) => pin.support && pin.ceId)
  if (supportCePin) lockSupportCeId = supportCePin.ceId
  if (mode === 'account' && account && !account.virtual) {
    const ownedCe = account.craftEssencesOwned
      ? new Set(account.craftEssencesOwned.map((item) => item.id))
      : ownedIds(account.raw || account, 'ces')
    for (const pin of slotPins) {
      if (pin.support) continue
      for (const ceId of [pin.ceId, pin.ceBondId, pin.ceRewardId]) {
        if (ceId && !ownedCe.has(ceId)) return { ok: false, error: '该锁定无法满足' }
      }
    }
  }
  for (const pin of pins) {
    const svt = catalog.find((item) => item.id === pin.svtId)
    if (!svt) return { ok: false, error: '该锁定无法满足' }
    const form = servantBondForms(svt).find((item) => item.key === pin.formKey)
    if (!form) return { ok: false, error: '该形象不存在' }
    const rec = mode === 'account' ? recOf(svt, account) : null
    if (!formUnlocked(form, rec, mode)) return { ok: false, error: '该形象未解锁' }
  }
  for (const id of [...preferIds, ...lockIds]) {
    const svt = servants.find((item) => item.id === id)
    if (svt && !classOk(svt, questClass || '')) {
      return { ok: false, error: '该从者无法在此副本上场' }
    }
  }

  const className = questClass || ''
  let indexQueryMeta = null
  if (currentSolverIndex && (!solverAudit || solverAudit.skipIndexFilter !== true)) {
    const looked = applyIndexQuery(currentSolverIndex, {
      servants,
      ces,
      quest,
      questClass: className,
      questType,
      lockSvtIds: lockIds,
      excludeSvtIds: banSvtIds,
      excludeCeIds: banCeIds,
      mode,
      account,
    })
    servants = looked.servants
    indexQueryMeta = looked.query
  }
  const game = createGameData({
    servants: catalog,
    craftEssences: ces,
    quests: (gameIn && gameIn.quests) || [],
    enemies: (gameIn && gameIn.enemies) || [],
    traits: (gameIn && gameIn.traits) || [],
    skills: (gameIn && gameIn.skills) || [],
    noblePhantasms: (gameIn && gameIn.noblePhantasms) || [],
    version: gameIn && gameIn.version,
  })
  const accountData = createAccountData(game, { mode, account })
  const inputs = solverInputs(game, accountData)
  const pool = farmerPool(servants, accountData, inputs.mode).filter((svt) => classOk(svt, className))
  const ownedSet = new Set((accountData.servantsOwned || []).map((item) => item.id))
  const owned = (inputs.mode === 'account' ? servants.filter((svt) => ownedSet.has(svt.id)) : servants).filter(
    (svt) => classOk(svt, className),
  )

  for (const id of preferIds) {
    const svt = servants.find((item) => item.id === id)
    if (svt && svtMaxed(svt, account) && mode === 'account') {
      return { ok: false, error: '该从者本人拿不到羁绊' }
    }
  }

  const preferHit = findSvts(pool, preferIds)
  if (preferHit.missing.length && !missingOnlyFiltered(preferHit.missing, catalog, filter)) {
    return { ok: false, error: '该练度从者无法上场' }
  }
  const lockHit = findSvts(owned, lockIds)
  if (lockHit.missing.length && !missingOnlyFiltered(lockHit.missing, catalog, filter)) {
    return { ok: false, error: '该锁定无法满足' }
  }
  const grandMust = []
  if (questType === 'grand' && mode === 'account') {
    const gids = accountGrandIds(account)
    for (const svt of owned) {
      if (gids.has(svt.id)) grandMust.push(svt)
    }
  }
  const lockFarmers = []
  const seenLock = new Set()
  for (const svt of [...lockHit.out, ...grandMust]) {
    if (!svt || seenLock.has(svt.id)) continue
    seenLock.add(svt.id)
    lockFarmers.push(svt)
  }
  if (!pool.length && !lockFarmers.length) {
    return { ok: false, error: rosterFilterActive(filter) ? '筛选后没有可拿羁绊的从者' : '没有可拿羁绊的从者' }
  }

  const ownCes = cePool(ces, accountData, mode, false, filter)
  const supportCes = cePool(ces, accountData, mode, true, filter)
  const tStart = Date.now()
  if (!skipSolutionLookup && solutionIndexIn) {
    const hits = querySolutionIndex(solutionIndexIn, {
      questClass: className,
      questType,
      teapot,
      allowSupport: allowSupport !== false,
      eventId: Number(quest && (quest.eventId || quest.event_id)) || 0,
    })
    const filtered = filterSolutionHits(
      hits,
      {
        filter,
        mode,
        account,
        preferSvtIds: preferIds,
        lockSvtIds: lockIds,
        frontIds,
        pinCes,
        pinSprites: pins,
        slotPins,
        allowSupport: allowSupport !== false,
      },
      { servants: catalog, ces },
    )
    let looked = hydrateSolutionHits(filtered, {
      servants: catalog,
      ces,
      base,
      teapot,
      bondBonuses: liveBonuses,
      quest,
      bond15Aura,
      questType,
      questClass: className,
      allowSupport: allowSupport !== false,
      preferIds,
      lockIds,
    })
    const lockedSupport = Number(lockSupportCeId) || 0
    if (lockedSupport) looked = looked.filter((plan) => supportCeIdOf(plan) === lockedSupport)
    if (looked.length) {
      const uniq = paretoByCost(looked)
      const chosen = pickCostPlan(uniq, Number.isInteger(costLimit) ? costLimit : null)
      const best = uniq[chosen] || uniq[0]
      const plansOut = keepTopPlans(uniq, best)
      best.plans = plansOut
      best.chosen = 0
      best.allPlans = plansOut
      best.queryStats = {
        ...emptyQueryStats(),
        timing: { totalMs: Date.now() - tStart, indexMs: 0, searchMs: 0 },
        candidates: { raw: hits.length, legal: filtered.length },
        results: { assembled: looked.length, unique: uniq.length, returned: plansOut.length },
      }
      best.solverStats = { nodes: 0, pruned: 0, bestScore: best.total || 0, elapsed: Date.now() - tStart, memoHits: 0, memoMisses: 0 }
      return best
    }
  }
  const cacheKey =
    solverAudit
      ? ''
      : solverCacheKey({
          gameDataVersion: (gameIn && gameIn.version && gameIn.version.dataVersion) || '',
          mode,
          base,
          teapot,
          costLimit,
          optimizeBy: optimizeMode,
          preferSvtIds: preferIds,
          lockSvtIds: lockIds,
          allowSupport: allowSupport !== false,
          questType,
          questClass: className,
          bond15Aura,
          frontIds,
          pinCes,
          pinSprites: pins,
          slotPins,
          grandPosition: sanitizeGrandPosition(grandPositionIn, allowSupport !== false),
          filter,
          servantSig: servantCatalogSig(catalog),
          ceSig: ceCatalogSig(ces),
          accountSig:
            mode === 'account' && account && !account.virtual
              ? `${(account.servants || []).map((svt) => `${svt.id}:${svt.bondLv || 0}:${svt.bondCap || ''}:${svt.isGrand ? 1 : 0}`).join(',')}|${(account.ces || []).map((ce) => `${ce.id}:${ce.count || 1}:${ce.mlb ? 1 : 0}:${ce.mlbCount || 0}`).join(',')}`
              : '',
          region: regionIn || (gameIn && gameIn.version && gameIn.version.region) || '',
          eventId: Number(quest && (quest.eventId || quest.event_id)) || 0,
        })
  if (cacheKey) {
    const cached = readSolverCache(cacheKey)
    if (cached && cached.ok) return cached
  }
  const plans = []
  let lastStats = null
  let lastError = '锁定超出编队上限'
  const trySupport = allowSupport ? [true] : [false]
  for (const useSupport of trySupport) {
    const cap = useSupport ? 5 : 6
    const mustIds = new Set([...preferHit.out, ...lockFarmers].map((svt) => svt.id))
    if (mustIds.size > cap) continue
    const plan = buildPlan({
      base,
      teapot,
      servants,
      ces,
      account,
      mode,
      useSupport,
      pool,
      ownCes,
      supportCes,
      preferSvts: preferHit.out,
      lockSvts: lockFarmers,
      questType,
      questClass: className,
      costLimit,
      filter,
      bond15Aura,
      optimizeBy: optimizeMode,
      priorities,
      frontIds,
      pinCes,
      spriteMode,
      pinSprites: pins,
      slotPins,
      game,
      useMemo,
      useUb,
      useCompression,
      useDominance,
      grandPosition: sanitizeGrandPosition(grandPositionIn, useSupport),
      onSolverProgress,
      quest,
      bondBonuses: liveBonuses,
    })
    if (plan && plan.ok) {
      plans.push(...(plan.plans || [plan]))
      if (plan.solverStats) lastStats = plan.solverStats
    }
    else if (plan && plan.error) lastError = plan.error
  }
  if (!plans.length) return { ok: false, error: lastError }
  const assist = assistCandidates(plans, ces)
  const lockedId = Number(lockSupportCeId) || 0
  const poolForCost = lockedId ? plans.filter((plan) => supportCeIdOf(plan) === lockedId) : plans
  if (!poolForCost.length) return { ok: false, error: '没有使用该助战礼装的方案', assist }
  const uniq = paretoByCost(poolForCost)
  let pickPool = uniq
  if (Number.isInteger(focusCost) && focusCost >= 0) {
    const feasible = uniquePlans(poolForCost.filter((plan) => (plan.costUsed || 0) <= focusCost))
    if (feasible.length) pickPool = feasible
  }
  const chosen = pickCostPlan(pickPool, focusCost)
  const best = pickPool[chosen]
  best.rows = best.slots
    .filter((slot) => slot.filled && !slot.isSupport)
    .map((slot) => {
      const svt = servants.find((item) => item.id === slot.svtId)
      if (svt) slot.label = svt.name
      const result = best.output.results.find((item) => item.position === slot.position)
      return explainFormBonuses(slot, best.slots, ces, result)
    })
  const chosenKey = planFingerprint(best)
  let plansOut = uniq
  if (!plansOut.some((plan) => planFingerprint(plan) === chosenKey)) plansOut = [best, ...plansOut]
  plansOut = keepTopPlans(plansOut, best)
  best.plans = plansOut
  best.chosen = Math.max(0, plansOut.findIndex((plan) => planFingerprint(plan) === chosenKey))
  best.focusCost = focusCost
  best.assist = assistCandidates(plansOut, ces)
  best.allPlans = plansOut
  best.lockSupportCeId = lockedId
  if (rosterFilterActive(filter) && best.summary) best.summary += '已按筛选屏蔽从者。'
  if (lastStats) best.solverStats = lastStats
  if (best.solverStats && indexQueryMeta) {
    best.solverStats.indexQueryMs = indexQueryMeta.ms
    best.solverStats.indexServants = (indexQueryMeta.servantIds || []).length
    best.solverStats.indexCes = (indexQueryMeta.ceIds || []).length
  } else if (!best.solverStats && indexQueryMeta) {
    best.solverStats = {
      indexQueryMs: indexQueryMeta.ms,
      indexServants: (indexQueryMeta.servantIds || []).length,
      indexCes: (indexQueryMeta.ceIds || []).length,
    }
  }
  if (cacheKey) writeSolverCache(cacheKey, best)
  best.queryStats = {
    timing: {
      totalMs: Date.now() - tStart,
      indexMs: (indexQueryMeta && indexQueryMeta.ms) || 0,
      searchMs: (lastStats && lastStats.elapsed) || 0,
    },
    candidates: {
      raw: catalog.length,
      legal: pool.length,
    },
    search: {
      nodes: (lastStats && lastStats.nodes) || 0,
      pruned: (lastStats && lastStats.pruned) || 0,
      memoHits: (lastStats && lastStats.memoHits) || 0,
      memoMisses: (lastStats && lastStats.memoMisses) || 0,
    },
    results: {
      assembled: plans.length,
      unique: uniq.length,
      returned: plansOut.length,
    },
  }
  return best
}

function takeWithinCost(mustRows, fillerRows, cap, costLimit) {
  const out = []
  let spent = 0
  for (const row of [...mustRows, ...fillerRows]) {
    if (out.length >= cap) break
    if (out.some((item) => item.svt.id === row.svt.id)) continue
    const c = svtCostOf(row.svt, row.form)
    if (!remainingCostFeasible(spent, costLimit, c)) {
      if (mustRows.some((item) => item.svt.id === row.svt.id)) return { ok: false, spent, farmers: out }
      continue
    }
    out.push(row)
    spent += c
  }
  return { ok: true, farmers: out, spent }
}

function rowsBySvtId(rows) {
  const map = new Map()
  for (const row of rows || []) {
    if (!row || !row.svt) continue
    const id = row.svt.id
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(row)
  }
  return map
}

function eachCartesianRows(groups, visit) {
  const acc = []
  function rec(i) {
    if (i >= groups.length) {
      visit(acc)
      return
    }
    const list = groups[i] || []
    if (!list.length) return
    for (const row of list) {
      acc.push(row)
      rec(i + 1)
      acc.pop()
    }
  }
  rec(0)
}

function eachFarmerMixes(mustRows, fillerRows, n, visit) {
  const mustMap = rowsBySvtId(mustRows)
  const mustIds = [...mustMap.keys()]
  if (mustIds.length > n) return
  const fillerMap = rowsBySvtId(fillerRows)
  for (const id of mustIds) fillerMap.delete(id)
  const fillerIds = [...fillerMap.keys()]
  const need = n - mustIds.length
  if (need < 0 || need > fillerIds.length) return

  const emit = (extraIds) => {
    const groups = [...mustIds.map((id) => mustMap.get(id)), ...extraIds.map((id) => fillerMap.get(id))]
    eachCartesianRows(groups, visit)
  }

  if (need === 0) {
    emit([])
    return
  }
  eachCombination(fillerIds, need, (pick) => emit(pick.slice()))
}

export function warmStartMix(mustRows, freeRows, ownCes, cap) {
  return takeWithinCost(mustRows, byCoverThenCost(freeRows, ownCes), cap, Infinity)
}

function applyRateMilliUb(value, milli) {
  if (!milli) return value
  return (value * (1000 + milli)) / 1000
}

function sharedSlotSeconds(forms, maxed, ces, asSupport, k) {
  const live = []
  for (let i = 0; i < forms.length; i++) {
    if (!maxed[i]) live.push(i)
  }
  const seconds = live.map(() => 0)
  if (!k || !ces || !ces.length || !live.length) return { live, seconds }
  const scored = []
  for (let c = 0; c < ces.length; c++) {
    const hits = forms.map((form, i) => (maxed[i] ? 0 : ceMilliOn(ces[c], form, asSupport)))
    let sum = 0
    for (let j = 0; j < live.length; j++) sum += hits[live[j]] || 0
    scored.push({ hits, sum })
  }
  scored.sort((a, b) => b.sum - a.sum)
  const take = Math.min(k, scored.length)
  for (let t = 0; t < take; t++) {
    const hits = scored[t].hits
    for (let j = 0; j < live.length; j++) seconds[j] += hits[live[j]] || 0
  }
  return { live, seconds }
}

export function createState15(farmers, account, bond15Aura = true) {
  const rows = farmers || []
  const own15Servants = rows.filter((row) => svtBond15(row.svt, account)).map((row) => row.svt && row.svt.id)
  const activeAura = bond15Aura !== false && own15Servants.length > 0
  const affectedOwnForms = {}
  for (const row of rows) {
    const id = row.svt && row.svt.id
    if (id == null) continue
    const self = own15Servants.includes(id)
    affectedOwnForms[id] = activeAura ? 250 * (own15Servants.length - (self ? 1 : 0)) : 0
  }
  return {
    own15Servants,
    activeAura,
    affectedOwnForms,
    supportExcluded: true,
  }
}

export function state15Milli(state15, svtId) {
  if (!state15 || !state15.activeAura) return 0
  return state15.affectedOwnForms[svtId] || 0
}

export function mixUpperBound({
  farmers,
  base,
  teapot = false,
  ownCes = [],
  supportCes = [],
  useSupport = true,
  grand = false,
  bond15Aura = true,
  account = null,
} = {}) {
  const live = (farmers || []).filter((row) => !svtMaxed(row.svt, account))
  if (!live.length) return 0
  const n = (farmers || []).length
  const ownSlots = n + (grand ? 1 : 0)
  const rows = farmers || []
  const maxed = rows.map((row) => svtMaxed(row.svt, account))
  const forms = rows.map((row) => row.form || { traitIds: (row.svt && row.svt.traitIds) || [] })
  const aura =
    bond15Aura === false ? 0 : 250 * rows.filter((row) => svtBond15(row.svt, account)).length
  const ownHits = (ownCes || []).map((ce) => forms.map((form, i) => (maxed[i] ? 0 : ceMilliOn(ce, form, false))))
  const supHits = useSupport
    ? (supportCes || []).map((ce) => forms.map((form, i) => (maxed[i] ? 0 : ceMilliOn(ce, form, true))))
    : []
  const supCount = useSupport ? (grand ? 2 : 1) : 0
  const teapotMul = teapot ? 2 : 1
  const scored = []
  for (let i = 0; i < rows.length; i++) {
    if (maxed[i]) continue
    const ownBest = ownHits.map((hits) => hits[i] || 0).sort((a, b) => b - a).slice(0, ownSlots)
    const ownSum = ownBest.reduce((sum, milli) => sum + milli, 0)
    const supBest = supHits.map((hits) => hits[i] || 0).sort((a, b) => b - a).slice(0, supCount)
    const supSum = supBest.reduce((sum, milli) => sum + milli, 0)
    const selfAura = bond15Aura === false ? 0 : svtBond15(rows[i].svt, account) ? 250 : 0
    const second = ownSum + supSum + aura - selfAura
    const frontMilli = useSupport ? 240 : 200
    const backMilli = useSupport ? 40 : 0
    const front = applyRateMilli(applyRateMilli(base, frontMilli), second) + 50
    const back = applyRateMilli(applyRateMilli(base, backMilli), second) + 50
    scored.push({ front, back, gain: front - back })
  }
  scored.sort((a, b) => b.gain - a.gain)
  const frontSet = new Set(scored.slice(0, 3).map((_, i) => i))
  let total = 0
  for (let i = 0; i < scored.length; i++) {
    total += frontSet.has(i) ? scored[i].front : scored[i].back
  }
  const independentUb = total * teapotMul
  const ownShared = sharedSlotSeconds(forms, maxed, ownCes || [], false, ownSlots)
  const supShared = useSupport
    ? sharedSlotSeconds(forms, maxed, supportCes || [], true, supCount)
    : { live: ownShared.live, seconds: ownShared.live.map(() => 0) }
  const scoredShared = []
  for (let j = 0; j < ownShared.live.length; j++) {
    const i = ownShared.live[j]
    const selfAura = bond15Aura === false ? 0 : svtBond15(rows[i].svt, account) ? 250 : 0
    const second = ownShared.seconds[j] + (supShared.seconds[j] || 0) + aura - selfAura
    const frontMilli = useSupport ? 240 : 200
    const backMilli = useSupport ? 40 : 0
    const front = applyRateMilliUb(applyRateMilliUb(base, frontMilli), second) + 50
    const back = applyRateMilliUb(applyRateMilliUb(base, backMilli), second) + 50
    scoredShared.push({ front, back, gain: front - back })
  }
  scoredShared.sort((a, b) => b.gain - a.gain)
  let sharedTotal = 0
  for (let i = 0; i < scoredShared.length; i++) {
    sharedTotal += i < 3 ? scoredShared[i].front : scoredShared[i].back
  }
  const sharedUb = Math.ceil(sharedTotal) * teapotMul
  return Math.min(independentUb, sharedUb)
}

export function mixUpperBound0({ farmers, base, teapot = false, account = null } = {}) {
  const live = (farmers || []).filter((row) => !svtMaxed(row.svt, account)).length
  if (!live) return 0
  const frontN = Math.min(3, live)
  const backN = live - frontN
  const maxSecond = 5000
  const front = applyRateMilli(applyRateMilli(base, 240), maxSecond) + 50
  const back = applyRateMilli(applyRateMilli(base, 40), maxSecond) + 50
  return (front * frontN + back * backN) * (teapot ? 2 : 1)
}

export function mixUpperBound2(opts = {}) {
  const remainingCost = opts.remainingCost
  const ownCes = (opts.ownCes || []).filter(
    (ce) => opts.grand || remainingCostFeasible(0, remainingCost, ceCostOf(ce)),
  )
  return mixUpperBound({ ...opts, ownCes })
}

function ceMilliOn(ce, form, asSupport, mlb = true) {
  const traits = (form && form.traitIds) || []
  const key = `${ce && ce.id}|${asSupport ? 1 : 0}|${mlb ? 1 : 0}|${traits.join(',')}`
  const cached = milliMemo.get(key)
  if (cached !== undefined) return cached
  let value = 0
  if (currentSolverIndex) {
    const indexed = milliFromIndex(currentSolverIndex, ce, form, asSupport, mlb)
    value = indexed != null ? indexed : ceMilliLive(ce, form, asSupport, mlb)
  } else {
    value = ceMilliLive(ce, form, asSupport, mlb)
  }
  milliMemo.set(key, value)
  return value
}

function eachSubset(arr, maxK, visit) {
  const pick = []
  function rec(start) {
    visit(pick)
    if (pick.length >= maxK) return
    for (let i = start; i < arr.length; i++) {
      pick.push(arr[i])
      rec(i + 1)
      pick.pop()
    }
  }
  rec(0)
}

function dedupeById(cands) {
  const best = new Map()
  for (const cand of cands) {
    const key = cand.ce && cand.ce.id
    if (key == null) continue
    const prev = best.get(key)
    if (!prev || cand.cost < prev.cost || (cand.cost === prev.cost && cand.ce.collectionNo < prev.ce.collectionNo)) {
      best.set(key, cand)
    }
  }
  return [...best.values()]
}

function hitSum(cand) {
  return (cand.hits || []).reduce((sum, milli) => sum + milli, 0)
}

function splitOwnCands(cands) {
  const uncond = []
  const cond = []
  for (const cand of cands || []) {
    const fn = mlbFunc(cand.ce)
    if (hasCondition(fn)) cond.push(cand)
    else uncond.push(cand)
  }
  uncond.sort(
    (a, b) => hitSum(b) - hitSum(a) || a.cost - b.cost || a.ce.collectionNo - b.ce.collectionNo,
  )
  cond.sort((a, b) => hitSum(b) - hitSum(a) || a.cost - b.cost || a.ce.collectionNo - b.ce.collectionNo)
  return { uncond: pruneDominatedCands(uncond), cond: pruneDominatedCands(cond) }
}

function makeCeCands(ces, forms, asSupport, maxed, account, mode, useDominance = true) {
  const out = []
  for (const ce of ces || []) {
    const mlb = asSupport ? true : mlbOf(ce, account, mode || 'free', false)
    const hits = forms.map((form, index) => (maxed && maxed[index] ? 0 : ceMilliOn(ce, form, asSupport, mlb)))
    if (useDominance && !hits.some((milli) => milli > 0)) continue
    out.push({ ce, hits, cost: asSupport ? 0 : ceCostOf(ce) })
  }
  return asSupport ? dedupeById(out) : out
}

function eachGrandOwnSplits(ownPick, ownSlotCount, grand, visit) {
  if (!grand || !ownPick.length) {
    visit({ normal: ownPick, reward: null })
    return
  }
  if (ownPick.length <= 1) {
    visit({ normal: ownPick, reward: null })
    return
  }
  for (let i = 0; i < ownPick.length; i++) {
    const rest = ownPick.filter((_, index) => index !== i)
    if (rest.length > ownSlotCount) continue
    visit({ normal: rest, reward: ownPick[i] })
  }
}

function searchCeLoadouts({
  base,
  teapot,
  farmers,
  useSupport,
  ownCes,
  supportCes,
  grand,
  preferSvts,
  servants,
  ces,
  account = null,
  mode = 'free',
  bond15Aura = true,
  lockSvts = [],
  optimizeBy = 'total',
  frontIds = [],
  pinCes = [],
  spriteMode = 'bond_first',
  pinSprites = [],
  costLimit = null,
  slotPins = [],
  useDominance = true,
  grandPosition: grandPositionIn = 0,
}) {
  const grandPosition = sanitizeGrandPosition(grandPositionIn, useSupport)
  const formed = placeGrandFirst(
    farmers.map((row) => ({
      svt: row.svt,
      form: row.form || formForAnchor(row.svt, null, null, spriteMode, recOf(row.svt, account), mode, pinSprites),
    })),
    account,
    grand,
    grandPosition,
  )
  const slots0 = layoutSlots(formed, useSupport, grand, grandSvtIdOf(account, formed, grand), grandPosition)
  const ownSlots = slots0.filter((slot) => slot.filled && !slot.isSupport)
  const forms = ownSlots.map((slot) => ({ traitIds: slot.traitIds, svtId: slot.svtId }))
  const fronts = frontLayouts(formed, frontIds, slotPins)
  const state15 = createState15(formed, account, bond15Aura)
  const preferSet = new Set((preferSvts || []).map((svt) => svt.id))
  if (optimizeBy === 'prefer') {
    for (const svt of lockSvts || []) preferSet.add(svt.id)
  }
  const teapotMul = teapot ? 2 : 1
  const svtCost = partyCostOf(slots0, servants, ces)
  const maxed = formed.map((row) => svtMaxed(row.svt, account))
  const ownCands = makeCeCands(ownCes, forms, false, maxed, account, mode, useDominance)
  const supCands = useSupport ? makeCeCands(supportCes, forms, true, maxed, account, mode, useDominance) : []
  const ownCap = ownSlots.length + (grand && ownSlots.some((slot) => slot.isGrand) ? 1 : 0)
  if (!fronts.length) return []
  const best = new Map()
  let champRow = null
  const grandSvtId = grandSvtIdOf(account, formed, grand)
  const grandSeat = grand && grandSvtId ? pinnedGrandSeat(grandPosition, forms.length) : -1

  function consider(ownPick, sup, sup2) {
    if (sup && sup2) {
      const sumA = sup.hits.reduce((sum, milli) => sum + milli, 0)
      const sumB = sup2.hits.reduce((sum, milli) => sum + milli, 0)
      if (sumB > sumA) {
        const swap = sup
        sup = sup2
        sup2 = swap
      }
    }
    const add = forms.map(() => 0)
    for (const cand of ownPick) {
      for (let i = 0; i < add.length; i++) {
        add[i] += (cand.hits && cand.hits[i]) || 0
      }
    }
    if (sup) {
      for (let i = 0; i < add.length; i++) {
        add[i] += (sup.hits && sup.hits[i]) || 0
      }
    }
    if (sup2) {
      for (let i = 0; i < add.length; i++) {
        add[i] += (sup2.hits && sup2.hits[i]) || 0
      }
    }
    eachGrandOwnSplits(ownPick, ownSlots.length, grand, (split) => {
      const ceCost = split.normal.reduce((sum, cand) => sum + cand.cost, 0)
      const costUsed = svtCost + ceCost
      const pinFront = (frontIds && frontIds.length) || (slotPins && slotPins.some((pin) => pin && pin.svtId))
      let frontIdxList = fronts
      const supportInFront = useSupport && !grand
      if (!pinFront && forms.length > 3) {
        frontIdxList = [
          bestFrontByGain({
            forms,
            add,
            state15,
            maxed,
            base,
            useSupport: supportInFront,
            grandSvtId,
            grandSeat,
          }),
        ]
      } else if (grandSeat >= 0) {
        frontIdxList = fronts.map((idx) => forceGrandFrontIdx(idx, forms, grandSvtId, grandSeat))
      }
      for (const frontIdx of frontIdxList) {
        const frontMilli = supportInFront ? 240 : 200
        const backMilli = supportInFront ? 40 : 0
        const afterFront = forms.map((_, i) => applyRateMilli(base, frontIdx.includes(i) ? frontMilli : backMilli))
        let total = 0
        let preferBond = 0
        for (let i = 0; i < forms.length; i++) {
          if (maxed[i]) continue
          const bond = (applyRateMilli(afterFront[i], add[i] + state15Milli(state15, forms[i].svtId)) + 50) * teapotMul
          total += bond
          if (preferSet.has(forms[i].svtId)) preferBond += bond
        }
        const next = {
          total,
          preferBond,
          bond15Count: formed.filter((row) => svtBond15(row.svt, account)).length,
          costUsed,
          optimizeBy,
          ownNormal: split.normal.map((cand) => cand.ce),
          ownReward: split.reward ? split.reward.ce : null,
          support: sup ? sup.ce : null,
          supportReward: sup2 ? sup2.ce : null,
          frontIdx,
        }
        const prev = best.get(costUsed)
        if (!prev || betterTarget(next, prev)) best.set(costUsed, next)
        if (!champRow || betterTarget(next, champRow)) champRow = next
      }
    })
  }

  function considerOwn(ownPick) {
    if (!useSupport || !supCands.length) {
      consider(ownPick, null, null)
      return
    }
    if (grand) {
      const groups = groupCandsByEffect(supCands)
      eachPrefixCombos(groups, 2, (pick) => {
        if (!pick.length) return
        consider(ownPick, pick[0], pick[1] || null)
      })
      return
    }
    let best = supCands[0]
    let bestSum = -1
    for (const cand of supCands) {
      const sum = (cand.hits || []).reduce((total, milli) => total + milli, 0)
      if (sum > bestSum) {
        best = cand
        bestSum = sum
      }
    }
    consider(ownPick, best, null)
  }

  const pinCeIds = [...new Set((pinCes || []).map((item) => Number(item && item.ceId)).filter((id) => id))]
  const required = []
  const requiredIds = new Set()
  for (const ceId of pinCeIds) {
    const existing = ownCands.find((cand) => cand.ce.id === ceId)
    if (existing) {
      required.push(existing)
      requiredIds.add(ceId)
      continue
    }
    const ce = (ownCes || []).find((item) => item.id === ceId)
    const catalogCe = ce || (ces || []).find((item) => item.id === ceId)
    if (!catalogCe) return []
    required.push({
      ce: catalogCe,
      hits: forms.map((form, index) => (maxed && maxed[index] ? 0 : ceMilliOn(catalogCe, form, false))),
      cost: ceCostOf(catalogCe),
    })
    requiredIds.add(ceId)
  }
  if (required.length > ownCap) return []
  const restPool = ownCands.filter((cand) => !requiredIds.has(cand.ce.id))
  const rest = useDominance ? pruneDominatedCands(restPool) : restPool
  const groups = groupCandsByEffect(rest)
  const requiredCost = required.reduce((sum, cand) => sum + (Number(cand.cost) || 0), 0)
  const auraMilli = forms.map((form) => state15Milli(state15, form.svtId))
  const add0 = forms.map(() => 0)
  for (const cand of required) {
    for (let i = 0; i < add0.length; i++) add0[i] += (cand.hits && cand.hits[i]) || 0
  }
  const supportInFront0 = useSupport && !grand
  const frontMilli0 = supportInFront0 ? 240 : 200
  const backMilli0 = supportInFront0 ? 40 : 0
  let bestSupHits = forms.map(() => 0)
  if (useSupport && supCands.length) {
    const supCount = grand ? 2 : 1
    if (grand) {
      bestSupHits = forms.map((_, i) => {
        const vals = supCands.map((cand) => (cand.hits && cand.hits[i]) || 0).sort((a, b) => b - a)
        let sum = 0
        for (let k = 0; k < supCount && k < vals.length; k++) sum += vals[k]
        return sum
      })
    } else {
      let top = null
      let topSum = -1
      for (const cand of supCands) {
        const sum = hitSum(cand)
        if (sum > topSum) {
          top = cand
          topSum = sum
        }
      }
      if (top && top.hits) bestSupHits = top.hits
    }
  }
  function leftoverUb(add, gi, left) {
    const second = add.slice()
    let remain = Math.max(0, left)
    for (let g = gi; g < groups.length && remain > 0; g++) {
      const n = Math.min(remain, (groups[g] || []).length)
      const hits = (groups[g] && groups[g][0] && groups[g][0].hits) || []
      for (let t = 0; t < n; t++) {
        for (let i = 0; i < second.length; i++) second[i] += hits[i] || 0
      }
      remain -= n
    }
    const scored = []
    for (let i = 0; i < second.length; i++) {
      if (maxed[i]) continue
      const milli = second[i] + (bestSupHits[i] || 0) + (auraMilli[i] || 0)
      const front = applyRateMilliUb(applyRateMilliUb(base, frontMilli0), milli) + 50
      const back = applyRateMilliUb(applyRateMilliUb(base, backMilli0), milli) + 50
      scored.push({ front, back, gain: front - back })
    }
    scored.sort((a, b) => b.gain - a.gain)
    let total = 0
    for (let i = 0; i < scored.length; i++) total += i < 3 ? scored[i].front : scored[i].back
    return Math.ceil(total) * teapotMul
  }
  function recCe(gi, left, pick, add, spent, rewardUsed = false) {
    if (gi >= groups.length || left <= 0) {
      considerOwn(required.length ? required.concat(pick) : pick.slice())
      return
    }
    if (champRow && optimizeBy !== 'prefer' && leftoverUb(add, gi, left) < champRow.total) {
      considerOwn(required.length ? required.concat(pick) : pick.slice())
      return
    }
    const items = uniqueCeCands(groups[gi] || [])
    if (items.length === 1) {
      const cand = items[0]
      const addCost = Number(cand.cost) || 0
      const nextAdd = add.map((value, i) => value + ((cand.hits && cand.hits[i]) || 0))
      if (remainingCostFeasible(spent, costLimit, addCost)) {
        pick.push(cand)
        recCe(gi + 1, left - 1, pick, nextAdd, spent + addCost, rewardUsed)
        pick.pop()
      } else if (grand && !rewardUsed) {
        pick.push(cand)
        recCe(gi + 1, left - 1, pick, nextAdd, spent, true)
        pick.pop()
      }
      recCe(gi + 1, left, pick, add, spent, rewardUsed)
      return
    }
    const hi = Math.min(Math.max(0, left), items.length)
    const sameCost = items.length <= 1 || items.every((cand) => cand.cost === items[0].cost)
    for (let k = hi; k >= 1; k--) {
      if (sameCost) {
        const combo = items.slice(0, k)
        const addCost = combo.reduce((sum, cand) => sum + (Number(cand.cost) || 0), 0)
        const nextAdd = add.map((value, i) => value + combo.reduce((sum, cand) => sum + ((cand.hits && cand.hits[i]) || 0), 0))
        if (remainingCostFeasible(spent, costLimit, addCost)) {
          recCe(gi + 1, left - k, pick.concat(combo), nextAdd, spent + addCost, rewardUsed)
        } else if (grand && !rewardUsed) {
          const seenFree = new Set()
          for (const reward of combo) {
            const free = Number(reward.cost) || 0
            if (seenFree.has(free)) continue
            seenFree.add(free)
            recCe(gi + 1, left - k, pick.concat(combo), nextAdd, spent + addCost - free, true)
          }
        }
        continue
      }
      eachCombination(items, k, (combo) => {
        const addCost = combo.reduce((sum, cand) => sum + (Number(cand.cost) || 0), 0)
        const nextAdd = add.map((value, i) => value + combo.reduce((sum, cand) => sum + ((cand.hits && cand.hits[i]) || 0), 0))
        if (remainingCostFeasible(spent, costLimit, addCost)) {
          recCe(gi + 1, left - k, pick.concat(combo), nextAdd, spent + addCost, rewardUsed)
        } else if (grand && !rewardUsed) {
          const seenFree = new Set()
          for (const reward of combo) {
            const free = Number(reward.cost) || 0
            if (seenFree.has(free)) continue
            seenFree.add(free)
            recCe(gi + 1, left - k, pick.concat(combo), nextAdd, spent + addCost - free, true)
          }
        }
      })
    }
    recCe(gi + 1, left, pick, add, spent, rewardUsed)
  }
  recCe(0, ownCap - required.length, [], add0, svtCost + requiredCost)

  return [...best.values()]
}

function buildPlan({
  base,
  teapot,
  servants,
  ces,
  account,
  mode,
  useSupport,
  pool,
  ownCes,
  supportCes,
  preferSvts,
  lockSvts,
  questType = 'normal',
  questClass = '',
  costLimit = 113,
  filter = null,
  bond15Aura = true,
  optimizeBy = 'total',
  priorities = [],
  frontIds = [],
  pinCes = [],
  spriteMode = 'bond_first',
  pinSprites = [],
  game = null,
  slotPins = [],
  useMemo = true,
  useUb = true,
  useCompression = true,
  useDominance = true,
  onSolverProgress = null,
  grandPosition: grandPositionIn = 0,
  quest = null,
  bondBonuses = null,
}) {
  const cap = useSupport ? 5 : 6
  const grand = questType === 'grand'
  const grandPosition = sanitizeGrandPosition(grandPositionIn, useSupport)
  const mustSvts = [
    ...preferSvts,
    ...lockSvts.filter((svt) => !preferSvts.some((item) => item.id === svt.id)),
  ]
  const exclude = new Set(mustSvts.map((svt) => svt.id))
  if (exclude.size > cap) return { ok: false, error: '锁定超出编队上限' }
  const minN = mustSvts.length
  const startN = minN === 0 ? 1 : minN
  const foundByAssist = new Map()
  let lastError = '没有可拿羁绊的从者'
  const seenMix = new Set()
  const bondAcc = mode === 'account' ? account : null
  const freeRows = expandFormRows(
    pool.filter((svt) => !exclude.has(svt.id)),
    filter,
    spriteMode,
    bondAcc,
    mode,
    pinSprites,
  )
  const loadoutCache = new Map()
  const searchState = createSearchState({ cap, minN, costLimit })
  function pingProgress() {
    if (!onSolverProgress) return
    const now = Date.now()
    if (now - searchState.lastPing < 200) return
    searchState.lastPing = now
    onSolverProgress(searchProgress(searchState))
  }
  function cachedLoadouts(farmers) {
    const formKey = formStateKey(
      farmers.map((row) => ({
        svtId: row.svt.id,
        traitIds: (row.form && row.form.traitIds) || row.svt.traitIds || [],
        cost: svtCostOf(row.svt, row.form),
      })),
      farmers.map((row) => svtMaxed(row.svt, bondAcc)),
      farmers.map((row) => svtBond15(row.svt, bondAcc)),
    )
    const memoKey = loadoutMemoKey({
      formKey,
      useSupport,
      grand,
      bond15Aura,
      optimizeBy,
      pinCeIds: (pinCes || []).map((item) => Number(item && item.ceId) || 0),
      ownCap: farmers.length + (grand ? 1 : 0),
      costLimit,
      frontIds,
      slotPins,
      grandPosition,
    })
    if (useMemo) {
      const hit = loadoutCache.get(memoKey)
      if (hit) {
        searchState.memoHits += 1
        return hit
      }
      searchState.memoMisses += 1
    }
    const loadouts = searchCeLoadouts({
      base,
      teapot,
      farmers,
      useSupport,
      ownCes,
      supportCes,
      grand,
      preferSvts,
      servants,
      ces,
      account: bondAcc,
      mode,
      bond15Aura,
      lockSvts,
      optimizeBy,
      frontIds,
      pinCes,
      spriteMode,
      pinSprites,
      costLimit,
      slotPins,
      useDominance,
      grandPosition,
    })
    if (useMemo) loadoutCache.set(memoKey, loadouts)
    return loadouts
  }
  function keepFound(plan) {
    if (!plan || !plan.ok) return
    const key = planAssistKey(plan)
    const prev = foundByAssist.get(key)
    if (!prev || comparePlans(plan, prev) < 0) foundByAssist.set(key, plan)
  }
  const bestExactAtN = new Map()
  function noteExact(plan, n) {
    if (!plan || !plan.ok) return
    const prev = bestExactAtN.get(n)
    const costUsed = plan.costUsed || 0
    if (!prev || plan.total > prev.total || (plan.total === prev.total && costUsed < prev.costUsed)) {
      bestExactAtN.set(n, { total: plan.total, costUsed })
    }
  }
  function skipMixByUb(farmers) {
    if (!useUb) return false
    if (optimizeBy === 'prefer') return false
    const svtCost = farmers.reduce((sum, row) => sum + svtCostOf(row.svt, row.form), 0)
    const same = bestExactAtN.get(farmers.length)
    let champTotal = null
    if (same && svtCost >= same.costUsed) champTotal = same.total
    if (champTotal == null) return false
    const ub0 = mixUpperBound0({ farmers, base, teapot, account: bondAcc })
    if (ub0 < champTotal) return true
    const ub1 = mixUpperBound({
      farmers,
      base,
      teapot,
      ownCes,
      supportCes,
      useSupport,
      grand,
      bond15Aura,
      account: bondAcc,
    })
    if (ub1 < champTotal) return true
    if (!Number.isInteger(costLimit) || costLimit < 0) return false
    const remain = Math.max(0, costLimit - svtCost)
    const ub2 = mixUpperBound2({
      farmers,
      base,
      teapot,
      ownCes,
      supportCes,
      useSupport,
      grand,
      bond15Aura,
      account: bondAcc,
      remainingCost: remain,
    })
    return ub2 < champTotal
  }
  function evaluateFarmers(farmers) {
    if (!farmers || !farmers.length) return
    const mixKey = farmers.map((row) => `${row.svt.id}:${(row.form && row.form.key) || 'd'}`).join(',')
    if (seenMix.has(mixKey)) return
    seenMix.add(mixKey)
    if (bondAcc && !farmers.some((row) => !svtMaxed(row.svt, bondAcc))) return
    if (skipMixByUb(farmers)) return
    for (const loadout of cachedLoadouts(farmers)) {
      const plan = assemblePlan({
        base,
        teapot,
        servants,
        ces,
        account,
        mode,
        useSupport,
        farmers,
        loadout,
        preferSvts,
        questType,
        questClass,
        costLimit,
        grand,
        bond15Aura,
        lockSvts,
        optimizeBy,
        priorities,
        pinCes,
        spriteMode,
        pinSprites,
        game,
        slotPins,
        grandPosition,
        quest,
        bondBonuses,
      })
      keepFound(plan)
      noteExact(plan, farmers.length)
      noteBestPlan(searchState, plan, comparePlans)
    }
  }
  {
    const seedMust = mustSvts.map((svt) => ({
      svt,
      form: formForAnchor(svt, null, filter, spriteMode, recOf(svt, bondAcc), mode, pinSprites),
    }))
    const seed = warmStartMix(seedMust, freeRows, ownCes, cap)
    if (seed.ok && seed.farmers.length >= Math.max(1, minN)) {
      evaluateFarmers(orderFarmers(seedMust, [], seed.farmers, bondAcc))
    }
    const greedy = seedMust.slice()
    const greedyUsed = new Set(greedy.map((row) => row && row.svt && row.svt.id))
    const greedyPool = uniqueBestRows(freeRows, ownCes, bondAcc)
    while (greedy.length < cap) {
      let best = null
      let bestUb = -1
      for (const row of greedyPool) {
        const id = row && row.svt && row.svt.id
        if (id == null || greedyUsed.has(id)) continue
        const ub = mixUpperBound({
          farmers: greedy.concat([row]),
          base,
          teapot,
          ownCes,
          supportCes,
          useSupport,
          grand,
          bond15Aura,
          account: bondAcc,
        quest,
        bondBonuses,
      })
        if (ub > bestUb) {
          bestUb = ub
          best = row
        }
      }
      if (!best) break
      greedy.push(best)
      greedyUsed.add(best.svt.id)
    }
    if (greedy.length >= Math.max(1, minN)) {
      evaluateFarmers(orderFarmers(seedMust, [], greedy, bondAcc))
    }
  }
  function walkMixes(mustRows, fillerRows, requireHitIds) {
    const mustMap = rowsBySvtId(mustRows)
    const mustIds = [...mustMap.keys()]
    if (mustIds.length > cap) return
    const fillerMap = rowsBySvtId(fillerRows)
    for (const id of mustIds) fillerMap.delete(id)
    const ubOpts = {
      base,
      teapot,
      ownCes,
      supportCes,
      useSupport,
      grand,
      bond15Aura,
      milliOn: (ce, form, asSupport) => ceMilliOn(ce, form, asSupport),
      isMaxed: (row) => svtMaxed(row.svt, bondAcc),
      isBond15: (row) => svtBond15(row.svt, bondAcc),
    }
    const fillerFlat = []
    for (const rows of fillerMap.values()) fillerFlat.push(...rows)
    const fillerGroups = (
      useCompression ? clusterRowsByEffectCost(fillerFlat, ownCes, bondAcc, cap, priorities) : [...fillerMap.values()]
    ).sort((a, b) => {
      const scoreOf = (group) =>
        Math.max(
          0,
          ...(group || []).map((row) => partyBranchUpperBound({ selected: [row], leftover: [], need: 0, ...ubOpts })),
        )
      return scoreOf(b) - scoreOf(a)
    })
    const mustSet = new Set(mustIds)
    let leftoverFrom = []
    function rebuildLeftoverFrom() {
      leftoverFrom = new Array(fillerGroups.length + 1)
      leftoverFrom[fillerGroups.length] = []
      for (let i = fillerGroups.length - 1; i >= 0; i--) {
        leftoverFrom[i] = (fillerGroups[i] || []).concat(leftoverFrom[i + 1])
      }
    }
    function emit(selected) {
      if (!selected.length || selected.length < minN || selected.length < startN) return
      if (requireHitIds && requireHitIds.size && selected.length > mustIds.length) {
        const extraHit = selected.some((row) => !mustSet.has(row.svt.id) && requireHitIds.has(row.svt.id))
        if (!extraHit) return
      }
      evaluateFarmers(orderFarmers(selected, [], [], bondAcc))
    }
    function dfs(selected, spent, gi, startInGroup, slotsLeft) {
      searchState.nodes += 1
      pingProgress()
      emit(selected)
      if (slotsLeft <= 0 || gi >= fillerGroups.length) return
      if (useUb && searchState.bestPlan && optimizeBy !== 'prefer') {
        const leftoverRows = leftoverFrom[gi] || []
        const ub = partyBranchUpperBound({
          selected,
          leftover: leftoverRows,
          need: slotsLeft,
          ...ubOpts,
        })
        if (ub < (searchState.bestPlan.total || 0)) {
          searchState.pruned += 1
          if (!selected.length && slotsLeft > 1) {
            dfs(selected, spent, gi, 0, 1)
            return
          }
          if (selected.length) return
        }
      }
      const group = fillerGroups[gi] || []
      const used = new Set(selected.map((row) => row.svt.id))
      for (let i = startInGroup; i < group.length; i++) {
        const row = group[i]
        if (!row || used.has(row.svt.id)) continue
        const cost = svtCostOf(row.svt, row.form)
        if (!remainingCostFeasible(spent, costLimit, cost)) continue
        selected.push(row)
        dfs(selected, spent + cost, gi, i + 1, slotsLeft - 1)
        selected.pop()
      }
      dfs(selected, spent, gi + 1, 0, slotsLeft)
    }
    rebuildLeftoverFrom()
    eachCartesianRows(
      mustIds.map((id) => mustMap.get(id)),
      (mustPick) => {
        const spent = mustPick.reduce((sum, row) => sum + svtCostOf(row.svt, row.form), 0)
        if (!remainingCostFeasible(spent, costLimit, 0)) return
        dfs(mustPick.slice(), spent, 0, 0, cap - mustPick.length)
      },
    )
  }
  const mustRows = expandFormRows(mustSvts, filter, spriteMode, bondAcc, mode, pinSprites)
  const allRows = useCompression
    ? compressEquivalentRows(uniqueBestRows(freeRows, ownCes, bondAcc), ownCes, Infinity, bondAcc)
    : uniqueBestRows(freeRows, ownCes, bondAcc)
  walkMixes(mustRows, allRows, null)
  const plans = uniquePlans([...foundByAssist.values()])
  if (!plans.length) return { ok: false, error: lastError, solverStats: searchProgress(searchState) }
  plans.sort(comparePlans)
  annotateInterchange(plans, freeRows, ownCes, useSupport ? supportCes : [], bondAcc)
  return { ok: true, error: '', plans, solverStats: searchProgress(searchState) }
}

function attachSlotCombat(slot, svt, game) {
  const skillsFromSvt = Array.isArray(svt && svt.skills) ? svt.skills : []
  const skillsFromGame = ((game && game.skills) || []).filter((skill) => skill && skill.svtId === (svt && svt.id))
  const np = ((game && game.noblePhantasms) || []).find((item) => item && item.svtId === (svt && svt.id))
  slot.atk = Number((svt && (svt.atk || svt.atkMax)) || 0) || 0
  slot.hp = Number((svt && (svt.hp || svt.hpMax)) || 0) || 0
  slot.np = Number((svt && svt.np) || 0) || 0
  slot.npMultiplier = Number((svt && svt.npMultiplier) || (np && np.npMultiplier) || 0) || 0
  slot.npGain = Number((svt && svt.npGain) || (np && np.npGain) || 0) || 0
  slot.skills = skillsFromSvt.length ? skillsFromSvt : skillsFromGame
}

export function assemblePlan({
  base,
  teapot,
  servants,
  ces,
  account,
  mode,
  useSupport,
  farmers,
  loadout,
  preferSvts,
  questType,
  questClass,
  costLimit,
  grand,
  bond15Aura = true,
  lockSvts = [],
  optimizeBy = 'total',
  priorities = [],
  pinCes = [],
  spriteMode = 'bond_first',
  pinSprites = [],
  game = null,
  slotPins = [],
  grandPosition: grandPositionIn = 0,
  quest = null,
  bondBonuses = null,
}) {
  const grandPosition = sanitizeGrandPosition(grandPositionIn, useSupport)
  const formed = placeGrandFirst(
    farmers.map((row) => ({
      svt: row.svt,
      form: row.form || formForAnchor(row.svt, null, null, spriteMode, recOf(row.svt, mode === 'account' ? account : null), mode, pinSprites),
    })),
    account,
    grand,
    grandPosition,
  )
  const grandSvtId = grandSvtIdOf(account, formed, grand)
  const seated = seatOwnFarmers(formed, useSupport, loadout && loadout.frontIdx, slotPins, grandSvtId, grandPosition)
  const slots = layoutSeatedSlots(seated, useSupport, grand, grandSvtId, grandPosition)
  const own = slots.filter((slot) => slot.filled && !slot.isSupport)
  for (const slot of own) {
    const row = formed.find((item) => item.svt.id === slot.svtId)
    if (!row) continue
    const rec = mode === 'account' ? recOf(row.svt, account) : null
    slot.bondLv = rec ? Number(rec.bondLv) || 0 : 0
    slot.bondCap = rec ? resolvedBondCap(rec, row.svt.id) : defaultBondCap(row.svt.id)
    slot.bond15 = rec ? svtBond15(row.svt, account) : false
    slot.bondMaxed = rec ? svtMaxed(row.svt, account) : false
    slot.spriteReason = spriteReasonOf(row.svt, row.form, ces, pinSprites, spriteMode)
    attachSlotCombat(slot, row.svt, game)
  }
  const picked = (loadout && loadout.ownNormal) || []
  const seenOwnCe = new Set()
  picked.forEach((ce, index) => {
    if (!own[index] || !ce) return
    if (seenOwnCe.has(ce)) return
    seenOwnCe.add(ce)
    applyCe(own[index], ce, mlbOf(ce, account, mode, false))
  })
  for (const pin of pinCes || []) {
    const svtId = Number(pin && pin.svtId) || 0
    const ceId = Number(pin && pin.ceId) || 0
    if (!svtId || !ceId) continue
    const target = own.find((slot) => slot.svtId === svtId)
    if (!target) continue
    if (target.ceId === ceId) continue
    const source = own.find((slot) => slot.ceId === ceId)
    const ce = (ces || []).find((item) => item.id === ceId) || picked.find((item) => item.id === ceId)
    if (source) {
      const tmpId = target.ceId
      const tmpMlb = target.ceMlb
      target.ceId = source.ceId
      target.ceMlb = source.ceMlb
      source.ceId = tmpId
      source.ceMlb = tmpMlb
    } else if (ce) {
      applyCe(target, ce, mlbOf(ce, account, mode, false))
    }
  }
  if (loadout && loadout.ownReward) {
    const grandOwn = slots.find((slot) => slot.isGrand && slot.filled && !slot.isSupport)
    if (grandOwn) {
      grandOwn.ceRewardId = loadout.ownReward.id
      grandOwn.ceRewardMlb = mlbOf(loadout.ownReward, account, mode, false)
      seenOwnCe.add(loadout.ownReward)
    }
  }
  const supportSlot = slots.find((slot) => slot.isSupport)
  if (supportSlot && loadout && loadout.support) applyCe(supportSlot, loadout.support, true)
  if (supportSlot && loadout && loadout.supportReward) supportSlot.ceRewardId = loadout.supportReward.id
  for (const pin of slotPins || []) {
    const slot = slots[pin.position - 1]
    if (!slot) continue
    if (pin.ceBondId) slot.ceBondId = pin.ceBondId
    if (pin.ceRewardId) slot.ceRewardId = pin.ceRewardId
  }
  applyCraftEssences(slots, ces)
  resolveSlotEventPassives(slots, { quest, catalog: bondBonuses })
  const output = calcParty(base, teapot, slots, { bond15Aura })
  const preferSet = new Set((preferSvts || []).map((svt) => svt.id))
  const lockSet = new Set((lockSvts || []).map((svt) => svt.id))
  let total = 0
  let preferBond = 0
  let lockBond = 0
  let bond15Count = 0
  for (const slot of slots) {
    if (slot.bond15 && slot.filled && !slot.isSupport) bond15Count += 1
    const result = output.results.find((item) => item.position === slot.position)
    if (result && result.eligible) {
      total += result.final
      if (preferSet.has(slot.svtId)) preferBond += result.final
      if (lockSet.has(slot.svtId)) lockBond += result.final
    }
  }
  const support = slots.find((slot) => slot.isSupport && slot.filled)
  const preferFront = slots.filter((slot) => preferSet.has(slot.svtId) && slot.position <= 3).map((slot) => slot.label)
  const preferBack = slots
    .filter((slot) => preferSet.has(slot.svtId) && slot.position > 3 && !slot.isSupport)
    .map((slot) => slot.label)
  const costUsed = partyCostOf(slots, servants, ces)
  const empty = slots.filter((slot) => !slot.filled).length
  const ownCount = slots.filter((slot) => slot.filled && !slot.isSupport).length
  const mashHolder = slots.some((slot) => {
    if (!slot.filled || slot.isSupport || !slot.bond15 || !slot.bondMaxed) return false
    const svt = (servants || []).find((item) => item.id === slot.svtId)
    if (!svt || svt.collectionNo !== 1) return false
    const form = (svt.forms || []).find((item) => item.key === slot.svtArtKey)
    return svtCostOf(svt, form) === 0
  })
  const spriteNotes = slots
    .filter((slot) => slot.spriteReason)
    .map((slot) => `${slot.label}：${slot.spriteReason}`)
  const summary = [
    optimizeBy === 'prefer'
      ? '一键推荐：主练羁绊最高，再全队总羁绊。锁定从者必须上场。'
      : preferSvts.length
        ? '一键推荐：总羁绊最高，再练度羁绊。锁定从者必须上场。'
        : '一键推荐：按总羁绊从高到低列出帕累托方案。',
    grand
      ? `冠位战 · ${classLabel(questClass) || questClass}。${questClass === 'extra1' || questClass === 'extra2' ? 'Extra 冠位栏己方只上 1 骑。' : ''}冠位 3 礼装位可叠 8 张。羁绊礼装为该从者10绊礼装，通关羁绊不加。${grandCeLine(slots, ces)}`
      : questClass
        ? `职阶限制 ${classLabel(questClass)}。`
        : '普通编队。',
    `上场 ${ownCount} 人。COST ${costUsed}。`,
    empty ? `空槽 ${empty}。` : '',
    mashHolder ? '玛修 15绊 0 COST 占位：给队友光环并带礼装，本人无羁绊。' : '',
    useSupport
      ? grand
        ? `助战冠位后排不上从者，普通+报酬礼装光环给己方，只算己方羁绊，前排己方 +20%。`
        : `助战固定后排不上从者，只给${support && support.ceId ? ceNameOf(ces, support.ceId) : '助战礼装'}（按助战倍率给己方），只算己方最多 5 人羁绊，前排己方 +20%。`
      : '不开助战，先填前排再填后排。',
    preferFront.length ? `练度从者前排：${preferFront.join('、')}。` : '',
    preferBack.length ? `练度超出前排，后排：${preferBack.join('、')}。` : '',
    '条件礼装按上场队伍结算：20% 命中过半时优先于午餐 10%。',
    '己方与助战的同名礼装各记一笔，分开展示和加算。',
    '礼装按 ID 去重，同倍率不同卡可叠；助战按该队命中加总现算。',
    '填人按特质覆盖率/COST，优先能叠多张 20% 的从者。',
    '礼装可不上；填写 COST 时只在范围内取羁绊最高。',
    '前排三人按总羁绊枚举。',
    bond15Aura === false ? '15绊光环已关。' : '',
    spriteMode === 'strict_order' ? '形象按严格顺序：3破 > 灵衣 > 1破 > 初始。' : '形象羁绊优先。',
    spriteNotes.length ? `形象：${spriteNotes.join('；')}。` : '',
    (priorities || []).some((rule) => rule && rule.enabled !== false) ? '羁绊相同再用从者优先级决胜。' : '',
    '每个灵基/灵衣是一套独立特性；编队按特性进组，礼装按已上场形态的特质结算。同一从者不同形态会作为不同方案竞争。',
    preferSvts.length ? `练度羁绊 ${preferBond}，总羁绊 ${total}。` : `总羁绊 ${total}。`,
  ]
    .filter(Boolean)
    .join('')
  const teamSvts = slots.filter((slot) => slot.filled && !slot.isSupport).map((slot) => {
    const svt = (servants || []).find((item) => item.id === slot.svtId) || { id: slot.svtId }
    return {
      ...svt,
      rarity: slot.rarity != null ? slot.rarity : svt.rarity,
      attribute: slot.attribute || svt.attribute,
      traitIds: slot.traitIds && slot.traitIds.length ? slot.traitIds : svt.traitIds,
      bondLevel: slot.bondLv,
      bondCap: slot.bondCap,
    }
  })
  return {
    ok: true,
    error: '',
    slots,
    summary,
    total,
    preferBond,
    lockBond,
    optimizeBy,
    priorityScore: priorityScore(teamSvts, priorities),
    bond15Count,
    output,
    useSupport,
    costUsed,
    costLimit,
    questType,
    questClass,
  }
}
