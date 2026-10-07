import { SCHEMA_VERSION } from './data-layer.js'
import { validateGameBundle } from './game-data.js'

export function parseJsonOrFail(text, label = 'json') {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, error: `${label} JSON 损坏` }
  }
}

export async function pullJson(fetchImpl, url, {
  attempts = 4, timeoutMs = 120000,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
  onRetry = message => console.warn(message),
} = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let retryable = true
    let retryAfter = 0
    let failure
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (!res?.ok) {
        const status = res?.status || 0
        retryable = !status || status === 408 || status === 429 || status >= 500
        const header = res?.headers?.get('retry-after')
        if (header) retryAfter = /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now()
        // Release unsuccessful response bodies before another request.
        await res?.body?.cancel().catch(() => {})
        failure = new Error(`${url} HTTP ${status}`)
      } else {
        try { return await res.json() } catch (cause) {
          failure = new Error(`${url} JSON 损坏或下载中断`, { cause })
        }
      }
    } catch (cause) {
      const detail = cause.cause?.code || cause.code || cause.name || 'unknown'
      failure = new Error(`网络失败 ${url} (${detail})`, { cause })
    }
    if (!retryable || attempt === attempts) {
      throw new Error(`${failure.message}；已尝试 ${attempt} 次`, { cause: failure })
    }
    const delay = Math.min(60000, Math.max(1000 * 2 ** (attempt - 1), retryAfter || 0))
    onRetry(`下载重试 ${attempt}/${attempts}：${failure.message}；${delay}ms 后重试`)
    await wait(delay)
  }
}

export function requireCnExport(list) {
  if (!Array.isArray(list) || !list.length) throw new Error('CN 失败')
  return list
}

export function optionalJpExport(list) {
  return Array.isArray(list) && list.length ? list : []
}

export function isCountDrop(prevN, nextN, ratio = 0.8) {
  const prev = Number(prevN) || 0
  const next = Number(nextN) || 0
  if (prev <= 0) return false
  return next < prev * ratio
}

export function snapshotPublishDecision({ previous = null, candidate = {}, schemaVersion = SCHEMA_VERSION } = {}) {
  const errors = []
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, errors: ['无候选快照'], keepPrevious: true }
  }
  const check = validateGameBundle({
    servants: candidate.servants,
    ces: candidate.ces,
    version: candidate.version,
    enemies: candidate.enemies,
    traits: candidate.traits,
    skills: candidate.skills,
    noblePhantasms: candidate.noblePhantasms,
  })
  if (!check.ok) errors.push(...check.errors)
  if ((candidate.ces || []).length < 100) errors.push(`礼装数异常: ${(candidate.ces || []).length}`)
  const ver = candidate.version || {}
  if (ver.schemaVersion != null && Number(ver.schemaVersion) !== Number(schemaVersion)) {
    errors.push(`schema 改变: ${ver.schemaVersion} != ${schemaVersion}`)
  }
  if (previous) {
    if (isCountDrop((previous.servants || []).length, (candidate.servants || []).length)) {
      errors.push(`从者数骤降 ${(previous.servants || []).length} -> ${(candidate.servants || []).length}`)
    }
    if (isCountDrop((previous.ces || []).length, (candidate.ces || []).length)) {
      errors.push(`礼装数骤降 ${(previous.ces || []).length} -> ${(candidate.ces || []).length}`)
    }
  }
  return { ok: !errors.length, errors, keepPrevious: errors.length > 0 }
}
