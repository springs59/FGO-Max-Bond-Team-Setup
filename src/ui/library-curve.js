const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function renderLibraryCurve(info) {
  if(!info)return '<p class="library-curve-status">开始计算后，按当前账号与筛选组合精确曲线，再求解尚未覆盖的部分。已有匹配配置会保留；COST 没有固定为 95。</p>'
  if(info.exactCache)return '<p class="library-curve-status">当前完整条件已有本地精确答案，直接复用；无需导入其他仓库候选或重新拟合曲线。</p>'
  if(info.error)return `<p class="library-curve-status">本次匹配未完成：${esc(info.error)}。已转为当前条件精确求解。</p>`
  const points=info.points || [],maxX=Math.max(1,...points.map(p=>p.cost)),maxY=Math.max(1,...points.map(p=>p.total))
  const x=p=>35+p.cost/maxX*640,y=p=>155-p.total/maxY*125
  const paths=[];let current=[]
  for(const point of points){
    if(current.length&&point.cost!==current.at(-1).cost+1){paths.push(current);current=[]}
    current.push(point)
  }
  if(current.length)paths.push(current)
  return `<section class="library-curve-info"><h3>当前账号与筛选的方案曲线</h3>
    <p>基础羁绊 ${esc(info.base)} · COST ${info.costLimit == null ? '不限' : esc(info.costLimit)} · 账号可用 ${info.matched||0} 队 · 当前筛选可用 ${info.legal||0} 队 · ${info.groups||0} 组精确曲线；仅送入 ${info.selected||0} 个相关最优及次优候选。</p>
    <p>${info.noCandidate?'当前点没有可用仓库方案，保留曲线空缺。':info.hasGap?'当前 COST 点缺少直接记录，已有可行方案作为下界，保留覆盖缺口。':'已找到当前点的仓库候选。'}${info.gapSolved?'本次搜索已完成当前条件的精确核实。':'未覆盖部分仍需精确求解。'}</p>
    ${points.length?`<svg viewBox="0 0 720 185" role="img" aria-label="当前基础羁绊下各 COST 的仓库候选曲线，缺口不连线"><path d="M35 20V155H685" fill="none" stroke="currentColor"/>${paths.filter(p=>p.length>1).map(p=>`<polyline points="${p.map(t=>x(t)+','+y(t)).join(' ')}" fill="none" stroke="currentColor" stroke-width="2"/>`).join('')}${points.map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="3" fill="currentColor"><title>COST ${p.cost} · 羁绊 ${p.total}</title></circle>`).join('')}<text x="35" y="176" fill="currentColor">0</text><text x="630" y="176" fill="currentColor">COST ${maxX}</text><text x="38" y="18" fill="currentColor">羁绊 ${maxY}</text></svg>`:''}
    <p>曲线保留两次取整。缺少记录的 COST 不补线；仓库候选不会单独作为全局最优证明。</p></section>`
}
