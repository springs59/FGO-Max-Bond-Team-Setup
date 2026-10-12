import { installWorkerTransport,postWorkerMessage } from '../worker-transport.js'
import { solveProjectedGlobal } from './global-curve-expand.js'
import { buildGlobalEnvelope } from './global-envelope.js'
import { anonymousEnvelopeBank } from './anonymous-effects.js'
import { formationConfigMatches, applyActivityEffects } from './formation-effects.js'

installWorkerTransport(self,async ({ data: m }) => {
  try {
    if (m.kind === 'solve') {
      const bank = solveProjectedGlobal(m.source, m.options, stats => self.postMessage({ kind: 'progress', stats }))
      await postWorkerMessage(self,{ kind: 'solved', bank, envelope: buildGlobalEnvelope(bank.records, bank.meta, m.options) })
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
      if (Date.now() - last > 350) { self.postMessage({ kind: 'effect-progress', scanned }); last = Date.now() }
    }
    const meta = { supports }, all = buildGlobalEnvelope(records, meta, { cost: options.cost, portraitCap: 10, capped: -1 })
    const ids = [...new Set(all.hulls.flatMap(h => h.map(x => x[1])))]
    const bank = { configs: ids.map(i => configs[i]), records: ids.map(i => records[i]), meta, enumerated: base.enumerated, scanned }
    await postWorkerMessage(self,{ kind: 'effects', bank, envelope: buildGlobalEnvelope(bank.records, meta, { cost: options.cost, portraitCap: 10, capped: -1 }) })
  } catch (error) { self.postMessage({ kind: 'error', message: error.message }) }
})
