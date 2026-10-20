import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { SEARCH_MODEL } from '../src/solver/ai-model.js'

// Publish only the existing baseline here. Offline candidates require separate
// validation and sealed-test acceptance before entering this software channel.
const output = process.argv[2] || 'ai'
await mkdir(output, { recursive: true })
const raw = JSON.stringify(SEARCH_MODEL) + '\n'
await writeFile(`${output}/baseline.json`, raw)
await writeFile(`${output}/manifest.json`, JSON.stringify({
  format: 1, sequence: 1, version: SEARCH_MODEL.version, featureVersion: 1,
  minAppVersion: '2.1.1', maxAppVersion: '2.1.99', qualification: 'baseline',
  file: 'baseline.json', size: Buffer.byteLength(raw),
  sha256: createHash('sha256').update(raw).digest('hex'),
  notes: '查询级单次决策模型；每次新查询最多一次推理。起点及范围须经精确校验，不代表已证明所有条件下加速。',
}, null, 2) + '\n')
