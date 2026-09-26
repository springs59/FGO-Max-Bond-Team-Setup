import assert from 'node:assert/strict'
import { renderBonusList } from './bonus-list.js'
import { layoutMode, shellClass } from './responsive-layout.js'

assert.equal(layoutMode(1440, 900), 'pc')
assert.equal(layoutMode(800, 1024), 'tablet-portrait')
assert.equal(layoutMode(1024, 800), 'tablet-landscape')
assert.equal(layoutMode(390, 844), 'phone-portrait')
assert.equal(layoutMode(640, 360), 'phone-landscape')

assert.equal(shellClass('pc'), 'app-shell pc')
assert.equal(shellClass('pc', { hasDetail: true }), 'app-shell pc has-detail')
assert.equal(shellClass('phone-portrait', { hasDetail: true }), 'app-shell phone has-detail')
assert.equal(shellClass('tablet-portrait'), 'app-shell tablet portrait')

const live = renderBonusList(
  [
    {
      name: '幕末武斗',
      partyBonus: 0.5,
      source: 'extraPassive',
      startedAt: 1790229600,
      endedAt: 1792043999,
      active: true,
    },
  ],
  '可以吃到',
)
assert.match(live, /活动被动/)
assert.match(live, /全队/)
assert.match(live, /\+50%/)
assert.match(live, /生效/)
assert.doesNotMatch(live, /1790229600/)
assert.match(live, /~/)

const always = renderBonusList([{ name: '午餐', selfBonus: 0.1, source: 'craftEssence', active: true }], '礼装')
assert.match(always, /常驻/)
assert.match(always, /礼装/)

const story = renderBonusList(
  [{ name: '女杰的威风', selfBonus: 1, source: 'extraPassive', startedAt: 946656000, endedAt: 2145888000, active: true }],
  '可以吃到',
)
assert.match(story, /常驻/)
assert.doesNotMatch(story, /2038/)
