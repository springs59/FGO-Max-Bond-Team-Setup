import assert from 'node:assert/strict'
import { formatServantNames, renderQuestBonusHtml, summarizeQuestBondBonuses } from './quest-bonus.js'

const live = {
  extraPassives: [
    { servantId: 102700, name: '幕末武斗力量 A', target: 'self', rate: 0.2, skillId: 940408 },
    { servantId: 104400, name: '幕末武斗力量 A', target: 'self', rate: 0.2, skillId: 940408 },
    { servantId: 106400, name: '幕末武斗力量 EX', target: 'self', rate: 0.5, skillId: 940407 },
    { servantId: 306100, name: '幕末武斗力量 EX', target: 'self', rate: 0.5, skillId: 940407 },
    { servantId: 800100, name: '幕末武斗力量 B', target: 'ptFull', rate: 0.05, skillId: 940409 },
  ],
  questFriendships: [],
}

const names = {
  102700: '冲田总司',
  104400: '斋藤一',
  106400: '近藤勇',
  306100: '原田左之助',
  800100: '玛修·基列莱特',
}

{
  const summary = summarizeQuestBondBonuses(live)
  assert.equal(summary.extraGroups.length, 3)
  assert.equal(summary.extraGroups[0].target, 'ptFull')
  assert.equal(summary.extraGroups[0].rate, 0.05)
  assert.deepEqual(summary.extraGroups[0].servantIds, [800100])
  assert.equal(summary.extraGroups[1].rate, 0.5)
  assert.deepEqual(summary.extraGroups[1].servantIds, [106400, 306100])
  assert.equal(summary.extraGroups[2].rate, 0.2)
  assert.deepEqual(summary.extraGroups[2].servantIds, [102700, 104400])
}

{
  const html = renderQuestBonusHtml(live, (id) => names[id])
  assert.match(html, /该本加成/)
  assert.match(html, /全队/)
  assert.match(html, /玛修·基列莱特/)
  assert.match(html, /\+5%/)
  assert.match(html, /活动从者自身/)
  assert.match(html, /近藤勇/)
  assert.match(html, /原田左之助/)
  assert.match(html, /\+50%/)
  assert.match(html, /冲田总司/)
  assert.match(html, /斋藤一/)
  assert.match(html, /\+20%/)
}

{
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  assert.equal(formatServantNames(ids, (id) => `n${id}`, 8), 'n1、n2、n3、n4、n5、n6、n7、n8 等9人')
}

{
  const empty = renderQuestBonusHtml({ extraPassives: [], questFriendships: [] }, () => '')
  assert.match(empty, /该本无额外活动羁绊加成/)
}

console.log('quest-bonus.test.js ok')
