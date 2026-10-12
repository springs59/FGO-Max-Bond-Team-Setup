import { saveComputedCandidates } from './query-library.js'
// A separate storage worker keeps IndexedDB writes moving while the solver's
// synchronous exact search runs. Only small facts travel across this boundary.
let pending = Promise.resolve(), added = 0, error = null
self.onmessage = ({data}) => {
  if (data.type === 'batch') {
    pending = pending.then(async () => {
      if (error) return
      try { added += (await saveComputedCandidates(data.values)).added }
      catch (e) { error = `已计算候选未能全部保存：${e.message || e}` }
    })
  } else if (data.type === 'finish') {
    pending.then(() => self.postMessage({saved:!error,added,...(error?{error}:{})}))
  }
}
