import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildQuestIndex } from '../src/solver/index.js'

export { buildQuestIndex }

async function loadJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const quests = await loadJson('src/data/quests.json', [])
  const out = buildQuestIndex({ quests })
  console.log(`quest-index ${out.length} quests`)
}
