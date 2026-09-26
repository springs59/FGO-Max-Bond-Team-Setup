const ATLAS = 'https://static.atlasacademy.io'

function regionOrder(region) {
  return region === 'JP' ? ['JP', 'CN'] : ['CN', 'JP']
}

export function servantFaceUrls(svt, { region = 'CN' } = {}) {
  const id = Number(svt && svt.id) || 0
  const urls = []
  if (svt && svt.face) urls.push(svt.face)
  if (id) {
    for (const code of regionOrder(region)) {
      for (const stage of [0, 1, 4, 3]) {
        urls.push(`${ATLAS}/${code}/Faces/f_${id}${stage}.png`)
      }
    }
  }
  return [...new Set(urls.filter(Boolean))]
}

export function servantGraphUrls(svt, { region = 'CN' } = {}) {
  const id = Number(svt && svt.id) || 0
  const urls = []
  if (!id) return urls
  for (const code of regionOrder(region)) {
    urls.push(`${ATLAS}/${code}/CharaGraph/${id}/${id}a@1.png`)
    urls.push(`${ATLAS}/${code}/CharaGraph/${id}/${id}b@1.png`)
  }
  return urls
}

export function servantImageUrls(svt, opts) {
  return servantFaceUrls(svt, opts)
}

export function servantDetailUrls(svt, opts) {
  return [...new Set([...servantGraphUrls(svt, opts), ...servantFaceUrls(svt, opts)].filter(Boolean))]
}

export function servantIcon(svt, opts) {
  return servantFaceUrls(svt, opts)[0] || ''
}
