import { applyCraftEssences } from './atlas.js'
import { accountServantOf, defaultBondCap, resolvedBondCap } from './account.js'
import { resolveServantState } from './servant-state.js'
import { servantCost } from './servant-cost.js'
import { resolveSlotEventPassives } from './bond/bonus.js'
import { calcParty } from './bond.js'
import { compileBondCurve, curveKey } from './solver/bond-curve.js'
import { servantBondForms, formUnlocked } from './recommend.js'
import { matchRosterForm } from './filter.js'

export const normalizedForm = key => !key || key === 'd' || key === 'default' ? 'default' : String(key)

// Settle physical compositions against live catalog/account facts, never their
// archived totals. The same operation powers edits, comparison and alternatives.
export function settleParty(source, options = {}) {
  const { servants = [], ces = [], mode, account, base = 0, teapot = false, bond15Aura = true } = options
  const byId = options.servantsById || new Map(servants.map(s => [Number(s.id), s]))
  const ceById = options.cesById || new Map(ces.map(c => [Number(c.id), c]))
  let costUsed = 0
  const slots = source.map(s => {
    const slot = { ...s, ceLines: [], eventPassive: 0, eventBonus: null, customPercent: 0 }
    const svt = byId.get(Number(slot.svtId))
    if (svt && !slot.isSupport) {
      const form = resolveServantState(svt, normalizedForm(slot.svtArtKey) === 'default' ? '' : slot.svtArtKey)
      Object.assign(slot, { label: svt.name, face: svt.face, className: form.className, attribute: form.attribute,
        traitIds: form.traitIds, rarity: form.rarity, formLabel: form.formLabel })
      const rec = mode === 'account' ? accountServantOf(account, slot.svtId) : null
      if (mode === 'account') { slot.bondLv = Number(rec?.bondLv) || 0; slot.bondCap = resolvedBondCap(rec, slot.svtId) }
      slot.bondCap = Number(slot.bondCap) || defaultBondCap(slot.svtId)
      slot.bond15 = Number(slot.bondLv) >= 15
      slot.bondMaxed = Number(slot.bondLv) >= slot.bondCap
      if (slot.filled) costUsed += servantCost(svt, form)
    }
    if (slot.filled && !slot.isSupport) costUsed += Number(ceById.get(Number(slot.ceId))?.cost) || 0
    return slot
  })
  applyCraftEssences(slots, ces, ceById)
  resolveSlotEventPassives(slots, { quest: options.quest, catalog: options.bondBonuses })
  const output = calcParty(base, teapot, slots, { bond15Aura })
  const curve = compileBondCurve(slots, { bond15Aura })
  return { ok: output.ok, slots, output, curve, costUsed,
    total: output.ok ? output.results.reduce((sum, r) => sum + r.final, 0) : 0 }
}

export function replacePartyMember(source, position, servant, formKey = '', options = {}) {
  const slots = source.map(s => s.position !== position ? { ...s } : {
    ...s, svtId: servant.id, svtArtKey: formKey, label: servant.name, face: servant.face,
    filled: true, isSupport: false, svtQuery: '', svtArts: [], extraPassives: [],
  })
  return settleParty(slots, options)
}

export function interchangeableMembers(source, position, entries, options = {}) {
  const original = settleParty(source, options), key = curveKey(original.curve)
  const byId = new Map((options.servants || []).map(s => [Number(s.id), s]))
  // Identity, not portrait, determines whether a servant is already deployed.
  const seated = new Set(source.filter(s => s.filled && !s.isSupport && s.position !== position).map(s => Number(s.svtId)))
  const seen = new Set(), result = []
  for (const entry of entries) {
    const id = Number(entry.id), signature = id + ':' + normalizedForm(entry.formKey)
    if (seen.has(signature) || !byId.has(id)) continue
    seen.add(signature)
    const svt=byId.get(id),form=servantBondForms(svt).find(f=>f.key===normalizedForm(entry.formKey))
    const rec=options.mode==='account'?accountServantOf(options.account,id):null
    if(options.mode==='account'&&!options.account?.virtual&&!rec)continue
    if(!form||!formUnlocked(form,rec,options.mode)||!matchRosterForm(svt,form,options.filter))continue
    const candidate = replacePartyMember(source, position, byId.get(id), entry.formKey, options)
    result.push({ ...entry, id, onField: seated.has(id), total: candidate.total,
      sameEffect: candidate.costUsed === original.costUsed && curveKey(candidate.curve) === key })
  }
  return result
}
