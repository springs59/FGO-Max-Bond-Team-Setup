import { bondEffectsForServant, ceBondEffects, servantProvides, servantReceives } from '../rules/index.js'
import { lookupCeAsset, lookupServantAsset } from '../assets/asset-index.js'
import { ceImageUrls } from '../assets/ce-images.js'
import { servantDetailUrls } from '../assets/servant-images.js'
import { renderBonusList } from './bonus-list.js'
import { renderCeEffectDetails } from './ce-effect-copy.js'

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function detailPanelClass(layout = 'pc') {
  if (layout === 'phone') return 'detail-panel sheet'
  return 'detail-panel dock'
}

function renderHead(title, meta) {
  return `<div class="detail-head">
      <div>
        <h2>${esc(title)}</h2>
        <p class="detail-meta">${esc(meta)}</p>
      </div>
      <button type="button" class="detail-close" data-detail-close="1" aria-label="关闭">关闭</button>
    </div>`
}

function artImg(urls, alt) {
  const list = [...new Set((urls || []).filter(Boolean))]
  if (!list.length) return `<div class="detail-art-ph">${esc(alt || '立绘暂缺')}</div>`
  const [first, ...rest] = list
  return `<img class="detail-art" src="${esc(first)}" alt="${esc(alt)}" referrerpolicy="no-referrer" decoding="async" data-img="detail" data-fallbacks="${esc(rest.join('|'))}" onerror="window.handleAtlasImgError&&window.handleAtlasImgError(this)" />`
}

export function renderDetailPanel({
  detail,
  servants = [],
  ces = [],
  catalog = null,
  quest = null,
  now,
  assetIndex = null,
  layout = 'pc',
  region = 'CN',
  tab = 'recv',
  slots = [],
} = {}) {
  if (!detail) return `<aside class="${detailPanelClass(layout)}" hidden></aside>`
  const backdrop = `<div class="detail-backdrop" data-detail-close="1"></div>`
  const current = tab === 'give' ? 'give' : 'recv'
  if (detail.kind === 'ce') {
    const ce = (ces || []).find((item) => item.id === Number(detail.id)) || null
    const asset = lookupCeAsset(assetIndex, detail.id)
    const mlb = detail.mlb !== false
    const effects = ceBondEffects(ce, { mlb, isSupport: Boolean(detail.isSupport) })
    const want = mlb ? 4 : 0
    const live = effects.filter((row) => Number(row.condLimitCount) === want)
    const liveRows = live.length ? live : effects.filter((row) => row.active)
    const fxOpts = { slots, servants, isSupport: Boolean(detail.isSupport) }
    return `${backdrop}<aside class="${detailPanelClass(layout)}" data-open="1">
      ${renderHead((ce && ce.name) || '礼装', `ID ${detail.id} · COST ${(ce && ce.cost) || 0}`)}
      ${artImg([asset && asset.icon, asset && asset.face, ...ceImageUrls(ce)], (ce && ce.name) || '礼装')}
      ${renderDetailTabs(current, [
        { id: 'recv', label: '当前生效', html: renderCeEffectDetails(liveRows, fxOpts) },
        { id: 'give', label: '可以提供', html: renderCeEffectDetails(effects, fxOpts) },
      ])}
    </aside>`
  }
  const svt = (servants || []).find((item) => item.id === Number(detail.id)) || null
  const asset = lookupServantAsset(assetIndex, detail.id)
  const effects = bondEffectsForServant({
    servantId: detail.id,
    catalog,
    quest,
    now,
  })
  return `${backdrop}<aside class="${detailPanelClass(layout)}" data-open="1">
    ${renderHead((svt && svt.name) || '从者', `${(svt && svt.className) || ''} · ID ${detail.id}`)}
    ${artImg([...(detail.artUrls || []), asset && asset.graph, ...servantDetailUrls(svt || { id: detail.id }, { region })], (svt && svt.name) || '从者')}
    ${renderDetailTabs(current, [
      { id: 'recv', label: '可以吃到', html: renderBonusList(servantReceives(effects), '可以吃到') },
      { id: 'give', label: '可以提供', html: renderBonusList(servantProvides(effects), '可以提供') },
    ])}
  </aside>`
}

function renderDetailTabs(current, tabs) {
  const buttons = tabs
    .map(
      (item) =>
        `<button type="button" class="detail-tab${item.id === current ? ' active' : ''}" data-detail-tab="${esc(item.id)}">${esc(item.label)}</button>`,
    )
    .join('')
  const bodies = tabs
    .map((item) => `<div class="detail-tab-body" data-tab="${esc(item.id)}"${item.id === current ? '' : ' hidden'}>${item.html}</div>`)
    .join('')
  return `<div class="detail-tabs">${buttons}</div>${bodies}`
}
