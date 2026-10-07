import { readActiveData } from '../native/shared/store.js'
import { attributeTraits, applyAliasDisplayNames, applyAliases, isPlayableServant, mergeGrandQuests, slimBondCes, slimServants } from './game-data.js'
import { normalizeRegion, REGION_CN, REGION_JP } from './region.js'
import { itemSearchNames, nameScore, searchTerms } from './search.js'

import { emptyBondBonusCatalog, extractExtraPassives } from './bond/activity.js'

export const ATLAS = 'https://api.atlasacademy.io'
export const REGION = REGION_CN

const CLASS_CN = {
  saber: '剑',
  archer: '弓',
  lancer: '枪',
  rider: '骑',
  caster: '术',
  assassin: '杀',
  berserker: '狂',
  ruler: '裁',
  avenger: '仇',
  moonCancer: '月',
  alterEgo: '他',
  foreigner: '降',
  pretender: '伪',
  shielder: '盾',
  beast: '兽',
  unBeast: '兽',
  beastEresh: '兽',
  unBeastOlgaMarie: '兽',
  extra1: 'Extra I',
  extra2: 'Extra II',
}

export function classLabel(className) {
  return CLASS_CN[className] || className
}

export function attrLabel(attribute) {
  const map = { man: '人', human: '人', sky: '天', earth: '地', star: '星', beast: '兽' }
  return map[attribute] || attribute
}

async function loadLocalJson(path) {
  const url = new URL(path, import.meta.url)
  const build = new URL(import.meta.url).searchParams.get('build')
  if (build) url.searchParams.set('build', build)
  const active = await readActiveData(url)
  if (active !== undefined) return active
  const res = await fetch(url)
  if (!res.ok) throw new Error(`local json missing: ${path}`)
  return res.json()
}

export async function loadCes() {
  // Atlas /equip/search no longer accepts funcType; CE catalog comes from the daily snapshot
  const aliasMap = await loadLocalJson('./data/ce-aliases.json').catch(() => ({}))
  try {
    return applyAliases(await loadLocalJson('./data/ces.json'), aliasMap)
  } catch {
    return applyAliases(await loadLocalJson('./data/bond-ces.json'), aliasMap)
  }
}

export async function loadServants() {
  const aliasMap = await loadLocalJson('./data/aliases.json').catch(() => ({}))
  return applyAliases(await loadLocalJson('./data/servants.json'), aliasMap).filter(isPlayableServant)
}

export async function loadQuests() {
  return mergeGrandQuests(await loadLocalJson('./data/quests.json'))
}

export async function loadMetadata() {
  return loadLocalJson('./data/metadata.json').catch(() => null)
}

export async function loadVersion() {
  return loadLocalJson('./data/version.json').catch(() => null)
}

export async function loadEnemies() {
  return loadLocalJson('./data/enemies.json').catch(() => [])
}

export async function loadSkills() {
  return loadLocalJson('./data/skills.json').catch(() => [])
}

export async function loadNoblePhantasms() {
  return loadLocalJson('./data/noble-phantasms.json').catch(() => [])
}

export async function loadTraits() {
  return loadLocalJson('./data/traits.json').catch(() => [])
}

export async function loadSolverIndex() {
  return loadLocalJson('./data/solver-index.json').catch(() => null)
}

export async function loadBondBonuses() {
  try {
    const data = await loadLocalJson('./data/bond-bonuses.json')
    if (data && (Array.isArray(data.extraPassives) || Array.isArray(data.questFriendships))) return data
  } catch {
    // snapshot missing
  }
  return emptyBondBonusCatalog()
}

export async function loadGeneratedJson(name, fallback = null) {
  try {
    return await loadLocalJson(`../generated/${name}`)
  } catch {
    return fallback
  }
}

export async function loadCurrentActivity() {
  return loadGeneratedJson('current-activity.json', { activities: [] })
}

export async function loadActivityBondIndex() {
  return loadGeneratedJson('activity-bond-index.json', { extraPassives: [], questFriendships: [] })
}

export async function loadActivityScoreIndex() {
  return loadGeneratedJson('activity-score-index.json', null)
}

export async function loadSolutionIndex() {
  return loadGeneratedJson('solution-index.json', null)
}

export async function loadCombinationFactors() {
  return loadGeneratedJson('combination-factors.json', null)
}

export async function loadCurveIndex() {
  return loadGeneratedJson('curve-index.json', null)
}

export async function loadImageIndex() {
  return loadGeneratedJson('image-index.json', null)
}

export async function loadJpExtras() {
  const [aliasMap, ceAliasMap] = await Promise.all([
    loadLocalJson('./data/aliases.json').catch(() => ({})),
    loadLocalJson('./data/ce-aliases.json').catch(() => ({})),
  ])
  const [servants, ces, quests] = await Promise.all([
    loadLocalJson('./data/jp-extra-servants.json').catch(() => []),
    loadLocalJson('./data/jp-extra-ces.json').catch(() => []),
    loadLocalJson('./data/jp-extra-quests.json').catch(() => []),
  ])
  return {
    servants: applyAliasDisplayNames(
      applyAliases(Array.isArray(servants) ? servants : [], aliasMap),
      aliasMap,
    ).filter(isPlayableServant),
    ces: applyAliases(Array.isArray(ces) ? ces : [], ceAliasMap),
    quests: Array.isArray(quests) ? quests : [],
  }
}

const servantNiceCache = new Map()
export async function fetchServantNice(svtId, region = REGION) {
  const key = normalizeRegion(region)
  const cacheKey = `${key}:${svtId}`
  if (servantNiceCache.has(cacheKey)) return servantNiceCache.get(cacheKey)
  const pending = (async () => {
    try {
      const res = await fetch(`${ATLAS}/nice/${key}/servant/${svtId}`)
      if (res.ok) return await res.json()
    } catch {
      // The local regional snapshot remains authoritative on network failure.
    }
    return null
  })()
  servantNiceCache.set(cacheKey, pending)
  const result = await pending
  if (!result) servantNiceCache.delete(cacheKey)
  return result
}

export function passivesFromNice(svt) {
  if (!svt) return []
  return extractExtraPassives(svt).map((rec) => ({
    skillId: rec.skillId,
    name: rec.name,
    rate: rec.rate,
    add: rec.add,
    eventId: rec.eventId,
    target: rec.target,
    startedAt: rec.startedAt,
    endedAt: rec.endedAt,
  }))
}

function costumeLabel(svt, key) {
  const bags = [svt && svt.profile && svt.profile.costume, svt && svt.costume]
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object') continue
    const direct = bag[key]
    if (direct && (direct.name || direct.shortName)) return direct.name || direct.shortName
    for (const rec of Object.values(bag)) {
      if (!rec || typeof rec !== 'object') continue
      if (String(rec.id) === String(key) || String(rec.battleCharaId) === String(key)) {
        return rec.name || rec.shortName || `灵衣 ${key}`
      }
    }
  }
  return `灵衣 ${key}`
}

function idsOf(traits) {
  return (traits || []).map((trait) => (trait && typeof trait === 'object' ? trait.id : trait)).filter((id) => id != null)
}

export function traitIdsForForm(svt, kind, rawId) {
  const base = idsOf(svt && svt.traits)
  const bag = (svt && svt.ascensionAdd && svt.ascensionAdd.individuality) || {}
  let extra
  if (kind === 'costume') extra = (bag.costume || {})[rawId]
  else if (kind === 'ascension') extra = (bag.ascension || {})[rawId]
  const traits = extra && extra.length ? idsOf(extra) : base
  const attribute = svt?.ascensionAdd?.attribute?.[kind]?.[rawId]
  return attribute ? attributeTraits(traits, attribute) : traits
}

function formLabelOf(forms, key, fallback) {
  const hit = (forms || []).find((item) => item.key === key)
  return (hit && hit.name) || fallback
}

export function battleAppearanceLabel(name, key = '') {
  const raw = String(name || '').replace(/^灵衣\s*/, '').trim()
  const formKey = String(key || '')
  if (/（/.test(raw)) return raw
  if (formKey.startsWith('c') || formKey.startsWith('costume')) {
    return `${raw || '灵衣'}（灵衣形象）`
  }
  if (formKey.startsWith('a') || /^第\d+阶段/.test(raw)) {
    return `${raw || '再临'}（再临形象）`
  }
  if (!raw || raw === '默认灵基' || raw === '默认') return '默认战斗形象'
  return `${raw}（战斗形象）`
}

export function artsFromNice(svt) {
  return artsFromNiceWithForms(svt, [])
}

export function artsFromNiceWithForms(svt, forms) {
  const items = []
  const seen = new Set()
  const baseTraits = idsOf(svt && svt.traits)
  function push(key, kind, label, url, rawId) {
    if (!url || seen.has(key)) return
    seen.add(key)
    items.push({
      key,
      kind,
      label,
      url,
      traitIds: kind === 'face' ? baseTraits : traitIdsForForm(svt, kind, rawId),
    })
  }
  const faces = (svt && svt.extraAssets && svt.extraAssets.faces) || {}
  const asc = faces.ascension || {}
  for (const [stage, url] of Object.entries(asc)) {
    push(`a${stage}`, 'ascension', battleAppearanceLabel(`第${stage}阶段`, `a${stage}`), url, stage)
  }
  const costumes = faces.costume || {}
  for (const [id, url] of Object.entries(costumes)) {
    const key = `c${id}`
    push(key, 'costume', battleAppearanceLabel(formLabelOf(forms, key, costumeLabel(svt, id)), key), url, id)
  }
  if (!items.length) {
    const bags = [
      svt && svt.extraAssets && svt.extraAssets.narrowFigure,
      svt && svt.extraAssets && svt.extraAssets.charaGraph,
    ]
    for (const bag of bags) {
      if (items.length) break
      for (const [stage, url] of Object.entries((bag && bag.ascension) || {})) {
        push(`a${stage}`, 'ascension', battleAppearanceLabel(`第${stage}阶段`, `a${stage}`), url, stage)
      }
      for (const [id, url] of Object.entries((bag && bag.costume) || {})) {
        const key = `c${id}`
        push(key, 'costume', battleAppearanceLabel(formLabelOf(forms, key, costumeLabel(svt, id)), key), url, id)
      }
    }
  }
  // Shared or missing illustrations must never collapse distinct form states.
  for (const form of forms || []) {
    if (seen.has(form.key)) continue
    const kind = form.key.startsWith('c') ? 'costume' : 'ascension'
    const rawId = form.key.slice(1)
    const url = form.face || (kind === 'ascension' ? asc[rawId] || asc[1] : costumes[rawId]) || svt?.face
    push(form.key, kind, battleAppearanceLabel(form.name, form.key), url, rawId)
    const item = items.find(item => item.key === form.key)
    if (item && form.traitIds) item.traitIds = form.traitIds
  }
  if (!items.length && svt && svt.face) push('default', 'face', '默认', svt.face, '')
  return items
}

export function pickCeSkill(ce, mlb) {
  const want = mlb ? 4 : 0
  const skills = ((ce && ce.skills) || []).filter((skill) => (skill.funcs || []).length)
  if (!skills.length) return null
  return skills.find((skill) => skill.condLimitCount === want) || skills[0]
}

function traitCode(trait) {
  if (trait == null) return null
  return typeof trait === 'object' ? trait.id : trait
}

function allMatchGroup(set, group) {
  const unsigned = []
  const signed = []
  for (const trait of group || []) {
    const id = traitCode(trait)
    if (id == null) continue
    if (id < 1) signed.push(-id)
    else unsigned.push(id)
  }
  if (unsigned.length && !unsigned.every((id) => set.has(id))) return false
  if (signed.length && signed.every((id) => set.has(id))) return false
  return true
}

export function ceMatchesServant(func, traitIds) {
  const set = new Set(traitIds || [])
  if (func.andTvals && func.andTvals.length) {
    return func.andTvals.some((group) => group && group.length && allMatchGroup(set, group))
  }
  if (func.tvals && func.tvals.length) {
    return func.tvals.some((trait) => allMatchGroup(set, [trait]))
  }
  return true
}

function rateOf(func, wearerIsSupport) {
  if (wearerIsSupport && func.followerRate != null) return func.followerRate / 1000
  return (func.rate || 0) / 1000
}

function ceIdsOn(slots, support) {
  const ids = new Set()
  for (const slot of slots || []) {
    if (!slot.filled || Boolean(slot.isSupport) !== Boolean(support)) continue
    for (const id of [slot.ceId, slot.ceRewardId]) {
      if (id) ids.add(Number(id) || id)
    }
  }
  return ids
}

function ceLineLabel(ce, wearer, sameOnBoth) {
  if (wearer.isSupport) return `${ce.name}（助战）`
  if (sameOnBoth) return `${ce.name}（自己）`
  return ce.name
}

export function applyCraftEssences(slots, ces, catalogById = null) {
  const catalog = catalogById || new Map(ces.map((ce) => [ce.id, ce]))
  for (const slot of slots) {
    slot.ceLines = []
    slot.ceMiss = ''
  }
  const ownCeIds = ceIdsOn(slots, false)
  const supportCeIds = ceIdsOn(slots, true)

  for (const wearer of slots) {
    if (!wearer.filled) continue
    const equipped = [
      { id: wearer.ceId, mlb: wearer.ceMlb, slot: 'normal' },
    ]
    if (wearer.isGrand) equipped.push({ id: wearer.ceRewardId, mlb: wearer.ceRewardMlb !== false, slot: 'reward' })
    for (const item of equipped) {
      if (!item.id) continue
      const ce = catalog.get(Number(item.id)) || catalog.get(item.id)
      if (!ce) continue
      const skill = pickCeSkill(ce, item.mlb)
      if (!skill) continue

      for (const func of skill.funcs) {
        if (func.eventId) continue
        if (func.applySupport === 0 && wearer.isSupport) continue
        const pct = rateOf(func, wearer.isSupport)
        const targets = func.target === 'ptFull' ? slots.filter((slot) => slot.filled) : [wearer]

        if (func.add && !wearer.isSupport) {
          wearer.portrait = wearer.portrait || func.add >= 50
        }

        let hit = 0
        let miss = 0
        for (const target of targets) {
          if (target.isSupport) continue
          if (target.bondMaxed) continue
          if (!ceMatchesServant(func, target.traitIds)) {
            miss += 1
            continue
          }
          if (pct) {
            target.ceLines.push({
              key: `ce-${ce.id}-${wearer.isSupport ? 's' : 'o'}${wearer.position}-${item.slot}`,
              label: ceLineLabel(ce, wearer, ownCeIds.has(Number(ce.id)) && supportCeIds.has(Number(ce.id))),
              pct,
            })
            hit += 1
          }
        }
        if (!hit && miss) {
          wearer.ceMiss = `${ce.name} 条件未对上`
        }
      }
    }
  }
  return slots
}

export function searchByName(list, query, nameOf) {
  const q = String(query || '').trim()
  if (!q) return list.slice(0, 12)
  return list
    .map((item, index) => ({ item, index, score: nameScore(itemSearchNames(item, nameOf ? nameOf(item) : ''), q) }))
    .filter(hit => hit.score)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(hit => hit.item)
}

export function searchServantForms(list, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) {
    return (list || []).slice(0, 24).map((svt) => ({ ...svt, artKey: '', formLabel: '', formKind: 'default' }))
  }
  const hits = []
  for (const svt of list || []) {
    const servantNames = itemSearchNames(svt, classLabel(svt.className))
    const servantScore = nameScore(servantNames, q)
    if (servantScore) {
      hits.push({ ...svt, artKey: '', formLabel: '', formKind: 'default', score: servantScore })
    }
    for (const form of svt.forms || []) {
      const formScore = nameScore([...servantNames, form.name], q)
      const formMatched = searchTerms(q).some(term => nameScore([form.name], term))
      if (!formScore || !formMatched) continue
      hits.push({
        ...svt,
        artKey: form.key,
        formLabel: form.name,
        formKind: 'costume',
        score: formScore + 0.2,
      })
    }
  }
  hits.sort((a, b) => b.score - a.score || a.collectionNo - b.collectionNo)
  return hits.slice(0, 24)
}

function asciiFold(value) {
  return String(value || '').replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/[－—–]/g, '-')
}

function questHaystack(quest) {
  const display = String(quest.display || '')
  const names = [
    display,
    quest.name,
    quest.spot,
    quest.war,
    asciiFold(quest.spot),
    asciiFold(display),
    ...(quest.aliases || []),
  ]
  if (display.includes('暗之修炼场')) names.push(display.replaceAll('暗之修炼场', '杀之修炼场'))
  return names
}

export function searchQuests(list, query, now = Date.now() / 1000) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)
  const hits = []
  for (const quest of list || []) {
    const names = questHaystack(quest)
    let score = nameScore(names, q)
    if (!score && tokens.length > 1) {
      const parts = tokens.map((token) => nameScore(names, token))
      if (parts.every((part) => part > 0)) score = parts.reduce((sum, part) => sum + part, 0) / tokens.length
    }
    if (!score) continue
    const closed = quest.closedAt || 0
    const live = quest.openedAt <= now && (closed === 0 || now <= closed)
    hits.push({ ...quest, score: score + (live ? 0.5 : 0), live })
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      String(a.display).length - String(b.display).length ||
      b.bond - a.bond ||
      a.id - b.id,
  )
  return hits.slice(0, 12)
}

export function pickArt(arts, key) {
  if (!arts || !arts.length) return null
  const want = String(key || '')
  if (want && want !== 'default') {
    const hit = arts.find((item) => item.key === want)
    if (hit) return hit
  }
  const asc = arts.filter((item) => item.kind === 'ascension')
  if (asc.length) {
    return asc
      .slice()
      .sort((a, b) => Number(String(a.key).replace(/\D/g, '')) - Number(String(b.key).replace(/\D/g, '')))
      .at(-1)
  }
  return arts[0]
}

export async function loadDataStatus() {
  return loadLocalJson('../generated/data-status.json').catch(() => null)
}

export async function loadQuestBrowserIndex() {
  return loadLocalJson('../generated/quest-browser-index.json').catch(() => null)
}

let jpSnapshotPromise
export function loadJpSnapshot() {
  if (!jpSnapshotPromise) jpSnapshotPromise = (async () => {
    const [bundle, aliasMap, ceAliasMap] = await Promise.all([
      loadLocalJson('./data/jp/bundle.json'),
      loadLocalJson('./data/aliases.json').catch(() => ({})),
      loadLocalJson('./data/ce-aliases.json').catch(() => ({})),
    ])
    if (bundle?.region !== 'JP' || bundle?.version?.region !== 'JP') throw Error('JP snapshot unavailable')
    return { ...bundle,
      servants: applyAliasDisplayNames(applyAliases(bundle.servants || [], aliasMap), aliasMap).filter(isPlayableServant),
      ces: applyAliasDisplayNames(applyAliases(bundle.ces || [], ceAliasMap), ceAliasMap),
    }
  })().catch(err => { jpSnapshotPromise = null; throw err })
  return jpSnapshotPromise
}
