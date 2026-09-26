const ATLAS = 'https://static.atlasacademy.io'

export function encodeAtlasUrl(url) {
  return String(url || '').replace(/@/g, '%40')
}

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
  const bags = [
    svt && svt.extraAssets && svt.extraAssets.charaGraph,
    svt && svt.extraAssets && svt.extraAssets.charaGraphChanged,
  ]
  for (const bag of bags) {
    for (const group of [bag && bag.ascension, bag && bag.costume]) {
      for (const url of Object.values(group || {})) {
        if (url) urls.push(encodeAtlasUrl(url))
      }
    }
  }
  for (const code of regionOrder(region)) {
    for (const letter of ['a', 'b']) {
      for (const size of ['1', '2']) {
        urls.push(`${ATLAS}/${code}/CharaGraph/${id}/${id}${letter}%40${size}.png`)
      }
    }
  }
  return [...new Set(urls.filter(Boolean))]
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
