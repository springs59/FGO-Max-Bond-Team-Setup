import { candidateCollector } from './query-candidate-collector.js'
import { equipmentCurves, compareEquipmentCurves } from './equipment-curves.js'
import { describeQuery, readQuery, saveQuery } from './query-library.js'

self.onmessage = async ({ data }) => {
  let collector
  try {
    const description = await describeQuery('equipment', data, `礼装曲线 · B ${data.range.min}–${data.range.max}`)
    const cached = await readQuery(description)
    if (cached) { self.postMessage({type:'result',result:cached,localResult:{hit:true,saved:true}}); return }
    collector = candidateCollector()
    const comparison = compareEquipmentCurves(equipmentCurves({ ...data.domain, mergeEquivalent: true }), {
      ...data.range, returnCandidates: true, onCandidate:candidate=>collector.capture({engine:'equipment-curve',...candidate}), onProgress: progress => self.postMessage({ type: 'progress', progress }) })
    // Full unique curves travel with the result; equivalent evaluated variants
    // are retained separately in the aggregate library, before winner selection.
    const winners = new Map()
    for (const interval of comparison.intervals) winners.set(interval.id, interval.candidate)
    const result = { ...comparison,
      winners: comparison.winners.map(w => ({ id: w.id, total: w.total })),
      curves: [...winners].map(([id, candidate]) => ({ id, ...candidate })) }
    const candidates = await collector.finish(); collector = null
    const saved = candidates.saved ? await saveQuery(description, result) : candidates
    self.postMessage({ type: 'result', result, localResult:{hit:false,...saved} })
  } catch (error) { collector?.cancel(); self.postMessage({ type: 'error', error: String(error.message || error) }) }
}
