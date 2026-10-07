import { get, put, commitStage, status } from './store.js'
import { UPDATE_URL, validateManifest, remoteFileUrl, digest, MAX_FILE_BYTES } from './manifest.js'
import { precomputeRegion, regionCacheKey } from './precompute.js'
const root = new URL('../../', import.meta.url)
let current, started, logs, running = false
async function report(phase, extra = {}) {
  current = { ...current, state: 'running', phase, elapsedMs: Date.now() - started, updatedAt: Date.now(), ...extra }
  logs.push({ at: Date.now(), text: phase }); logs = logs.slice(-60)
  current.logs = logs
  await put('meta', 'status', current)
  self.postMessage(current)
}
async function bytes(url, limit = MAX_FILE_BYTES) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 90000)
    try {
      const response = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const reader = response.body.getReader(), parts = []; let count = 0
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        count += value.length
        if (count > limit) { await reader.cancel(); throw new Error('文件超过大小限制') }
        parts.push(value)
      }
      const out = new Uint8Array(count); let offset = 0
      for (const part of parts) { out.set(part, offset); offset += part.length }
      return out
    } catch (error) {
      if (attempt === 3) throw error
      await report(`下载重试 ${attempt}/3：${error.message}`)
    } finally { clearTimeout(timer) }
  }
}
async function json(url, limit) { return JSON.parse(new TextDecoder().decode(await bytes(url, limit))) }
async function run(command = {}) {
  if (running) return
  running = true; started = Date.now(); current = await status(); logs = current.logs || []
  try {
    await report(command.offline ? '读取随软件附带的数据' : '检查国服与日服数据', { done: 0, total: 0, error: '', changed: 0 })
    let bundled = false, manifest
    const active = await get('meta', 'active')
    try {
      manifest = validateManifest(await json(command.offline ? new URL('generated/native-data-manifest.json', root) : UPDATE_URL, 1024 * 1024))
      bundled = Boolean(command.offline)
    } catch (error) {
      if (active && !command.offline) throw error
      manifest = validateManifest(await json(new URL('generated/native-data-manifest.json', root), 1024 * 1024))
      bundled = true
      await report('网络检查失败，使用安装包内的数据并计算本地索引')
    }
    if (await digest(new TextEncoder().encode(JSON.stringify(manifest.files))) !== manifest.id) throw new Error('目录指纹不一致')
    if (active?.id === manifest.id && !command.force) {
      const complete = { ...current, state: 'done', phase: '数据已是最新，无需重复预计算', checkedAt: Date.now(), elapsedMs: Date.now() - started }
      await put('meta', 'status', complete); self.postMessage(complete); return
    }
    const checkpoint = await get('meta', 'checkpoint')
    await put('meta', 'checkpoint', manifest)
    let done = 0, changed = 0
    for (const f of manifest.files) {
      await report(`下载与校验：${f.path}`, { done, total: manifest.files.length })
      const existing = await get('files', f.path)
      const staged = checkpoint?.id === manifest.id ? await get('stage', f.path) : null
      if (staged?.sha256 === f.sha256) { done++; continue }
      if (existing?.sha256 === f.sha256) await put('stage', f.path, existing)
      else {
        const data = await bytes(bundled ? new URL(f.path, root) : remoteFileUrl(manifest, f.path))
        if (data.byteLength !== f.size || await digest(data) !== f.sha256) throw new Error(`${f.path} 校验不一致，保留上一份完整数据`)
        await put('stage', f.path, { sha256: f.sha256, data: JSON.parse(new TextDecoder().decode(data)) })
        changed++
      }
      done++
    }
    const file = async p => (await get('stage', p))?.data
    const version = await file('src/data/version.json')
    const cn = { region: 'CN', servants: await file('src/data/servants.json'), ces: await file('src/data/ces.json'), quests: await file('src/data/quests.json'), traits: await file('src/data/traits.json'), version, bondBonuses: await file('src/data/bond-bonuses.json') }
    const jp = await file('src/data/jp/bundle.json')
    for (const [region, bundle] of [['CN', cn], ['JP', jp]]) {
      const key = regionCacheKey(bundle, region)
      let computed = !command.force ? await get('cache', key) : null
      await report(`${region === 'CN' ? '国服' : '日服'}：${computed ? '复用已验证的本地索引' : '预计算从者灵基、礼装作用与组合索引'}`, { done, total: manifest.files.length, changed })
      if (!computed) { computed = precomputeRegion(bundle, region); await put('cache', key, computed) }
      if (region === 'CN') {
        // Preserve source checksum: these derived overrides are scoped to this
        // source version and are independently validated above.
        for (const [path, data] of [['src/data/solver-index.json', computed.solverIndex], ['generated/combination-factors.json', computed.factorIndex]]) {
          const rec = await get('stage', path)
          if (rec) await put('stage', path, { ...rec, data, derived: true })
        }
      } else await put('stage', 'src/data/jp/bundle.json', { ...(await get('stage', 'src/data/jp/bundle.json')), data: { ...jp, solverIndex: computed.solverIndex, factorIndex: computed.factorIndex }, derived: true })
    }
    const complete = { ...current, state: 'done', phase: '数据更新与本地预计算完成', done: manifest.files.length, total: manifest.files.length, changed, checkedAt: Date.now(), completedAt: Date.now(), elapsedMs: Date.now() - started, dataId: manifest.id }
    await commitStage(manifest, complete)
    self.postMessage(complete)
  } catch (error) {
    const failed = { ...current, state: 'error', phase: '任务失败，已保留旧数据和下载进度', error: String(error.message || error), elapsedMs: Date.now() - started }
    await put('meta', 'status', failed).catch(() => {}); self.postMessage(failed)
  } finally { running = false }
}
self.onmessage = e => run(e.data || {})
