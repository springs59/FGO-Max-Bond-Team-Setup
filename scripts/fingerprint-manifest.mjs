import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { SCHEMA_VERSION } from '../src/data-layer.js'
import { RULE_VERSION, SOLUTION_INDEX_VERSION } from '../src/rules/versions.js'
import { SOLVER_INDEX_VERSION } from '../src/solver/solver-index.js'
import { resolveCurrentActivity } from '../src/rules/index.js'
import { fingerprintOf, indexRefreshDecision } from './index-fingerprints.mjs'

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (fallback !== undefined) return fallback
    throw err
  }
}

async function fileHash(path) {
  try {
    const buf = await readFile(path)
    return createHash('sha256').update(buf).digest('hex')
  } catch {
    return ''
  }
}

const catalog = await loadJson('src/data/bond-bonuses.json', {
  extraPassives: [],
  questFriendships: [],
  events: [],
})
const resolved = resolveCurrentActivity({ catalog })
const activityDataHash = createHash('sha256')
  .update(
    [
      await fileHash('src/data/bond-bonuses.json'),
      await fileHash('src/data/events.json'),
      await fileHash('src/data/quests.json'),
    ].join('\n'),
  )
  .digest('hex')

async function codeFiles(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'data') continue
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) out.push(...await codeFiles(path))
    else if (/\.(js|mjs)$/.test(path) && !path.endsWith('.test.js')) out.push(path)
  }
  return out
}
const paths = [...await codeFiles('src'), ...await codeFiles('scripts')].sort()
const activityOnlyCode = new Set([
  'src/bond/activity.js', 'src/bond/bonus.js', 'src/bond/snapshot.js',
  'src/rules/activity-rules.js', 'src/solver/activity-score-index.js',
  'scripts/resolve-current-activity.mjs', 'scripts/build-activity-score-index.mjs',
  'scripts/validate-activity-score-index.mjs', 'scripts/index-fingerprints.mjs',
  'scripts/audit-bond-mechanisms.mjs',
])
const codeEntries = await Promise.all(paths.map(async path => `${path}:${await fileHash(path)}`))
const codeHash = fingerprintOf(codeEntries.filter((_, i) => !activityOnlyCode.has(paths[i])))
const activityCodeHash = fingerprintOf(codeEntries.filter((_, i) => activityOnlyCode.has(paths[i])))
const version = await loadJson('src/data/version.json', {})
const payload = {
  baseFingerprint: fingerprintOf({
    baseDataVersion: version.baseDataVersion || version.dataVersion,
    codeHash, solverVersion: SOLVER_INDEX_VERSION,
    solutionIndexVersion: SOLUTION_INDEX_VERSION, ruleVersion: RULE_VERSION,
  }),
  activityFingerprint: fingerprintOf({
    activityDataHash, activityCodeHash, activityState: resolved.activityState,
    baseDataVersion: version.baseDataVersion || version.dataVersion,
  }),
  solverVersion: SOLVER_INDEX_VERSION,
  solutionIndexVersion: SOLUTION_INDEX_VERSION,
  schemaVersion: SCHEMA_VERSION,
  ruleVersion: RULE_VERSION,
}

payload.fingerprint = fingerprintOf(payload)

const previous = await loadJson('generated/manifest.json', null)
const { baseChanged, activityChanged, changed } = indexRefreshDecision(previous, payload)

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT,
    `changed=${changed ? 'true' : 'false'}\nbase_changed=${baseChanged ? 'true' : 'false'}\nactivity_changed=${activityChanged ? 'true' : 'false'}\n`, { flag: 'a' })
}

if (changed) {
  await writeFile('generated/manifest.json', JSON.stringify(payload, null, 2) + '\n')
  console.log(`fingerprint changed base=${baseChanged} activity=${activityChanged} ${payload.fingerprint}`)
} else {
  console.log(`fingerprint unchanged ${payload.fingerprint}`)
}

process.exitCode = 0
