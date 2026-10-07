import { isNative, status } from './store.js'
if(isNative()) {
  const bar=document.createElement('div')
  bar.style.cssText='padding:10px 18px;background:#1d2e3e;color:#e8f3ff;display:flex;justify-content:space-between;align-items:center;gap:12px;font:14px system-ui;position:relative;z-index:2'
  const text=document.createElement('span'), button=document.createElement('button')
  button.textContent='更新与后台任务';button.style.cssText='background:#afd8f6;color:#172635;border:0;border-radius:6px;padding:9px 12px;cursor:pointer;white-space:nowrap'
  button.onclick=()=>{ if(window.fgoDesktop)window.fgoDesktop.openTasks();else if(window.FgoAndroid)window.FgoAndroid.openTasks() }
  bar.append(text,button);document.body.prepend(bar)
  const refresh=async()=>{ const s=await status();text.textContent=s.state==='running'?s.phase:s.state==='error'?'更新失败，正在使用旧数据':s.state==='done'?'数据与预计算已就绪':'离线图鉴可用 · 后台任务可查看' }
  setInterval(refresh,3000);refresh()
}
