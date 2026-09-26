import assert from 'node:assert/strict'
import {
  formatEffectValue,
  formatPartyHits,
  formatTraitCondition,
  formStateLabel,
  renderCeEffectDetails,
} from './ce-effect-copy.js'

{
  const lunch = formatTraitCondition({ tvals: [], andTvals: [] })
  assert.match(lunch, /任意灵基/)
}

{
  const caster = formatTraitCondition({ tvals: [{ id: 104, name: 'classCaster' }], andTvals: [] })
  assert.match(caster, /术阶/)
}

{
  const lawfulGood = formatTraitCondition({
    tvals: [],
    andTvals: [[{ id: 300, name: 'alignmentLawful' }, { id: 303, name: 'alignmentGood' }]],
  })
  assert.match(lawfulGood, /秩序/)
  assert.match(lawfulGood, /善/)
}

{
  const costume = formatTraitCondition({ tvals: [{ id: 2780, name: 'hasCostume' }], andTvals: [] })
  assert.match(costume, /灵衣/)
}

assert.equal(formStateLabel({ key: 'c800130', name: '常夏的泳装' }), '灵衣「常夏的泳装」')
assert.equal(formStateLabel({ key: 'a1', name: '第1阶段' }), '第1阶段灵基')

{
  const tea = formatEffectValue({
    target: 'ptFull',
    ownRate: 0.05,
    supportRate: 0.15,
    add: 0,
  })
  assert.match(tea, /自己装备全体 \+5%/)
  assert.match(tea, /助战装备全体 \+15%/)
}

{
  const portrait = formatEffectValue({ target: 'ptFull', ownRate: 0, supportRate: 0, add: 50 })
  assert.match(portrait, /固定 \+50/)
}

{
  const party = formatPartyHits(
    { tvals: [{ id: 104, name: 'classCaster' }], andTvals: [] },
    {
      servants: [{ id: 500100, name: '梅林', traitIds: [104] }],
      slots: [
        { position: 1, filled: true, svtId: 500100, label: '梅林', traitIds: [104], formLabel: '默认灵基' },
        { position: 6, filled: true, svtId: 500100, label: '梅林', isSupport: true, traitIds: [104], formLabel: '默认灵基' },
      ],
    },
  )
  assert.match(party, /1号 梅林（默认灵基）可吃到/)
  assert.match(party, /助战/)
}

{
  const html = renderCeEffectDetails(
    [
      {
        name: '手稿之翼',
        condLimitCount: 4,
        target: 'ptFull',
        ownRate: 0.2,
        supportRate: 0.2,
        add: 0,
        tvals: [{ id: 104, name: 'classCaster' }],
        andTvals: [],
      },
    ],
    {
      servants: [{ id: 500100, name: '梅林', className: 'caster', traitIds: [104], forms: [] }],
      slots: [{ position: 1, filled: true, svtId: 500100, label: '梅林', traitIds: [104], formLabel: '默认灵基' }],
    },
  )
  assert.match(html, /满破/)
  assert.match(html, /己方全体通关羁绊 \+20%/)
  assert.match(html, /术阶/)
  assert.match(html, /助战本人不拿羁绊/)
  assert.match(html, /可吃到/)
}

console.log('ce-effect-copy.test.js ok')
