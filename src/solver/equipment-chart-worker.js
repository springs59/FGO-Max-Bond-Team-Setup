import { equipmentCurves, compareEquipmentCurves } from './equipment-curves.js'

self.onmessage = ({ data }) => {
  try {
    const comparison = compareEquipmentCurves(equipmentCurves({ ...data.domain, mergeEquivalent: true }), {
      ...data.range, returnCandidates: true, onProgress: progress => self.postMessage({ type: 'progress', progress }) })
    // Preserve only unique winning curves for transport. Full expansion was
    // performed in the worker; plotting points is not an optimization shortcut.
    const winners = new Map()
    for (const interval of comparison.intervals) winners.set(interval.id, interval.candidate)
    self.postMessage({ type: 'result', result: { ...comparison,
      winners: comparison.winners.map(w => ({ id: w.id, total: w.total })),
      curves: [...winners].map(([id, candidate]) => ({ id, ...candidate })) } })
  } catch (error) { self.postMessage({ type: 'error', error: String(error.message || error) }) }
}
