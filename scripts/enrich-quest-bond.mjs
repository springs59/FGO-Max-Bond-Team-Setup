import { keepLatestPhases, slimQuests } from '../src/game-data.js'

// Basic phase search currently exposes player EXP as `bond`. Use the
// authoritative nice phase value for every quest before collapsing rows.
export async function enrichQuestBond(rows, fetchPhase, concurrency = 12, { allowZero = false } = {}) {
  const latest = keepLatestPhases(slimQuests(rows))
  const output = new Array(latest.length)
  let cursor = 0
  async function worker() {
    while (cursor < latest.length) {
      const at = cursor++
      const row = latest[at]
      const phase = await fetchPhase(row.id, row.phase)
      if (Number(phase?.id) !== Number(row.id) || Number(phase?.phase) !== Number(row.phase) ||
          !Number.isFinite(Number(phase?.bond)) || Number(phase.bond) < 0 || (!allowZero && Number(phase.bond) === 0)) {
        throw new Error(`invalid authoritative bond for quest ${row.id}/${row.phase}`)
      }
      output[at] = { ...row, bond: Number(phase.bond) }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, latest.length) }, worker))
  return output
}
