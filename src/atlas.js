import { applyAliases, isPlayableServant, mergeGrandQuests, slimBondCes, slimServants } from './game-data.js'
export const ATLAS = 'https://api.atlasacademy.io'
export const REGION = 'CN'

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
  const res = await fetch(url)
  if (!res.ok) throw new Error(`local json missing: ${path}`)
  return res.json()
}

export async function loadCes() {
  // Atlas /equip/search no longer accepts funcType; bond CEs come from the daily snapshot
  return loadLocalJson('./data/bond-ces.json')
}

export async function loadServants() {
  const aliasMap = await loadLocalJson('./data/aliases.json').catch(() => ({}))
  return applyAliases(await loadLocalJson('./data/servants.json'), aliasMap).filter(isPlayableServant)
}

export async function loadQuests() {
  return mergeGrandQuests(await loadLocalJson('./data/quests.json'))
}

export async function fetchQuestBond(questId, phase = 1) {
  const res = await fetch(`${ATLAS}/nice/${REGION}/quest/${questId}/${phase}`)
  if (!res.ok) throw new Error('quest not found')
  const quest = await res.json()
  return {
    bond: quest.bond,
    name: quest.name,
    spot: quest.spotName || '',
    id: quest.id,
    phase: quest.phase,
  }
}

export async function fetchServantPassives(svtId) {
  const svt = await fetchServantNice(svtId)
  return passivesFromNice(svt)
}

export async function fetchServantNice(svtId) {
  const res = await fetch(`${ATLAS}/nice/${REGION}/servant/${svtId}`)
  if (!res.ok) return null
  return res.json()
}

export function passivesFromNice(svt) {
  if (!svt) return []
  const out = []
  for (const skill of svt.extraPassive || []) {
    if (skill.id === 970663) continue
    for (const func of skill.functions || []) {
      if (func.funcType !== 'servantFriendshipUp') continue
      const svals = (func.svals || [{}])[0]
      const rate = (svals.RateCount || 0) / 1000
      const add = svals.AddCount || 0
      if (!rate && !add) continue
      out.push({
        skillId: skill.id,
        name: skill.name,
        rate,
        add,
        eventId: svals.EventId || 0,
        target: func.funcTargetType,
      })
    }
  }
  return out
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
  if (extra && extra.length) return idsOf(extra)
  return base
}

function formLabelOf(forms, key, fallback) {
  const hit = (forms || []).find((item) => item.key === key)
  return (hit && hit.name) || fallback
}

export function artsFromNice(svt) {
  return artsFromNiceWithForms(svt, [])
}

export function artsFromNiceWithForms(svt, forms) {
  const items = []
  const seen = new Set()
  const baseTraits = idsOf(svt && svt.traits)
  function push(key, kind, label, url, rawId) {
    if (!url || seen.has(url)) return
    seen.add(url)
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
    push(`a${stage}`, 'ascension', `灵基 ${stage}`, url, stage)
  }
  const costumes = faces.costume || {}
  for (const [id, url] of Object.entries(costumes)) {
    const key = `c${id}`
    push(key, 'costume', formLabelOf(forms, key, costumeLabel(svt, id)), url, id)
  }
  if (!items.length && svt && svt.face) push('default', 'face', '默认', svt.face, '')
  return items
}

export function pickCeSkill(ce, mlb) {
  const want = mlb ? 4 : 0
  return ce.skills.find((skill) => skill.condLimitCount === want) || ce.skills[0]
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

export function applyCraftEssences(slots, ces) {
  const catalog = new Map(ces.map((ce) => [ce.id, ce]))
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
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list.slice(0, 12)
  return list
    .filter((item) => {
      const names = nameOf ? nameOf(item) : ''
      const extra = (item.aliases || []).join(' ')
      return `${names} ${extra}`.toLowerCase().includes(q)
    })
}

function nameScore(names, q) {
  let best = 0
  for (const raw of names || []) {
    const s = String(raw || '').trim().toLowerCase()
    if (!s) continue
    if (s === q) best = Math.max(best, 4)
    else if (s.startsWith(q)) best = Math.max(best, 3)
    else if (s.includes(q)) best = Math.max(best, 1)
  }
  return best
}

export function searchServantForms(list, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) {
    return (list || []).slice(0, 24).map((svt) => ({ ...svt, artKey: '', formLabel: '', formKind: 'default' }))
  }
  const hits = []
  for (const svt of list || []) {
    const servantNames = [
      svt.name,
      svt.originalName,
      svt.collectionNo,
      classLabel(svt.className),
      ...(svt.aliases || []),
    ]
    const servantScore = nameScore(servantNames, q)
    if (servantScore) {
      hits.push({ ...svt, artKey: '', formLabel: '', formKind: 'default', score: servantScore })
    }
    for (const form of svt.forms || []) {
      const formScore = nameScore([form.name], q)
      if (!formScore) continue
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
  return arts.find((item) => item.key === key) || arts[0]
}
