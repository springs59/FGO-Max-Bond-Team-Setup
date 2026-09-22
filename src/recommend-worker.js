import { recommendTeam } from './recommend.js'
import { recommendFarm } from './farming.js'
import { solveQuest } from './quest-solver.js'
import { cloneSolverResult } from './solver/cache.js'

function cloneResult(value) {
  if (!value || typeof value !== 'object') return value
  if (value.bond || value.team) {
    return {
      ...value,
      bond: value.bond ? cloneSolverResult(value.bond) : value.bond,
      team: value.team ? cloneSolverResult(value.team) : value.team,
    }
  }
  return cloneSolverResult(value)
}

self.onmessage = (event) => {
  const msg = event.data || {}
  const id = msg.id
  const opts = msg.opts || {}
  try {
    let kind = 'bond'
    let value
    if (msg.solverMode === 'farm') {
      kind = 'farm'
      value = recommendFarm(opts)
    } else if (msg.solverMode === 'quest') {
      kind = 'quest'
      value = solveQuest(opts)
    } else {
      value = recommendTeam({
        ...opts,
        onSolverProgress: (progress) => {
          self.postMessage({ id, type: 'progress', progress })
        },
      })
    }
    self.postMessage({ id, ok: true, type: 'result', result: { kind, value: cloneResult(value) } })
  } catch (err) {
    self.postMessage({ id, ok: false, type: 'error', error: String((err && err.message) || err || '求解失败') })
  }
}
