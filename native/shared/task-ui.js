import { get, status, isNative } from './store.js'
const $ = id => document.getElementById(id)
const channel = new BroadcastChannel('fgo-native-tasks')
const labels = { idle:'等待', running:'后台运行中', paused:'已暂停', error:'需要重试', done:'已完成' }
let browserHost
function send(command) {
  if (window.fgoDesktop) window.fgoDesktop.command(command)
  else if(window.FgoAndroid) window.FgoAndroid.command(JSON.stringify(command))
  else {
    if (!browserHost) { browserHost = document.createElement('iframe'); browserHost.hidden = true; browserHost.src = './host.html'; document.body.append(browserHost); browserHost.onload = () => channel.postMessage(command) }
    else channel.postMessage(command)
  }
}
async function render() {
  const s = await status(), active = await get('meta','active')
  $('state').textContent = labels[s.state] || s.state
  $('phase').textContent = s.phase
  $('progress').max = s.total || 1; $('progress').value = s.done || 0
  $('counts').textContent = s.total ? `已完成 ${s.done || 0} / ${s.total} 个文件 · 本次变更 ${s.changed || 0} 个` : '国服和日服独立更新，复用未变化的索引'
  $('time').textContent = `耗时 ${Math.round((s.elapsedMs || 0)/1000)} 秒${s.checkedAt ? ' · 最近检查 '+new Date(s.checkedAt).toLocaleString() : ''}`
  $('error').textContent = s.error || ''
  $('start').disabled = s.state === 'running'; $('rebuild').disabled = s.state === 'running'; $('pause').disabled = s.state !== 'running'
  $('version').textContent = active ? `数据 ${active.id.slice(0,12)} · 发布于 ${new Date(active.generatedAt).toLocaleString()}` : '正在使用随安装包附带的数据'
  $('logs').replaceChildren(...(s.logs || []).slice(-30).reverse().map(row => { const li=document.createElement('li'); li.textContent=new Date(row.at).toLocaleTimeString()+' '+row.text; return li }))
}
$('start').onclick = () => send({action:'start'})
$('pause').onclick = () => send({action:'pause'})
$('rebuild').onclick = () => send({action:'start',force:true})
$('auto').checked = localStorage.getItem('nativeAutoUpdate') !== '0'
$('auto').onchange = () => { localStorage.setItem('nativeAutoUpdate',$('auto').checked?'1':'0'); if(window.fgoDesktop) window.fgoDesktop.auto($('auto').checked); if(window.FgoAndroid) window.FgoAndroid.auto($('auto').checked) }
$('apply').onclick = () => { if(window.fgoDesktop) window.fgoDesktop.apply(); else if(window.FgoAndroid) window.FgoAndroid.apply(); else location.href='../index.html' }
$('platform').textContent = isNative() ? (window.fgoDesktop ? '窗口关闭后可留在系统托盘运行。自动更新每 6 小时检查一次；电脑休眠时等待恢复。' : '后台任务通过通知栏显示。自动检查由安卓系统调度；系统中断后下次继续。') : '网页预览：离开此页面会中断后台任务，已完成的步骤会保留。软件版由独立后台任务运行。'
channel.onmessage = render
setInterval(render,1500); render()
