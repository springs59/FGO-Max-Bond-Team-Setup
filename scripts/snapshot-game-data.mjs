import { writeFile } from 'node:fs/promises'
import { slimBondCes, slimServants } from '../src/game-data.js'

const ATLAS = 'https://api.atlasacademy.io'
const REGION = 'CN'

async function pull(path) {
  const res = await fetch(`${ATLAS}${path}`)
  if (!res.ok) throw new Error(`${path} ${res.status}`)
  return res.json()
}

const servants = slimServants(await pull(`/export/${REGION}/basic_servant.json`))
await writeFile('src/data/servants.json', JSON.stringify(servants) + '\n')

const equips = await pull(`/export/${REGION}/nice_equip.json`)
const ces = slimBondCes(equips)
if (!ces.length) throw new Error('no bond ces')
await writeFile('src/data/bond-ces.json', JSON.stringify(ces, null, 2) + '\n')

console.log(`snapshot ${servants.length} servants, ${ces.length} bond ces`)
