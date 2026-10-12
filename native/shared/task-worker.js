import { get, put, commitStage, status } from './store.js'
import { UPDATE_URL, validateManifest, remoteFileUrl, digest, MAX_FILE_BYTES } from './manifest.js'
import { precomputeRegion, regionCacheKey, baseCacheKey, accountProjectionKey, projectAccountDomain } from './precompute.js'
import { estimatePrecompute, precomputeUnits } from './precompute-plan.js'
const root = new URL('../../', import.meta.url)
let current, started, logs, running = false
async function report(phase, extra = {}) {
  current = { ...current, state: 'running', phase, elapsedMs: Date.now() - started, updatedAt: Date.now(), ...extra }
  logs.push({ at: Date.now(), text: phase }); logs = logs.slice(-60)
  console.info('Native task:', phase)
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
    await report(command.offline ? '读取随软件附带的数据' : '检查国服与日服数据', { done: 0, total: 0, error: '', changed: 0, precomputeNeeded: null, estimate: null })
    let bundled = false, manifest
    const active = await get('meta', 'active')
    try {
      manifest = command.accountOnly && active ? validateManifest(active) : validateManifest(await json(command.offline ? new URL('generated/native-data-manifest.json', root) : UPDATE_URL, 1024 * 1024))
      bundled = Boolean(command.offline)
    } catch (error) {
      if (active && !command.offline) throw error
      manifest = validateManifest(await json(new URL('generated/native-data-manifest.json', root), 1024 * 1024))
      bundled = true
      await report('网络检查失败，使用安装包内的数据并计算本地索引')
    }
    if (await digest(new TextEncoder().encode(JSON.stringify(manifest.files))) !== manifest.id) throw new Error('目录指纹不一致')
    const profiles = (await get('meta', 'accountProfiles'))?.profiles || []
    async function plansFor(bundles) {
      const plans = []
      for (const [region, bundle] of bundles) {
        const key = await regionCacheKey(bundle, region), baseKey = baseCacheKey(bundle, region)
        const computed = !command.force ? await get('cache', key) : null
        const base = !command.force ? await get('cache', baseKey) : null
        const accounts = []
        for (const profile of profiles.filter(p => p.region === region)) {
          const accountKey = await accountProjectionKey(key, profile)
          accounts.push({ profile, key: accountKey, needed: command.force || !await get('cache', accountKey) })
        }
        plans.push({ region, bundle, key, baseKey, computed, base, accounts })
      }
      return plans
    }
    if (active?.id === manifest.id && !command.force) {
      const cn = { region: 'CN', servants: (await get('files','src/data/servants.json'))?.data, ces: (await get('files','src/data/ces.json'))?.data,
        quests: (await get('files','src/data/quests.json'))?.data, traits: (await get('files','src/data/traits.json'))?.data,
        version: (await get('files','src/data/version.json'))?.data, bondBonuses: (await get('files','src/data/bond-bonuses.json'))?.data }
      const jp = (await get('files','src/data/jp/bundle.json'))?.data
      const checkPlans = await plansFor([['CN',cn],['JP',jp]])
      if (checkPlans.every(p => p.computed && p.accounts.every(a => !a.needed))) {
        const complete = { ...current, state: 'done', phase: '数据与全部账号索引已是最新，无需重复预计算', precomputeNeeded: false, estimate: null, accountCount: profiles.length, checkedAt: Date.now(), elapsedMs: Date.now() - started }
        await put('meta', 'status', complete); self.postMessage(complete); return
      }
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
    // These bundled/previous derived indexes are rebuilt or loaded from cache
    // below. Release their JSON-expanded graphs before regional computation.
    delete jp.solverIndex; delete jp.factorIndex; delete jp.joinedEffectIndex
    const plans = await plansFor([['CN', cn], ['JP', jp]])
    let history = (await get('meta','precomputeHistory')) || []
    const jobs = plans.filter(p => !p.computed || p.accounts.some(a => a.needed))
    const units = jobs.reduce((n,p) => n + precomputeUnits(p.bundle, { baseNeeded: !p.base, jointNeeded: !p.computed, accounts: p.accounts.filter(a => a.needed).length }), 0)
    const estimate = estimatePrecompute(units, history)
    await report(jobs.length ? '需要预计算：更新公共效果与受影响账号的小范围索引' : '无需预计算：公共效果与全部账号索引均可复用',
      { precomputeNeeded: !!jobs.length, estimate: jobs.length ? estimate : null, accountCount: profiles.length, done, total: manifest.files.length, changed })
    const calculationStart = Date.now()
    for (const p of plans) {
      const { region, bundle, key } = p
      let computed = p.computed
      await report(`${region === 'CN' ? '国服' : '日服'}：${computed ? '复用公共联合索引' : p.base ? '复用礼装索引，更新活动联合效果' : '预计算礼装、活动与编队条件联合索引'}`, { done, total: manifest.files.length, changed })
      if (!computed) {
        const previousJoint = (await get('meta', 'lastJoint:' + region)) || null
        computed = precomputeRegion(bundle, region, { base: p.base, previousJoint })
        await put('cache', key, computed)
        await put('cache', p.baseKey, { solverIndex: computed.solverIndex, factorIndex: computed.factorIndex })
        await put('meta', 'lastJoint:' + region, computed.joinedEffectIndex)
      }
      for (const a of p.accounts) {
        if (!a.needed) continue
        await report(`${region === 'CN' ? '国服' : '日服'}：筛选账号「${a.profile.name}」的可用身份与库存`)
        await put('cache', a.key, projectAccountDomain(computed, bundle, a.profile))
      }
      if (region === 'CN') {
        // Preserve source checksum: these derived overrides are scoped to this
        // source version and are independently validated above.
        for (const [path, data] of [['src/data/solver-index.json', { ...computed.solverIndex, activityScores: computed.joinedEffectIndex.activityScores }], ['generated/combination-factors.json', computed.factorIndex], ['generated/joined-effects.json', computed.joinedEffectIndex]]) {
          const rec = await get('stage', path)
          if (rec) await put('stage', path, { ...rec, data, derived: true, sourceDataId: manifest.id })
          else if (path === 'generated/joined-effects.json') await put('stage', path, { data, sha256: await digest(new TextEncoder().encode(JSON.stringify(data))), derived: true, sourceDataId: manifest.id })
        }
      } else {
        const rec = await get('stage', 'src/data/jp/bundle.json')
        await put('stage', 'src/data/jp/bundle.json', { sha256: rec.sha256, data: { ...jp, solverIndex: computed.solverIndex, factorIndex: computed.factorIndex, joinedEffectIndex: computed.joinedEffectIndex }, derived: true })
      }
      p.bundle = null; p.computed = null; p.base = null
    }
    if (units) { history = [...history, { units, durationMs: Math.max(1, Date.now() - calculationStart) }].slice(-12); await put('meta','precomputeHistory',history) }
    const complete = { ...current, state: 'done', phase: '数据更新与本地预计算完成', done: manifest.files.length, total: manifest.files.length, changed, checkedAt: Date.now(), completedAt: Date.now(), elapsedMs: Date.now() - started, dataId: manifest.id }
    await commitStage(manifest, complete)
    self.postMessage(complete)
  } catch (error) {
    const failed = { ...current, state: 'error', phase: '任务失败，已保留旧数据和下载进度', error: String(error.message || error), elapsedMs: Date.now() - started }
    await put('meta', 'status', failed).catch(() => {}); self.postMessage(failed)
  } finally { running = false }
}
self.onmessage = e => run(e.data || {})
