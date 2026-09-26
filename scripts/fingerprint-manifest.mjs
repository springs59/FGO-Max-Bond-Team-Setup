import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { SCHEMA_VERSION } from '../src/data-layer.js'
import { RULE_VERSION, SOLUTION_INDEX_VERSION } from '../src/rules/versions.js'
import { SOLVER_INDEX_VERSION } from '../src/solver/solver-index.js'
import { resolveCurrentActivity } from '../src/rules/index.js'

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
const atlasHash = createHash('sha256')
  .update(
    [
      await fileHash('src/data/servants.json'),
      await fileHash('src/data/ces.json'),
      await fileHash('src/data/quests.json'),
      await fileHash('src/data/bond-bonuses.json'),
      await fileHash('src/data/events.json'),
      await fileHash('src/data/jp-extra-servants.json'),
      await fileHash('src/data/jp-extra-ces.json'),
      await fileHash('src/data/jp-extra-quests.json'),
      await fileHash('src/data/aliases.json'),
      await fileHash('src/data/traits.json'),
    ].join('\n'),
  )
  .digest('hex')

const payload = {
  atlasHash,
  activityState: resolved.activityState,
  solverVersion: SOLVER_INDEX_VERSION,
  solutionIndexVersion: SOLUTION_INDEX_VERSION,
  schemaVersion: SCHEMA_VERSION,
  ruleVersion: RULE_VERSION,
}

payload.fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex')

const previous = await loadJson('generated/manifest.json', null)
const changed = !previous || previous.fingerprint !== payload.fingerprint

if (process.env.GITHUB_OUTPUT) {
  await writeFile(process.env.GITHUB_OUTPUT, `changed=${changed ? 'true' : 'false'}\n`, { flag: 'a' })
}

if (changed) {
  await writeFile('generated/manifest.json', JSON.stringify(payload, null, 2) + '\n')
  console.log(`fingerprint changed ${payload.fingerprint}`)
} else {
  console.log(`fingerprint unchanged ${payload.fingerprint}`)
}

process.exitCode = 0
