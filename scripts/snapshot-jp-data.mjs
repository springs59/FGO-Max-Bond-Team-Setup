import { loadPhasePartyMetadata } from './quest-party-source.mjs'
import { createHash } from 'node:crypto'
import { stableJson } from './write-if-changed.mjs'
import { baseDataVersionOf } from './index-fingerprints.mjs'
import { buildQuestBrowserIndex } from './build-quest-browser-index.mjs'
import { loadPermanentQuestSources } from './quest-access-source.mjs'
import { enrichQuestBond } from './enrich-quest-bond.mjs'
import { slimServants, slimCes, slimTraits, snapshotQuests, liveLimitedEventWars, stampEventQuests } from '../src/game-data.js'
import { buildBondBonusSnapshot, bondBonusPublishDecision } from '../src/bond/snapshot.js'
import { validateRegionalSnapshot } from '../src/regional-data.js'

export async function buildJpSnapshot({ pull, enrichFormPassives, previous = null }) {
  const region = 'JP'
  const required = value => { if (!Array.isArray(value) || !value.length) throw Error('JP export missing'); return value }
  const [nice, basic, equips, eventsNice, basicEvents, wars, free, main] = await Promise.all([
    pull('/export/JP/nice_servant.json'), pull('/export/JP/basic_servant.json'),
    pull('/export/JP/nice_equip.json'), pull('/export/JP/nice_event.json'),
    pull('/export/JP/basic_event.json'), pull('/export/JP/basic_war.json'),
    pull('/basic/JP/quest/phase/search?type=free'), pull('/basic/JP/quest/phase/search?type=main'),
  ])
  const basics = new Map(required(basic).map(s => [s.id, s]))
  for (const row of required(nice)) if (!Number.isInteger(row.cost) || row.cost < 0) throw Error('JP COST missing: ' + row.id)
  const servants = slimServants(await enrichFormPassives(nice.map(s => ({ ...basics.get(s.id), ...s })), region))
  const ces = slimCes(required(equips)), traits = slimTraits(servants)
  const bondBonuses = { ...buildBondBonusSnapshot({ servantsNice: nice, eventsNice: required(eventsNice), basicEvents: required(basicEvents) }), region }
  const decision = bondBonusPublishDecision({ previous: previous?.bondBonuses, candidate: bondBonuses })
  if (!decision.ok) throw Error(decision.errors.join('; '))
  const rawQuests = [...required(free), ...(main || [])]
  const permanent = await loadPermanentQuestSources({ pull, events: eventsNice, wars, region })
  rawQuests.push(...permanent.rows)
  const eventWars = liveLimitedEventWars(eventsNice, Date.now() / 1000, region)
  const seen = new Set()
  for (const event of eventWars) {
    const id = Number(event.warId)
    if (seen.has(id)) continue
    seen.add(id)
    const rows = await pull('/basic/JP/quest/phase/search?' + new URLSearchParams({ warId: String(id) }))
    rawQuests.push(...stampEventQuests(rows || [], event))
  }
  // Discover Japanese daily/Grand chapters from JP war metadata, not CN names or dates.
  for (const war of required(wars)) {
    if (!/カルデアゲート|曜日|日替わり|戴冠|冠位/.test([war.name, war.longName].join(' ')) || seen.has(Number(war.id))) continue
    seen.add(Number(war.id))
    rawQuests.push(...(await pull('/basic/JP/quest/phase/search?' + new URLSearchParams({ warId: String(war.id) })) || []))
  }
  const previousQuests = new Map((previous?.quests || []).map(q => [q.id + ':' + q.phase, q]))
  const enriched = await enrichQuestBond(rawQuests, async (id, phase) => {
    const cached = previousQuests.get(id + ':' + phase)
    if (cached && cached.bond > 0 && !cached.eventId && cached.partyMetadataComplete) return { ...cached, id, phase }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = await pull('/raw/JP/quest/' + id + '/' + phase), r = raw?.mstQuestPhase
        const party = await loadPhasePartyMetadata(raw, () => pull('/nice/JP/quest/' + id + '/' + phase))
        return { id: r?.questId, phase: r?.phase, bond: r?.friendshipExp,
          ...party }
      } catch (err) { if (attempt === 2) throw err }
    }
  }, 12, { allowZero: true })
  // JP keeps its actual quests; never append the synthetic CN Grand catalog.
  const quests = snapshotQuests(enriched).map(q => ({ ...q, region }))
  const questBrowserIndex = buildQuestBrowserIndex(rawQuests, quests, previous?.questBrowserIndex, region,
    { wars, events: eventsNice, ...permanent })
  const payload = { region, servants, ces, traits, quests, bondBonuses, events: bondBonuses.events, questBrowserIndex }
  const dataVersion = createHash('sha256').update(JSON.stringify(stableJson(payload))).digest('hex')
  const updatedAt = previous?.version?.dataVersion === dataVersion ? previous.version.updatedAt : new Date().toISOString()
  const bundle = { ...payload, version: { region, schemaVersion: 1, questBondSource: 'mstQuestPhase.friendshipExp',
    sourceVersion: 'atlas-jp', dataVersion, updatedAt,
    baseDataVersion: baseDataVersionOf({ servants, ces, traits, quests, questBondSource: 'mstQuestPhase.friendshipExp' }) } }
  const check = validateRegionalSnapshot(bundle, region)
  if (!check.ok) throw Error(check.errors.join('; '))
  if (servants.length < 400 || ces.length < 100) throw Error('JP catalog count too small')
  if (previous && (servants.length < previous.servants.length * .8 || ces.length < previous.ces.length * .8)) throw Error('JP catalog count dropped')
  console.log('JP snapshot: ' + servants.length + ' servants, ' + ces.length + ' CEs, ' + quests.length + ' quests')
  return bundle
}
