export function layoutMode(width, height) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  if (w <= 640) return h >= w ? 'phone-portrait' : 'phone-landscape'
  if (w <= 1100) return h >= w ? 'tablet-portrait' : 'tablet-landscape'
  return 'pc'
}

export function shellClass(mode, { hasDetail = false } = {}) {
  let base = 'app-shell pc'
  if (mode === 'phone-portrait' || mode === 'phone-landscape') base = 'app-shell phone'
  else if (mode === 'tablet-portrait') base = 'app-shell tablet portrait'
  else if (mode === 'tablet-landscape') base = 'app-shell tablet landscape'
  return hasDetail ? `${base} has-detail` : base
}
