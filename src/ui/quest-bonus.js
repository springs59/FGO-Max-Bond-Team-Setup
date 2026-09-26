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

export function summarizeQuestBondBonuses(live) {
  const extraGroups = []
  const seen = new Map()
  for (const rec of (live && live.extraPassives) || []) {
    const rate = Number(rec.rate) || 0
    if (!rate) continue
    const target = rec.target === 'ptFull' ? 'ptFull' : 'self'
    const skill = rec.name || '活动被动'
    const key = `${target}:${rate}:${skill}`
    if (!seen.has(key)) {
      const group = { target, rate, skill, servantIds: [] }
      seen.set(key, group)
      extraGroups.push(group)
    }
    const sid = Number(rec.servantId) || 0
    if (sid && !seen.get(key).servantIds.includes(sid)) seen.get(key).servantIds.push(sid)
  }
  extraGroups.sort((a, b) => {
    if (a.target !== b.target) return a.target === 'ptFull' ? -1 : 1
    return b.rate - a.rate
  })
  const quests = []
  const questSeen = new Set()
  for (const rec of (live && live.questFriendships) || []) {
    const rate = Number(rec.rate) || 0
    if (!rate) continue
    const name = rec.name || '关卡活动'
    const key = `${name}:${rate}`
    if (questSeen.has(key)) continue
    questSeen.add(key)
    quests.push({ name, rate })
  }
  return { extraGroups, quests }
}

export function formatServantNames(ids, nameOf, limit = 8) {
  const names = (ids || []).map((id) => {
    const label = typeof nameOf === 'function' ? nameOf(id) : ''
    return label || `从者${id}`
  })
  if (names.length <= limit) return names.join('、')
  return `${names.slice(0, limit).join('、')} 等${names.length}人`
}

export function renderQuestBonusHtml(live, nameOf) {
  const { extraGroups, quests } = summarizeQuestBondBonuses(live)
  if (!extraGroups.length && !quests.length) {
    return `<p class="quest-bonus">该本无额外活动羁绊加成</p>`
  }
  const items = []
  for (const rec of quests) {
    items.push(
      `<li><span class="qb-kind">关卡</span><span class="qb-rate">+${pct(rec.rate)}</span><span class="qb-skill">${esc(rec.name)}</span></li>`,
    )
  }
  for (const group of extraGroups) {
    const who = group.target === 'ptFull' ? '全队' : '活动从者自身'
    const names = formatServantNames(group.servantIds, nameOf)
    items.push(
      `<li><span class="qb-kind">${esc(who)}</span><span class="qb-rate">+${pct(group.rate)}</span><span class="qb-names">${esc(names)}</span><span class="qb-skill">${esc(group.skill)}</span></li>`,
    )
  }
  return `<div class="quest-bonus"><p>该本加成</p><ul class="quest-bonus-list">${items.join('')}</ul></div>`
}
