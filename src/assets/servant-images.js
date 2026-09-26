export function servantImageUrls(svt, { region = 'CN' } = {}) {
  const id = Number(svt && svt.id) || 0
  const regions = region === 'JP' ? ['JP', 'CN'] : ['CN', 'JP']
  const urls = []
  if (svt && svt.face) urls.push(svt.face)
  if (id) {
    for (const code of regions) {
      urls.push(`https://static.atlasacademy.io/${code}/Faces/f_${id}0.png`)
    }
  }
  return [...new Set(urls.filter(Boolean))]
}

export function servantIcon(svt, opts) {
  return servantImageUrls(svt, opts)[0] || ''
}
