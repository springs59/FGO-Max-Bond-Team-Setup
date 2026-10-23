export function scoreTeamResultsHtml(info) {
  if(!info)return ''
  const kind=info.kind||'best',count=kind==='best'?info.bestCount:info.otherCount,offset=info.offset||0,size=info.pageSize||64
  const score=Number.isFinite(info.bestScore)?info.bestScore:'尚无',unit=info.grouped?'组':'套'
  return `<section id="scoreTeamResults" class="rec-note" aria-label="完整同分配队">
    <p id="scoreTeamProgress">${scoreTeamProgressText(info)}</p>
    ${!info.complete&&!info.stopped&&!info.stopping?'<p>分数或方案组数不变时，搜索仍可能在排除其他组合；节点数增加表示计算仍在推进。总搜索量未知，暂不显示完成百分比。</p>':''}
    ${info.stopped&&!info.complete?'<p class="score-partial-note">以下为停止前已计算出的结果。当前最高分尚未证明为全局最优，全部同分方案尚未收齐；可继续查看、切换和导出已有结果。</p>':''}
    ${info.previewOnly?'<p>当前已得到1套可行队伍，尚未登记为合并方案组；下方仍保留该队伍。</p>':''}
    <p>当前最高${info.primary==='preferBond'?'主练羁绊':'总羁绊'}：${score}。${info.grouped?'等效从者、形态、礼装与无关换位合并为一组，保留替换选项；不同 COST 和有效加成仍分别保留。':'同分队伍保留不同 COST、角色、形态、礼装满破状态和站位；完全相同的礼装副本不重复计数。'}</p>
    <div class="account-bar-actions"><button data-score-kind="best" ${kind==='best'?'disabled':''}>最高分${info.grouped?'方案组':'配队'}（${info.bestCount||0}）</button><button data-score-kind="other" ${kind==='other'||!info.otherCount?'disabled':''}>途中其他队伍（${info.otherCount||0}）</button></div>
    <div class="account-bar-actions"><button data-score-page="${Math.max(0,offset-size)}" ${offset===0?'disabled':''}>上一页</button><span>第 ${Math.floor(offset/size)+1} 页 · 每页 ${size} ${unit} · 当前类别 ${count||0} ${unit}</span><button data-score-page="${offset+size}" ${offset+size>=(count||0)?'disabled':''}>下一页</button><button data-score-page="${offset}">刷新本页</button></div>
    <p>${info.grouped?'每组展示一套可用队伍，组内变化不逐条展开；导出保留替换选项和联动约束。':'分页仅限制单次读取数量，不截断全部同分结果。'}其他队伍只收集搜索途中已计算的合法结果，不穷尽低分队伍。</p>
    ${info.diskBacked===false?'<p>当前环境使用内存保存结果，关闭页面前请先导出。</p>':''}
    <button data-score-export ${info.complete||info.stopped?'':'disabled'}>导出全部已得到队伍（JSONL）</button>
  </section>`
}
export function scoreTeamProgressText(info){
  const stats=info.stats,details=[]
  if(stats)details.push(`已搜索 ${stats.nodes||0} 个节点`,`已计算 ${stats.evaluated||0} 个完整组合`,`剪枝 ${(stats.scorePruned||0)+(stats.budgetPruned||0)} 次`)
  if(Number.isFinite(info.elapsedMs))details.push(`用时 ${(Math.max(0,info.elapsedMs)/1000).toFixed(1)} 秒`)
  return `${info.cacheHit?'复用本次会话的完整结果 · ':''}${info.complete?('最高分已证明，同分方案已收齐'+(info.grouped?'（等效合并）':'')):info.stopped?'已停止，当前结果尚未证明完整':info.stopping?'正在停止并保存已得到的队伍':info.phase==='preparing'?'正在准备候选与搜索起点':'正在证明最高分并收集全部同分配队'} · 同分 ${info.bestCount||0} ${info.grouped?'组':'套'} · 途中其他 ${info.otherCount||0} ${info.grouped?'组':'套'}${details.length?' · '+details.join(' · '):''}`
}


const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function scoreTeamFamilyHtml(info,servantName=id=>id,ceName=id=>id){
  if(!info)return ''
  const rows=info.members.filter(m=>m.options.length>1).map(m=>`<li>${m.position}号位从者：${m.options.map(o=>escape(servantName(o.svt))+'（'+escape(o.art||'default')+'）').join('、')}</li>`)
  const ces=info.equipment.filter(e=>e.options.length>1).map(e=>`<li>${e.position}号位${e.support?'助战':''}礼装：${e.options.map(o=>escape(ceName(o.id))+'（'+(o.mlb?'满破':'未满破')+(e.support?'':`，库存${o.count}`)+'）').join('、')}</li>`)
  const seats=info.seatGroups.map(g=>`<li>${g.join('、')}号位可整体互换从者及其礼装。</li>`)
  return `<details class="rec-note" id="scoreTeamFamily"><summary>本组可替换选项与站位</summary><p>每个从者只能使用一次；各位置共用礼装库存。选项需要联动选择，不能把同一从者或同一份礼装重复分配。替换后可在队伍编辑区重新结算。</p><ul>${[...rows,...ces,...seats].join('')||'<li>本组仅有当前配队。</li>'}</ul></details>`
}
