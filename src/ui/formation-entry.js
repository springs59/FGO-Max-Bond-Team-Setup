import * as envelopes from '../solver/global-envelope.js'
import * as expansion from '../solver/global-curve-expand.js'
import * as descriptions from '../solver/global-curve-description.js'
import * as anonymous from '../solver/anonymous-effects.js'
import * as formation from '../solver/formation-effects.js'
import { buildFormationDomain, formationDomainMatches, formationScene } from '../solver/formation-domain.js'
import { get, put, isNative } from '../../native/shared/store.js'
import { regionCacheKey } from '../../native/shared/precompute.js'
import { digest } from '../../native/shared/manifest.js'

Object.assign(globalThis, envelopes, expansion, descriptions, anonymous, formation)
const $ = id => document.getElementById(id)
try {
  const context = parent.fgoFormationReviewContext
  if (!context) throw Error('请从配队主界面的“配队求解器与曲线”入口打开。')
  const domains = {}, local = []
  for (const [region, bundle] of Object.entries(context.bundles)) {
    if (!bundle) continue
    let computed = null
    if (isNative()) computed = await get('cache', await regionCacheKey(bundle, region)).catch(() => null)
    if (formationDomainMatches(computed?.formationDomain, bundle)) {
      domains[region] = computed.formationDomain; local.push(region)
    } else domains[region] = buildFormationDomain(bundle)
  }
  const catalog = { profiles: Object.values(domains).flatMap(d => d.profiles), activity: Object.assign({}, ...Object.values(domains).map(d => d.activity)) }
  for (const option of $('region').options) option.disabled = !domains[option.value]
  const memory = new Map()
  globalThis.FgoFormationRuntime = {
    catalog, region: context.region, base: context.base, cost: context.cost,
    close: context.close,
    assertCurrent(region) {
      if (!formationDomainMatches(domains[region], context.bundles[region])) throw Error('活动或编队条件的有效状态已变化，请关闭后重新打开。')
    },
    load(tag) { const domain = domains[catalog.profiles.find(p => p.tag === tag)?.region]; return formationScene(domain, tag) },
    async key(kind, scene, options, profiles) {
      const region = scene.source.region
      if (!formationDomainMatches(domains[region], context.bundles[region])) throw Error('活动或编队条件的有效状态已变化，请关闭后重新打开。')
      return `formation-review-v3:${kind}:${await digest(new TextEncoder().encode(JSON.stringify([scene.source, options, profiles])))}`
    },
    async read(key) {
      if (memory.has(key)) return memory.get(key)
      const saved = await get('cache', key).catch(() => null)
      // Keep the full key in the record as a second guard against unrelated caches.
      return saved?.key === key ? saved.value : null
    },
    async write(key, value) {
      memory.set(key, value)
      await put('cache', key, { key, value }).catch(() => {})
    },
  }
  const blocked = Object.values(domains).reduce((n, d) => n + d.unsupported.length, 0)
  $('data-source').textContent = `${local.length ? '优先使用本机已完成的预计算数据（' + local.join('／') + '）' : '使用主界面当前加载的图鉴与活动数据'}。曲线及精确核实优先复用本地计算结果。${context.accountName ? '当前账号：' + context.accountName + '；本页核实为自由图鉴范围，账号库存、满绊身份与锁定位置继续在主界面配队。' : '本页核实为自由图鉴范围。'}${blocked ? '当前快照中' + blocked + '项特殊关卡条件尚不能在曲线层完整解析，请在主界面按关卡规则求解。' : ''}`
  await import('./formation-review.js')
  let expired = false
  setInterval(() => {
    if (expired) return
    try { globalThis.FgoFormationRuntime.assertCurrent($('region').value) }
    catch (error) { expired = true; globalThis.FgoFormationInvalidated(error.message) }
  }, 1000)
} catch (error) {
  $('summary').textContent = error.message
  $('summary').className = 'card error'
  $('close-review').onclick = () => parent.fgoFormationReviewContext?.close()
}
