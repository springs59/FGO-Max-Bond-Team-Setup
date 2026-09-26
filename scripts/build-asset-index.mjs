import { readFile, writeFile } from 'node:fs/promises'
import { mkdir } from 'node:fs/promises'
import { buildAssetIndex } from '../src/assets/asset-index.js'

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (fallback !== undefined) return fallback
    throw err
  }
}

const servants = await loadJson('src/data/servants.json', [])
const extras = await loadJson('src/data/jp-extra-servants.json', [])
const ces = await loadJson('src/data/ces.json', [])
const index = buildAssetIndex({
  servants: servants.concat(extras),
  ces,
  region: 'CN',
})
await mkdir('generated', { recursive: true })
await writeFile('generated/image-index.json', JSON.stringify(index) + '\n')
console.log(`image-index servants ${Object.keys(index.servant).length} ces ${Object.keys(index.craftEssence).length}`)
