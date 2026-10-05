// One normalization and ranking rule for names, nicknames and costume searches.
export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[·・•〔〕【】「」『』()\[\]＝=\-_—–]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .replace(/(^|\s)([a-z])\s+(?=\p{Script=Han})/gu, '$1$2')
}

export function searchTerms(query) {
  return normalizeSearch(query).split(' ').filter(Boolean)
}

export function nameScore(names, query) {
  const q = normalizeSearch(query)
  if (!q) return 0
  const compact = q.replace(/\s/g, '')
  const values = (names || []).map(normalizeSearch).filter(Boolean)
  let best = 0
  for (const name of values) {
    const s = name.replace(/\s/g, '')
    if (s === compact) best = Math.max(best, 4)
    else if (s.startsWith(compact)) best = Math.max(best, 3)
    else if (s.includes(compact)) best = Math.max(best, 1)
  }
  if (best) return best
  const haystack = values.join(' ')
  return searchTerms(q).every(term => haystack.includes(term)) ? 0.5 : 0
}

export function itemSearchNames(item, extra = '') {
  return [item.name, item.originalName, item.collectionNo, extra,
    ...(Array.isArray(item.aliases) ? item.aliases : [])]
}

export function matchedAlias(item, query) {
  if (!normalizeSearch(query) || nameScore([item.name, item.originalName], query)) return ''
  const aliases = Array.isArray(item.aliases) ? item.aliases : []
  const direct = aliases.map(alias => ({ alias, score: nameScore([alias], query) }))
    .filter(hit => hit.score).sort((a, b) => b.score - a.score)
  if (direct.length) return direct[0].alias
  return aliases.find(alias => searchTerms(query).some(term =>
    nameScore([alias], term) && !nameScore([item.name, item.originalName], term))) || ''
}
