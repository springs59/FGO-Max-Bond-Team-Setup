import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { emptyBondBonusCatalog } from './activity.js'
import {
  bondBonusPublishDecision,
  buildBondBonusSnapshot,
  catalogOrEmpty,
  validateBondBonusCatalog,
} from './snapshot.js'

const BAKUMATSU = {
  eventId: 80576,
  startedAt: 1790229600,
  endedAt: 1792043999,
}

function extraSkill({
  id,
  name,
  eventId,
  startedAt,
  endedAt,
  rateCount,
  target = 'self',
  condQuestId = 0,
}) {
  return {
    id,
    name,
    extraPassive: [{ eventId, startedAt, endedAt, condQuestId, condQuestPhase: 0 }],
    functions: [
      {
        funcType: 'servantFriendshipUp',
        funcTargetType: target,
        svals: [{ RateCount: rateCount, EventId: eventId }],
      },
    ],
  }
}

function dummyPassive(i) {
  return {
    type: 'extraPassive',
    servantId: 1000 + i,
    skillId: 8000 + i,
    name: `p${i}`,
    eventId: 80000 + i,
    rate: 0.2,
    add: 0,
    target: 'self',
    startedAt: 1,
    endedAt: 2,
    condQuestId: 0,
    condQuestPhase: 0,
    applySupportSvt: 1,
  }
}

{
  const catalog = buildBondBonusSnapshot({
    servantsNice: [
      {
        id: 106400,
        extraPassive: [
          extraSkill({
            id: 940407,
            name: '幕末武斗力量 EX',
            eventId: BAKUMATSU.eventId,
            startedAt: BAKUMATSU.startedAt,
            endedAt: BAKUMATSU.endedAt,
            rateCount: 500,
          }),
          extraSkill({
            id: 970663,
            name: '梦火的引导',
            eventId: 0,
            startedAt: 1,
            endedAt: 2145888000,
            rateCount: 250,
            target: 'ptFull',
          }),
          extraSkill({
            id: 990123,
            name: '牵绊获得量提升',
            eventId: 80273,
            startedAt: BAKUMATSU.startedAt,
            endedAt: BAKUMATSU.endedAt,
            rateCount: 1000,
          }),
          extraSkill({
            id: 88000,
            name: '夏活力量 EX',
            eventId: 80414,
            startedAt: 1700000000,
            endedAt: 1700003600,
            rateCount: 500,
          }),
        ],
      },
      {
        id: 800100,
        extraPassive: [
          extraSkill({
            id: 940409,
            name: '幕末武斗力量 B',
            eventId: BAKUMATSU.eventId,
            startedAt: BAKUMATSU.startedAt,
            endedAt: BAKUMATSU.endedAt,
            rateCount: 50,
            target: 'ptFull',
          }),
        ],
      },
    ],
    eventsNice: [
      {
        id: 71564,
        name: '特定从者 获得牵绊点数提升',
        type: 'questCampaign',
        startedAt: 1700000000,
        endedAt: 1700003600,
        campaigns: [
          {
            target: 'questFriendship',
            value: 1200,
            calcType: 'multiplication',
            targetIds: [106400],
          },
          {
            target: 'questUseFriendshipUpItem',
            value: 2000,
            calcType: 'multiplication',
            targetIds: [],
          },
        ],
        campaignQuests: [
          { questId: 0, isExcepted: false },
          { questId: 94061699, isExcepted: true },
        ],
      },
      {
        id: 80576,
        name: '幕末武斗神话 唠唠叨叨新选组 THE END',
        type: 'eventQuest',
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
        campaigns: [],
        campaignQuests: [],
      },
    ],
    basicEvents: [
      {
        id: 80576,
        name: '幕末武斗神话 唠唠叨叨新选组 THE END',
        type: 'eventQuest',
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
      },
      {
        id: 80414,
        name: '夏活',
        type: 'eventQuest',
        startedAt: 1700000000,
        endedAt: 1700003600,
      },
    ],
  })

  assert.equal(catalog.extraPassives.length, 3)
  assert.equal(catalog.extraPassives.some((rec) => rec.skillId === 970663), false)
  assert.equal(catalog.extraPassives.some((rec) => rec.skillId === 990123), false)
  const kondo = catalog.extraPassives.find((rec) => rec.servantId === 106400 && rec.eventId === 80576)
  assert.equal(kondo.rate, 0.5)
  assert.equal(kondo.target, 'self')
  const mash = catalog.extraPassives.find((rec) => rec.servantId === 800100)
  assert.equal(mash.target, 'ptFull')
  assert.equal(mash.rate, 0.05)
  const expired = catalog.extraPassives.find((rec) => rec.eventId === 80414)
  assert.equal(expired.rate, 0.5)

  assert.equal(catalog.questFriendships.length, 1)
  const qf = catalog.questFriendships[0]
  assert.equal(qf.eventId, 71564)
  assert.equal(qf.rate, 0.2)
  assert.equal(qf.allQuests, true)
  assert.deepEqual(qf.targetIds, [106400])
  assert.deepEqual(qf.exceptedQuestIds, [94061699])

  const eventIds = catalog.events.map((ev) => ev.id).sort((a, b) => a - b)
  assert.deepEqual(eventIds, [71564, 80414, 80576])
  assert.equal(catalog.events.find((ev) => ev.id === 80576).name.includes('幕末'), true)

  const check = validateBondBonusCatalog(catalog)
  assert.equal(check.ok, true)
  assert.equal(check.extraPassiveCount, 3)
  assert.equal(check.questFriendshipCount, 1)
}

{
  const empty = buildBondBonusSnapshot({})
  assert.deepEqual(empty, emptyBondBonusCatalog())
  assert.equal(validateBondBonusCatalog(empty).ok, true)
  assert.deepEqual(catalogOrEmpty(null), emptyBondBonusCatalog())
}

{
  assert.equal(validateBondBonusCatalog(null).ok, false)
  assert.equal(validateBondBonusCatalog([]).ok, false)
  assert.ok(validateBondBonusCatalog({ extraPassives: [], questFriendships: [], events: {} }).errors.some((text) => text.includes('events')))
  const dreamfire = validateBondBonusCatalog({
    extraPassives: [{ ...dummyPassive(1), skillId: 970663, servantId: 1, rate: 0.25 }],
    questFriendships: [],
    events: [],
  })
  assert.equal(dreamfire.ok, false)
  assert.ok(dreamfire.errors.some((text) => text.includes('970663')))
  const ceSkill = validateBondBonusCatalog({
    extraPassives: [{ ...dummyPassive(1), skillId: 990001, servantId: 1, rate: 1 }],
    questFriendships: [],
    events: [],
  })
  assert.equal(ceSkill.ok, false)
  assert.ok(ceSkill.errors.some((text) => text.includes('礼装技能')))
}

{
  const previous = {
    extraPassives: Array.from({ length: 100 }, (_, i) => dummyPassive(i)),
    questFriendships: Array.from({ length: 20 }, (_, i) => ({
      type: 'questFriendship',
      eventId: 71000 + i,
      name: `q${i}`,
      startedAt: 1,
      endedAt: 2,
      value: 1200,
      rate: 0.2,
      calcType: 'multiplication',
      targetIds: [],
      allQuests: true,
      questIds: [],
      exceptedQuestIds: [],
    })),
    events: [{ id: 1, name: 'e', type: 'questCampaign', startedAt: 1, endedAt: 2 }],
  }
  const ok = bondBonusPublishDecision({ previous, candidate: previous })
  assert.equal(ok.ok, true)
  assert.equal(ok.keepPrevious, false)

  const dropped = bondBonusPublishDecision({
    previous,
    candidate: { extraPassives: previous.extraPassives.slice(0, 10), questFriendships: [], events: [] },
  })
  assert.equal(dropped.ok, false)
  assert.equal(dropped.keepPrevious, true)
  assert.ok(dropped.errors.some((text) => text.includes('骤降')))

  const first = bondBonusPublishDecision({
    previous: emptyBondBonusCatalog(),
    candidate: emptyBondBonusCatalog(),
  })
  assert.equal(first.ok, true)
}

{
  const shipped = JSON.parse(readFileSync(new URL('../data/bond-bonuses.json', import.meta.url), 'utf8'))
  const check = validateBondBonusCatalog(shipped)
  assert.equal(check.ok, true)
  assert.equal((shipped.extraPassives || []).some((rec) => rec.skillId === 970663), false)
  assert.equal(
    (shipped.extraPassives || []).some((rec) => rec.skillId >= 990000 && rec.skillId < 1000000),
    false,
  )
}

console.log('bond snapshot tests passed')
