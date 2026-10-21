export function scoreTeamResultsHtml(info) {
  if(!info)return ''
  const kind=info.kind||'best',count=kind==='best'?info.bestCount:info.otherCount,offset=info.offset||0,size=info.pageSize||64
  const score=Number.isFinite(info.bestScore)?info.bestScore:'尚无'
  return `<section id="scoreTeamResults" class="rec-note" aria-label="完整同分配队">
    <p id="scoreTeamProgress">${scoreTeamProgressText(info)}</p>
    <p>当前最高${info.primary==='preferBond'?'主练羁绊':'总羁绊'}：${score}。同分队伍保留不同 COST、角色、形态、礼装满破状态和站位；完全相同的礼装副本不重复计数。</p>
    <div class="account-bar-actions"><button data-score-kind="best" ${kind==='best'?'disabled':''}>最高分配队（${info.bestCount||0}）</button><button data-score-kind="other" ${kind==='other'||!info.otherCount?'disabled':''}>途中其他队伍（${info.otherCount||0}）</button></div>
    <div class="account-bar-actions"><button data-score-page="${Math.max(0,offset-size)}" ${offset===0?'disabled':''}>上一页</button><span>第 ${Math.floor(offset/size)+1} 页 · 每页 ${size} 套 · 当前类别 ${count||0} 套</span><button data-score-page="${offset+size}" ${offset+size>=(count||0)?'disabled':''}>下一页</button><button data-score-page="${offset}">刷新本页</button></div>
    <p>分页仅限制单次读取数量，不截断全部同分结果。其他队伍只收集搜索途中已计算的合法结果，不穷尽低分队伍。</p>
    ${info.diskBacked===false?'<p>当前环境使用内存保存结果，关闭页面前请先导出。</p>':''}
    <button data-score-export ${info.complete||info.stopped?'':'disabled'}>导出全部已得到队伍（JSONL）</button>
  </section>`
}
export function scoreTeamProgressText(info){
  return `${info.complete?'最高分已证明，同分配队已列全':info.stopped?'已停止，当前结果尚未证明完整':info.stopping?'正在停止并保存已得到的队伍':'正在证明最高分并收集全部同分配队'} · 同分 ${info.bestCount||0} 套 · 途中其他 ${info.otherCount||0} 套`
}
