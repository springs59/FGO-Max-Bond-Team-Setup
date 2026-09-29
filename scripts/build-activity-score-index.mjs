import { readFile } from 'node:fs/promises'
import { writeIfChanged } from './write-if-changed.mjs'
import { buildActivityScoreIndex } from '../src/solver/activity-score-index.js'

const read = async path => JSON.parse(await readFile(path, 'utf8'))
const [quests, servants, bondBonuses, version] = await Promise.all([
  read('src/data/quests.json'), read('src/data/servants.json'),
  read('src/data/bond-bonuses.json'), read('src/data/version.json'),
])
const scores = buildActivityScoreIndex({ quests, servants, bondBonuses })
const index = { gameDataVersion: version.baseDataVersion || version.dataVersion, ...scores }
await writeIfChanged('generated/activity-score-index.json', JSON.stringify(index) + '\n')
console.log(`activity-score-index quests ${Object.keys(index.byQuest).length}`)
