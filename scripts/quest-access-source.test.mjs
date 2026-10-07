import assert from 'node:assert/strict'
import { loadPermanentQuestSources } from './quest-access-source.mjs'
import { liveLimitedEventWars } from '../src/game-data.js'
import { eventAvailability } from '../src/quest-availability.js'

for (const region of ['CN', 'JP']) {
  const end = region === 'JP' ? 1893423600 : 2145888000
  const events = [{ id: 1, name: 'Main Interlude', type: 'eventQuest', startedAt: 1, endedAt: end, warIds: [1] },
    { id: 2, type: 'eventQuest', startedAt: 1, endedAt: end, warIds: [2] },
    { id: 3, type: 'eventQuest', startedAt: 1, endedAt: 200, warIds: [3] }]
  const wars = [{ id: 1, flags: ['isEvent'] }, { id: 2, flags: ['mainScenario'] }, { id: 3, flags: ['isEvent'] }]
  const calls = []
  const source = await loadPermanentQuestSources({ region, events, wars, now: 150, pull: async path => {
    calls.push(path)
    assert.ok(path.includes(`/${region}/`), 'never read the other server')
    return path.includes('/nice/') ? { id: 1, parentWarId: 1004, spots: [{ quests: [{ id: 9,
      releaseConditions: [{ type: 'purchaseShop', targetId: 42 }] }] }] }
      : [{ id: 9, phase: 1, warId: 1 }]
  } })
  assert.equal(source.rows.length, 1)
  assert.equal(source.rows[0].eventId, 1)
  assert.equal(source.questDetails[0].releaseConditions[0].type, 'purchaseShop')
  assert.equal(calls.length, 2)
  assert.equal(eventAvailability(events[1], wars[1], region), 'main-story')
  assert.deepEqual(liveLimitedEventWars(events, 150, region).map(x => x.eventId), [3])
}
console.log('Regional permanent chapters, purchase conditions and limited-event separation passed')
