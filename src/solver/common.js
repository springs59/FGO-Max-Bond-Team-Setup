const EXTRA_I = new Set(['ruler', 'avenger', 'moonCancer', 'shielder'])
const EXTRA_II = new Set(['alterEgo', 'foreigner', 'pretender', 'beast', 'unBeast', 'beastEresh', 'unBeastOlgaMarie'])

export function extraGroupOf(className) {
  if (EXTRA_I.has(className)) return 1
  if (EXTRA_II.has(className)) return 2
  return 0
}

export function classBucketOf(className, extra) {
  const group = extra == null ? extraGroupOf(className) : extra
  if (group === 1) return 'extra1'
  if (group === 2) return 'extra2'
  return className || 'unknown'
}

export function traitSig(traitIds) {
  return (traitIds || [])
    .map((id) => Number(id))
    .filter((id) => id)
    .sort((a, b) => a - b)
    .join(',')
}

export function costBucketOf(cost) {
  const n = Number(cost) || 0
  if (n <= 4) return '0-4'
  if (n <= 8) return '5-8'
  if (n <= 12) return '9-12'
  if (n <= 16) return '13-16'
  return '17+'
}
