import { readFile } from 'node:fs/promises'
import { writeIfChanged } from './write-if-changed.mjs'
const status = JSON.parse(await readFile('generated/data-status.json', 'utf8'))
const manifest = JSON.parse(await readFile('generated/manifest.json', 'utf8'))
const index = JSON.parse(await readFile('generated/solution-index.json', 'utf8'))
const activityIndex = JSON.parse(await readFile('generated/activity-score-index.json', 'utf8'))
const activityQuests = Object.values(activityIndex.byQuest || {})
const curves = JSON.parse(await readFile('generated/curve-index.json', 'utf8'))
const factors = JSON.parse(await readFile('generated/combination-factors.json', 'utf8'))
status.precomputeCheckedAt = new Date().toISOString()
status.precomputeFingerprint = manifest.fingerprint
status.precomputedQueryCount = index.queries.length
status.precomputedCompleteQueryCount = index.queries.filter(row => row.complete !== false).length
status.curveCount = curves.curves.length
status.curveResultCoverage = curves.coverage
status.combinationFactorMemberCount = factors.members.length
status.combinationFactorVectorCount = factors.vectors.length
status.precomputedSkippedEventQueryCount = (index.skippedEventQueries || []).length
status.precomputedActivityQuestCount = activityQuests.length
status.precomputedActivityServantCount = activityQuests.reduce((count, row) => count + Object.keys(row).length, 0)
status.workflowRun = process.env.GITHUB_RUN_ID || null
await writeIfChanged('generated/data-status.json', JSON.stringify(status, null, 2) + '\n')
