import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { servantBondForms } from '../src/recommend.js'
import { buildServantIndex } from '../src/solver/index.js'

export { buildServantIndex }

export async function loadJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const servants = await loadJson('src/data/servants.json', [])
  const out = buildServantIndex({ servants, formsOf: servantBondForms })
  console.log(`servant-index ${out.servants.length} servants, ${out.formCount} forms`)
}
