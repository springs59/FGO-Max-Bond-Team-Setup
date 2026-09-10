export const BOND15_LV = 15
export const CE_ID_MIN = 9300000

function isBytes(raw) {
  return typeof ArrayBuffer !== 'undefined' && (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw))
}

function toUint8(raw) {
  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  throw new Error('bytes')
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function walk(node, visit, seen = new Set()) {
  if (!node || typeof node !== 'object') return
  if (seen.has(node)) return
  seen.add(node)
  visit(node)
  const values = Array.isArray(node) ? node : Object.values(node)
  for (const value of values) walk(value, visit, seen)
}

function bondLvOf(node) {
  if (node.bondLv != null) return num(node.bondLv)
  if (node.friendshipRank != null) return num(node.friendshipRank)
  return 0
}

function isCollection(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const id = num(node.svtId)
  if (!id) return false
  return node.friendshipRank != null || node.bondLv != null || node.maxFriendshipRank != null
}

function isInstance(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const id = num(node.svtId || node.ceId || node.id)
  if (!id) return false
  if (isCollection(node)) return false
  return node.limitCount != null || node.lv != null || node.curLv != null
}

function ownedStatus(node) {
  if (node.status == null) return true
  return num(node.status) >= 2
}

function upsertServant(map, id, bondLv) {
  if (!id || id >= CE_ID_MIN) return
  const prev = map.get(id) || { id, bondLv: 0 }
  prev.bondLv = Math.max(prev.bondLv, num(bondLv))
  map.set(id, prev)
}

function upsertCe(map, id, limitCount) {
  if (!id || id < CE_ID_MIN) return
  const prev = map.get(id) || { id, limitCount: 0, mlb: false }
  prev.limitCount = Math.max(prev.limitCount, num(limitCount))
  prev.mlb = prev.limitCount >= 4
  map.set(id, prev)
}

function ingestChaldeaMaps(node, servants, ces) {
  const svtMap = node.svtStatus || node.servantStatus || node.servants
  if (svtMap && typeof svtMap === 'object' && !Array.isArray(svtMap)) {
    for (const [key, value] of Object.entries(svtMap)) {
      const rec = value && typeof value === 'object' ? value : {}
      const id = num(rec.svtId || rec.id || key)
      upsertServant(servants, id, bondLvOf(rec))
    }
  }
  const ceMap = node.craftEssenceStatus || node.ceStatus || node.craftEssences
  if (ceMap && typeof ceMap === 'object' && !Array.isArray(ceMap)) {
    for (const [key, value] of Object.entries(ceMap)) {
      const rec = value && typeof value === 'object' ? value : {}
      const id = num(rec.svtId || rec.ceId || rec.id || key)
      upsertCe(ces, id, rec.limitCount)
    }
  }
  if (Array.isArray(node.servants)) {
    for (const rec of node.servants) {
      const id = num(rec.svtId || rec.id)
      upsertServant(servants, id, bondLvOf(rec))
    }
  }
  if (Array.isArray(node.craftEssences)) {
    for (const rec of node.craftEssences) {
      const id = num(rec.svtId || rec.ceId || rec.id)
      upsertCe(ces, id, rec.limitCount)
    }
  }
}

function masterLvFromNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return 0
  let lv = 0
  if (node.userGame) {
    const games = Array.isArray(node.userGame) ? node.userGame : [node.userGame]
    for (const game of games) {
      if (!game || typeof game !== 'object') continue
      lv = Math.max(lv, num(game.lv), num(game.userLv))
    }
  }
  if (node.userLv != null && node.svtId == null && node.limitCount == null) {
    lv = Math.max(lv, num(node.userLv))
  }
  if (node.lv != null && node.qp != null && node.svtId == null && node.limitCount == null) {
    lv = Math.max(lv, num(node.lv))
  }
  return lv
}

function ingestFateLogin(data, servants, ces) {
  const cache = data && data.cache
  if (!cache || typeof cache !== 'object') return false
  let hit = false
  for (const bag of [cache.replaced, cache.updated, cache.delta]) {
    if (!bag || typeof bag !== 'object') continue
    const collection = bag.userSvtCollection
    if (Array.isArray(collection)) {
      hit = true
      for (const rec of collection) {
        if (!rec || typeof rec !== 'object') continue
        if (!ownedStatus(rec)) continue
        upsertServant(servants, num(rec.svtId), bondLvOf(rec))
      }
    }
    for (const key of ['userSvt', 'userSvtStorage']) {
      const list = bag[key]
      if (!Array.isArray(list)) continue
      hit = true
      for (const rec of list) {
        if (!rec || typeof rec !== 'object') continue
        const id = num(rec.svtId || rec.ceId || rec.id)
        if (id >= CE_ID_MIN) upsertCe(ces, id, rec.limitCount)
      }
    }
  }
  return hit
}

function tryJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractJson(text) {
  const start = text.search(/[\[{]/)
  if (start < 0) return null
  const sliced = text.slice(start).trim()
  const direct = tryJson(sliced)
  if (direct) return direct
  const open = sliced[0]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let escape = false
  for (let i = 0; i < sliced.length; i++) {
    const ch = sliced[i]
    if (inStr) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') {
      inStr = true
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return tryJson(sliced.slice(0, i + 1))
    }
  }
  return null
}

function looksPhp(text) {
  const head = text.slice(0, 400).toLowerCase()
  return (
    head.includes('<?php') ||
    head.includes('<?php') ||
    /^\s*(?:\$\w+|return|array\s*\(|\[)/i.test(text)
  )
}

function parsePhp(input) {
  const s = input
  let i = 0

  function skip() {
    while (i < s.length) {
      const ch = s[i]
      if (/\s/.test(ch)) {
        i++
        continue
      }
      if (ch === '/' && s[i + 1] === '/') {
        i += 2
        while (i < s.length && s[i] !== '\n') i++
        continue
      }
      if (ch === '/' && s[i + 1] === '*') {
        i += 2
        while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++
        i += 2
        continue
      }
      if (ch === '#') {
        while (i < s.length && s[i] !== '\n') i++
        continue
      }
      break
    }
  }

  function eat(str) {
    skip()
    if (s.slice(i, i + str.length).toLowerCase() === str.toLowerCase()) {
      i += str.length
      return true
    }
    return false
  }

  function parseString(quote) {
    i++
    let out = ''
    while (i < s.length) {
      const ch = s[i]
      if (ch === '\\') {
        const next = s[i + 1]
        if (next === quote || next === '\\') {
          out += next
          i += 2
          continue
        }
        out += next || ''
        i += 2
        continue
      }
      if (ch === quote) {
        i++
        return out
      }
      out += ch
      i++
    }
    throw new Error('php string')
  }

  function parseNumber() {
    const start = i
    if (s[i] === '-') i++
    while (i < s.length && /[0-9.]/.test(s[i])) i++
    const raw = s.slice(start, i)
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }

  function parseArrayBody(end) {
    const entries = []
    skip()
    while (i < s.length && s[i] !== end) {
      skip()
      if (s[i] === end) break
      const value = parseValue()
      skip()
      if (s[i] === '=' && s[i + 1] === '>') {
        i += 2
        const rhs = parseValue()
        entries.push([value, rhs])
      } else {
        entries.push([entries.length, value])
      }
      skip()
      if (s[i] === ',') {
        i++
        skip()
      }
    }
    if (s[i] !== end) throw new Error('php array')
    i++
    const sequential = entries.every((entry, idx) => entry[0] === idx || entry[0] === String(idx))
    if (sequential) return entries.map((entry) => entry[1])
    const obj = {}
    for (const [key, value] of entries) obj[key] = value
    return obj
  }

  function parseValue() {
    skip()
    const ch = s[i]
    if (ch === '\'' || ch === '"') return parseString(ch)
    if (ch === '-' || /[0-9]/.test(ch)) return parseNumber()
    if (eat('null')) return null
    if (eat('true')) return true
    if (eat('false')) return false
    if (eat('array')) {
      skip()
      if (s[i] !== '(') throw new Error('php array')
      i++
      return parseArrayBody(')')
    }
    if (ch === '[') {
      i++
      return parseArrayBody(']')
    }
    if (ch === '{') {
      const json = extractJson(s.slice(i))
      if (json) {
        const chunk = JSON.stringify(json)
        i += chunk.length
        return json
      }
    }
    throw new Error('php value')
  }

  skip()
  if (s.slice(i, i + 5).toLowerCase() === '<?php') i += 5
  else if (s.slice(i, i + 2) === '<?') i += 2
  skip()
  if (s[i] === '$') {
    while (i < s.length && s[i] !== '=') i++
    if (s[i] === '=') i++
  }
  skip()
  eat('return')
  const value = parseValue()
  return value
}

function stripHttpEnvelope(text) {
  if (!/^HTTP\/\d/i.test(text)) return text
  const crlf = text.indexOf('\r\n\r\n')
  const lf = text.indexOf('\n\n')
  let idx = -1
  if (crlf >= 0 && (lf < 0 || crlf <= lf)) idx = crlf + 4
  else if (lf >= 0) idx = lf + 2
  if (idx < 0) return text
  return text.slice(idx).trim()
}

function b64ToUtf8(s) {
  const cleaned = String(s).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = cleaned.length % 4
  const padded = pad ? cleaned + '='.repeat(4 - pad) : cleaned
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf8')
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function tryFateBase64(content) {
  let s = content.trim()
  try {
    s = decodeURIComponent(s)
  } catch {
    /* keep original */
  }
  s = s.trim()
  if (s.startsWith('"') && s.endsWith('"') && s.length > 2) {
    try {
      s = JSON.parse(s)
    } catch {
      s = s.slice(1, -1)
    }
  }
  if (typeof s !== 'string' || !s.startsWith('ey')) return null
  try {
    return tryJson(b64ToUtf8(s))
  } catch {
    return null
  }
}

export function decodeAccountText(raw) {
  let text = String(raw || '').replace(/^\uFEFF/, '').trim()
  if (!text) throw new Error('empty')
  text = stripHttpEnvelope(text)
  const asJson = tryJson(text)
  if (asJson) return asJson
  const b64 = tryFateBase64(text)
  if (b64) return b64
  if (looksPhp(text)) {
    try {
      return parsePhp(text)
    } catch {
      /* try JSON body next */
    }
  }
  const embedded = extractJson(text)
  if (embedded) return embedded
  throw new Error('decode')
}

function bytesToUtf8(bytes) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

async function inflate(bytes, format) {
  if (typeof DecompressionStream === 'function') {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    } catch {
      /* try node zlib next */
    }
  }
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const zlib = await import('node:zlib')
      if (format === 'gzip') return new Uint8Array(zlib.gunzipSync(bytes))
      if (format === 'deflate-raw') return new Uint8Array(zlib.inflateRawSync(bytes))
      if (format === 'deflate') return new Uint8Array(zlib.inflateSync(bytes))
    } catch {
      return null
    }
  }
  return null
}

function looksPlainAccountText(text) {
  const t = text.trim()
  return (
    t.startsWith('{') ||
    t.startsWith('[') ||
    t.startsWith('ey') ||
    t.startsWith('HTTP') ||
    looksPhp(t)
  )
}

async function decodeFromBytes(bytes) {
  if (!bytes || !bytes.length) throw new Error('empty')
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const unzipped = await inflate(bytes, 'gzip')
    if (unzipped) return decodeFromBytes(unzipped)
  }
  const text = bytesToUtf8(bytes).replace(/^\uFEFF/, '')
  if (looksPlainAccountText(text)) return decodeAccountText(text)
  const raw = await inflate(bytes, 'deflate-raw')
  if (raw) return decodeAccountText(bytesToUtf8(raw))
  const deflated = await inflate(bytes, 'deflate')
  if (deflated) return decodeAccountText(bytesToUtf8(deflated))
  return decodeAccountText(text)
}

function failParse(error) {
  return { ok: false, error, source: '', servants: [], ces: [], masterLv: 0 }
}

export function parseAccount(raw) {
  let data = raw
  if (isBytes(raw)) {
    try {
      data = decodeAccountText(bytesToUtf8(toUint8(raw)))
    } catch {
      return failParse('文件无法解析')
    }
  } else if (typeof raw === 'string') {
    try {
      data = decodeAccountText(raw)
    } catch {
      return failParse('文件无法解析')
    }
  }
  if (!data || typeof data !== 'object') {
    return failParse('文件格式无法识别')
  }

  const servants = new Map()
  const ces = new Map()
  let masterLv = 0
  let sawDump = ingestFateLogin(data, servants, ces)
  let sawChaldea = false

  walk(data, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return
    if (node.svtStatus || node.craftEssenceStatus || node.ceStatus) sawChaldea = true
    if (Array.isArray(node.users) || node.region != null) sawChaldea = true
    masterLv = Math.max(masterLv, masterLvFromNode(node))
    ingestChaldeaMaps(node, servants, ces)

    if (isCollection(node)) {
      sawDump = true
      if (!ownedStatus(node)) return
      upsertServant(servants, num(node.svtId), bondLvOf(node))
    }
    if (isInstance(node)) {
      const id = num(node.svtId || node.ceId || node.id)
      sawDump = true
      if (id >= CE_ID_MIN) upsertCe(ces, id, node.limitCount)
      else upsertServant(servants, id, bondLvOf(node))
    }
  })

  const servantList = [...servants.values()].sort((a, b) => a.id - b.id)
  const ceList = [...ces.values()].sort((a, b) => a.id - b.id)
  if (!servantList.length && !ceList.length) {
    return failParse('文件格式无法识别')
  }

  const source = sawChaldea ? 'chaldea' : 'dump'
  return { ok: true, error: '', source, servants: servantList, ces: ceList, masterLv }
}

export async function parseAccountFile(raw) {
  if (typeof raw === 'string' || (raw && typeof raw === 'object' && !isBytes(raw))) {
    return parseAccount(raw)
  }
  try {
    const data = await decodeFromBytes(toUint8(raw))
    return parseAccount(data)
  } catch {
    return failParse('文件无法解析')
  }
}

export function accountServantOf(account, svtId) {
  if (!account) return null
  return account.servants.find((item) => item.id === Number(svtId)) || null
}

export function accountCeOf(account, ceId) {
  if (!account) return null
  return account.ces.find((item) => item.id === Number(ceId)) || null
}
