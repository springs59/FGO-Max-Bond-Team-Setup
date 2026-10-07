import { RULE_VERSION } from '../../src/rules/versions.js'
import { SOLVER_INDEX_VERSION } from '../../src/solver/solver-index.js'
export const UPDATE_URL = 'https://springs59.github.io/FGO-Max-Bond-Team-Setup/generated/native-data-manifest.json'
export const RUNTIME = 1
export const MAX_FILE_BYTES = 32 * 1024 * 1024
export function validateManifest(m) {
  if (m?.format !== 1 || m.runtime !== RUNTIME || m.ruleVersion !== RULE_VERSION || m.solverVersion !== SOLVER_INDEX_VERSION) throw new Error('数据需要新版软件，请先更新安装包')
  if (!/^[a-f0-9]{64}$/.test(m.id || '') || !/^[a-f0-9]{40}$/.test(m.revision || '')) throw new Error('数据版本标记无效')
  if (!Array.isArray(m.files) || m.files.length < 6 || m.files.length > 100) throw new Error('数据目录不完整')
  const seen = new Set(); let size = 0
  for (const f of m.files) {
    if (!/^(src\/data|generated)\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.json$/.test(f.path) || f.path.includes('..') || seen.has(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.size) || f.size < 1 || f.size > MAX_FILE_BYTES) throw new Error('不安全或损坏的数据目录')
    seen.add(f.path); size += f.size
  }
  if (size > 96 * 1024 * 1024) throw new Error('数据包超过大小限制')
  for (const path of ['src/data/servants.json','src/data/ces.json','src/data/quests.json','src/data/version.json','src/data/jp/bundle.json','generated/quest-browser-index.json']) if (!seen.has(path)) throw new Error(`缺少 ${path}`)
  return m
}
export function remoteFileUrl(m, path) {
  if (!m.files.some(f => f.path === path)) throw new Error('文件不在更新目录中')
  return `https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/${m.revision}/${path}`
}
export async function digest(bytes) {
  const result = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(result)].map(x => x.toString(16).padStart(2, '0')).join('')
}
