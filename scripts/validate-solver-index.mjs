import { readFile } from 'node:fs/promises'
import { servantBondForms } from '../src/recommend.js'
import { validateSolverIndex } from '../src/solver/solver-index.js'

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

const index = await loadJson('src/data/solver-index.json')
const servants = await loadJson('src/data/servants.json')
const ces = await loadJson('src/data/ces.json').catch(() => loadJson('src/data/bond-ces.json'))
const version = await loadJson('src/data/version.json').catch(() => null)

const check = validateSolverIndex(index, {
  servants,
  ces,
  version,
  formsOf: servantBondForms,
})
if (!check.ok) {
  console.error(check.errors.join('\n'))
  process.exit(1)
}
console.log(`solver-index ok: ${check.servantCount} servants, ${check.ceCount} ces, forms ${check.formCount}`)
