export function uniqueUrls(urls) {
  return [...new Set((urls || []).filter(Boolean))]
}

export function imgFallbackHtml(urls, alt, cls = '') {
  const list = uniqueUrls(urls)
  if (!list.length) return ''
  const [first, ...rest] = list
  const classAttr = cls ? ` class="${cls}"` : ''
  const extra = rest.join('|').replace(/"/g, '&quot;')
  return `<img${classAttr} src="${first}" alt="${alt || ''}" referrerpolicy="no-referrer" data-img="asset" data-fallbacks="${extra}" onerror="window.handleAtlasImgError&&window.handleAtlasImgError(this)" />`
}

export function consumeImgFallback(el) {
  const next = String((el && el.dataset && el.dataset.fallbacks) || '')
    .split('|')
    .filter(Boolean)
  if (!next.length) return false
  el.dataset.fallbacks = next.slice(1).join('|')
  el.src = next[0]
  return true
}

export function handleImgError(el) {
  if (!el || el.tagName !== 'IMG') return false
  const src = el.currentSrc || el.src || ''
  if (el.dataset.errSrc === src) return false
  el.dataset.errSrc = src
  if (consumeImgFallback(el)) return true
  if (el.dataset.img === 'detail') {
    const ph = document.createElement('div')
    ph.className = 'detail-art-ph'
    ph.textContent = el.alt || '立绘暂缺'
    el.replaceWith(ph)
    return false
  }
  el.style.display = 'none'
  return false
}
