import { readFile } from 'node:fs/promises'
import { writeIfChanged } from './write-if-changed.mjs'
const status = JSON.parse(await readFile('generated/data-status.json', 'utf8'))
const manifest = JSON.parse(await readFile('generated/manifest.json', 'utf8'))
const index = JSON.parse(await readFile('generated/solution-index.json', 'utf8'))
const solverIndex = JSON.parse(await readFile('src/data/solver-index.json', 'utf8'))
const activityQuests = Object.values(solverIndex.activityScores?.byQuest || {})
status.precomputeCheckedAt = new Date().toISOString()
status.precomputeFingerprint = manifest.fingerprint
status.precomputedQueryCount = index.queries.length
status.precomputedActivityQuestCount = activityQuests.length
status.precomputedActivityServantCount = activityQuests.reduce((count, row) => count + Object.keys(row).length, 0)
status.workflowRun = process.env.GITHUB_RUN_ID || null
await writeIfChanged('generated/data-status.json', JSON.stringify(status, null, 2) + '\n')
