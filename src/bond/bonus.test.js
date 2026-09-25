import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calcParty } from '../bond.js'
import {
  extractExtraPassives,
  extractQuestFriendships,
  extraPassiveApplies,
  isWindowOpen,
  questFriendshipApplies,
  rateFromCampaignValue,
  rateFromCount,
} from './activity.js'
import {
  applyBondBonusesToSlots,
  catalogFromSlots,
  getEffectiveBondBonus,
  groupEventBonusSources,
  liveBondBonusCatalog,
  resolveSlotEventPassives,
} from './bonus.js'

const NOW = 1791000000
const BAKUMATSU = {
  eventId: 80576,
  startedAt: 1790229600,
  endedAt: 1792043999,
}
const EVENT_QUEST = { id: 94061601, eventId: 80576 }
const GRAND_QUEST = { id: 94061699, eventId: 0 }

function extraSkill({
  id,
  name,
  eventId,
  startedAt,
  endedAt,
  rateCount,
  target = 'self',
  condQuestId = 0,
  applySupportSvt,
}) {
  const svals = { RateCount: rateCount, EventId: eventId }
  if (applySupportSvt != null) svals.ApplySupportSvt = applySupportSvt
  return {
    id,
    name,
    extraPassive: [{ eventId, startedAt, endedAt, condQuestId, condQuestPhase: 0 }],
    functions: [
      {
        funcType: 'servantFriendshipUp',
        funcTargetType: target,
        svals: [svals],
      },
    ],
  }
}

function campaignEvent(overrides = {}) {
  return {
    id: 71500,
    name: '牵绊获得量提升',
    type: 'questCampaign',
    startedAt: BAKUMATSU.startedAt,
    endedAt: BAKUMATSU.endedAt,
    campaigns: [
      {
        target: 'questFriendship',
        value: 1200,
        calcType: 'multiplication',
        targetIds: [],
      },
    ],
    campaignQuests: [{ questId: 0, isExcepted: false }],
    ...overrides,
  }
}

{
  assert.equal(rateFromCount(200), 0.2)
  assert.equal(rateFromCount(500), 0.5)
  assert.equal(rateFromCount(50), 0.05)
  assert.equal(rateFromCount(1000), 1)
  assert.equal(rateFromCampaignValue(1200), 0.2)
  assert.equal(rateFromCampaignValue(1300), 0.3)
  assert.equal(rateFromCampaignValue(0), 0)
}

{
  assert.equal(isWindowOpen(BAKUMATSU.startedAt, BAKUMATSU.endedAt, NOW), true)
  assert.equal(isWindowOpen(BAKUMATSU.startedAt, BAKUMATSU.endedAt, BAKUMATSU.startedAt - 1), false)
  assert.equal(isWindowOpen(BAKUMATSU.startedAt, BAKUMATSU.endedAt, BAKUMATSU.endedAt + 1), false)
  assert.equal(isWindowOpen(2145888000, 2145888000, NOW), false)
  assert.equal(isWindowOpen(0, 0, NOW), false)
}

{
  const recs = extractExtraPassives({
    id: 106400,
    extraPassive: [
      extraSkill({
        id: 88001,
        name: '新选组之力 EX',
        eventId: 80576,
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
        rateCount: 500,
      }),
      extraSkill({
        id: 88002,
        name: '过期夏活',
        eventId: 80100,
        startedAt: 1600000000,
        endedAt: 1601000000,
        rateCount: 200,
      }),
      extraSkill({
        id: 970663,
        name: '梦火的引导',
        eventId: 0,
        startedAt: 1,
        endedAt: 2145888000,
        rateCount: 250,
      }),
      extraSkill({
        id: 991234,
        name: '活动礼装技能',
        eventId: 80576,
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
        rateCount: 200,
      }),
    ],
  })
  assert.equal(recs.length, 2)
  assert.equal(recs[0].rate, 0.5)
  assert.equal(recs[0].target, 'self')
  assert.equal(recs[1].eventId, 80100)
  assert.equal(
    recs.some((row) => row.skillId === 970663 || row.skillId === 991234),
    false,
  )
}

{
  const current = extractExtraPassives({
    id: 106400,
    extraPassive: [
      extraSkill({
        id: 88001,
        name: '新选组之力 EX',
        eventId: 80576,
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
        rateCount: 500,
      }),
    ],
  })[0]
  const expired = extractExtraPassives({
    id: 106400,
    extraPassive: [
      extraSkill({
        id: 88002,
        name: '过期夏活',
        eventId: 80100,
        startedAt: 1600000000,
        endedAt: 1601000000,
        rateCount: 200,
      }),
    ],
  })[0]
  assert.equal(extraPassiveApplies(current, EVENT_QUEST, NOW), true)
  assert.equal(extraPassiveApplies(current, GRAND_QUEST, NOW), false)
  assert.equal(extraPassiveApplies(expired, EVENT_QUEST, NOW), false)
  assert.equal(extraPassiveApplies(current, null, NOW), false)
}

{
  const mash = extractExtraPassives({
    id: 800100,
    extraPassive: [
      extraSkill({
        id: 88010,
        name: '幕末之力',
        eventId: 80576,
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
        rateCount: 50,
        target: 'ptFull',
      }),
    ],
  })[0]
  assert.equal(mash.target, 'ptFull')
  assert.equal(mash.rate, 0.05)
}

{
  const story = extractExtraPassives({
    id: 100100,
    extraPassive: [
      extraSkill({
        id: 88100,
        name: '女杰的威风',
        eventId: 80059,
        startedAt: 1500000000,
        endedAt: 2145888000,
        rateCount: 1000,
        condQuestId: 94012345,
      }),
    ],
  })[0]
  assert.equal(isWindowOpen(story.startedAt, story.endedAt, NOW), true)
  assert.equal(extraPassiveApplies(story, { id: 1, eventId: 80059 }, NOW), true)
  assert.equal(extraPassiveApplies(story, EVENT_QUEST, NOW), false)
  assert.equal(extraPassiveApplies(story, GRAND_QUEST, NOW), false)
}

{
  const all = extractQuestFriendships(campaignEvent())[0]
  assert.equal(all.rate, 0.2)
  assert.equal(all.allQuests, true)
  assert.equal(questFriendshipApplies(all, 106400, GRAND_QUEST, NOW), true)
  assert.equal(questFriendshipApplies(all, 106400, EVENT_QUEST, NOW), true)
  assert.equal(questFriendshipApplies(all, 106400, GRAND_QUEST, BAKUMATSU.endedAt + 10), false)

  const listed = extractQuestFriendships(
    campaignEvent({
      campaigns: [
        {
          target: 'questFriendship',
          value: 1300,
          calcType: 'multiplication',
          targetIds: [106400, 306100],
        },
      ],
      campaignQuests: [{ questId: 94061601, isExcepted: false }],
    }),
  )[0]
  assert.equal(listed.rate, 0.3)
  assert.equal(listed.allQuests, false)
  assert.equal(questFriendshipApplies(listed, 106400, EVENT_QUEST, NOW), true)
  assert.equal(questFriendshipApplies(listed, 102700, EVENT_QUEST, NOW), false)
  assert.equal(questFriendshipApplies(listed, 106400, GRAND_QUEST, NOW), false)

  const excepted = extractQuestFriendships(
    campaignEvent({
      campaignQuests: [
        { questId: 0, isExcepted: false },
        { questId: 94061699, isExcepted: true },
      ],
    }),
  )[0]
  assert.equal(questFriendshipApplies(excepted, 106400, EVENT_QUEST, NOW), true)
  assert.equal(questFriendshipApplies(excepted, 106400, GRAND_QUEST, NOW), false)

  assert.deepEqual(extractQuestFriendships({ type: 'eventQuest', campaigns: [] }), [])
  assert.deepEqual(
    extractQuestFriendships(
      campaignEvent({
        campaigns: [{ target: 'questUseFriendshipUpItem', value: 1200, targetIds: [] }],
      }),
    ),
    [],
  )
}

{
  const catalog = {
    extraPassives: extractExtraPassives({
      id: 106400,
      extraPassive: [
        extraSkill({
          id: 88001,
          name: '新选组之力 EX',
          eventId: 80576,
          startedAt: BAKUMATSU.startedAt,
          endedAt: BAKUMATSU.endedAt,
          rateCount: 500,
        }),
        extraSkill({
          id: 88002,
          name: '过期夏活',
          eventId: 80100,
          startedAt: 1600000000,
          endedAt: 1601000000,
          rateCount: 200,
        }),
      ],
    }).concat(
      extractExtraPassives({
        id: 800100,
        extraPassive: [
          extraSkill({
            id: 88010,
            name: '幕末之力',
            eventId: 80576,
            startedAt: BAKUMATSU.startedAt,
            endedAt: BAKUMATSU.endedAt,
            rateCount: 50,
            target: 'ptFull',
          }),
        ],
      }),
    ),
    questFriendships: extractQuestFriendships(campaignEvent()),
  }

  const none = getEffectiveBondBonus({
    servantId: 106400,
    catalog,
    quest: GRAND_QUEST,
    now: NOW,
  })
  assert.equal(none.self, 0)
  assert.equal(none.party, 0)
  assert.equal(none.questCampaign, 0.2)
  assert.equal(none.totalSecondLayer, 0.2)

  const kondo = getEffectiveBondBonus({
    servantId: 106400,
    catalog,
    quest: EVENT_QUEST,
    now: NOW,
  })
  assert.equal(kondo.self, 0.5)
  assert.equal(kondo.party, 0)
  assert.equal(kondo.questCampaign, 0.2)
  assert.equal(kondo.totalSecondLayer, 0.7)
  assert.equal(
    kondo.sources.some((row) => row.type === 'extraPassive' && row.rate === 0.2),
    false,
  )
  assert.deepEqual(
    getEffectiveBondBonus({ servantId: 106400, catalog, quest: EVENT_QUEST, now: NOW }),
    kondo,
  )

  const mash = getEffectiveBondBonus({
    servantId: 800100,
    catalog,
    quest: EVENT_QUEST,
    now: NOW,
  })
  assert.equal(mash.self, 0)
  assert.equal(mash.party, 0.05)
  assert.equal(mash.questCampaign, 0.2)

  const slots = applyBondBonusesToSlots(
    [
      { position: 1, filled: true, svtId: 106400, isSupport: false, eventPassive: 0 },
      { position: 2, filled: true, svtId: 800100, isSupport: false, eventPassive: 0 },
      { position: 6, filled: true, svtId: 102700, isSupport: true, eventPassive: 0 },
    ],
    { catalog, quest: EVENT_QUEST, now: NOW },
  )
  assert.equal(slots[0].eventPassive, 0.75)
  assert.equal(slots[1].eventPassive, 0.25)
  assert.equal(slots[2].eventPassive, 0.2)
  const kondoGroups = groupEventBonusSources(slots[0].eventBonus)
  assert.equal(kondoGroups.self.length, 1)
  assert.equal(kondoGroups.party.length, 1)
  assert.equal(kondoGroups.quest.length, 1)
  assert.equal(kondoGroups.self[0].rate, 0.5)
  assert.equal(kondoGroups.party[0].rate, 0.05)
  assert.equal(kondoGroups.quest[0].rate, 0.2)
  const mashGroups = groupEventBonusSources(slots[1].eventBonus)
  assert.equal(mashGroups.self.length, 0)
  assert.equal(mashGroups.party.length, 1)
  assert.equal(mashGroups.quest.length, 1)
  assert.equal(mashGroups.party[0].rate, 0.05)
  assert.equal(
    slots[1].eventBonus.sources.filter((row) => row.target === 'ptFull').length,
    1,
  )
}

{
  const extraPassives = extractExtraPassives({
    id: 106400,
    extraPassive: [
      extraSkill({
        id: 88001,
        name: '新选组之力 EX',
        eventId: 80576,
        startedAt: BAKUMATSU.startedAt,
        endedAt: BAKUMATSU.endedAt,
        rateCount: 500,
      }),
      extraSkill({
        id: 88002,
        name: '过期夏活',
        eventId: 80100,
        startedAt: 1600000000,
        endedAt: 1601000000,
        rateCount: 200,
      }),
      extraSkill({
        id: 88100,
        name: '女杰的威风',
        eventId: 80059,
        startedAt: 1500000000,
        endedAt: 2145888000,
        rateCount: 1000,
      }),
    ],
  })
  const oldSum = extraPassives
    .filter((passive) => passive.target !== 'ptFull')
    .reduce((sum, passive) => sum + passive.rate, 0)
  assert.equal(oldSum, 1.7)

  const eventBonus = getEffectiveBondBonus({
    servantId: 106400,
    extraPassives,
    quest: EVENT_QUEST,
    now: NOW,
  })
  assert.equal(eventBonus.self, 0.5)
  assert.equal(eventBonus.totalSecondLayer, 0.5)

  const grandBonus = getEffectiveBondBonus({
    servantId: 106400,
    extraPassives,
    quest: GRAND_QUEST,
    now: NOW,
  })
  assert.equal(grandBonus.self, 0)

  const storyBonus = getEffectiveBondBonus({
    servantId: 106400,
    extraPassives,
    quest: { id: 94012345, eventId: 80059 },
    now: NOW,
  })
  assert.equal(storyBonus.self, 1)

  const slots = [
    {
      position: 1,
      filled: true,
      svtId: 106400,
      isSupport: false,
      extraPassives,
      eventPassive: oldSum,
    },
    {
      position: 2,
      filled: true,
      svtId: 102700,
      isSupport: false,
      eventPassive: 0.2,
    },
  ]
  assert.deepEqual(catalogFromSlots(slots).extraPassives, extraPassives)
  resolveSlotEventPassives(slots, { quest: EVENT_QUEST, now: NOW })
  assert.equal(slots[0].eventPassive, 0.5)
  assert.equal(slots[1].eventPassive, 0.2)

  resolveSlotEventPassives(slots, { quest: GRAND_QUEST, now: NOW })
  assert.equal(slots[0].eventPassive, 0)
  assert.equal(slots[1].eventPassive, 0.2)
}

{
  const shipped = JSON.parse(readFileSync(new URL('../data/bond-bonuses.json', import.meta.url), 'utf8'))
  assert.ok(Array.isArray(shipped.extraPassives))
  assert.ok(Array.isArray(shipped.questFriendships))
  assert.equal(shipped.extraPassives.some((rec) => rec.skillId === 970663), false)
  assert.equal(shipped.extraPassives.some((rec) => rec.skillId >= 990000 && rec.skillId < 1000000), false)
}

{
  const catalog = {
    extraPassives: [],
    questFriendships: extractQuestFriendships(campaignEvent()),
  }
  const all = catalog.questFriendships[0]
  assert.equal(all.allQuests, true)
  assert.deepEqual(all.targetIds, [])

  const slot = {
    position: 1,
    filled: true,
    svtId: 106400,
    isSupport: false,
    eventPassive: 0,
  }
  resolveSlotEventPassives([slot], { catalog, quest: GRAND_QUEST, now: NOW })
  assert.equal(slot.eventPassive, 0.2)
  const out = calcParty(815, false, [slot])
  assert.equal(out.results[0].afterFront, 978)
  assert.equal(out.results[0].final, 1173)

  const listed = {
    extraPassives: [],
    questFriendships: extractQuestFriendships(
      campaignEvent({
        campaigns: [
          {
            target: 'questFriendship',
            value: 1300,
            calcType: 'multiplication',
            targetIds: [106400],
          },
        ],
        campaignQuests: [{ questId: 94061601, isExcepted: false }],
      }),
    ),
  }
  const kondo = { position: 1, filled: true, svtId: 106400, isSupport: false, eventPassive: 0 }
  const other = { position: 2, filled: true, svtId: 102700, isSupport: false, eventPassive: 0 }
  resolveSlotEventPassives([kondo, other], { catalog: listed, quest: EVENT_QUEST, now: NOW })
  assert.equal(kondo.eventPassive, 0.3)
  assert.equal(other.eventPassive, 0)
  resolveSlotEventPassives([kondo], { catalog: listed, quest: GRAND_QUEST, now: NOW })
  assert.equal(kondo.eventPassive, 0)

  const excepted = {
    extraPassives: [],
    questFriendships: extractQuestFriendships(
      campaignEvent({
        campaignQuests: [
          { questId: 0, isExcepted: false },
          { questId: GRAND_QUEST.id, isExcepted: true },
        ],
      }),
    ),
  }
  const a = { position: 1, filled: true, svtId: 106400, isSupport: false, eventPassive: 0 }
  resolveSlotEventPassives([a], { catalog: excepted, quest: EVENT_QUEST, now: NOW })
  assert.equal(a.eventPassive, 0.2)
  resolveSlotEventPassives([a], { catalog: excepted, quest: GRAND_QUEST, now: NOW })
  assert.equal(a.eventPassive, 0)

  const stacked = {
    extraPassives: extractExtraPassives({
      id: 106400,
      extraPassive: [
        extraSkill({
          id: 88001,
          name: '新选组之力 EX',
          eventId: 80576,
          startedAt: BAKUMATSU.startedAt,
          endedAt: BAKUMATSU.endedAt,
          rateCount: 500,
        }),
      ],
    }),
    questFriendships: extractQuestFriendships(campaignEvent()),
  }
  const both = {
    position: 1,
    filled: true,
    svtId: 106400,
    isSupport: false,
    extraPassives: stacked.extraPassives,
    eventPassive: 0,
  }
  resolveSlotEventPassives([both], { catalog: stacked, quest: EVENT_QUEST, now: NOW })
  assert.equal(both.eventPassive, 0.7)
  const stackedOut = calcParty(815, false, [both])
  assert.equal(stackedOut.results[0].afterFront, 978)
  assert.equal(stackedOut.results[0].final, 1662)

  const restored = { position: 1, filled: true, svtId: 106400, isSupport: false, eventPassive: 0 }
  resolveSlotEventPassives([restored], {
    catalog: { extraPassives: [], questFriendships: [] },
    quest: GRAND_QUEST,
    now: NOW,
  })
  assert.equal(restored.eventPassive, 0)
  const plain = calcParty(815, false, [restored])
  assert.equal(plain.results[0].final, 978)
}

{
  const empty = groupEventBonusSources(null)
  assert.deepEqual(empty, { self: [], party: [], quest: [] })
  const duped = groupEventBonusSources({
    sources: [
      { type: 'extraPassive', eventId: 80576, skillId: 1, rate: 0.5, target: 'self', name: '自身' },
      { type: 'extraPassive', eventId: 80576, skillId: 1, rate: 0.5, target: 'self', name: '自身重复' },
      { type: 'extraPassive', eventId: 80576, skillId: 2, rate: 0.05, target: 'ptFull', name: '全队' },
      { type: 'questFriendship', eventId: 80576, skillId: 0, rate: 0.2, target: 'self', name: '关卡' },
    ],
  })
  assert.equal(duped.self.length, 1)
  assert.equal(duped.party.length, 1)
  assert.equal(duped.quest.length, 1)
  assert.equal(duped.self[0].name, '自身')
}

{
  const leftover = {
    position: 1,
    filled: true,
    svtId: 106400,
    isSupport: false,
    eventPassive: 0.5,
    customPercent: 0.2,
  }
  applyBondBonusesToSlots([leftover], {
    catalog: { extraPassives: [], questFriendships: [] },
    quest: GRAND_QUEST,
    now: NOW,
  })
  assert.equal(leftover.eventPassive, 0)
  assert.equal(leftover.customPercent, 0.2)
  assert.deepEqual(groupEventBonusSources(leftover.eventBonus), { self: [], party: [], quest: [] })
}

{
  const catalog = {
    extraPassives: extractExtraPassives({
      id: 102700,
      extraPassive: [
        extraSkill({
          id: 88020,
          name: '新选组之力',
          eventId: 80576,
          startedAt: BAKUMATSU.startedAt,
          endedAt: BAKUMATSU.endedAt,
          rateCount: 200,
        }),
      ],
    }),
    questFriendships: [],
  }
  const okita = getEffectiveBondBonus({
    servantId: 102700,
    catalog,
    quest: EVENT_QUEST,
    now: NOW,
  })
  assert.equal(okita.self, 0.2)
  assert.equal(okita.party, 0)
  assert.equal(okita.questCampaign, 0)
  assert.equal(okita.totalSecondLayer, 0.2)
  const slot = { position: 1, filled: true, svtId: 102700, isSupport: false, eventPassive: 0 }
  resolveSlotEventPassives([slot], { catalog, quest: EVENT_QUEST, now: NOW })
  assert.equal(slot.eventPassive, 0.2)
  const out = calcParty(815, false, [slot])
  assert.equal(out.results[0].afterFront, 978)
  assert.equal(out.results[0].final, 1173)
  resolveSlotEventPassives([slot], { catalog, quest: GRAND_QUEST, now: NOW })
  assert.equal(slot.eventPassive, 0)
}

{
  const catalog = JSON.parse(readFileSync(new URL('../data/bond-bonuses.json', import.meta.url), 'utf8'))
  const liveGrand = liveBondBonusCatalog(catalog, GRAND_QUEST, NOW)
  assert.equal(liveGrand.extraPassives.length, 0)
  const liveEvent = liveBondBonusCatalog(catalog, EVENT_QUEST, NOW)
  assert.ok(liveEvent.extraPassives.length > 0)
  assert.ok(liveEvent.extraPassives.length < catalog.extraPassives.length)
  assert.ok(liveEvent.extraPassives.every((rec) => rec.eventId === 80576))
}
