import assert from 'node:assert/strict'
import { mkdtemp, stat, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeIfChanged } from '../scripts/write-if-changed.mjs'
import { slimServants } from './game-data.js'
import { bondMechanismOf, extractExtraPassives, isWindowOpen, extractQuestFriendships } from './bond/activity.js'
import { resolveCurrentActivity, nextActivityBoundary } from './rules/activity-rules.js'
import { validateBondBonusCatalog, buildBondBonusSnapshot } from './bond/snapshot.js'
const dir = await mkdtemp(join(tmpdir(), 'fgo-idempotent-'))
try {
  const file = join(dir, 'data.json')
  assert.equal(await writeIfChanged(file, 'same\n'), true)
  const before = await stat(file, { bigint: true })
  assert.equal(await writeIfChanged(file, 'same\n'), false)
  assert.equal((await stat(file, { bigint: true })).mtimeNs, before.mtimeNs)
  assert.equal(await writeIfChanged(file, 'changed\n'), true)
  assert.equal(await readFile(file, 'utf8'), 'changed\n')
} finally { await rm(dir, { recursive: true, force: true }) }
const [svt] = slimServants([{ id: 800100, collectionNo: 1, type: 'heroine', cost: 0, rarity: 4,
  costume: { 800190: { id: 17, battleCharaId: 800190, shortName: '形态' } }, traits: [{ id: 201 }], ascensionAdd: {
    overwriteCost: { costume: { 17: 16 } }, overwriteRarity: { costume: { 17: 5 } },
    attribute: { costume: { 800190: 'human' } }, individuality: { costume: { 800190: [{ id: 201 }] } },
  } }])
assert.deepEqual(svt.forms[0], { key: 'c800190', name: '形态', costumeId: 17, cost: 16, rarity: 5, attribute: 'human', traitIds: [202] })
const extraPassives = extractExtraPassives({ id: 1, extraPassive: [{ id: 123, extraPassive: [
  { eventId: 2, startedAt: 100, endedAt: 199 }, { eventId: 2, startedAt: 300, endedAt: 399 },
], functions: [{ funcType: 'servantFriendshipUp', funcTargetType: 'self', svals: [{ RateCount: 500 }] }] }] })
assert.equal(extraPassives.length, 2)
const catalog = { extraPassives, questFriendships: [], events: [{ id: 2, startedAt: 1, endedAt: 500 }] }
assert.equal(isWindowOpen(100, 199, 99), false)
assert.equal(isWindowOpen(100, 199, 100), true)
assert.equal(isWindowOpen(100, 199, 199), true)
assert.equal(isWindowOpen(100, 199, 200), false)
assert.equal(nextActivityBoundary(catalog, 199), 200)
assert.notEqual(resolveCurrentActivity({ catalog, now: 199 }).activityState, resolveCurrentActivity({ catalog, now: 200 }).activityState)
assert.equal(resolveCurrentActivity({ catalog, now: 300 }).extraPassives.length, 1)
const built = buildBondBonusSnapshot({ servantsNice: [], eventsNice: [] })
assert.equal(validateBondBonusCatalog({ ...built, extraPassives: [{ ...extraPassives[0], add: 10 }] }).ok, false)
assert.equal(bondMechanismOf(extraPassives[0]), 'event-self')
assert.equal(bondMechanismOf({ ...extraPassives[0], condQuestId: 42 }), 'unlock-self')
const globalCampaign = extractQuestFriendships({ id: 10, type: 'eventQuest',
  campaigns: [{ target: 'questFriendship', value: 1200, targetIds: [] }],
  campaignQuests: [{ questId: 0 }, { questId: 42, isExcepted: true }] })[0]
assert.equal(bondMechanismOf(globalCampaign), 'all-except-everyone')
assert.equal(validateBondBonusCatalog({ ...built, questFriendships: [globalCampaign] }).ok, true)
assert.throws(() => buildBondBonusSnapshot({ eventsNice: [{ id: 11,
  campaigns: [{ target: 'mysteryFriendship', value: 1200 }] }] }), /unknown campaign bond mechanic/)
console.log('data pipeline idempotence, source forms and activity boundary tests passed')
