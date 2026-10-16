import { describeQuery, saveQuery } from './query-library.js'
import { cloneSolverResult } from './cache.js'

export async function saveManualResult(kind, opts, value) {
  const plan = value?.bond || value?.team || value
  if (!plan?.ok) return { saved: false, error: '没有可保存的已完成结果' }
  return saveQuery(await describeQuery(kind, opts), cloneSolverResult(value))
}
