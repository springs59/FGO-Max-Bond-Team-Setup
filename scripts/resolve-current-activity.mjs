import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolveCurrentActivity } from '../src/rules/index.js'

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (err) {
    if (fallback !== undefined) return fallback
    throw err
  }
}

const catalog = await loadJson('src/data/bond-bonuses.json', {
  extraPassives: [],
  questFriendships: [],
  events: [],
})
const now = Number(process.env.ACTIVITY_NOW) || undefined
const resolved = resolveCurrentActivity({ catalog, now })

const currentActivity = {
  activities: resolved.activities.map((row) => ({
    eventId: row.eventId,
    active: row.active,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    type: row.type,
    name: row.name,
  })),
}

const activityBondIndex = {
  activityState: resolved.activityState,
  extraPassives: resolved.extraPassives,
  questFriendships: resolved.questFriendships,
}

await mkdir('generated', { recursive: true })
await writeFile('generated/current-activity.json', JSON.stringify(currentActivity, null, 2) + '\n')
await writeFile('generated/activity-bond-index.json', JSON.stringify(activityBondIndex) + '\n')

console.log(
  `activity ${resolved.activities.length} open, extraPassives ${resolved.extraPassives.length}, questFriendships ${resolved.questFriendships.length}`,
)
