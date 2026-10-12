import { equipmentCurves, compareEquipmentCurves } from './equipment-curves.js'
import { describeQuery, readQuery, saveQuery } from './query-library.js'

self.onmessage = async ({ data }) => {
  try {
    const description = await describeQuery('equipment', data, `礼装曲线 · B ${data.range.min}–${data.range.max}`)
    const cached = await readQuery(description)
    if (cached) { self.postMessage({type:'result',result:cached,localResult:{hit:true,saved:true}}); return }
    const comparison = compareEquipmentCurves(equipmentCurves({ ...data.domain, mergeEquivalent: true }), {
      ...data.range, returnCandidates: true, onProgress: progress => self.postMessage({ type: 'progress', progress }) })
    // Preserve only unique winning curves for transport. Full expansion was
    // performed in the worker; plotting points is not an optimization shortcut.
    const winners = new Map()
    for (const interval of comparison.intervals) winners.set(interval.id, interval.candidate)
    const result = { ...comparison,
      winners: comparison.winners.map(w => ({ id: w.id, total: w.total })),
      curves: [...winners].map(([id, candidate]) => ({ id, ...candidate })) }
    const saved = await saveQuery(description, result)
    self.postMessage({ type: 'result', result, localResult:{hit:false,...saved} })
  } catch (error) { self.postMessage({ type: 'error', error: String(error.message || error) }) }
}
