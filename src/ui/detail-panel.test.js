import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderDetailPanel } from './detail-panel.js'

const html = renderDetailPanel({
  detail: { kind: 'svt', id: 100100 },
  servants: [{ id: 100100, name: '阿尔托莉雅', className: 'Saber' }],
  tab: 'recv',
})

assert.match(html, /detail-backdrop/)
assert.doesNotMatch(html, /data-detail-tab/)
assert.match(html, /自身特性/)
assert.match(html, /当前灵基提供的 Buff/)
assert.match(html, /CharaGraph\/100100\/100100a%401\.png/)

const lunch = renderDetailPanel({
  detail: { kind: 'ce', id: 9401970, mlb: true },
  ces: [
    {
      id: 9401970,
      name: '迦勒底午餐时光',
      cost: 9,
      skills: [
        { name: '迦勒底午餐时光', condLimitCount: 0, funcs: [{ target: 'ptFull', rate: 20, add: 0 }] },
        { name: '迦勒底午餐时光', condLimitCount: 4, funcs: [{ target: 'ptFull', rate: 100, add: 0 }] },
      ],
    },
  ],
  servants: [{ id: 100100, name: '阿尔托莉雅', traitIds: [100], forms: [] }],
  slots: [{ position: 1, filled: true, ceId: 9401970, svtId: 100100, label: '阿尔托莉雅', traitIds: [100], formLabel: '默认灵基' }],
})
assert.match(lunch, /满破/)
assert.match(lunch, /己方全体通关羁绊 \+10%/)
assert.match(lunch, /任意灵基/)
assert.match(lunch, /作用对象（当前队伍）：阿尔托莉雅/)

{
  const catalog = JSON.parse(readFileSync(new URL('../data/bond-bonuses.json', import.meta.url), 'utf8'))
  const mash = renderDetailPanel({
    detail: { kind: 'svt', id: 800100 },
    servants: [{ id: 800100, name: '玛修', className: 'Shielder' }],
    catalog,
    quest: { id: 100, eventId: 0 },
    now: 1791000000,
    tab: 'give',
  })
  assert.match(mash, /幕末武斗力量/)
  assert.match(mash, /\+5%/)
  assert.match(mash, /未生效/)
}

{
  const catalog = JSON.parse(readFileSync(new URL('../data/bond-bonuses.json', import.meta.url), 'utf8'))
  const okita = renderDetailPanel({
    detail: { kind: 'svt', id: 102700 },
    servants: [{ id: 102700, name: '冲田总司', className: 'Saber' }],
    catalog,
    quest: { id: 94061601, eventId: 80576 },
    now: 1791000000,
    tab: 'recv',
  })
  assert.match(okita, /幕末武斗力量/)
  assert.match(okita, /\+20%/)
  assert.match(okita, /自身/)
  assert.match(okita, /生效/)
}
