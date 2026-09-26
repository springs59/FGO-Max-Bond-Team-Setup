export function uniqueUrls(urls) {
  return [...new Set((urls || []).filter(Boolean))]
}

export function imgFallbackHtml(urls, alt, cls = '') {
  const list = uniqueUrls(urls)
  if (!list.length) return ''
  const [first, ...rest] = list
  const classAttr = cls ? ` class="${cls}"` : ''
  const extra = rest.join('|').replace(/"/g, '&quot;')
  return `<img${classAttr} src="${first}" alt="${alt || ''}" referrerpolicy="no-referrer" data-img="asset" data-fallbacks="${extra}" />`
}
