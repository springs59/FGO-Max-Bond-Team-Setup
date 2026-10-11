import { readFile } from 'node:fs/promises'
import { writeIfChanged } from './write-if-changed.mjs'
import { precomputeRegion } from '../native/shared/precompute.js'

const read = async p => JSON.parse(await readFile(p, 'utf8'))
const optional = async p => read(p).catch(() => null)
const [servants, ces, quests, traits, version, bondBonuses, solverIndex, factorIndex, previousCN, jp, previousJP] = await Promise.all([
  read('src/data/servants.json'), read('src/data/ces.json'), read('src/data/quests.json'), read('src/data/traits.json'),
  read('src/data/version.json'), read('src/data/bond-bonuses.json'), read('src/data/solver-index.json'), read('generated/combination-factors.json'),
  optional('generated/joined-effects.json'), read('src/data/jp/bundle.json'), optional('generated/jp/joined-effects.json')])
const cn = { region: 'CN', servants, ces, quests, traits, version, bondBonuses }
const results = [
  ['CN', precomputeRegion(cn, 'CN', { base: { solverIndex, factorIndex }, previousJoint: previousCN })],
  ['JP', precomputeRegion(jp, 'JP', { previousJoint: previousJP })],
]
for (const [region, data] of results) {
  const prefix = region === 'CN' ? 'generated' : 'generated/jp'
  if (region === 'JP') await writeIfChanged(prefix + '/combination-factors.json', JSON.stringify(data.factorIndex) + '\n')
  await writeIfChanged(prefix + '/joined-effects.json', JSON.stringify(data.joinedEffectIndex) + '\n')
  console.log(`${region}: ${data.factorIndex.members.length} identity/forms, ${data.joinedEffectIndex.scenarios.length} joint scenarios; ${data.joinedEffectIndex.reusedScenarios} reused; all identities retained`)
}
