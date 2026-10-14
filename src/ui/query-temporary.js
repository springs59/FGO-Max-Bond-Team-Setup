import { recoverArchivedCandidates } from './query-recovery.js'
let entries=[],message='',busy=false,loaded=false,generation=0
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function temporaryPanel() {
  return `<section id="temporaryQueries" ${entries.length||message?'':'hidden'} aria-label="本地计算临时缓存">
    <p>本地计算临时缓存：是否保存到方案库？终止任务只保存已算出的候选。</p>
    ${entries.map((entry,i)=>`<div class="account-bar-actions"><span>${esc(entry.summary||`任务 ${i+1}`)} · ${(entry.bytes/1048576).toFixed(1)} MB</span><button data-temp-save="${esc(entry.name)}" ${busy?'disabled':''}>是，保存到方案库</button><button data-temp-discard="${esc(entry.name)}" ${busy?'disabled':''}>否，删除临时文件</button></div>`).join('')}
    <p role="status">${esc(message)}</p></section>`
}
export async function refreshTemporary(render) {
  const current=++generation
  let result=await recoverArchivedCandidates()
  for(let i=0;result.busy&&i<10;i++){await new Promise(r=>setTimeout(r,100));result=await recoverArchivedCandidates()}
  if(current!==generation)return
  if(result.ok){entries=result.entries||[];loaded=true}
  render()
}
export function bindTemporary(app,render,{calculating=false}={}) {
  if(!loaded&&!calculating){loaded=true;refreshTemporary(render)}
  const panel=app.querySelector('#temporaryQueries')
  if(panel&&calculating)panel.hidden=true
  for(const action of ['save','discard'])app.querySelectorAll(`[data-temp-${action}]`).forEach(button=>{
    button.onclick=async()=>{
      if(busy||calculating)return
      busy=true;message=action==='save'?'正在保存，临时文件会保留至入库成功…':'正在删除临时文件…';render()
      const result=await recoverArchivedCandidates({action,name:button.getAttribute(`data-temp-${action}`)})
      busy=false;message=result.ok?(action==='save'?'已保存到方案库。':'已删除临时文件。'):result.error
      await refreshTemporary(render)
    }
  })
}
