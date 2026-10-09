// Consume Atlas nice-phase metadata. Never infer party rules from quest names.
export function questPartyRules(quest = {}) {
  const flags = quest.flags || []
  let noSupport = Boolean(quest.noSupport || flags.includes('eventDeckNoSupport'))
  let ownCount = 0
  let partyCount = 0
  const unsupported = []
  const supports = quest.supportServants || []
  let supportPolicy = quest.supportPolicy || (supports.length ? 'either' : 'friend')
  let requiresSupport = Boolean(quest.partyMetadataComplete && !noSupport)
  let supportPosition = 6
  if (flags.includes('supportOnlyBattle')) unsupported.push('全队固定助战编成')
  if (flags.includes('supportOnlyForceBattle') || supports.some(s => s.required)) {
    supportPolicy = 'system'; requiresSupport = true
  }
  if (flags.includes('noSupportList')) {
    if (supports.length) { supportPolicy = 'system'; requiresSupport = true }
    else if (quest.npcSupportCount) unsupported.push('缺少系统助战详情')
    else noSupport = true
  }
  for (const row of quest.restrictions || []) {
    const rec = row.restriction || row
    if (['mySvtNum', 'svtNum'].includes(rec.type) && rec.rangeType === 'equal' && rec.targetVals?.length === 1) {
      const n = Number(rec.targetVals[0])
      // Smaller exact counts need a separate search domain; do not silently
      // reinterpret equality as a minimum and return an illegal larger party.
      if (n !== 6) { unsupported.push(`${rec.type} = ${n}`); continue }
      if (rec.type === 'mySvtNum') ownCount = Math.max(ownCount, n)
      else partyCount = Math.max(partyCount, n)
      if (ownCount === 6) noSupport = true
    } else if (rec.type === 'fixedSupportPosition' && rec.targetVals?.length === 1 && Number(rec.targetVals[0]) >= 1 && Number(rec.targetVals[0]) <= 6) {
      supportPosition = Number(rec.targetVals[0]); requiresSupport = true
    } else if (rec.type === 'supportOnly' && !rec.targetVals?.length) {
      requiresSupport = true
    } else {
      unsupported.push(rec.name || rec.type || '未识别的编成限制')
    }
  }
  if (noSupport) { supportPolicy = 'none'; requiresSupport = false }
  return { noSupport, ownCount, partyCount, supportPolicy, requiresSupport, supportPosition,
    unsupported, supported: unsupported.length === 0 }
}

export function minimumOwnCount(rules, useSupport) {
  return Math.max(rules.ownCount || 0, (rules.partyCount || 0) - (useSupport ? 1 : 0))
}

// Copy only public party metadata; account/NPC payloads never enter snapshots.
export function questPartyMetadata(phase = {}) {
  const out = {}
  if (Array.isArray(phase.flags)) out.flags = [...phase.flags]
  if (Array.isArray(phase.restrictions)) out.restrictions = phase.restrictions.map(row => {
    const rec = row.restriction || row
    return { restriction: { id: rec.id, name: rec.name || '', type: rec.type, rangeType: rec.rangeType,
      targetVals: [...(rec.targetVals || [])], targetVals2: [...(rec.targetVals2 || [])] } }
  })
  if (phase.npcSupportCount != null) out.npcSupportCount = Number(phase.npcSupportCount) || 0
  if (Array.isArray(phase.supportServants)) out.supportServants = phase.supportServants
  if (phase.partyMetadataComplete === true) out.partyMetadataComplete = true
  return out
}

export function availableSystemSupports(quest, account) {
  const supports = quest.supportServants || []
  const forced = supports.filter(s => s.required)
  return (forced.length ? forced : supports).filter(s => (s.releaseConditions || []).every(cond => {
    if (cond.type === 'none') return true
    const clear = (account?.questClears || []).find(row => row.id === Number(cond.targetId))
    if (cond.type === 'questClear') return Boolean(clear?.clearNum > 0)
    if (cond.type === 'questClearNum') return Boolean(clear?.clearNum >= Number(cond.value))
    // Unknown release conditions do not mean the NPC is available.
    return false
  }))
}
