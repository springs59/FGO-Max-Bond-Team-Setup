import { selectQueryModel, validQueryModelId } from './solver/query-models.js'
export const AI_ENABLED_KEY = 'fgo-ai-enabled-v1'
export const AI_QUERY_MODEL_KEY = 'fgo-ai-query-model-v1'
export const AI_SELECTION_KEY = 'fgo-ai-selection-v1'

// Save mode and policy together so a partial write cannot unexpectedly enable AI.
export function createAiSettings({ storage } = {}) {
  let enabled = false, queryModel = 'baseline'
  try {
    const saved = storage?.getItem(AI_SELECTION_KEY)
    if (saved != null) {
      const value = JSON.parse(saved)
      if (typeof value?.enabled === 'boolean' && validQueryModelId(value.queryModel)) {
        enabled = value.enabled; queryModel = value.queryModel
      }
    } else {
      const oldModel = storage?.getItem(AI_QUERY_MODEL_KEY)
      if (oldModel == null || validQueryModelId(oldModel)) {
        queryModel = oldModel || 'baseline'
        enabled = storage?.getItem(AI_ENABLED_KEY) === 'true'
      }
    }
  } catch { enabled = false; queryModel = 'baseline' }
  function persist() {
    try {
      if (!storage) return { persisted: false }
      storage.setItem(AI_SELECTION_KEY, JSON.stringify({ enabled, queryModel }))
      return { persisted: true }
    } catch { return { persisted: false } }
  }
  return {
    get enabled() { return enabled },
    get queryModel() { return queryModel },
    get selection() { return enabled ? queryModel : 'off' },
    setSelection(id) {
      if (id !== 'off' && !validQueryModelId(id)) throw Error('未知的 AI 模式')
      enabled = id !== 'off'
      if (enabled) queryModel = id
      return persist()
    },
    setQueryModel(id) {
      if (!validQueryModelId(id)) throw Error('未知的查询模型')
      queryModel = id
      return persist()
    },
    setEnabled(value) { enabled = value === true; return persist() },
    requestOptions(model) {
      return enabled ? { aiMode: 'on', aiModel: selectQueryModel(model, queryModel) } : { aiMode: 'off' }
    },
  }
}
