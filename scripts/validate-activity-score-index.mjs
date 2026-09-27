import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildActivityScoreIndex } from '../src/solver/activity-score-index.js'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const [index, quests, servants, bondBonuses] = await Promise.all([
  read('src/data/solver-index.json'), read('src/data/quests.json'),
  read('src/data/servants.json'), read('src/data/bond-bonuses.json'),
])
const current = buildActivityScoreIndex({ quests, servants, bondBonuses })
assert.deepEqual(index.activityScores, current, 'activity score matrix differs from live bond rules')
console.log(`activity matrix validated ${Object.keys(current.byQuest).length} quests`)
