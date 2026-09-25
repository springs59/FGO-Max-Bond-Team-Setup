import assert from 'node:assert/strict'
import {
  buildBonusIndex,
  buildCandidateIndex,
  buildQuestIndex,
  buildServantIndex,
  buildSolverMeta,
  classifyCeKinds,
  solverIndexPublishDecision,
} from './indexes.js'

{
  const quests = [
    {
      id: 1,
      phase: 1,
      display: '狂之修炼场 上级',
      name: '狂之修炼场 上级',
      war: '每日',
      bond: 815,
      ap: 40,
      openedAt: 1,
      closedAt: 2145888000,
    },
    {
      id: 83951001,
      display: '冠位研钻战 剑 100★★★',
      name: '冠位研钻战 剑 100★★★',
      type: 'grand',
      questType: 'grand',
      questClass: 'saber',
      bond: 4748,
      openedAt: 1,
      closedAt: 2145888000,
    },
  ]
  const rows = buildQuestIndex({ quests, now: 1_800_000_000 })
  assert.equal(rows[0].kind, 'train')
  assert.equal(rows[0].questClass, 'berserker')
  assert.equal(rows[0].available, 1)
  assert.equal(rows[1].kind, 'grand')
  assert.equal(rows[1].questType, 'grand')
}

{
  const now = 1_790_000_000
  const bag = {
    extraPassives: [
      {
        servantId: 11,
        eventId: 80576,
        skillId: 1,
        rate: 0.2,
        target: 'self',
        name: 'current',
        startedAt: now - 10,
        endedAt: now + 10,
      },
      {
        servantId: 12,
        eventId: 1,
        skillId: 2,
        rate: 0.5,
        target: 'self',
        name: 'history',
        startedAt: now - 1000,
        endedAt: now - 100,
      },
      {
        servantId: 1,
        eventId: 80576,
        skillId: 3,
        rate: 0.05,
        target: 'ptFull',
        name: 'mash',
        startedAt: now - 10,
        endedAt: now + 10,
      },
    ],
    questFriendships: [
      {
        eventId: 9,
        name: 'campaign',
        rate: 0.2,
        allQuests: true,
        questIds: [],
        exceptedQuestIds: [99],
        targetIds: [],
        startedAt: now - 10,
        endedAt: now + 10,
      },
    ],
    events: [{ id: 80576, name: '幕末', startedAt: now - 10, endedAt: now + 10 }],
  }
  const bonuses = buildBonusIndex({ bondBonuses: bag, now })
  assert.ok(bonuses.selfBySvt[11])
  assert.equal(bonuses.selfBySvt[12], undefined)
  assert.ok(bonuses.partyBySvt[1])
  assert.equal(bonuses.questFriendship.length, 1)
  assert.equal(bonuses.events.length, 1)
}

{
  const servantIndex = buildServantIndex({
    servants: [
      { id: 11, collectionNo: 11, className: 'saber', attribute: 'earth', rarity: 3, cost: 7, traitIds: [] },
      { id: 12, collectionNo: 12, className: 'ruler', attribute: 'star', rarity: 5, cost: 16, traitIds: [] },
    ],
    formsOf: (svt) => [{ key: 'default', name: '默认', traitIds: [], cost: svt.cost }],
  })
  assert.equal(servantIndex.servants.length, 2)
  assert.equal(servantIndex.servants[1].extra, 1)
  const ces = [
    { id: 1, kinds: classifyCeKinds({ mlb: { rate: 200 }, portrait: 0, svtBond: 0 }) },
    { id: 2, kinds: classifyCeKinds({ mlb: { rate: 50, followerRate: 150 }, portrait: 0, svtBond: 0 }) },
  ]
  const bonuses = { selfBySvt: { 11: [{ rate: 0.2 }] }, partyBySvt: {} }
  const cand = buildCandidateIndex({
    servants: servantIndex.servants,
    ces,
    bonuses,
    quests: [{ id: 1, kind: 'train' }],
  })
  assert.deepEqual(cand.byClass.saber, [11])
  assert.deepEqual(cand.byClass.extra1, [12])
  assert.ok(cand.byCeKind.bond20.includes(1))
  assert.ok(cand.byCeKind.tea.includes(2))
  assert.deepEqual(cand.byBonusSelf, [11])
  assert.deepEqual(cand.byQuestKind.train, [1])
}

{
  const meta = buildSolverMeta({
    index: {
      schemaVersion: 2,
      solverIndexVersion: 2,
      sourceVersion: 'atlas-cn',
      gameDataVersion: 't',
      builtAt: '2026-09-25T00:00:00.000Z',
      servantCount: 1,
      ceCount: 2,
      formCount: 3,
      quests: [1],
    },
    durationMs: 12,
    checksum: 'abc',
  })
  assert.equal(meta.checksum, 'abc')
  assert.equal(meta.buildDurationMs, 12)
  assert.equal(meta.questCount, 1)
  const fail = solverIndexPublishDecision({ ok: false, errors: ['x'] })
  assert.equal(fail.publish, false)
  assert.equal(fail.keepPrevious, true)
  const ok = solverIndexPublishDecision({ ok: true })
  assert.equal(ok.publish, true)
}

console.log('solver indexes tests passed')
