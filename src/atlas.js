import { slimBondCes, slimServants } from './game-data.js'
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
}

export function classLabel(className) {
  return CLASS_CN[className] || className
}

export function attrLabel(attribute) {
  const map = { man: '人', sky: '天', earth: '地', star: '星', beast: '兽' }
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
  try {
    const res = await fetch(`${ATLAS}/export/${REGION}/basic_servant.json`)
    if (res.ok) return slimServants(await res.json())
  } catch {
    /* fall through to snapshot */
  }
  return loadLocalJson('./data/servants.json')
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
  const res = await fetch(`${ATLAS}/nice/${REGION}/servant/${svtId}`)
  if (!res.ok) return []
  const svt = await res.json()
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

export function pickCeSkill(ce, mlb) {
  const want = mlb ? 4 : 0
  return ce.skills.find((skill) => skill.condLimitCount === want) || ce.skills[0]
}

export function ceMatchesServant(func, traitIds) {
  const set = new Set(traitIds || [])
  if (func.andTvals && func.andTvals.length) {
    return func.andTvals.some((group) => group.every((trait) => set.has(trait.id)))
  }
  if (func.tvals && func.tvals.length) {
    return func.tvals.some((trait) => set.has(trait.id))
  }
  return true
}

function rateOf(func, wearerIsSupport) {
  if (wearerIsSupport && func.followerRate != null) return func.followerRate / 1000
  return (func.rate || 0) / 1000
}

export function applyCraftEssences(slots, ces) {
  const catalog = new Map(ces.map((ce) => [ce.id, ce]))
  for (const slot of slots) {
    slot.ceLines = []
    slot.ceMiss = ''
  }

  for (const wearer of slots) {
    if (!wearer.filled || !wearer.ceId) continue
    const ce = catalog.get(Number(wearer.ceId)) || catalog.get(wearer.ceId)
    if (!ce) continue
    const skill = pickCeSkill(ce, wearer.ceMlb)
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
            key: `ce-${ce.id}`,
            label: ce.name,
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
  return slots
}

export function searchByName(list, query, nameOf) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return list.slice(0, 12)
  return list.filter((item) => nameOf(item).toLowerCase().includes(q)).slice(0, 12)
}
