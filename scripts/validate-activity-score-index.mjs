import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildActivityScoreIndex } from '../src/solver/activity-score-index.js'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const [index, quests, servants, bondBonuses] = await Promise.all([
  read('generated/activity-score-index.json'), read('src/data/quests.json'),
  read('src/data/servants.json'), read('src/data/bond-bonuses.json'),
])
const current = buildActivityScoreIndex({ quests, servants, bondBonuses })
const version = await read('src/data/version.json')
assert.equal(index.gameDataVersion, version.baseDataVersion || version.dataVersion)
assert.deepEqual({ activityState: index.activityState, byQuest: index.byQuest }, current,
  'activity score matrix differs from live bond rules')
console.log(`activity matrix validated ${Object.keys(current.byQuest).length} quests`)
