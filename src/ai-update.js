import { SEARCH_MODEL } from './solver/ai-model.js'
import { validSearchModel, predictPriority } from './solver/ai-search.js'
import { validQueryPolicy } from './solver/query-ai.js'

export const APP_VERSION = '2.1.20'
export const AI_ROOT = 'https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/ai-models/'
export const AI_FEED = AI_ROOT + 'manifest.json'
export const AI_STORAGE_KEY = 'fgo-ai-model-v1'
const LIMIT = 256 * 1024
const encoder = new TextEncoder()
const versionParts = value => {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw Error('模型兼容版本无效')
  const parts = value.split('.').map(Number)
  if (!parts.every(Number.isSafeInteger)) throw Error('模型兼容版本无效')
  return parts
}
function compare(a, b) {
  const x = versionParts(a), y = versionParts(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return Math.sign(x[i] - y[i])
  return 0
}
export function validateAiManifest(m) {
  if (m?.format !== 1 || m.featureVersion !== 1 || !Number.isSafeInteger(m.sequence) || m.sequence < 1 ||
      typeof m.version !== 'string' || !/^[\w.-]{1,100}$/.test(m.version) ||
      !/^[a-f0-9]{64}$/.test(m.sha256) || !Number.isSafeInteger(m.size) || m.size < 1 || m.size > LIMIT ||
      !/^[\w-]+\.json$/.test(m.file)) throw Error('AI 更新信息无效')
  if (compare(APP_VERSION, m.minAppVersion) < 0 || compare(APP_VERSION, m.maxAppVersion) > 0) throw Error('模型与当前软件版本不兼容')
  if (m.qualification === 'baseline') {
    if (m.version !== SEARCH_MODEL.version) throw Error('基线模型身份不匹配')
  } else if (m.qualification !== 'passed' || m.validation?.passed !== true || m.validation?.sealedTestPassed !== true) {
    throw Error('候选模型尚未通过验收，继续使用当前模型')
  }
  return m
}
async function digest(bytes) {
  return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('')
}
export async function verifyAiModel(manifest, raw) {
  validateAiManifest(manifest)
  if (typeof raw !== 'string') throw Error('AI 权重格式无效')
  const bytes = encoder.encode(raw)
  if (bytes.length !== manifest.size || await digest(bytes) !== manifest.sha256) throw Error('AI 权重大小或摘要校验失败')
  const model = JSON.parse(raw)
  if (model.version !== manifest.version || !validSearchModel(model) || !validQueryPolicy(model.queryPolicy)) throw Error('AI 网络结构或特征不兼容')
  if (manifest.qualification === 'baseline' && JSON.stringify(model) !== JSON.stringify(SEARCH_MODEL)) throw Error('基线权重不匹配')
  for (const head of Object.values(model.heads)) for (const x of [Array(16).fill(0), Array(16).fill(1), Array(16).fill(-1)]) {
    const value = predictPriority(head, x)
    if (!Number.isFinite(value) || value < 0 || value > 1) throw Error('AI 推理检查失败')
  }
  return model
}
async function readBounded(url, max, fetcher) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal })
    if (!response.ok) throw Error('GitHub AI 下载失败：' + response.status)
    if (Number(response.headers.get('content-length')) > max) throw Error('AI 文件过大')
    const reader = response.body?.getReader()
    if (!reader) throw Error('当前浏览器不支持安全读取模型，请更新浏览器或 WebView')
    const chunks = []; let length = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.length
        if (length > max) throw Error('AI 文件过大')
        chunks.push(value)
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error }
    const bytes = new Uint8Array(length); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } finally { clearTimeout(timer) }
}
export function createAiUpdater({ storage, fetcher = (...args) => fetch(...args) } = {}) {
  let active = SEARCH_MODEL, sequence = 0, busy = false
  return {
    get model() { return active },
    async restore() {
      try {
        const saved = storage?.getItem(AI_STORAGE_KEY)
        if (!saved) return { restored: false }
        if (saved.length > LIMIT * 2) throw Error('本地 AI 记录过大')
        const { manifest, raw } = JSON.parse(saved)
        const model = await verifyAiModel(manifest, raw)
        active = model; sequence = manifest.sequence
        return { restored: true }
      } catch {
        active = SEARCH_MODEL; sequence = 0
        return { restored: false, fallback: true }
      }
    },
    async update() {
      if (busy) throw Error('正在检查 AI 更新')
      busy = true
      try {
        const manifest = validateAiManifest(JSON.parse(await readBounded(AI_FEED, 8192, fetcher)))
        if (manifest.sequence <= sequence) return { changed: false }
        const raw = await readBounded(AI_ROOT + manifest.file, LIMIT, fetcher)
        const model = await verifyAiModel(manifest, raw)
        // One atomic storage write: failed persistence leaves the active model untouched.
        if (!storage) throw Error('当前环境无法保存 AI 更新')
        storage.setItem(AI_STORAGE_KEY, JSON.stringify({ manifest, raw }))
        const changed = JSON.stringify(model) !== JSON.stringify(active)
        active = model; sequence = manifest.sequence
        return { changed }
      } finally { busy = false }
    },
    reset() {
      storage?.removeItem(AI_STORAGE_KEY)
      active = SEARCH_MODEL; sequence = 0
    },
  }
}
