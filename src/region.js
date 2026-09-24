export const REGION_CN = 'CN'
export const REGION_JP = 'JP'
export const DEFAULT_REGION = REGION_CN

export function normalizeRegion(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'jp' || raw === 'ja' || raw === 'japan') return REGION_JP
  return REGION_CN
}

export function parseAccountRegion(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return ''
  if (raw === 'jp' || raw === 'ja' || raw === 'japan') return REGION_JP
  if (raw === 'cn' || raw === 'china' || raw === 'zh' || raw === 'chn') return REGION_CN
  return ''
}

export function regionLabel(region) {
  return normalizeRegion(region) === REGION_JP ? '日服' : '国服'
}

export function atlasRegion(region) {
  return normalizeRegion(region)
}
