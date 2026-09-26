import { bondEffectsForServant, ceBondEffects, servantProvides, servantReceives } from '../rules/index.js'
import { lookupCeAsset, lookupServantAsset } from '../assets/asset-index.js'
import { renderBonusList } from './bonus-list.js'

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

export function renderDetailPanel({
  detail,
  servants = [],
  ces = [],
  catalog = null,
  quest = null,
  now,
  assetIndex = null,
  layout = 'pc',
} = {}) {
  if (!detail) return `<aside class="${detailPanelClass(layout)}" hidden></aside>`
  const backdrop = layout === 'phone' ? `<div class="detail-backdrop" data-detail-close="1"></div>` : ''
  if (detail.kind === 'ce') {
    const ce = (ces || []).find((item) => item.id === Number(detail.id)) || null
    const asset = lookupCeAsset(assetIndex, detail.id)
    const effects = ceBondEffects(ce, { mlb: detail.mlb !== false, isSupport: Boolean(detail.isSupport) })
    const img = (asset && asset.icon) || (ce && ce.face) || ''
    return `${backdrop}<aside class="${detailPanelClass(layout)}" data-open="1">
      <button type="button" class="detail-close" data-detail-close="1" aria-label="关闭">x</button>
      ${img ? `<img class="detail-art" src="${esc(img)}" alt="${esc(ce && ce.name)}" referrerpolicy="no-referrer" />` : ''}
      <h2>${esc((ce && ce.name) || '礼装')}</h2>
      <p class="detail-meta">ID ${esc(detail.id)} · COST ${(ce && ce.cost) || 0}</p>
      ${renderBonusList(effects.filter((row) => row.theoretical), '可以提供（理论）')}
      ${renderBonusList(effects.filter((row) => row.active), '当前实际生效')}
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
  const img = (asset && asset.face) || (svt && svt.face) || ''
  return `${backdrop}<aside class="${detailPanelClass(layout)}" data-open="1">
    <button type="button" class="detail-close" data-detail-close="1" aria-label="关闭">x</button>
    ${img ? `<img class="detail-art" src="${esc(img)}" alt="${esc(svt && svt.name)}" referrerpolicy="no-referrer" />` : ''}
    <h2>${esc((svt && svt.name) || '从者')}</h2>
    <p class="detail-meta">${esc((svt && svt.className) || '')} · ID ${esc(detail.id)}</p>
    ${renderBonusList(servantReceives(effects), '可以吃到')}
    ${renderBonusList(servantProvides(effects), '可以提供')}
  </aside>`
}
