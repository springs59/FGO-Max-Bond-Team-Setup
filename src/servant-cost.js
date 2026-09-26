// Basic Atlas exports may omit COST. Rarity 0 is not a free servant.
export function servantCost(svt, form = null) {
  if (!svt) return 0
  const angra = Number(svt.id) === 1100100 || Number(svt.collectionNo) === 107
  const raw = form && form.cost != null && form.cost !== '' ? form.cost : svt.cost
  const explicit = raw != null && raw !== '' ? Number(raw) : NaN
  if (Number.isFinite(explicit) && explicit >= 0 && !(angra && explicit === 0)) return explicit
  if (Number(svt.id) === 800100 || Number(svt.collectionNo) === 1) return 0
  if (angra) return 4
  return [4, 3, 4, 7, 12, 16][svt.rarity] ?? 16
}
