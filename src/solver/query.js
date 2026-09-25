function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
}

function ownedServantIdSet(account) {
  if (!account || account.virtual) return null
  const rows = account.servantsOwned || account.servants || []
  const ids = rows.map((item) => Number(item && item.id != null ? item.id : item)).filter((id) => id)
  return ids.length ? new Set(ids) : null
}

function ownedCeIdSet(account) {
  if (!account || account.virtual) return null
  const rows = account.craftEssencesOwned || account.ces || []
  const ids = rows.map((item) => Number(item && item.id != null ? item.id : item)).filter((id) => id)
  return ids.length ? new Set(ids) : null
}

export function querySolverIndex(index, {
  quest = null,
  questClass = '',
  questType = 'normal',
  servantIds = null,
  ceIds = null,
  lockSvtIds = [],
  excludeSvtIds = [],
  excludeCeIds = [],
  mode = 'free',
  account = null,
} = {}) {
  if (!index || !index.candidates) return null
  const t0 = nowMs()
  const cand = index.candidates
  const qClass = questClass || (quest && (quest.questClass || '')) || ''
  let svts
  if (qClass && cand.byClass && Array.isArray(cand.byClass[qClass])) {
    svts = cand.byClass[qClass].slice()
  } else {
    svts = (index.servants || []).map((svt) => svt.id)
  }
  if (Array.isArray(servantIds)) {
    const allow = new Set(servantIds.map(Number))
    svts = svts.filter((id) => allow.has(id))
  }
  if (mode === 'account') {
    const owned = ownedServantIdSet(account)
    if (owned) svts = svts.filter((id) => owned.has(id))
  }
  const excluded = new Set((excludeSvtIds || []).map(Number).filter((id) => id))
  if (excluded.size) svts = svts.filter((id) => !excluded.has(id))
  const locks = (lockSvtIds || []).map(Number).filter((id) => id)
  if (locks.length) {
    const have = new Set(svts)
    for (const id of locks) {
      if (!have.has(id)) {
        svts.push(id)
        have.add(id)
      }
    }
  }
  let cesOut = (index.ces || []).map((ce) => ce.id)
  if (Array.isArray(ceIds)) {
    const allow = new Set(ceIds.map(Number))
    cesOut = cesOut.filter((id) => allow.has(id))
  }
  if (mode === 'account') {
    const ownedCe = ownedCeIdSet(account)
    if (ownedCe) cesOut = cesOut.filter((id) => ownedCe.has(id))
  }
  const banCe = new Set((excludeCeIds || []).map(Number).filter((id) => id))
  if (banCe.size) cesOut = cesOut.filter((id) => !banCe.has(id))
  return {
    servantIds: svts,
    ceIds: cesOut,
    questClass: qClass,
    questType,
    ms: nowMs() - t0,
  }
}

export function applyIndexQuery(index, { servants = [], ces = [], ...query } = {}) {
  const looked = querySolverIndex(index, {
    ...query,
    servantIds: servants.map((svt) => svt.id),
    ceIds: (ces || []).map((ce) => ce.id),
  })
  if (!looked) return { servants, ces, query: null }
  const allowSvt = new Set(looked.servantIds)
  for (const id of query.lockSvtIds || []) allowSvt.add(Number(id))
  const nextServants = servants.filter((svt) => allowSvt.has(svt.id))
  let nextCes = ces
  if (looked.ceIds && looked.ceIds.length) {
    const allowCe = new Set(looked.ceIds)
    nextCes = (ces || []).filter((ce) => allowCe.has(ce.id))
  }
  return { servants: nextServants, ces: nextCes, query: looked }
}
