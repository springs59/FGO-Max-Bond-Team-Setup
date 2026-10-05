import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { browseQuests, decorateQuest, questCategory, questContent, questRepeatability, questWindow, rememberQuest, loadRecentQuests, saveRecentQuests } from './quest-browser.js'
import { buildQuestBrowserIndex } from '../../scripts/build-quest-browser-index.mjs'

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
assert.deepEqual(browseQuests(list, { category: 'event', content: 'farm', now }).map(q => q.id), [2])
assert.deepEqual(browseQuests(list, { category: 'main', now }).map(q => q.id), [1])
assert.deepEqual(browseQuests(list, { category: 'once', now }).map(q => q.id), [1])
assert.deepEqual(browseQuests(list, { query: '京都 815', category: 'event', now }).map(q => q.id), [2, 6])
assert.equal(browseQuests(list, { category: 'event', scope: 'all', now }).length, 5)
assert.equal(browseQuests(list, { category: 'free', war: '阿瓦隆', now }).length, 1)
const index = buildQuestBrowserIndex([farm], [farm, story], { quests: { 1: story } })
assert.equal(index.quests[1].afterClear, 'close')
assert.equal(decorateQuest({ ...farm, afterClear: undefined }, index).afterClear, 'repeatLast')
assert.equal(decorateQuest({ id: 2 }, index, 'JP').afterClear, undefined)
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
