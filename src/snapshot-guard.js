import { SCHEMA_VERSION } from './data-layer.js'
import { validateGameBundle } from './game-data.js'

export function parseJsonOrFail(text, label = 'json') {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false, error: `${label} JSON 损坏` }
  }
}

export async function pullJson(fetchImpl, url) {
  let res
  try {
    res = await fetchImpl(url)
  } catch {
    throw new Error(`网络失败 ${url}`)
  }
  if (!res || !res.ok) throw new Error(`${url} ${res ? res.status : 0}`)
  try {
    return await res.json()
  } catch {
    throw new Error(`${url} JSON 损坏`)
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
