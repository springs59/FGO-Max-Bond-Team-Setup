import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { browseQuests, decorateQuest, questCategory, questContent, questRepeatability, questWindow, questTags, rememberQuest, loadRecentQuests, saveRecentQuests } from './quest-browser.js'
import { buildQuestBrowserIndex } from '../../scripts/build-quest-browser-index.mjs'
import { slimQuests } from '../game-data.js'

const now = 150
const story = { id: 1, phase: 2, type: 'main', name: '第十话 池田屋', war: '新选组', eventId: 7, bond: 165, openedAt: 100, closedAt: 200, afterClear: 'close' }
const farm = { ...story, id: 2, type: 'event', name: '神剑改 黄金剑', spot: '京都', bond: 815, afterClear: 'repeatLast' }
const history = { ...farm, id: 3, closedAt: 120 }
const future = { ...farm, id: 4, openedAt: 160 }
const free = { id: 5, phase: 1, type: 'free', name: '王城', war: '阿瓦隆', openedAt: 1, closedAt: 2145888000, bond: 855, afterClear: 'repeatFirst' }
const unknown = { ...farm, id: 6, afterClear: '' }
const daily = { ...farm, id: 7, war: '每日任务', name: '剑之修炼场 极级', display: '剑之修炼场 极级' }
assert.equal(questCategory(story), 'event')
assert.deepEqual(questContent(story), ['story', '活动主线'])
assert.deepEqual(questContent(farm), ['farm', '活动周回'])
assert.deepEqual(questRepeatability(story), ['once', '一次通关'])
assert.deepEqual(questRepeatability(farm), ['repeat', '可反复挑战'])
assert.equal(questRepeatability(unknown)[0], 'unknown')
assert.equal(questCategory(daily), 'daily')
assert.equal(questWindow(history, now)[0], 'expired')
assert.equal(questWindow(future, now)[0], 'future')
assert.equal(questWindow(farm, now)[0], 'limited')
const list = [story, farm, history, future, free, unknown, daily]
const internal = { ...farm, spot: '主线设定用', name: 'bbe4e', ap: 999 }
const scene = { ...story, flags: ['noBattle'] }
assert.deepEqual(browseQuests([internal, scene], { scope: 'all', now }), [])
assert.deepEqual(slimQuests([internal, { ...internal, spot: 'メイン設定用' }, scene]), [])
assert.equal(slimQuests([{ ...story, ap: 0 }]).length, 1, 'zero AP battles remain selectable')
assert.deepEqual(browseQuests(list, { category: 'event', content: 'farm', now }).map(q => q.id), [2])
assert.deepEqual(browseQuests(list, { category: 'main', now }).map(q => q.id), [1])
assert.deepEqual(browseQuests(list, { category: 'once', now }).map(q => q.id), [1])
assert.deepEqual(browseQuests(list, { query: '京都 815', category: 'event', now }).map(q => q.id), [2, 6])
assert.equal(browseQuests(list, { category: 'event', scope: 'all', now }).length, 5)
assert.equal(browseQuests(list, { category: 'free', war: '阿瓦隆', now }).length, 1)
const index = buildQuestBrowserIndex([farm], [farm, story], { region: 'CN', quests: { 1: story } })
assert.equal(index.quests[1].afterClear, 'close')
assert.equal(decorateQuest({ ...farm, afterClear: undefined }, index).afterClear, 'repeatLast')
assert.equal(decorateQuest({ id: 2 }, index, 'JP').afterClear, undefined)
// JP's 2030 long-term sentinel used to be treated as a running event; CN's
// corresponding 2038 sentinel was excluded, producing inconsistent lists.
const permanent = { id: 9, phase: 1, region: 'JP', type: 'event', name: 'bbe4e',
  eventId: 80292, war: 'メイン・インタールード 深海電脳楽土 SE.RA.PH',
  openedAt: 1, closedAt: 1901199599, afterClear: 'repeatLast', bond: 515,
  releaseConditions: [{ type: 'purchaseShop', targetId: 6000420 }, { type: 'questClear', targetId: 1000822 }] }
assert.equal(questCategory(permanent), 'permanent')
assert.equal(questWindow(permanent, now)[0], 'permanent')
assert.equal(browseQuests([permanent], { category: 'event', now }).length, 0)
assert.equal(browseQuests([permanent], { category: 'permanent', now }).length, 1)
assert.ok(questTags(permanent).includes('含购买 / 兑换条件'))
assert.ok(questTags(permanent).includes('账号解锁未核验'))
const mainRaid = { ...permanent, id: 10, war: '終章', availabilityKind: 'main-story', afterClear: 'close' }
assert.equal(questCategory(mainRaid), 'main')
assert.equal(questWindow(mainRaid, now)[0], 'permanent')
assert.equal(browseQuests([mainRaid], { category: 'event', now }).length, 0)
const regionalIndex = buildQuestBrowserIndex([{ ...permanent, warId: 9088 }], [permanent], null, 'JP', {
  wars: [{ id: 9088, eventId: 80292, flags: ['isEvent'] }],
  warDetails: [{ id: 9088, parentWarId: 1004 }],
  events: [{ id: 80292, endedAt: 1893423600 }],
  questDetails: [{ id: 9, releaseConditions: permanent.releaseConditions }],
})
assert.equal(regionalIndex.quests[9].availabilityKind, 'main-interlude')
assert.equal(regionalIndex.quests[9].releaseConditions[0].type, 'purchaseShop')
assert.equal(buildQuestBrowserIndex([], [permanent], regionalIndex, 'CN').quests[9], undefined)
assert.deepEqual(rememberQuest(['1:2', '2:2'], story), ['1:2', '2:2'])
const store = { data: new Map(), getItem(key) { return this.data.get(key) }, setItem(key, value) { this.data.set(key, value) } }
assert.equal(saveRecentQuests(['1:2'], 'CN', store), true)
assert.deepEqual(loadRecentQuests('CN', store), ['1:2'])
assert.deepEqual(loadRecentQuests('JP', store), [])
assert.equal(saveRecentQuests([], 'CN', { setItem() { throw new Error('blocked') } }), false)
const actual = JSON.parse(readFileSync(new URL('../data/quests.json', import.meta.url)))
const meta = JSON.parse(readFileSync(new URL('../../generated/quest-browser-index.json', import.meta.url)))
for (const quest of actual) {
  if (quest.type === 'grand') continue
  assert.ok(meta.quests[quest.id], `missing browser metadata: ${quest.id}`)
  assert.ok(['close', 'closeDisp', 'repeatFirst', 'repeatLast', 'resetInterval'].includes(meta.quests[quest.id].afterClear))
}
console.log('quest browser: source classification, phase identity, windows, search, recent choices and snapshot coverage passed')
