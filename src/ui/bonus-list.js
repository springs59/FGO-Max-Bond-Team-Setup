function pct(rate) {
  return `${Math.round((Number(rate) || 0) * 1000) / 10}%`
}

function ymdCst(unix) {
  const d = new Date((Number(unix) + 8 * 3600) * 1000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatWindow(row) {
  const start = Number(row && row.startedAt) || 0
  const end = Number(row && row.endedAt) || 0
  if (!start && !end) return '常驻'
  const a = start ? ymdCst(start) : ''
  const b = end ? ymdCst(end) : ''
  if (a && b) return `${a} ~ ${b}`
  return a || b
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderBonusList(effects, title) {
  const rows = (effects || []).map((row) => {
    const rate = row.partyBonus || row.selfBonus || 0
    const src = row.source === 'questFriendship' ? '关卡活动' : row.source === 'craftEssence' ? '礼装' : '活动被动'
    const window = formatWindow(row)
    const live = row.active ? '生效' : '未生效'
    const who = (row.partyBonus || 0) > 0 ? '全队' : '自身'
    return `<li class="bonus-row" data-active="${row.active ? '1' : '0'}"><span class="bonus-src">${esc(src)} · ${who}</span><span class="bonus-name">${esc(row.name || row.label || '')}</span><span class="bonus-rate">+${pct(rate)}</span><span class="bonus-live">${live}</span><span class="bonus-time">${esc(window)}</span></li>`
  })
  if (!rows.length) return `<section class="bonus-list"><h3>${esc(title)}</h3><p class="bonus-empty">无</p></section>`
  return `<section class="bonus-list"><h3>${esc(title)}</h3><ul>${rows.join('')}</ul></section>`
}
