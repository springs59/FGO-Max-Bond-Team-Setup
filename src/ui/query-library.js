import { listQueries, exportQueries, importQueries, migrateLegacyQueries, readSharedPlan } from '../solver/query-library.js'
const labels = { bond:'羁绊推荐',farm:'周回推荐',quest:'通关核算',equipment:'礼装组合曲线',
  'shared-plan':'全局通用方案','formation-effects':'编队效果曲线','formation-actual':'编队精确核实','legacy-bond':'旧版羁绊推荐','legacy-formation':'旧版编队曲线' }
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function saveFile({blob,name}) {
  if (window.fgoDesktop?.exportQueryFile) return await window.fgoDesktop.exportQueryFile(name,new Uint8Array(await blob.arrayBuffer()))
  if (window.FgoAndroid?.exportQueryFile) {
    if (blob.size>32*1024*1024) throw Error('备份较大，请勾选部分查询分批导出；导入时可以合并')
    const bytes=new Uint8Array(await blob.arrayBuffer()),parts=[]
    for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)))
    if(window.FgoAndroid.exportQueryFile(name,btoa(parts.join('')))===false)throw Error('已有备份正在保存，请完成后重试')
    while(true) {
      const status=JSON.parse(window.FgoAndroid.queryExportStatus())
      if(status.state==='done')return {saved:true}
      if(status.state==='canceled')return {saved:false,canceled:true}
      if(status.state==='error')throw Error(status.error||'导出文件失败')
      await new Promise(r=>setTimeout(r,250))
    }
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click()
  setTimeout(()=>URL.revokeObjectURL(url),60000)
  return {saved:true}
}
export async function openQueryLibrary({servants=[],ces=[],onUsePlan=null}={}) {
  const dialog=document.createElement('dialog');dialog.className='equipment-chart-dialog query-library-dialog'
  dialog.innerHTML=`<form method="dialog"><button style="float:right">关闭</button><h2>全局方案与本地计算库</h2></form>
    <p>通用方案只保存成员、灵基、礼装、满破要求和位置，不绑定账号。自由配队与所有账号共用此库，调用时按当前库存及关卡重新核实、结算。普通方案可手动调用；冠位与系统助战方案仍保存供迁移，但暂不支持直接调用。</p><p>完成的计算自动保存。完全相同的有效条件直接复用答案；条件改变时，合法的通用方案帮助减少搜索，仍继续核算当前最优。</p>
    <p>可导出全部或勾选的结果，在另一台电脑、手机或网页导入合并。导入不会覆盖账号和设置；重复记录去重，同条件的不同结果保留为独立记录。不同算法或数据条件的记录不会直接当作当前答案。</p>
    <div class="account-bar-actions"><button id="queryExportAll">导出全部方案与结果</button><button id="queryExportSelected">导出勾选记录</button>
    <label class="file">导入并合并<input id="queryImport" type="file" multiple accept=".gz,.jsonl,application/gzip,application/x-ndjson"></label><button id="queryRefresh">刷新列表</button></div>
    <p id="queryLibraryStatus" role="status">正在读取…</p><div id="queryLibraryRows"></div>`
  document.body.append(dialog);dialog.showModal()
  const $=id=>dialog.querySelector('#'+id);let busy=false
  function setBusy(value){busy=value;for(const id of ['queryExportAll','queryExportSelected','queryImport','queryRefresh'])$(id).disabled=value}
  async function refresh(message='') {
    const rows=await listQueries(),bytes=rows.reduce((n,r)=>n+(r.bytes||0),0),plans=rows.filter(r=>r.kind==='shared-plan')
    const names=new Map(servants.map(s=>[Number(s.id),s.name])),ceNames=new Map(ces.map(c=>[Number(c.id),c.name]))
    const descriptions=new Map()
    for(const row of plans){const plan=await readSharedPlan(row.id);if(plan)descriptions.set(row.id,plan.slots.filter(s=>s.filled).map(s=>`${s.position}：${s.isSupport?'助战':names.get(s.svtId)||s.svtId}${s.svtArtKey&&s.svtArtKey!=='default'?'／'+s.svtArtKey:''}${s.ceId?' · '+(ceNames.get(s.ceId)||s.ceId)+(s.ceMlb?'（满破）':'（未满破）'):''}`).join('；'))}
    $('queryLibraryStatus').textContent=`${message}${message?' · ':''}${plans.length} 个全局方案、${rows.length-plans.length} 条计算记录，约 ${(bytes/1048576).toFixed(1)} MB。结果长期保留；本机存储不足时会提示保存失败。`
    $('queryLibraryRows').innerHTML=rows.map(r=>`<label class="query-library-row"><input type="checkbox" value="${esc(r.id)}"><span><b>${esc(labels[r.kind]||r.kind)}</b><br>${esc(descriptions.get(r.id)||r.summary)}<br><small>${new Date(r.updatedAt).toLocaleString('zh-CN',{hour12:false})}</small></span><span>${((r.bytes||0)/1024).toFixed(0)} KB</span>${r.kind==='shared-plan'&&onUsePlan?`<button type="button" data-plan="${esc(r.id)}">按当前条件调用</button>`:''}</label>`).join('')||'<p>尚无记录。完成推荐或曲线计算后会自动加入。</p>'
  }
  async function output(selected=false) {
    if(busy)return
    const ids=selected?[...$('queryLibraryRows').querySelectorAll('input:checked')].map(x=>x.value):null
    if(selected&&!ids.length){$('queryLibraryStatus').textContent='请先勾选需要导出的方案或计算记录。';return}
    setBusy(true);$('queryLibraryStatus').textContent='正在生成并保存备份…'
    try {const archive=await exportQueries(ids),result=await saveFile(archive);await refresh(result.canceled?'已取消保存':`已导出 ${archive.count} 条记录`)}
    catch(e){$('queryLibraryStatus').textContent=e.message}finally{setBusy(false)}
  }
  $('queryLibraryRows').onclick=async event=>{
    const button=event.target.closest('[data-plan]');if(!button||busy)return
    event.preventDefault();setBusy(true)
    try{const plan=await readSharedPlan(button.dataset.plan);if(!plan)throw Error('方案已不可读取');dialog.close();await onUsePlan(plan)}catch(e){$('queryLibraryStatus').textContent=e.message}finally{setBusy(false)}
  }
  $('queryExportAll').onclick=()=>output();$('queryExportSelected').onclick=()=>output(true)
  $('queryRefresh').onclick=()=>refresh().catch(e=>$('queryLibraryStatus').textContent=e.message)
  $('queryImport').onchange=async event=>{
    const files=[...event.target.files];if(!files.length||busy)return
    setBusy(true);$('queryLibraryStatus').textContent='正在校验和合并备份…'
    try {
      let added=0,duplicates=0,conflicts=0
      for(const file of files){const r=await importQueries(file);added+=r.added;duplicates+=r.duplicates;conflicts+=r.conflicts}
      await refresh(`新增 ${added} 条，重复 ${duplicates} 条，保留不同结果 ${conflicts} 条`)
    }catch(e){$('queryLibraryStatus').textContent=`此文件未合并：${e.message}；已有结果仍保留。`}
    finally{event.target.value='';setBusy(false)}
  }
  dialog.onclose=()=>dialog.remove()
  try {await migrateLegacyQueries();await refresh()}catch(e){$('queryLibraryStatus').textContent=`本地结果库暂不可用：${e.message}`}
}
