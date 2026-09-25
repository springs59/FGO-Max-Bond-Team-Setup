import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCeIndex } from '../src/solver/index.js'

export { buildCeIndex }

async function loadJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ces = await loadJson('src/data/ces.json', null) || await loadJson('src/data/bond-ces.json', [])
  const out = buildCeIndex({ ces })
  console.log(`ce-index ${out.ces.length} bond ces`)
}
