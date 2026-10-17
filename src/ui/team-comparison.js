import { settleParty } from '../party-state.js'
import { comparisonIssues } from './comparison-workspace.js'

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function groupBondPlans(plans = []) {
  const groups = new Map()
  plans.forEach((plan, index) => {
    const key = Number(plan.total) || 0
    if (!groups.has(key)) groups.set(key, { total: key, indices: [] })
    groups.get(key).indices.push(index)
  })
  return [...groups.values()]
}
export function physicalPartyKey(plan) {
  return JSON.stringify((plan.slots || []).map(s => [s.position, !!s.filled, !!s.isSupport, s.svtId || 0,
    s.svtArtKey || '', s.ceId || 0, s.ceMlb !== false, s.ceBondId || 0, s.ceBondMlb !== false,
    s.ceRewardId || 0, s.ceRewardMlb !== false, s.bondLv || 0, s.bondCap || 0, !!s.portrait]))
}
export function renderPlanGroups(rec, describe) {
  const groups = groupBondPlans(rec.plans), chosen = rec.chosen || 0
  const group = groups.find(g => g.indices.includes(chosen)) || groups[0]
  if (!group) return ''
  const local = group.indices.indexOf(chosen), page = Math.floor(Math.max(0, local) / 20)
  const shown = group.indices.slice(page * 20, page * 20 + 20)
  return `<div class="bond-plan-groups"><h2>推荐队伍</h2><div class="plan-tabs" role="tablist" aria-label="按总羁绊分组">${groups.map(g =>
    `<button type="button" role="tab" aria-selected="${g === group}" data-rec-plan="${g.indices[0]}">${g.total} 羁绊 · ${g.indices.length} 队</button>`).join('')}</div>
    <div class="plan-tabs plan-variants" role="tablist" aria-label="同羁绊配队">${shown.map(i =>
      `<span class="plan-variant"><button type="button" role="tab" aria-selected="${i === chosen}" data-rec-plan="${i}">配队 ${group.indices.indexOf(i) + 1} · COST ${rec.plans[i].costUsed || 0}</button><button type="button" data-compare-plan="${i}" aria-label="将配队 ${group.indices.indexOf(i)+1} 加入对比">加入对比</button></span>`).join('')}</div>
    ${group.indices.length > 20 ? `<div class="rec-pager-nav"><button data-rec-plan="${group.indices[Math.max(0, page * 20 - 20)]}" ${page === 0 ? 'disabled' : ''}>上一页配队</button><span>${page + 1} / ${Math.ceil(group.indices.length / 20)}</span><button data-rec-plan="${group.indices[Math.min(group.indices.length - 1, page * 20 + 20)]}" ${(page + 1) * 20 >= group.indices.length ? 'disabled' : ''}>下一页配队</button></div>` : ''}
    ${describe(rec.plans[chosen] || rec.plans[group.indices[0]])}
    <div class="rec-pager-nav"><button type="button" data-rec-step="-1" ${chosen<=0?'disabled':''}>上一套</button><span class="rec-now-idx">${chosen+1} / ${rec.plans.length}</span><button type="button" data-rec-step="1" ${chosen>=rec.plans.length-1?'disabled':''}>下一套</button></div>
    <button type="button" data-compare-plan="${chosen}">将此推荐队伍加入对比</button><button type="button" data-workspace="compare">打开队伍对比</button></div>`
}
export function comparePartyRows(plans, options) {
  const settled = plans.map(p => settleParty(p.slots, options))
  const issues = plans.map(p=>comparisonIssues(p,options))
  const byCe = new Map((options.ces || []).map(c => [Number(c.id), c.name]))
  const rows = [ { label: '编队检查', values: issues.map(list=>list.join('；')||'符合已检查条件') },
    { label: '总羁绊', values: settled.map((p,i) => issues[i].length?`${p.total}（编队待调整）`:String(p.total)) },
    { label: 'COST', values: settled.map(p => String(p.costUsed)) } ]
  for (let position = 1; position <= 6; position++) {
    const slots = settled.map(p => p.slots.find(s => s.position === position))
    const prefix = position <= 3 ? `前排 ${position}` : `后排 ${position}`
    rows.push({ label: prefix + ' · 从者／形态', values: slots.map(s => !s?.filled ? '空位' : s.isSupport ? '助战' : `${s.label || s.svtId}（${s.formLabel || '默认'}） · ${s.bondLv || 0}/${s.bondCap || 10}绊`) })
    rows.push({ label: prefix + ' · 礼装', values: slots.map(s => !s?.filled ? '—' : ['ceId','ceBondId','ceRewardId'].filter(k => s[k]).map(k => `${byCe.get(Number(s[k])) || s[k]}${s[k === 'ceId' ? 'ceMlb' : k === 'ceBondId' ? 'ceBondMlb' : 'ceRewardMlb'] === false ? '（未满破）' : '（满破）'}`).join('、') || '无') })
    rows.push({ label: prefix + ' · 获取羁绊', values: settled.map(p => String(p.output.results.find(r => r.position === position)?.final || 0)) })
    rows.push({ label: prefix + ' · 加成', values: settled.map(p => {
      const r = p.output.results.find(r => r.position === position)
      return (r?.lines || []).map(l => `${l.label} +${Math.round(l.pct * 10000) / 100}%`).join('、') || '—'
    }) })
    rows.push({ label: prefix + ' · 对其他队员贡献', values: settled.map(p => {
      const without = settleParty(p.slots.map(s => s.position === position ? { ...s, filled: false } : s), options)
      const contribution = p.output.results.filter(r => r.position !== position).reduce((sum, r) => sum + r.final - (without.output.results.find(x => x.position === r.position)?.final || 0), 0)
      return (contribution >= 0 ? '+' : '') + contribution
    }) })
  }
  return rows.map(row => ({ ...row, different: new Set(row.values).size > 1 }))
}
export function renderTeamComparison(plans, options) {
  return `<section class="team-comparison"><div class="panel-heading"><h2>队伍对比 · ${plans.length} 队</h2><button type="button" data-compare-current>加入当前队伍</button><button type="button" data-comparison-new>新建队伍</button><button type="button" data-compare-clear ${plans.length ? '' : 'disabled'}>清空对比</button></div>
    <p>按当前账号、关卡、基础羁绊和茶壶重新结算。不同处高亮；“对其他队员贡献”包含光环、活动被动和礼装效果。</p>
    ${!plans.length ? '<p>从推荐列表加入队伍，或新建队伍。复制后可分别编辑从者、灵基、礼装与站位。</p>' : `<div class="comparison-scroll"><table><thead><tr><th>比较项目</th>${plans.map((plan,i) => `<th>${esc(plan.name||`队伍 ${i+1}`)}<div class="comparison-actions"><button type="button" data-comparison-edit="${i}">编辑</button><button type="button" data-comparison-copy="${i}">复制</button><button type="button" data-comparison-use="${i}" ${comparisonIssues(plan,options).length?'disabled':''}>设为当前队伍</button><button type="button" data-compare-remove="${i}">移除</button></div></th>`).join('')}</tr></thead><tbody>${comparePartyRows(plans, options).map(row => `<tr class="${row.different ? 'comparison-different' : ''}"><th>${esc(row.label)}</th>${row.values.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}</section>`
}
