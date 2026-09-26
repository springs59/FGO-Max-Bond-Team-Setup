import { ceImageUrls } from './ce-images.js'
import { servantGraphUrls, servantImageUrls } from './servant-images.js'

export function buildAssetIndex({ servants = [], ces = [], region = 'CN' } = {}) {
  const servant = {}
  for (const svt of servants) {
    const id = Number(svt && svt.id) || 0
    if (!id) continue
    const urls = servantImageUrls(svt, { region })
    servant[id] = {
      icon: urls[0] || '',
      face: urls[0] || '',
      graph: servantGraphUrls(svt, { region })[0] || '',
    }
  }
  const craftEssence = {}
  for (const ce of ces) {
    const id = Number(ce && ce.id) || 0
    if (!id) continue
    const urls = ceImageUrls(ce)
    craftEssence[id] = {
      icon: urls[0] || '',
      face: (ce && ce.face) || urls[0] || '',
    }
  }
  return { servant, craftEssence }
}

export function lookupServantAsset(index, servantId) {
  return index && index.servant ? index.servant[Number(servantId) || 0] || null : null
}

export function lookupCeAsset(index, ceId) {
  return index && index.craftEssence ? index.craftEssence[Number(ceId) || 0] || null : null
}
