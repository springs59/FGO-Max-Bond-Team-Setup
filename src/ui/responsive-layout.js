export function layoutMode(width, height) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  if (w <= 640) return h >= w ? 'phone-portrait' : 'phone-landscape'
  if (w <= 1100) return h >= w ? 'tablet-portrait' : 'tablet-landscape'
  return 'pc'
}

export function shellClass(mode) {
  if (mode === 'phone-portrait' || mode === 'phone-landscape') return 'app-shell phone'
  if (mode === 'tablet-portrait') return 'app-shell tablet portrait'
  if (mode === 'tablet-landscape') return 'app-shell tablet landscape'
  return 'app-shell pc'
}
