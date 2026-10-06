import { bondEffectsForServant, ceBondEffects } from '../rules/index.js'
import { lookupCeAsset, lookupServantAsset } from '../assets/asset-index.js'
import { ceImageUrls } from '../assets/ce-images.js'
import { servantDetailUrls } from '../assets/servant-images.js'
import { renderBonusList } from './bonus-list.js'
import { renderCeEffectDetails } from './ce-effect-copy.js'
import { traitLabel } from './ce-effect-copy.js'
import { resolveServantState, abilitiesForState } from '../servant-state.js'
import { classLabel, attrLabel } from '../atlas.js'

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
  plans = [],
  traits = [],
} = {}) {
  if (!detail) return `<aside class="${detailPanelClass(layout)}" hidden></aside>`
  const backdrop = `<div class="detail-backdrop" data-detail-close="1"></div>`
  if (detail.kind === 'ce') {
    const ce = (ces || []).find((item) => item.id === Number(detail.id)) || null
    const asset = lookupCeAsset(assetIndex, detail.id)
    const mlb = detail.mlb !== false
    const effects = ceBondEffects(ce, { mlb, isSupport: Boolean(detail.isSupport) })
    const want = mlb ? 4 : 0
    const live = effects.filter((row) => Number(row.condLimitCount) === want)
    const liveRows = live.length ? live : effects.filter((row) => row.active)
    const fxOpts = { slots, servants, plans, ceId: detail.id, mlb, position: detail.position,
      scope: detail.scope || 'team', isSupport: Boolean(detail.isSupport) }
    return `${backdrop}<aside class="${detailPanelClass(layout)}" data-open="1">
      ${renderHead((ce && ce.name) || '礼装', `ID ${detail.id} · COST ${(ce && ce.cost) || 0}`)}
      ${artImg([asset && asset.icon, asset && asset.face, ...ceImageUrls(ce)], (ce && ce.name) || '礼装')}
      ${renderCeEffectDetails(liveRows, fxOpts)}
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
  const currentState = resolveServantState(svt, detail.formKey || '', detail.nice)
  const abilities = abilitiesForState(detail.nice, currentState, detail.extraSkills)
  const traitMap = new Map([...traits, ...(detail.nice?.traits || [])].map(t => [Number(t.id), t]))
  const traitNames = [...new Set((currentState?.traitIds || []).map(id => traitLabel(traitMap.get(Number(id)) || id)))]
  const meta = currentState ? `${classLabel(currentState.className)} · ${attrLabel(currentState.attribute)} · ${currentState.rarity}星 · COST ${currentState.cost} · ${currentState.formLabel}` : ''
  return `${backdrop}<aside class="${detailPanelClass(layout)}" data-open="1">
    ${renderHead((svt && svt.name) || '从者', meta)}
    ${artImg([...(detail.artUrls || []), asset && asset.graph, ...servantDetailUrls(svt || { id: detail.id }, { region })], (svt && svt.name) || '从者')}
    <section class="bonus-list"><h3>自身特性</h3><p>${esc(traitNames.join('、') || '无')}</p></section>
    <section class="bonus-list"><h3>当前灵基提供的 Buff</h3>
    ${abilities.length ? abilities.map(a => `<article class="ce-fx"><h4>${esc(a.group)} · ${esc(a.name)}</h4><p>${esc(a.detail || '无额外效果说明')}</p></article>`).join('') : `<p>${detail.nice ? '无' : '正在加载当前灵基技能资料…'}</p>`}</section>
    ${renderBonusList(effects, '活动羁绊加成')}
  </aside>`
}
