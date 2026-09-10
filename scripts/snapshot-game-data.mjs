import { writeFile } from 'node:fs/promises'
import {
  applyAliases,
  parseMooncellAliases,
  slimBondCes,
  slimServants,
  snapshotQuests,
  mergeGrandQuests,
} from '../src/game-data.js'

const ATLAS = 'https://api.atlasacademy.io'
const REGION = 'CN'
const MOONCELL =
  'https://fgo.wiki/index.php?title=%E5%BE%AE%E4%BB%B6:ServantsList/data&action=raw'

async function pull(path) {
  const res = await fetch(`${ATLAS}${path}`)
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

async function pullMooncellAliases() {
  const res = await fetch(MOONCELL)
  if (!res.ok) throw new Error(`mooncell ${res.status}`)
  return parseMooncellAliases(await res.text())
}

let aliasMap = {}
try {
  aliasMap = await pullMooncellAliases()
  await writeFile('src/data/aliases.json', JSON.stringify(aliasMap) + '\n')
} catch (err) {
  console.warn('mooncell aliases skipped', err.message)
}

// basic_servant 含灵衣短名；形态特质需 nice.ascensionAdd.individuality，有则写入 forms.traitIds
const servants = applyAliases(slimServants(await pull(`/export/${REGION}/basic_servant.json`)), aliasMap)
const mashNice = await pull(`/nice/${REGION}/servant/1?lore=false`)
const mash = servants.find((item) => item.collectionNo === 1)
if (mash && mashNice) {
  mash.rarity = mashNice.rarity
  const paladin = new Set(['c800190', 'c800200'])
  const paladinTraits = (mash.traitIds || []).map((id) => (id === 201 ? 202 : id))
  if (!paladinTraits.includes(202)) paladinTraits.push(202)
  mash.forms = (mash.forms || []).map((form) =>
    paladin.has(form.key)
      ? { ...form, rarity: 5, cost: 16, attribute: 'human', traitIds: paladinTraits.slice() }
      : form,
  )
}
await writeFile('src/data/servants.json', JSON.stringify(servants) + '\n')

const equips = await pull(`/export/${REGION}/nice_equip.json`)
const ces = slimBondCes(equips)
if (!ces.length) throw new Error('no bond ces')
await writeFile('src/data/bond-ces.json', JSON.stringify(ces, null, 2) + '\n')

const free = await pull(`/basic/${REGION}/quest/phase/search?type=free`)
const dailyQuery = new URLSearchParams({ spotName: '每日任务' })
const daily = await pull(`/basic/${REGION}/quest/phase/search?${dailyQuery}`)
const quests = snapshotQuests([...(free || []), ...(daily || [])])
if (!quests.length) throw new Error('no quests')
const withGrand = mergeGrandQuests(quests)
await writeFile('src/data/quests.json', JSON.stringify(withGrand) + '\n')

console.log(`snapshot ${servants.length} servants, ${ces.length} bond ces, ${withGrand.length} quests`)
