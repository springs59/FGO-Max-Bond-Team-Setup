import { createBoundedWorker,postWorkerMessage } from '../worker-transport.js'
import { temporaryPanel,bindTemporary,refreshTemporary } from './query-temporary.js'
import { evaluateBondCurve } from '../solver/bond-curve.js'

const colors = ['#dc6b19','#237bc1','#25914b','#9741b5','#e34259','#798525','#387f84','#ae592d']
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))

export function openEquipmentChart(domain, { teapot = false } = {}) {
  let worker = null
  const dialog = document.createElement('dialog')
  dialog.className = 'equipment-chart-dialog'
  dialog.innerHTML = `<form method="dialog"><button style="float:right">关闭</button><h2>此队伍的礼装全组合曲线</h2></form>
    <p>固定当前从者、灵基、位置和羁绊状态，完整展开所有可用礼装的数量与满破组合，包括不佩戴、助战肖像和 COST 限制。命中范围逐人计算。下方显示在所选基础羁绊区间获胜的组合。</p>
    <p>此图比较固定队伍；改变从者或关卡规则后需要重新计算。筛选后效果相同的礼装合并，保留持有数量并优先使用低 COST 的可行代表。</p>
    <label>基础羁绊起点 <input id="curveMin" type="number" min="0" step="1" value="0"></label>
    <label>终点 <input id="curveMax" type="number" min="0" step="1" value="2000"></label>
    <button id="curveRun" type="button">完整计算</button> <button id="curveCancel" type="button" disabled>停止</button>
    <p id="curveStatus" role="status">点击完整计算，在后台枚举。</p>
    <div id="curveTemporary"></div>
    <canvas id="curveCanvas" width="960" height="450" aria-label="基础羁绊与队伍总羁绊收益对比"></canvas>
    <div id="curveLegend"></div>
    <details><summary>选择其他组合加入对比</summary>
      <input id="curveSearch" placeholder="搜索礼装名或 COST"><select id="curveOther" aria-label="所有组合函数"></select>
      <button id="curveAdd" type="button">加入图表</button><button id="curveMore" type="button">显示下一批</button>
      <p>可选择未在此区间获胜的组合。每批显示 30 项。</p></details><div id="curveIntervals"></div>`
  document.body.append(dialog); dialog.showModal()
  const get = id => dialog.querySelector('#'+id)
  const label = candidate => {
    const own = candidate.equipment.map(e => `${domain.ces.find(c=>c.id===e.ceId)?.name || e.ceId}${e.mlb?'':'（未满破）'}×${e.count}`).join(' + ') || '自出无礼装'
    const support = domain.ces.find(c=>c.id===candidate.supportCeId)?.name || '无'
    return `${own}；助战：${support}；COST ${candidate.cost}`
  }
  function renderTemporary(){if(!dialog.isConnected)return;get('curveTemporary').innerHTML=temporaryPanel();bindTemporary(get('curveTemporary'),renderTemporary,{calculating:Boolean(worker)})}
  function stop() { worker?.terminate(); worker=null; get('curveRun').disabled=false; get('curveCancel').disabled=true;refreshTemporary(renderTemporary) }
  get('curveCancel').onclick=()=>{stop();get('curveStatus').textContent='计算已停止，结果未标记为完整。'}
  dialog.onclose=()=>{stop();dialog.remove()}
  get('curveRun').onclick=async()=>{
    const min=Number(get('curveMin').value),max=Number(get('curveMax').value)
    if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<0||max<min) {get('curveStatus').textContent='请输入有效的非负整数区间。';return}
    worker=createBoundedWorker(new URL('../solver/equipment-chart-worker.js',import.meta.url),{type:'module'})
    get('curveRun').disabled=true;get('curveCancel').disabled=false
    get('curveStatus').textContent='正在展开礼装组合…'
    worker.onerror=()=>{stop();get('curveStatus').textContent='后台计算失败，请重试。'}
    worker.onmessage=({data})=>{
      if(data.type==='progress') {get('curveStatus').textContent=`已展开 ${data.progress.scanned.toLocaleString()} 套；不同收益函数 ${data.progress.unique.toLocaleString()}${data.progress.phase==='compare'?'；正在逐点精算':''}`;return}
      stop()
      if(data.type==='error'){get('curveStatus').textContent=data.error;return}
      const result=data.result
      get('curveStatus').textContent=`${data.localResult?.hit?'已复用本地查询结果。':data.localResult?.saved?'计算完成并保存到本地查询库。':data.localResult?.error||''}等效礼装合并后完整展开 ${result.scanned.toLocaleString()} 个加成组合，${result.unique.toLocaleString()} 条不同函数，${result.curves.length} 套在此区间获胜。比较每个整数基数，保留两次向下取整；同收益优先低 COST。`
      const visible=new Set(result.curves.map(c=>c.id))
      const plotted=result.curves.slice()
      function legend(){get('curveLegend').innerHTML=plotted.map((c,i)=>`<div><label style="display:block;color:${colors[i%colors.length]}"><input type="checkbox" data-curve="${c.id}" ${visible.has(c.id)?'checked':''}>方案 ${i+1}：${escape(label(c))}</label>
        <details><summary>逐成员函数与命中结果</summary>${c.curve.terms.filter(t=>t.eligible).map(t=>`<p>位置 ${t.position}：${escape(domain.slots.find(s=>s.position===t.position)?.label||t.svtId)}；${teapot?'2 × ':''}[⌊⌊B × ${t.front}/1000⌋ × ${t.second}/1000⌋ + ${t.flat}]</p>`).join('')}<p>总收益为上述各成员收益之和。第一层对应前排，第二层包含命中的礼装、活动与光环；末项为叠加后的固定奖励。</p></details></div>`).join('')}
      legend()
      let offset=0
      function choices(){const query=get('curveSearch').value.toLowerCase()
        const rows=result.allCurves.filter(c=>!query||label(c).toLowerCase().includes(query))
        if(offset>=rows.length)offset=0
        get('curveOther').innerHTML=rows.slice(offset,offset+30).map(c=>`<option value="${c.id}">${escape(label(c))}</option>`).join('')
        get('curveMore').disabled=rows.length<=30}
      get('curveSearch').oninput=()=>{offset=0;choices()}
      get('curveMore').onclick=()=>{offset+=30;choices()}
      get('curveAdd').onclick=()=>{const id=Number(get('curveOther').value),c=result.allCurves.find(c=>c.id===id)
        if(!c)return;if(!plotted.some(p=>p.id===id))plotted.push(c);visible.add(id);legend();draw()}
      choices()
      get('curveIntervals').innerHTML='<table><thead><tr><th>基础羁绊区间</th><th>优势方案</th></tr></thead><tbody>'+result.intervals.map(r=>`<tr><td>${r.min}—${r.max}</td><td>${escape(label(r.candidate))}</td></tr>`).join('')+'</tbody></table>'
      function draw(){
        const canvas=get('curveCanvas'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,p=60
        ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h)
        const yMax=Math.max(1,...result.winners.map(w=>w.total))*1.05
        const x=base=>p+(base-min)/Math.max(1,max-min)*(w-p-20),y=value=>h-p-value/yMax*(h-p-20)
        ctx.font='13px sans-serif';ctx.strokeStyle='#ccc';ctx.fillStyle='#333'
        for(let i=0;i<=5;i++){const v=yMax*i/5;ctx.beginPath();ctx.moveTo(p,y(v));ctx.lineTo(w-20,y(v));ctx.stroke();ctx.fillText(Math.round(v),4,y(v)+4)}
        for(let i=0;i<=5;i++){const b=Math.round(min+(max-min)*i/5);ctx.fillText(b,x(b)-10,h-p+20)}
        ctx.fillText('基础羁绊 B',w/2,h-12);ctx.fillText('队伍总羁绊',p,14)
        plotted.forEach((c,i)=>{if(!visible.has(c.id))return;ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=2;ctx.beginPath()
          const step=Math.max(1,Math.ceil((max-min)/900))
          for(let b=min;b<=max;b+=step){const total=evaluateBondCurve(c.curve,b,{teapot}).total;b===min?ctx.moveTo(x(b),y(total)):ctx.lineTo(x(b),y(total))}
          ctx.lineTo(x(max),y(evaluateBondCurve(c.curve,max,{teapot}).total));ctx.stroke()})
      }
      get('curveLegend').onchange=e=>{const id=Number(e.target.dataset.curve);e.target.checked?visible.add(id):visible.delete(id);draw()}
      draw()
    }
    try{await postWorkerMessage(worker,{domain,range:{min,max,teapot}})}catch(error){if(error.name==='AbortError')return;stop();get('curveStatus').textContent=`任务数据传输失败：${error.message||error}`}
  }
}
