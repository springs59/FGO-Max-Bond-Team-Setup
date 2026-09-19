import { readFile } from 'node:fs/promises'
import { validateGameBundle } from '../src/game-data.js'

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

const servants = await loadJson('src/data/servants.json')
const ces = await loadJson('src/data/bond-ces.json')
const version = await loadJson('src/data/version.json').catch(() => null)
const enemies = await loadJson('src/data/enemies.json').catch(() => [])
const traits = await loadJson('src/data/traits.json').catch(() => [])
const skills = await loadJson('src/data/skills.json').catch(() => [])
const noblePhantasms = await loadJson('src/data/noble-phantasms.json').catch(() => [])

const check = validateGameBundle({
  servants,
  ces,
  version,
  enemies,
  traits,
  skills,
  noblePhantasms,
})
if (!check.ok) {
  console.error(check.errors.join('\n'))
  process.exit(1)
}
console.log(`validate ok: ${check.servantCount} servants, ${check.ceCount} ces, living ${check.living}`)
