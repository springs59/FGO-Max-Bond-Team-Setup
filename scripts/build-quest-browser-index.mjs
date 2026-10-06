import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { writeIfChanged } from './write-if-changed.mjs'

// Display metadata is independent from solver fingerprints and result indexes.
export function buildQuestBrowserIndex(rows, quests, previous = null, region = 'CN') {
  const raw = new Map((rows || []).map(q => [Number(q.id), q]))
  const entries = {}
  for (const q of [...quests].sort((a, b) => Number(a.id) - Number(b.id))) {
    const r = raw.get(Number(q.id)) || previous?.quests?.[q.id]
    if (!r) continue
    entries[q.id] = { type: r.type, afterClear: r.afterClear || '', warId: Number(r.warId) || 0,
      flags: Array.isArray(r.flags) ? r.flags : [] }
  }
  return { version: 1, region, source: 'Atlas Academy basic quest afterClear', quests: entries }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = JSON.parse(await readFile(process.argv[2], 'utf8'))
  const quests = JSON.parse(await readFile('src/data/quests.json', 'utf8'))
  const index = buildQuestBrowserIndex(rows, quests)
  await writeIfChanged('generated/quest-browser-index.json', JSON.stringify(index) + '\n')
  console.log(`quest browser metadata: ${Object.keys(index.quests).length}/${quests.length}`)
}
