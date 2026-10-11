import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildFormationDomain, formationDomainMatches, formationScene } from './formation-domain.js'
import { buildCombinationFactors } from './combination-factors.js'
import { servantBondForms } from '../recommend.js'
import { formationOptions } from './formation-effects.js'
import { getEffectiveBondBonus } from '../bond/bonus.js'

const read = p => JSON.parse(readFileSync(new URL('../data/' + p + '.json', import.meta.url)))
const servants = read('servants').filter(s => [100100, 100700, 200100].includes(s.id))
const ces = [{ id: 101, name: '测试全队礼装', cost: 2, skills: [{ condLimitCount: 4, funcs: [{ target: 'ptFull', rate: 200, add: 0, tvals: [], andTvals: [] }] }] }]
const bondBonuses = read('bond-bonuses'), event = bondBonuses.events.find(e => e.id === 80520), now = (event.startedAt + 3600) * 1000
const bundle = { region: 'CN', version: { region: 'CN', baseDataVersion: 'formation-fixture' }, servants, ces, bondBonuses,
  quests: [{ id: 9001, phase: 1, eventId: event.id, type: 'event', bond: 100, openedAt: event.startedAt, closedAt: event.endedAt },
    { id: 9002, bond: 100, noSupport: true, restrictions: [{ type: 'svtNum', rangeType: 'equal', targetVals: [2] }] },
    { id: 9003, bond: 100, flags: ['supportOnlyBattle'] }] }
const live = buildFormationDomain(bundle, { now })
const factorIndex = buildCombinationFactors({ servants, ces, formsOf: servantBondForms, version: bundle.version })
const indexed = buildFormationDomain(bundle, { now, factorIndex })
assert.deepEqual(indexed.source, live.source, 'local factor vectors and live evaluation produce exactly the same domain')
assert.equal(live.source.forms, servants.reduce((n, s) => n + servantBondForms(s).length, 0), 'every form is retained before restrictions')
assert.equal(live.unsupported.length, 1, 'unknown guest constraints are reported rather than relaxed')
const self = live.profiles.find(p => p.label.startsWith('无助战'))
assert.deepEqual([...new Set(formationOptions(formationScene(live, self.tag).meta).map(x => x.own))], [1, 2, 3, 4, 5, 6])
const constrained = live.profiles.find(p => p.family === 'special')
assert.deepEqual([...new Set(formationOptions(formationScene(live, constrained.tag).meta).map(x => x.own))], [2])
const active = live.profiles.find(p => Object.keys(p.scores).length)
assert.ok(active)
for (const row of formationScene(live, active.tag).source.rows) {
  const oracle = getEffectiveBondBonus({ servantId: row.id, catalog: bondBonuses, quest: bundle.quests[0], now })
  assert.equal(row.self, Math.round((oracle.totalSecondLayer || 0) * 1000))
}
assert.equal(live.activity[self.tag].length, 0, 'no-activity conditions never borrow another scene\'s tiers')
assert.equal(formationDomainMatches(live, bundle, now), true)
assert.equal(formationDomainMatches(live, bundle, (event.endedAt + 1) * 1000), false, 'event boundary invalidates reuse')
assert.equal(formationDomainMatches(live, { ...bundle, region: 'JP' }, now), false)
assert.equal(formationDomainMatches(live, { ...bundle, version: { ...bundle.version, baseDataVersion: 'new' } }, now), false)
assert.equal(formationDomainMatches(live, { ...bundle, quests: bundle.quests.map(q => ({ ...q, noSupport: false })) }, now), false)
const expired = buildFormationDomain(bundle, { now: (event.endedAt + 1) * 1000 })
assert.ok(expired.profiles.every(p => !Object.keys(p.scores).length), 'past event bonuses are not reused')
console.log('Formation domain: local-vector equivalence, all identities/forms, no-support capacity, constrained counts, activity oracle, scene isolation and freshness passed')
