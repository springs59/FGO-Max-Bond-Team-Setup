import { isNative, status } from './store.js'
import { taskPhase } from './task-display.js'
if(isNative()) {
  const bar=document.createElement('div')
  bar.className='native-taskbar'
  const text=document.createElement('span'), button=document.createElement('button')
  button.textContent='更新与后台任务'
  button.onclick=()=>{ if(window.fgoDesktop)window.fgoDesktop.openTasks();else if(window.FgoAndroid)window.FgoAndroid.openTasks() }
  bar.append(text,button);document.body.prepend(bar)
  let refreshing = false
  const refresh=async()=>{
    if (refreshing) return
    refreshing = true
    try {
      const s=await status()
      const label=s.state==='running'?taskPhase(s):s.state==='error'?'更新未完成 · 可重试':s.state==='done'?'数据已就绪':s.state==='paused'?'更新已暂停 · 可继续':'离线图鉴可用'
      if (text.textContent !== label) text.textContent=label
    } catch { text.textContent='离线图鉴可用 · 任务状态暂不可用' }
    finally { refreshing = false }
  }
  setInterval(refresh,3000);refresh()
}
