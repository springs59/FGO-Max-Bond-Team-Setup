import { readFile } from 'node:fs/promises'
import { validateRegionalSnapshot } from '../src/regional-data.js'
const bundle = JSON.parse(await readFile('src/data/jp/bundle.json', 'utf8'))
const check = validateRegionalSnapshot(bundle, 'JP')
if (!check.ok) throw Error(check.errors.join('; '))
const cn = JSON.parse(await readFile('src/data/servants.json', 'utf8'))
const cnIds = new Set(cn.map(s => s.id))
console.log('Independent JP validated: ' + bundle.servants.length + ' servants, ' + bundle.ces.length + ' CEs, ' +
  bundle.quests.length + ' quests, ' + bundle.servants.filter(s => !cnIds.has(s.id)).length + ' CN-unavailable servants')
