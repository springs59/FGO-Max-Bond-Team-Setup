import { recoverArchivedCandidates } from './query-recovery.js'
import { aggregateLibrary, exportQueryStream, importQueries, migrateLegacyQueries, sharedPlans } from '../solver/query-library.js'
const labels = { bond:'羁绊查询',farm:'周回查询',quest:'通关查询',equipment:'礼装组合曲线',
  'computed-candidate':'已计算候选与曲线','shared-plan':'全局通用编队','formation-effects':'编队效果曲线',
  'formation-actual':'编队精确核实','legacy-bond':'旧版羁绊查询','legacy-formation':'旧版编队曲线' }
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
async function saveFile({stream,name}) {
  const desktop=window.fgoDesktop,android=window.FgoAndroid
  if(desktop?.beginQueryExport || android?.beginQueryExport) {
    const reader=stream.getReader();let began=false
    try {
      if(desktop?.beginQueryExport) {
        const state=await desktop.beginQueryExport(name)
        if(state.canceled)return {saved:false,canceled:true}
        began=true
      } else {
        if(!android.beginQueryExport(name))throw Error('备份保存未能开始，请完成已有保存后重试')
        while(true) {
          const status=JSON.parse(android.queryExportStatus())
          if(status.state==='ready'){began=true;break}
          if(status.state==='canceled')return {saved:false,canceled:true}
          if(status.state==='error')throw Error(status.error||'导出文件失败')
          await new Promise(r=>setTimeout(r,250))
        }
      }
      while(true) {
        const next=await reader.read();if(next.done)break
        for(let i=0;i<next.value.length;i+=256*1024) {
          const chunk=next.value.subarray(i,i+256*1024)
          if(desktop?.appendQueryExport)await desktop.appendQueryExport(chunk)
          else {
            const parts=[]
            for(let j=0;j<chunk.length;j+=32768)parts.push(String.fromCharCode(...chunk.subarray(j,j+32768)))
            if(!android.appendQueryExport(btoa(parts.join(''))))throw Error(JSON.parse(android.queryExportStatus()).error||'备份写入中断')
          }
        }
      }
      if(desktop?.finishQueryExport)return await desktop.finishQueryExport(false)
      if(!android.finishQueryExport(false))throw Error(JSON.parse(android.queryExportStatus()).error||'备份未完成')
      return {saved:true}
    } catch(error) {
      if(began){if(desktop?.finishQueryExport)await desktop.finishQueryExport(true).catch(()=>{});else android.finishQueryExport(true)}
      throw error
    } finally {await reader.cancel().catch(()=>{})}
  }
  const blob=await new Response(stream).blob()
  // Compatibility for an older installed shell. Updated shells stream one
  // whole backup without retaining it as a base64 string in memory.
  if(desktop?.exportQueryFile)return await desktop.exportQueryFile(name,new Uint8Array(await blob.arrayBuffer()))
  if(android?.exportQueryFile) {
    if(blob.size>32*1024*1024)throw Error('请更新软件后导出整个库；新版支持单文件流式保存较大的数据文件')
    const bytes=new Uint8Array(await blob.arrayBuffer()),parts=[]
    for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)))
    if(android.exportQueryFile(name,btoa(parts.join('')))===false)throw Error('已有备份正在保存，请完成后重试')
    while(true) {
      const status=JSON.parse(android.queryExportStatus())
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
export async function openQueryLibrary({servants=[],onUsePlan=null,waitForArchive=null}={}) {
  const dialog=document.createElement('dialog');dialog.className='equipment-chart-dialog query-library-dialog'
  dialog.innerHTML=`<form method="dialog"><button style="float:right">关闭</button><h2>聚合方案与计算库</h2></form>
    <p>所有查询汇入同一个库，相同编队和相同候选内容自动去重。全局通用编队只保存成员、灵基、礼装、满破要求和位置，自由配队及不同账号共用，调用时按当前条件核实。</p>
    <p>已实际算出的候选与曲线长期保存，包括非最优结果。搜索中未展开、被剪枝的组合不会为了保存而额外穷举。完整有效条件相同时直接复用已完成答案；条件改变时先利用库中编队，再继续核算当前最优。</p>
    <p>点击导出即保存整个库为一个未压缩的数据文件，自动包含全部已保存方案、候选、曲线和查询答案，无需选择导出内容。可迁移到电脑、手机或网页，也可导入多个备份自动合并；不会覆盖账号或设置。相同条件下有不同答案时保留两者并重新核实。</p>
    <div class="account-bar-actions"><button id="queryExportAll">导出方案库</button>
    <label class="file">导入并合并<input id="queryImport" type="file" multiple accept=".gz,.jsonl,application/gzip,application/x-ndjson"></label>
    <button id="queryUseLibrary" ${onUsePlan?'':'hidden'}>从整个库找适配编队</button><button id="queryRefresh">刷新汇总</button></div>
    <p id="queryLibraryStatus" role="status">正在读取…</p><div id="queryLibraryRows"></div>`
  document.body.append(dialog);dialog.showModal()
  const $=id=>dialog.querySelector('#'+id);let busy=false
  function setBusy(value){busy=value;for(const id of ['queryExportAll','queryImport','queryUseLibrary','queryRefresh'])$(id).disabled=value}
  async function refresh(message='') {
    const library=await aggregateLibrary(),plans=library.groups.find(g=>g.kind==='shared-plan')?.count||0,candidates=library.groups.find(g=>g.kind==='computed-candidate')?.count||0
    $('queryLibraryStatus').textContent=`${message}${message?' · ':''}${plans} 个全局方案、${candidates} 个已计算候选，整个库 ${library.count} 个去重内容，约 ${(library.bytes/1048576).toFixed(1)} MB。本机存储不足时会提示保存失败。`
    $('queryLibraryRows').innerHTML=library.groups.map(g=>`<div class="query-library-row" data-kind="${esc(g.kind)}"><span><b>${esc(labels[g.kind]||g.kind)}</b><br><small>最近更新：${new Date(g.updatedAt).toLocaleString('zh-CN',{hour12:false})}</small></span><span>${g.count} 个 · ${(g.bytes/1048576).toFixed(1)} MB</span></div>`).join('')||'<p>库中尚无内容。完成查询或曲线计算后会自动汇入。</p>'
  }
  $('queryExportAll').onclick=async()=>{
    if(busy)return
    setBusy(true);$('queryLibraryStatus').textContent='正在等待候选保存并将整个库写入一个备份文件…'
    try {
      const waited = await waitForArchive?.()
      if (!dialog.isConnected) return
      if (waited) {
        let recovered=await recoverArchivedCandidates()
        for(let i=0;recovered.busy&&i<50;i++){await new Promise(r=>setTimeout(r,100));recovered=await recoverArchivedCandidates()}
        if(!recovered.ok || recovered.busy)throw Error(recovered.error||'候选仍在保存，请稍后导出完整库')
      }
      const archive=await exportQueryStream(),result=await saveFile(archive);await refresh(result.canceled?'已取消保存':`已导出整个库，共 ${archive.count} 个内容，一个文件`)}
    catch(e){$('queryLibraryStatus').textContent=`导出未完成：${e.message}`}finally{setBusy(false)}
  }
  $('queryUseLibrary').onclick=async()=>{
    if(busy||!onUsePlan)return
    setBusy(true);$('queryLibraryStatus').textContent='正在检索整个方案库…'
    try {
      await waitForArchive?.()
      if (!dialog.isConnected) return
      const plans=await sharedPlans({mode:'free',servants},Infinity)
      if(!plans.length)throw Error('库中尚无可核实的通用编队')
      dialog.close();await onUsePlan(plans)
    }catch(e){$('queryLibraryStatus').textContent=e.message}finally{setBusy(false)}
  }
  $('queryRefresh').onclick=()=>refresh().catch(e=>$('queryLibraryStatus').textContent=e.message)
  $('queryImport').onchange=async event=>{
    const files=[...event.target.files];if(!files.length||busy)return
    setBusy(true);$('queryLibraryStatus').textContent='正在校验和聚合备份…'
    try {
      let added=0,duplicates=0,conflicts=0
      for(const file of files){const r=await importQueries(file);added+=r.added;duplicates+=r.duplicates;conflicts+=r.conflicts}
      await refresh(`新增 ${added} 个内容，重复 ${duplicates} 个，保留不同答案 ${conflicts} 个`)
    }catch(e){$('queryLibraryStatus').textContent=`此文件未合并：${e.message}；已有库仍保留。`}
    finally{event.target.value='';setBusy(false)}
  }
  dialog.onclose=()=>dialog.remove()
  try {setBusy(true);await migrateLegacyQueries();$('queryLibraryStatus').textContent='正在恢复此前中断任务的候选…';const recovery=await recoverArchivedCandidates();await refresh(recovery.ok===false?`中断候选恢复未完成：${recovery.error}`:recovery.records?`恢复 ${recovery.records} 个已计算候选`:recovery.busy?'候选日志仍被计算进程占用，已完成的库可正常使用':'');setBusy(false)}catch(e){$('queryLibraryStatus').textContent=`本地结果库暂不可用：${e.message}`}finally{setBusy(false)}
}
