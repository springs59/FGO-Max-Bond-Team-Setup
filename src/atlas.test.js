import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  applyCraftEssences,
  artsFromNice,
  artsFromNiceWithForms,
  ceMatchesServant,
  pickCeSkill,
  searchByName,
  searchServantForms,
  traitIdsForForm,
} from './atlas.js'
import { applyAliases, isPlayableServant, parseMooncellAliases, slimBondCes, slimServants } from './game-data.js'

const ces = JSON.parse(readFileSync(new URL('./data/bond-ces.json', import.meta.url), 'utf8'))
const lunch = ces.find((ce) => ce.collectionNo === 330)
const tea = ces.find((ce) => ce.collectionNo === 910)
const holmes = ces.find((ce) => ce.collectionNo === 1080)
const nff = ces.find((ce) => ce.collectionNo === 1949)

assert.equal(pickCeSkill(lunch, true).funcs[0].rate, 100)
assert.equal(pickCeSkill(lunch, false).funcs[0].rate, 20)

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: lunch.id, ceMlb: true, traitIds: [], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines[0].pct, 0.1)
  assert.equal(slots[1].ceLines[0].pct, 0.1)
}

{
  const slots = [
    { position: 1, filled: true, isSupport: true, ceId: tea.id, ceMlb: true, traitIds: [], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines.length, 0)
  assert.equal(slots[1].ceLines[0].pct, 0.15)
  assert.equal(slots[1].ceLines[0].label, '迦勒底午茶时光（助战）')
}

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: tea.id, ceMlb: true, traitIds: [], ceLines: [] },
    { position: 6, filled: true, isSupport: true, ceId: tea.id, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  const lines = slots[0].ceLines
  assert.equal(lines.length, 2)
  assert.equal(lines[0].pct, 0.05)
  assert.equal(lines[0].label, '迦勒底午茶时光（自己）')
  assert.equal(lines[1].pct, 0.15)
  assert.equal(lines[1].label, '迦勒底午茶时光（助战）')
  assert.notEqual(lines[0].key, lines[1].key)
}

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: holmes.id, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines[0].pct, 0.05)
}

{
  const animal = 2821
  assert.equal(ceMatchesServant(pickCeSkill(nff, true).funcs[0], [animal]), true)
  assert.equal(ceMatchesServant(pickCeSkill(nff, true).funcs[0], [100]), false)
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: nff.id, ceMlb: true, traitIds: [100], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [animal], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines.length, 0)
  assert.equal(slots[1].ceLines[0].pct, 0.2)
}

{
  const slots = [
    { position: 1, filled: true, isSupport: false, ceId: nff.id, ceMlb: true, traitIds: [100], ceLines: [] },
  ]
  applyCraftEssences(slots, ces)
  assert.match(slots[0].ceMiss, /条件未对上/)
}

{
  const slots = [
    {
      position: 1,
      filled: true,
      isSupport: false,
      isGrand: true,
      ceId: 0,
      ceBondId: lunch.id,
      ceRewardId: holmes.id,
      ceMlb: true,
      ceBondMlb: true,
      ceRewardMlb: true,
      traitIds: [],
      ceLines: [],
    },
  ]
  applyCraftEssences(slots, ces)
  assert.equal(slots[0].ceLines.length, 1)
  assert.equal(slots[0].ceLines[0].pct, 0.05)
  assert.equal(slots[0].ceLines[0].label, holmes.name)
}

{
  const blocked = slimBondCes([
    {
      id: 9400002,
      collectionNo: 9002,
      name: '测试助战无效',
      rarity: 5,
      skills: [
        {
          name: '测试助战无效',
          condLimitCount: 4,
          functions: [
            {
              funcType: 'servantFriendshipUp',
              funcTargetType: 'ptFull',
              svals: [{ RateCount: 500, ApplySupportSvt: 0 }],
              followerVals: [],
              functvals: [],
              overWriteTvalsList: [],
            },
          ],
        },
      ],
    },
  ])[0]
  assert.equal(pickCeSkill(blocked, true).funcs[0].applySupport, 0)
  const slots = [
    { position: 1, filled: true, isSupport: true, ceId: blocked.id, ceMlb: true, traitIds: [], ceLines: [] },
    { position: 2, filled: true, isSupport: false, ceId: 0, ceMlb: true, traitIds: [], ceLines: [] },
  ]
  applyCraftEssences(slots, [blocked])
  assert.equal(slots[0].ceLines.length, 0)
  assert.equal(slots[1].ceLines.length, 0)
}

{
  const report = slimBondCes([
    {
      id: 9407850,
      collectionNo: 2052,
      name: '检查报告',
      rarity: 5,
      skills: [
        {
          name: '检查报告',
          condLimitCount: 4,
          functions: [
            {
              funcType: 'servantFriendshipUp',
              funcTargetType: 'ptFull',
              svals: [{ RateCount: 200 }],
              functvals: [],
              overWriteTvalsList: [],
              script: {
                overwriteTvals: [[{ id: 300, name: 'alignmentLawful' }, { id: 303, name: 'alignmentGood' }]],
              },
            },
          ],
        },
      ],
    },
  ])[0]
  const fn = pickCeSkill(report, true).funcs[0]
  assert.deepEqual(
    fn.andTvals[0].map((trait) => trait.id),
    [300, 303],
  )
  assert.equal(ceMatchesServant(fn, [300, 303]), true)
  assert.equal(ceMatchesServant(fn, [300, 304]), false)
  assert.equal(ceMatchesServant(fn, [300]), false)
}

{
  const bride = slimBondCes([
    {
      id: 9408590,
      collectionNo: 2233,
      name: '献给幸福的新娘',
      rarity: 5,
      skills: [
        {
          name: '献给幸福的新娘',
          condLimitCount: 4,
          functions: [
            {
              funcType: 'servantFriendshipUp',
              funcTargetType: 'ptFull',
              svals: [{ RateCount: 200 }],
              functvals: [],
              overWriteTvalsList: [],
              script: {
                overwriteTvals: [[{ id: 300, name: 'alignmentLawful' }, { id: 2, name: 'genderFemale' }]],
              },
            },
          ],
        },
      ],
    },
  ])[0]
  const fn = pickCeSkill(bride, true).funcs[0]
  assert.deepEqual(
    fn.andTvals[0].map((trait) => trait.id),
    [300, 2],
  )
  assert.equal(ceMatchesServant(fn, [300, 2]), true)
  assert.equal(ceMatchesServant(fn, [300, 1]), false)
}

{
  const report = ces.find((ce) => ce.collectionNo === 2052)
  const brideCe = ces.find((ce) => ce.collectionNo === 2233)
  const starGod = ces.find((ce) => ce.collectionNo === 2437)
  const reportFn = pickCeSkill(report, true).funcs[0]
  const brideFn = pickCeSkill(brideCe, true).funcs[0]
  const starFn = pickCeSkill(starGod, true).funcs[0]
  assert.deepEqual(
    reportFn.andTvals[0].map((trait) => trait.id),
    [300, 303],
  )
  assert.deepEqual(
    brideFn.andTvals[0].map((trait) => trait.id),
    [300, 2],
  )
  assert.deepEqual(
    starFn.tvals.map((trait) => trait.id),
    [304, 203],
  )
  assert.equal(ceMatchesServant(reportFn, [300, 303]), true)
  assert.equal(ceMatchesServant(reportFn, [300, 304]), false)
  assert.equal(ceMatchesServant(starFn, [304]), true)
  assert.equal(ceMatchesServant(starFn, [203]), true)
  assert.equal(ceMatchesServant(starFn, [300]), false)
}

{
  const arts = artsFromNice({
    face: 'https://example/default.png',
    extraAssets: {
      faces: {
        ascension: {
          1: 'https://example/a1.png',
          2: 'https://example/a2.png',
        },
        costume: {
          11: 'https://example/c11.png',
        },
      },
    },
    profile: { costume: { 11: { id: 11, name: '夏日灵衣' } } },
  })
  assert.equal(arts.length, 3)
  assert.equal(arts[0].label, '灵基 1')
  assert.equal(arts[2].kind, 'costume')
  assert.equal(arts[2].label, '夏日灵衣')
}

{
  const arts = artsFromNice({ face: 'https://example/default.png' })
  assert.deepEqual(arts, [
    { key: 'default', kind: 'face', label: '默认', url: 'https://example/default.png', traitIds: [] },
  ])
}

{
  const csv = `id,star,name_cn,name_jp,name_en,name_link,name_other,cost
2,5,阿尔托莉雅·潘德拉贡,アルトリア・ペンドラゴン,Altria Pendragon,阿尔托莉雅·潘德拉贡,呆毛&蓝呆&吾王,16
37,5,诸葛孔明,ショカツコウメイ,Zhuge Liang,诸葛孔明,孔明&孔老师,16
`
  const map = parseMooncellAliases(csv)
  assert.ok(map[2].includes('呆毛'))
  assert.ok(map[2].includes('Altria Pendragon'))
  assert.equal(map[2][0], '呆毛')
  const list = applyAliases(
    [{ collectionNo: 2, name: '阿尔托莉雅·潘德拉贡', aliases: [] }],
    map,
  )
  const hit = searchByName(list, '呆毛', (svt) => `${svt.collectionNo} ${svt.name}`)
  assert.equal(hit.length, 1)
  assert.equal(hit[0].collectionNo, 2)
  assert.equal(map[2][0], '呆毛')
}

{
  const csv = `id,star,name_cn,name_jp,name_en,name_link,name_other,cost
2,5,阿尔托莉雅·潘德拉贡,アルトリア・ペンドラゴン,Altria Pendragon,阿尔托莉雅·潘德拉贡,呆毛&蓝呆&Saber&吾王,16
3,4,阿尔托莉雅·潘德拉贡〔Alter〕,アルトリア・ペンドラゴン〔オルタ〕,Altria Pendragon (Alter),阿尔托莉雅·潘德拉贡〔Alter〕,黑呆,12
`
  const map = parseMooncellAliases(csv)
  assert.equal(map[2].includes('Saber'), true)
  assert.equal(map[2][0], '呆毛')
  assert.ok(map[2].includes('呆毛'))
  const list = applyAliases(
    [
      { collectionNo: 2, name: '阿尔托莉雅·潘德拉贡', aliases: [], forms: [{ key: 'c100130', name: '风王结界' }] },
      { collectionNo: 3, name: '阿尔托莉雅·潘德拉贡〔Alter〕', aliases: [], forms: [] },
    ],
    map,
  )
  const hair = searchServantForms(list, '呆毛')
  assert.equal(hair.length, 1)
  assert.equal(hair[0].collectionNo, 2)
  assert.equal(hair[0].formKind, 'default')
  const costume = searchServantForms(list, '风王结界')
  assert.equal(costume.length, 1)
  assert.equal(costume[0].artKey, 'c100130')
  assert.equal(costume[0].formLabel, '风王结界')
  const saber = searchServantForms(list, 'Saber')
  assert.equal(saber.length, 1)
  assert.equal(saber[0].collectionNo, 2)
}

{
  const csv = `id,star,name_cn,name_jp,name_en,name_link,name_other,cost
5,4,尼禄·克劳狄乌斯,ネロ・クラウディウス,Nero Claudius,尼禄·克劳狄乌斯,尼禄&红Saber,12
38,5,库·丘林,クー・フーリン,Cu Chulainn,库·丘林(Caster),C狗&法狗,16
62,5,玉藻前,玉藻の前,Tamamo-no-Mae,玉藻前,C狐&C玉,16
92,5,两仪式,両儀式,Ryougi Shiki,两仪式(Assassin),杀式&式姐,16
`
  const map = parseMooncellAliases(csv)
  assert.ok(map[5].includes('红Saber'))
  assert.equal(map[5][0], '尼禄')
  assert.ok(map[38].includes('C狗'))
  assert.ok(map[38].includes('库·丘林(Caster)'))
  assert.equal(map[38].indexOf('C狗') < map[38].indexOf('库·丘林(Caster)'), true)
  assert.ok(map[62].includes('C狐'))
  assert.ok(map[92].includes('两仪式(Assassin)'))
  const list = applyAliases(
    [
      { collectionNo: 5, name: '尼禄·克劳狄乌斯', aliases: [], className: 'saber' },
      { collectionNo: 38, name: '库·丘林', aliases: [], className: 'caster' },
      { collectionNo: 62, name: '玉藻前', aliases: [], className: 'caster' },
      { collectionNo: 92, name: '两仪式', aliases: [], className: 'assassin' },
    ],
    map,
  )
  assert.equal(searchServantForms(list, '红Saber')[0].collectionNo, 5)
  assert.equal(searchServantForms(list, 'C狐')[0].collectionNo, 62)
  assert.equal(searchServantForms(list, 'C狗')[0].collectionNo, 38)
  assert.equal(searchServantForms(list, '两仪式(Assassin)')[0].collectionNo, 92)
}

{
  const svt = {
    traits: [{ id: 107 }, { id: 2009 }],
    extraAssets: {
      faces: {
        ascension: { 1: 'https://example/a1.png' },
        costume: { 800130: 'https://example/c.png' },
      },
    },
    costume: { 800130: { shortName: '常夏的泳装' } },
    ascensionAdd: {
      individuality: {
        ascension: { 1: [] },
        costume: { 800130: [{ id: 2009 }, { id: 2838 }] },
      },
    },
  }
  const arts = artsFromNiceWithForms(svt, [{ key: 'c800130', name: '常夏的泳装' }])
  assert.deepEqual(arts[0].traitIds, [107, 2009])
  assert.equal(arts[1].kind, 'costume')
  assert.equal(arts[1].label, '常夏的泳装')
  assert.deepEqual(arts[1].traitIds, [2009, 2838])
  assert.deepEqual(traitIdsForForm(svt, 'costume', '800130'), [2009, 2838])
  assert.deepEqual(traitIdsForForm(svt, 'ascension', '1'), [107, 2009])
}

{
  const fn = { tvals: [{ id: -104, name: 'not caster' }], andTvals: [] }
  assert.equal(ceMatchesServant(fn, [102]), true)
  assert.equal(ceMatchesServant(fn, [104]), false)
  const andFn = { tvals: [], andTvals: [[{ id: 102 }, { id: 104 }]] }
  assert.equal(ceMatchesServant(andFn, [102, 104]), true)
  assert.equal(ceMatchesServant(andFn, [102]), false)
}

{
  const slim = slimServants([
    {
      collectionNo: 1,
      id: 800100,
      name: '玛修',
      originalName: '玛修',
      className: 'shielder',
      attribute: 'earth',
      rarity: 4,
      face: '',
      traits: [{ id: 107 }, { id: 2009 }],
      costume: { 800130: { shortName: '常夏的泳装' } },
      ascensionAdd: {
        individuality: {
          ascension: { 1: [] },
          costume: { 800130: [{ id: 2009 }, { id: 2838 }] },
        },
      },
    },
  ])
  assert.equal(slim[0].forms[0].key, 'c800130')
  assert.equal(slim[0].forms[0].name, '常夏的泳装')
  assert.deepEqual(slim[0].forms[0].traitIds, [2009, 2838])
}

{
  const slim = slimServants([
    { collectionNo: 83, id: 1700100, name: '所罗门', className: 'loreGrandCaster', type: 'enemyCollectionDetail', traits: [] },
    { collectionNo: 149, id: 9935400, name: '提亚马特', className: 'beastII', type: 'enemyCollectionDetail', traits: [] },
    { collectionNo: 411, id: 9945590, name: 'Ｅ－火玛丽', className: 'uOlgaMarieFlareCollection', type: 'enemyCollectionDetail', traits: [] },
    { collectionNo: 377, id: 3300100, name: '所多玛之兽／德拉科', className: 'beast', type: 'normal', traits: [] },
    { collectionNo: 417, id: 3300200, name: '埃列什基伽勒', className: 'beastEresh', type: 'normal', traits: [] },
    { collectionNo: 444, id: 4000100, name: 'Ｕ－奥尔加玛丽', className: 'unBeastOlgaMarie', type: 'normal', traits: [] },
    { collectionNo: 1, id: 800100, name: '玛修', className: 'shielder', type: 'heroine', traits: [] },
  ])
  assert.deepEqual(slim.map((svt) => svt.collectionNo), [377, 417, 444, 1])
  assert.equal(isPlayableServant({ collectionNo: 83, className: 'loreGrandCaster' }), false)
  assert.equal(isPlayableServant({ collectionNo: 377, className: 'beast' }), true)
}

console.log('atlas tests passed')
