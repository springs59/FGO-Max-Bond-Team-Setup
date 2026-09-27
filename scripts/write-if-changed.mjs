import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

// Preserve bytes and mtime when a successful refresh has identical content.
export async function writeIfChanged(path, text) {
  try { if (await readFile(path, 'utf8') === text) return false }
  catch (err) { if (err.code !== 'ENOENT') throw err }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(`${path}.tmp`, text)
  await rename(`${path}.tmp`, path)
  return true
}
export function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableJson(value[key])]))
  return value
}
