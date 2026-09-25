import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBonusIndex } from '../src/solver/index.js'

export { buildBonusIndex }

async function loadJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const bondBonuses = await loadJson('src/data/bond-bonuses.json', {
    extraPassives: [],
    questFriendships: [],
    events: [],
  })
  const out = buildBonusIndex({ bondBonuses })
  console.log(
    `bonus-index self=${Object.keys(out.selfBySvt).length} party=${Object.keys(out.partyBySvt).length} questFriendship=${out.questFriendship.length}`,
  )
}
