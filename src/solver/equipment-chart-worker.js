import { installWorkerTransport,postWorkerMessage } from '../worker-transport.js'
import { candidateCollector } from './query-candidate-collector.js'
import { equipmentCurves, compareEquipmentCurves } from './equipment-curves.js'
import { describeQuery, readQuery, stageCompletedQuery } from './query-library.js'

installWorkerTransport(self,async ({ data }) => {
  let collector
  try {
    const description = await describeQuery('equipment', data, `礼装曲线 · B ${data.range.min}–${data.range.max}`)
    const cached = await readQuery(description)
    if (cached) { await postWorkerMessage(self,{type:'result',result:cached,localResult:{hit:true,saved:true}}); return }
    collector = await candidateCollector({summary:description.summary})
    const comparison = compareEquipmentCurves(equipmentCurves({ ...data.domain, mergeEquivalent: true }), {
      ...data.range, returnCandidates: true, onCandidate:candidate=>collector.capture({engine:'equipment-curve',...candidate}), onProgress: progress => {collector.checkpoint?.();self.postMessage({ type: 'progress', progress })} })
    // Full unique curves travel with the result; equivalent evaluated variants
    // are retained separately in the aggregate library, before winner selection.
    const winners = new Map()
    for (const interval of comparison.intervals) winners.set(interval.id, interval.candidate)
    const result = { ...comparison,
      winners: comparison.winners.map(w => ({ id: w.id, total: w.total })),
      curves: [...winners].map(([id, candidate]) => ({ id, ...candidate })) }
    const completion=collector.prepareCompletion()
    const staged=await stageCompletedQuery(description,result,completion)
    const temporary=await collector.retain();collector=null
    await postWorkerMessage(self,{ type:'result',result,localResult:{hit:false,saved:false,temporary:temporary.temporary,name:temporary.name,...(temporary.error||staged.error?{error:temporary.error||staged.error}:{})} })
  } catch (error) { collector?.cancel(); self.postMessage({ type: 'error', error: String(error.message || error) }) }
})
