import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  bondEffectsForServant,
  ceBondEffects,
  resolveCurrentActivity,
  servantProvides,
  servantReceives,
} from './index.js'

const NOW = 1791000000
const ENDED = 1792044000
const QUEST = { id: 94061601, eventId: 80576 }
const OTHER = { id: 100, eventId: 0 }
const catalog = JSON.parse(readFileSync(new URL('../data/bond-bonuses.json', import.meta.url), 'utf8'))

const KONDO = 106400
const HARADA = 306100
const OKITA = 102700
const MASH = 800100

{
  const resolved = resolveCurrentActivity({ catalog, now: NOW })
  assert.ok(resolved.activities.some((row) => row.eventId === 80576 && row.active))
  assert.ok(resolved.extraPassives.some((row) => row.servantId === KONDO && row.eventId === 80576))
}

{
  const kondo = bondEffectsForServant({ servantId: KONDO, catalog, quest: QUEST, now: NOW })
  const self = kondo.find((row) => row.source === 'extraPassive' && row.selfBonus > 0)
  assert.ok(self)
  assert.equal(self.selfBonus, 0.5)
  assert.equal(self.eventId, 80576)
  assert.equal(self.questId, QUEST.id)
  assert.equal(self.servantId, KONDO)
  assert.ok(self.startedAt)
  assert.ok(self.endedAt)
}

{
  const harada = bondEffectsForServant({ servantId: HARADA, catalog, quest: QUEST, now: NOW })
  assert.equal(harada.find((row) => row.source === 'extraPassive').selfBonus, 0.5)
  const okita = bondEffectsForServant({ servantId: OKITA, catalog, quest: QUEST, now: NOW })
  assert.equal(okita.find((row) => row.source === 'extraPassive').selfBonus, 0.2)
  const mash = bondEffectsForServant({ servantId: MASH, catalog, quest: QUEST, now: NOW })
  const party = servantProvides(mash)
  assert.equal(party.length, 1)
  assert.equal(party[0].partyBonus, 0.05)
  assert.equal(party[0].selfBonus, 0)
}

{
  const ended = bondEffectsForServant({ servantId: KONDO, catalog, quest: QUEST, now: ENDED })
  assert.equal(ended.length, 0)
  const otherQuest = bondEffectsForServant({ servantId: KONDO, catalog, quest: OTHER, now: NOW })
  assert.equal(otherQuest.length, 0)
}

{
  const okita = bondEffectsForServant({ servantId: OKITA, catalog, quest: QUEST, now: NOW })
  const mash = bondEffectsForServant({ servantId: MASH, catalog, quest: QUEST, now: NOW })
  assert.equal(servantReceives(okita).some((row) => row.servantId === OKITA), true)
  assert.equal(servantReceives(okita).every((row) => row.partyBonus === 0), true)
  assert.equal(servantProvides(mash).every((row) => row.partyBonus > 0), true)
}

{
  const lunch = {
    id: 1,
    name: '午餐时光',
    skills: [
      {
        name: '牵绊获得量提升',
        condLimitCount: 4,
        funcs: [{ target: 'ptFull', rate: 100, add: 0, eventId: 0 }],
      },
    ],
  }
  const mlb = ceBondEffects(lunch, { mlb: true })
  const base = ceBondEffects(lunch, { mlb: false })
  assert.equal(mlb[0].partyBonus, 0.1)
  assert.equal(mlb[0].theoretical, true)
  assert.equal(base[0].theoretical, false)
}

console.log('bond-rules.test.js ok')
