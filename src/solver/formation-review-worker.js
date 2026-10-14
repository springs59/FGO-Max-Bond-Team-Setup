import { installWorkerTransport,postWorkerMessage } from '../worker-transport.js'
import { solveProjectedGlobal } from './global-curve-expand.js'
import { buildGlobalEnvelope } from './global-envelope.js'
import { anonymousEnvelopeBank } from './anonymous-effects.js'
import { formationConfigMatches, applyActivityEffects } from './formation-effects.js'
import {candidateCollector} from './query-candidate-collector.js'
import {stageCompletedQuery} from './query-library.js'
import {globalCandidate} from './query-global-candidate.js'

installWorkerTransport(self,async ({ data: m }) => {
  let collector
  try {
    collector=await candidateCollector({summary:m.description?.summary||'编队曲线计算'})
    const observe=(record,meta)=>collector.capture(globalCandidate(record,meta,{queryId:m.description?.queryId,kind:m.kind}))
    const complete=async(kind,value)=>{
      const completion=collector.prepareCompletion(),staged=await stageCompletedQuery(m.description,value,completion)
      const temporary=await collector.retain();collector=null
      await postWorkerMessage(self,{kind,...value,localResult:{saved:false,temporary:temporary.temporary,name:temporary.name,
        ...(temporary.error||staged.error?{error:temporary.error||staged.error}:{})}})
    }
    if (m.kind === 'solve') {
      const bank = solveProjectedGlobal(m.source, {...m.options,onComputedRecord:observe}, stats => {collector.checkpoint?.();self.postMessage({ kind: 'progress', stats })})
      await complete('solved',{bank,envelope:buildGlobalEnvelope(bank.records,bank.meta,m.options)})
      return
    }
    const { options, profiles, meta: effectMeta } = m
    const base = anonymousEnvelopeBank(effectMeta, { ...options, acceptConfiguration: c => formationConfigMatches(c, options) })
    const configs = [], records = [], supports = [], supportIds = new Map()
    let scanned = 0, last = Date.now()
    for (const c of base.configs) for (const v of applyActivityEffects(c, profiles, { envelope: true })) {
      const r = [v.support.layout, 0, 0, v.n, v.nf, v.k, 0, v.cost, ...Array(12).fill(0)]
      const support = { frontShare: v.support.frontShare, flat: v.flat }, key = JSON.stringify(support)
      if (!supportIds.has(key)) { supportIds.set(key, supports.length); supports.push(support) }
      r[1] = supportIds.get(key)
      v.terms.forEach((t, i) => { r[8 + (i < v.nf ? i : 3 + i - v.nf)] = t.second })
      configs.push(v); records.push(r); scanned++
      observe(r,{supports})
      if (Date.now() - last > 350) { self.postMessage({ kind: 'effect-progress', scanned }); last = Date.now() }
    }
    const meta = { supports }, all = buildGlobalEnvelope(records, meta, { cost: options.cost, portraitCap: 10, capped: -1 })
    const ids = [...new Set(all.hulls.flatMap(h => h.map(x => x[1])))]
    const bank = { configs: ids.map(i => configs[i]), records: ids.map(i => records[i]), meta, enumerated: base.enumerated, scanned }
    await complete('effects',{bank,envelope:buildGlobalEnvelope(bank.records,meta,{cost:options.cost,portraitCap:10,capped:-1})})
  } catch (error) { collector?.cancel();self.postMessage({ kind: 'error', message: error.message }) }
})
