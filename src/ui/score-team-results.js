export function scoreTeamResultsHtml(info) {
  if(!info)return ''
  const filtered=info.supportCeId!=null,bestCount=filtered?info.matchingBestCount:info.bestCount,otherCount=filtered?info.matchingOtherCount:info.otherCount
  const allCount=filtered?info.matchingAllCount:info.allCount??((info.bestCount||0)+(info.otherCount||0))
  const kind=info.kind||'best',count=kind==='all'?allCount:kind==='best'?bestCount:otherCount,offset=info.offset||0,size=info.pageSize||64
  const score=Number.isFinite(info.bestScore)?info.bestScore:'尚无',unit=info.grouped?'组':'套'
  return `<section id="scoreTeamResults" class="rec-note" aria-label="全部已计算配队">
    <p id="scoreTeamProgress">${scoreTeamProgressText(info)}</p>
    <ol class="score-stages"><li>${Number.isFinite(info.bestScore)?'✓':'…'} 找到合法队伍</li><li>${info.maximumProven?'✓':'…'} 证明最高分</li><li>${info.complete?'✓':'…'} 收齐同分方案${info.complete?'':'（未完成）'}</li></ol>
    ${!info.complete&&!info.stopped&&!info.stopping?'<p>分数或方案组数不变时，搜索仍可能在排除其他组合；节点数增加表示计算仍在推进。总搜索量未知，暂不显示完成百分比。</p>':''}
    ${info.stopped&&!info.complete?`<p class="score-partial-note">以下为停止前已计算出的结果。${info.maximumProven?'最高分已证明，全部同分方案尚未收齐':'当前最高分尚未证明为全局最优，全部同分方案尚未收齐'}；可继续查看、切换和导出已有结果。</p>`:''}
    ${info.recoveries?'<p class="score-recovery-note">补全时发现了更高收益，已自动重新搜索；此前已归档队伍保留在途中其他队伍中。</p>':''}
    ${info.previewOnly?'<p>当前已得到1套可行队伍，尚未登记为合并方案组；下方仍保留该队伍。</p>':''}
    <p>当前最高${info.primary==='preferBond'?'主练羁绊':'总羁绊'}：${score}。${info.grouped?'等效从者、形态、礼装与无关换位合并为一组，保留替换选项；不同 COST 和有效加成仍分别保留。':'同分队伍保留不同 COST、角色、形态、礼装满破状态和站位；完全相同的礼装副本不重复计数。'}</p>
    ${filtered?`<p>正在筛选已得配队：助战普通礼装 ${info.supportCeId||'空栏'}；匹配最高分 ${bestCount||0} ${unit}，途中其他 ${otherCount||0} ${unit}。全局最高分与完成状态仍对应原查询。</p>`:''}
    <div class="account-bar-actions">${info.allComputed?`<button data-score-kind="all" ${kind==='all'?'disabled':''}>全部已计算（${allCount||0}）</button>`:''}<button data-score-kind="best" ${kind==='best'||!bestCount?'disabled':''}>最高分${info.grouped?'方案组':'配队'}（${bestCount||0}）</button><button data-score-kind="other" ${kind==='other'||!otherCount?'disabled':''}>途中其他队伍（${otherCount||0}）</button></div>
    <div class="account-bar-actions"><button data-score-page="${Math.max(0,offset-size)}" ${offset===0?'disabled':''}>上一页</button><span>第 ${Math.floor(offset/size)+1} 页 · 每页 ${size} ${unit} · 当前类别 ${count||0} ${unit}</span><button data-score-page="${offset+size}" ${offset+size>=(count||0)?'disabled':''}>下一页</button><button data-score-page="${offset}">刷新本页</button></div>
    <p>${info.grouped?'每组展示一套可用队伍，组内变化不逐条展开；导出保留替换选项和联动约束。':'分页仅限制单次读取数量，不截断全部同分结果。'}其他队伍只收集搜索途中已计算的合法结果，不穷尽低分队伍。</p>
    ${info.allComputed?'<p>保留本次搜索完整结算过的所有合法组合，按羁绊分数从高到低分页，包括低于最高分的结果。等效组合可展开查看；未展开的剪枝分支尚未逐队计算，不计入已计算集合。</p>':''}
    ${info.diskBacked===false?'<p>当前环境使用内存保存结果，关闭页面前请先导出。</p>':''}
    <button data-score-export ${info.complete||info.stopped?'':'disabled'}>导出全部已得到队伍（JSONL）</button><p id="scoreTeamExportStatus" role="status"></p>
  </section>`
}
export function scoreTeamTabLabel(info,busy=false,ok=false){
  if(info?.imported)return '已打开档案'
  if(info?.stopping)return '正在保存'
  if(info?.stopped&&!info.complete)return '已停止 · 部分结果'
  if(info?.complete)return info.infeasible?'无合法队伍':'全部完成'
  if(info?.maximumProven)return '最高分已证明 · 补全同分中'
  if(busy)return Number.isFinite(info?.bestScore)?'证明最高分中':'寻找合法队伍中'
  return ok?'已有可用队伍':''
}
export function scoreTeamProgressText(info){
  const stats=info.stats,details=[]
  if(stats)details.push(`已搜索 ${stats.nodes||0} 个节点`,`已计算 ${stats.evaluated||0} 个完整组合`,`剪枝 ${(stats.scorePruned||0)+(stats.budgetPruned||0)+(stats.constraintPruned||0)} 次`)
  if(Number.isFinite(info.elapsedMs))details.push(`用时 ${(Math.max(0,info.elapsedMs)/1000).toFixed(1)} 秒`)
  return `${info.grandSearchScope?.includesRecommendations?'包含需先选择冠位的推荐；最高分按相应冠位选择后的条件计算 · ':''}${info.cacheHit?'复用本次会话的完整结果 · ':''}${info.infeasible?'当前条件无合法配队':info.complete?('最高分已证明，同分方案已收齐'+(info.grouped?'（等效合并）':'')):info.stopped?(info.maximumProven?'已停止，最高分已证明，同分方案尚未收齐':'已停止，当前结果尚未证明完整'):info.stopping?'正在停止并保存已得到的队伍':info.phase==='preparing'?'正在准备候选与搜索起点':!Number.isFinite(info.bestScore)?'正在寻找首套合法队伍':info.maximumProven?'最高分已证明，正在补全全部同分配队':info.recoveries?'发现更高收益，正在重新证明最高分':'正在证明最高分，优先寻找更高收益配队'}${info.allComputed?' · 已保存全部完整结算 '+(info.allCount||0)+' '+(info.grouped?'组':'套'):''} · 同分 ${info.bestCount||0} ${info.grouped?'组':'套'} · 途中其他 ${info.otherCount||0} ${info.grouped?'组':'套'}${details.length?' · '+details.join(' · '):''}`
}


const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function scoreTeamFamilyHtml(info,servantName=id=>id,ceName=id=>id){
  if(!info)return ''
  const rows=info.members.filter(m=>m.options.length>1).map(m=>`<li>${m.position}号位从者：${m.options.map(o=>escape(servantName(o.svt))+'（'+escape(o.art||'default')+'）').join('、')}</li>`)
  const ces=info.equipment.filter(e=>e.options.length>1).map(e=>`<li>${e.position}号位${e.support?'助战':''}礼装：${e.options.map(o=>escape(ceName(o.id))+'（'+(o.mlb?'满破':'未满破')+(e.support?'':`，库存${o.count}`)+'）').join('、')}</li>`)
  const seats=info.seatGroups.map(g=>`<li>${g.join('、')}号位可整体互换从者及其礼装。</li>`)
  return `<details class="rec-note" id="scoreTeamFamily"><summary>本组可替换选项与站位</summary><p>每个从者只能使用一次；各位置共用礼装库存。选项需要联动选择，不能把同一从者或同一份礼装重复分配。替换后可在队伍编辑区重新结算。</p><ul>${[...rows,...ces,...seats].join('')||'<li>本组仅有当前配队。</li>'}</ul></details>`
}
