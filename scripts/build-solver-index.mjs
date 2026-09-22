import { readFile, rename, writeFile } from 'node:fs/promises'
import { servantBondForms } from '../src/recommend.js'
import { buildSolverIndex } from '../src/solver/solver-index.js'

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

const servants = await loadJson('src/data/servants.json')
const ces = await loadJson('src/data/ces.json').catch(() => loadJson('src/data/bond-ces.json'))
const version = await loadJson('src/data/version.json').catch(() => null)

const index = buildSolverIndex({
  servants,
  ces,
  version,
  formsOf: servantBondForms,
})

const tmp = 'src/data/solver-index.json.tmp'
const dest = 'src/data/solver-index.json'
await writeFile(tmp, JSON.stringify(index) + '\n')
await rename(tmp, dest)
console.log(
  `solver-index ${index.servantCount} servants, ${index.formCount} forms, ${index.ceCount} ces, cond ${Object.keys(index.condHits || {}).length}`,
)
