import assert from 'node:assert/strict'
import {
  collapseQuests,
  eventWars,
  grandQuestCatalog,
  keepLatestPhases,
  liveLimitedEventWars,
  liveQuestsOfKind,
  mergeGrandQuests,
  questDisplayName,
  questLimits,
  questGroupLabel,
  questKindOf,
  questSelectGroups,
  findCascadeQuest,
  slimQuests,
  snapshotQuests,
  stampEventQuests,
  visibleQuestKinds,
} from './game-data.js'
import { searchQuests } from './atlas.js'

assert.equal(questDisplayName('每日替换 狂之修炼场 上级'), '狂之修炼场 上级')
assert.equal(questDisplayName('周三 狂之修炼场 上级'), '狂之修炼场 上级')
assert.equal(questDisplayName('【4周年纪念】周三 狂之修炼场 上级'), '狂之修炼场 上级')
assert.equal(questDisplayName('1100万纪念 周三 狂之修炼场 上级'), '狂之修炼场 上级')
assert.equal(questDisplayName('每日替换 宝物库 极级'), '宝物库 极级')
assert.equal(questDisplayName('打开宝物库之门 上级'), '宝物库 上级')
assert.equal(questDisplayName('周日 打开宝物库之门 极级'), '宝物库 极级')

const now = 1_700_000_000
const raw = [
  {
    id: 100,
    phase: 1,
    name: '宅邸残迹',
    spotName: '未确认坐标Ｘ－Ａ',
    warLongName: '特異点F',
    type: 'free',
    consume: 4,
    bond: 130,
    openedAt: 1,
    closedAt: 9_999_999_999,
  },
  {
    id: 100,
    phase: 3,
    name: '宅邸残迹',
    spotName: '未确认坐标Ｘ－Ａ',
    warLongName: '特異点F',
    type: 'free',
    consume: 4,
    bond: 415,
    openedAt: 1,
    closedAt: 9_999_999_999,
  },
  {
    id: 94004315,
    phase: 1,
    name: '周三 狂之修炼场 上级',
    spotName: '每日任务',
    warLongName: '每日任务',
    type: 'event',
    consume: 30,
    bond: 5690,
    openedAt: 1,
    closedAt: 10,
  },
  {
    id: 94006815,
    phase: 1,
    name: '每日替换 狂之修炼场 上级',
    spotName: '每日任务',
    warLongName: '每日任务',
    type: 'event',
    consume: 30,
    bond: 5690,
    openedAt: 1,
    closedAt: 9_999_999_999,
  },
  {
    id: 94066103,
    phase: 1,
    name: '每日替换 狂之修炼场 极级',
    spotName: '每日任务',
    warLongName: '每日任务',
    type: 'event',
    consume: 40,
    bond: 29690,
    openedAt: 1,
    closedAt: 9_999_999_999,
  },
  {
    id: 94006828,
    phase: 1,
    name: '每日替换 暗之修炼场 超级',
    spotName: '每日任务',
    warLongName: '每日任务',
    type: 'event',
    consume: 40,
    bond: 15690,
    openedAt: 1,
    closedAt: 9_999_999_999,
  },
  {
    id: 94007003,
    phase: 1,
    name: '打开宝物库之门 上级',
    spotName: '每日任务',
    warLongName: '每日任务',
    type: 'event',
    consume: 30,
    bond: 5690,
    openedAt: 1,
    closedAt: 9_999_999_999,
  },
]

const slim = slimQuests(raw)
assert.equal(keepLatestPhases(slim).find((quest) => quest.id === 100).phase, 3)
assert.equal(keepLatestPhases(slim).find((quest) => quest.id === 100).bond, 415)

const shot = snapshotQuests(raw, now)
assert.equal(shot.filter((quest) => quest.display === '狂之修炼场 上级').length, 1)
assert.equal(shot.find((quest) => quest.display === '狂之修炼场 上级').id, 94006815)

const upper = searchQuests(shot, '狂之修炼场 上级', now)
assert.equal(upper[0].id, 94006815)
assert.equal(upper[0].bond, 5690)
assert.equal(upper[0].display, '狂之修炼场 上级')

const extreme = searchQuests(shot, '狂之修炼场 极级', now)
assert.equal(extreme[0].bond, 29690)

const assassin = searchQuests(shot, '杀之修炼场', now)
assert.equal(assassin[0].display, '暗之修炼场 超级')

const assassinUpper = searchQuests(shot, '杀之修炼场 超级', now)
assert.equal(assassinUpper[0].display, '暗之修炼场 超级')

const vault = searchQuests(shot, '宝物库 上级', now)
assert.equal(vault[0].display, '宝物库 上级')
assert.equal(vault[0].bond, 5690)

const xa = searchQuests(shot, 'X-A', now)
assert.equal(xa[0].bond, 415)
assert.equal(xa[0].spot, '未确认坐标Ｘ－Ａ')

const free = searchQuests(shot, '宅邸残迹', now)
assert.equal(free[0].bond, 415)
assert.equal(free[0].phase, 3)

assert.equal(collapseQuests(slim, now).find((quest) => quest.display === '狂之修炼场 上级').id, 94006815)

assert.deepEqual(questLimits({ display: '狂之修炼场 上级' }), { questType: 'normal', questClass: 'berserker' })
assert.deepEqual(questLimits({ display: '暗之修炼场 超级' }), { questType: 'normal', questClass: 'assassin' })
assert.deepEqual(questLimits({ display: '宝物库 极级' }), { questType: 'normal', questClass: '' })
assert.deepEqual(questLimits({ display: '宅邸残迹' }), { questType: 'normal', questClass: '' })
assert.equal(questLimits({ display: '剑阶 100★★★', name: '冠位研钻战' }).questType, 'grand')
assert.equal(questLimits({ display: '剑阶 100★★★', name: '冠位研钻战' }).questClass, 'saber')

const grand = grandQuestCatalog()
assert.equal(grand.length, 9)
assert.equal(grand[0].display, '冠位研钻战 剑 100★★★')
assert.equal(grand[0].bond, 4748)
assert.deepEqual(questLimits(grand[0]), { questType: 'grand', questClass: 'saber' })
assert.deepEqual(questLimits(grand.find((quest) => quest.questClass === 'extra1')), { questType: 'grand', questClass: 'extra1' })

const mixed = mergeGrandQuests(shot)
const saberGrand = searchQuests(mixed, '冠位战 剑', now)
assert.equal(saberGrand[0].questClass, 'saber')
assert.equal(saberGrand[0].bond, 4748)
assert.equal(searchQuests(mixed, '冠位研钻战 Extra I', now)[0].questClass, 'extra1')

assert.equal(questGroupLabel({ display: '狂之修炼场 上级' }), '每日修炼场')
assert.equal(questGroupLabel({ display: '宝物库 极级' }), '宝物库')
assert.equal(questGroupLabel({ display: '宅邸残迹', war: '特異点F' }), '特異点F')
const groups = questSelectGroups(mixed)
assert.equal(groups[0].label, '每日修炼场')
assert.equal(groups.find((group) => group.label === '冠位研钻战').quests.length, 9)
assert.ok(groups[0].quests.some((quest) => quest.display === '狂之修炼场 上级'))

assert.equal(questKindOf({ display: '狂之修炼场 上级' }), 'train')
assert.equal(findCascadeQuest(mixed, { kind: 'train', questClass: 'berserker', diff: '上级' }).bond, 5690)
assert.equal(findCascadeQuest(mixed, { kind: 'vault', diff: '上级' }).display, '宝物库 上级')
assert.equal(findCascadeQuest(mixed, { kind: 'grand', questClass: 'saber' }).bond, 4748)

{
  const live = { id: 2, display: '同名关', ap: 20, bond: 100, phase: 1, openedAt: 1, closedAt: 0 }
  const closed = { id: 1, display: '同名关', ap: 20, bond: 100, phase: 1, openedAt: 1, closedAt: 5 }
  const merged = collapseQuests([closed, live], 10)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 2)
}

{
  const a = { id: 1, display: '同名关', ap: 20, bond: 100, phase: 1, openedAt: 1, closedAt: 0 }
  const bond = { id: 2, display: '同名关', ap: 20, bond: 200, phase: 1, openedAt: 1, closedAt: 0 }
  const ap = { id: 3, display: '同名关', ap: 40, bond: 100, phase: 1, openedAt: 1, closedAt: 0 }
  const phase = { id: 4, display: '同名关', ap: 20, bond: 100, phase: 3, openedAt: 1, closedAt: 0 }
  assert.equal(collapseQuests([a, bond], 10).length, 2)
  assert.equal(collapseQuests([a, ap], 10).length, 2)
  assert.equal(collapseQuests([a, phase], 10).length, 2)
}

{
  const now = 1_790_400_000
  const eventsNice = [
    { id: 80576, type: 'eventQuest', name: '幕末\n新选组', startedAt: 1790229600, endedAt: 1792043999, warIds: [9194] },
    { id: 80059, type: 'eventQuest', name: '雅戈泰', startedAt: 1, endedAt: 2145888000, warIds: [100] },
    { id: 71267, type: 'questCampaign', name: '加成', startedAt: 1, endedAt: 1792043999, warIds: [200] },
  ]
  const wars = liveLimitedEventWars(eventsNice, now)
  assert.equal(wars.length, 1)
  assert.equal(wars[0].eventId, 80576)
  assert.equal(wars[0].warId, 9194)
  assert.equal(wars[0].name, '幕末 新选组')
  assert.equal(liveLimitedEventWars(eventsNice, 1792044000).length, 0)

  const raw = stampEventQuests(
    [
      {
        id: 94149320,
        phase: 1,
        name: '神剑改 贯穿心脏之枪',
        spotName: '京都城区',
        warLongName: 'JP war',
        type: 'event',
        consume: 40,
        bond: 815,
        openedAt: 1790229600,
        closedAt: 1792043999,
      },
      {
        id: 94149301,
        phase: 1,
        name: '第一话',
        spotName: '京都城区',
        warLongName: 'JP war',
        type: 'main',
        consume: 0,
        bond: 0,
        openedAt: 1790229600,
        closedAt: 1792043999,
      },
    ],
    wars[0],
  )
  const shot = snapshotQuests(raw, now)
  assert.equal(shot.length, 1)
  assert.equal(shot[0].eventId, 80576)
  assert.equal(shot[0].war, '幕末 新选组')
  assert.equal(questKindOf(shot[0]), 'event')
  assert.equal(questKindOf({ display: '狂之修炼场 上级', eventId: 80576, closedAt: 1792043999 }), 'train')
  assert.equal(
    questKindOf({ display: '宅邸残迹', war: '特異点F', eventId: 80059, closedAt: 2145888000 }),
    'free',
  )
  assert.deepEqual(visibleQuestKinds(shot, now).map((row) => row[0]).includes('event'), true)
  assert.equal(visibleQuestKinds(shot, 1792044000).some((row) => row[0] === 'event'), false)
  assert.equal(liveQuestsOfKind(shot, 'event', now).length, 1)
  assert.equal(liveQuestsOfKind(shot, 'event', 1792044000).length, 0)
  assert.deepEqual(eventWars(shot, now), ['幕末 新选组'])
  assert.equal(findCascadeQuest(shot, { kind: 'event', key: '94149320:1' }, now).bond, 815)
  assert.equal(findCascadeQuest(shot, { kind: 'event', key: '94149320:1' }, 1792044000), null)
}

