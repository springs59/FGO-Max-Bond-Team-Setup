export const AI_ENABLED_KEY = 'fgo-ai-enabled-v1'

// Only an explicit saved opt-in enables inference. Storage failure keeps the
// choice for this session; updating or restoring weights never changes it.
export function createAiSettings({ storage } = {}) {
  let enabled = false
  try { enabled = storage?.getItem(AI_ENABLED_KEY) === 'true' } catch {}
  return {
    get enabled() { return enabled },
    setEnabled(value) {
      enabled = value === true
      try {
        if (!storage) return { persisted: false }
        storage.setItem(AI_ENABLED_KEY, String(enabled))
        return { persisted: true }
      } catch { return { persisted: false } }
    },
    requestOptions(model) {
      return enabled ? { aiMode: 'on', aiModel: model } : { aiMode: 'off' }
    },
  }
}
