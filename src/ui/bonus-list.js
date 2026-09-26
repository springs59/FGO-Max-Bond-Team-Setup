function pct(rate) {
  return `${Math.round((Number(rate) || 0) * 1000) / 10}%`
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
    const who = row.partyBonus ? '提供' : '吃到'
    const rate = row.partyBonus || row.selfBonus || 0
    const src = row.source === 'questFriendship' ? '关卡活动' : row.source === 'craftEssence' ? '礼装' : '活动被动'
    const cond = row.condQuestId ? `Quest ${row.condQuestId}` : row.questId ? `Quest ${row.questId}` : ''
    const window = row.startedAt || row.endedAt ? `${row.startedAt || 0}–${row.endedAt || 0}` : '常驻'
    const live = row.active ? '生效' : '未生效'
    return `<li class="bonus-row" data-active="${row.active ? '1' : '0'}"><span class="bonus-who">${who}</span><span class="bonus-src">${esc(src)}</span><span class="bonus-name">${esc(row.name || row.label || '')}</span><span class="bonus-rate">+${pct(rate)}</span><span class="bonus-cond">${esc(cond)}</span><span class="bonus-time">${esc(window)}</span><span class="bonus-live">${live}</span></li>`
  })
  if (!rows.length) return `<section class="bonus-list"><h3>${esc(title)}</h3><p class="bonus-empty">无</p></section>`
  return `<section class="bonus-list"><h3>${esc(title)}</h3><ul>${rows.join('')}</ul></section>`
}
