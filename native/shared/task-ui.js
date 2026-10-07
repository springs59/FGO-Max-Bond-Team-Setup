import { get, status, isNative } from './store.js'
import { taskPhase, taskError } from './task-display.js'
const $ = id => document.getElementById(id)
const channel = new BroadcastChannel('fgo-native-tasks')
const labels = { idle:'等待更新', running:'更新中', paused:'已暂停', error:'需要重试', done:'已完成' }
let browserHost, refreshing = false, renderedLogs = ''
const text = (id, value) => { const node = $(id); if (node.textContent !== value) node.textContent = value }
function showError(task) {
  $('error-box').hidden = false
  text('error', taskError(task))
  text('error-detail', String(task.error || task.phase || '未提供详细错误'))
}
function send(command) {
  try {
    if (window.fgoDesktop) window.fgoDesktop.command(command)
    else if(window.FgoAndroid) window.FgoAndroid.command(JSON.stringify(command))
    else {
      if (!browserHost) {
        browserHost = document.createElement('iframe'); browserHost.hidden = true
        browserHost.onload = () => channel.postMessage(command)
        browserHost.onerror = () => showError({ error:'后台计算无法启动' })
        browserHost.src = './host.html'; document.body.append(browserHost)
      } else channel.postMessage(command)
    }
  } catch (error) { showError({ error: String(error.message || error) }) }
}
async function render() {
  if (refreshing) return
  refreshing = true
  try {
    const [s, active] = await Promise.all([status(), get('meta','active')])
    text('state', labels[s.state] || '等待更新')
    $('state').dataset.state = s.state || 'idle'
    text('phase', s.state === 'error' ? '更新未完成，原有数据仍可使用' : taskPhase(s))
    $('progress').max = s.total || 1; $('progress').value = Math.min(s.done || 0, s.total || 1)
    $('progress').hidden = !s.total && s.state !== 'running'
    text('counts', s.total ? `已完成 ${s.done || 0} / ${s.total} 个文件 · 本次更新 ${s.changed || 0} 个` : '国服和日服独立更新，复用未变化的索引')
    text('time', `耗时 ${Math.round((s.elapsedMs || 0)/1000)} 秒${s.checkedAt ? ' · 最近检查 '+new Date(s.checkedAt).toLocaleString() : ''}`)
    $('error-box').hidden = s.state !== 'error'
    if (s.state === 'error') showError(s)
    text('start', { running:'正在更新…', paused:'继续任务', error:'重试更新' }[s.state] || '检查更新')
    $('start').disabled = s.state === 'running'; $('rebuild').disabled = s.state === 'running'
    $('pause').hidden = s.state !== 'running'
    $('apply').disabled = !active || s.state === 'running'
    text('version', active ? `数据版本 ${String(active.id).slice(0,12)} · 发布于 ${new Date(active.generatedAt).toLocaleString()}` : '正在使用随安装包附带的数据')
    const logs = (s.logs || []).slice(-30), key = JSON.stringify(logs)
    if (key !== renderedLogs) {
      renderedLogs = key
      $('logs').replaceChildren(...logs.slice().reverse().map(row => { const li=document.createElement('li'); li.textContent=new Date(row.at).toLocaleTimeString()+' '+row.text; return li }))
    }
    text('log-count', logs.length ? `最近 ${logs.length} 条` : '')
    $('empty-logs').hidden = logs.length > 0
  } catch (error) {
    text('state','状态暂不可用'); $('state').dataset.state = 'error'
    text('phase','无法读取本机任务状态')
    showError({ error: `IndexedDB: ${String(error.message || error)}` })
    $('progress').hidden = true; $('start').disabled = false; text('start','重试更新')
    $('pause').hidden = true; $('apply').disabled = true
  } finally { refreshing = false }
}
$('start').onclick = () => send({action:'start'})
$('pause').onclick = () => send({action:'pause'})
$('rebuild').onclick = () => send({action:'start',force:true})
try { $('auto').checked = localStorage.getItem('nativeAutoUpdate') !== '0' } catch { $('auto').checked = true }
$('auto').onchange = () => {
  try {
    localStorage.setItem('nativeAutoUpdate',$('auto').checked?'1':'0')
    if(window.fgoDesktop) window.fgoDesktop.auto($('auto').checked)
    if(window.FgoAndroid) window.FgoAndroid.auto($('auto').checked)
  } catch (error) { showError({error:`存储设置失败：${String(error.message || error)}`}) }
}
$('apply').onclick = () => { if(window.fgoDesktop) window.fgoDesktop.apply(); else if(window.FgoAndroid) window.FgoAndroid.apply(); else location.href='../index.html' }
$('platform').textContent = isNative() ? (window.fgoDesktop ? '自动更新每 6 小时检查一次。窗口关闭后可留在系统托盘运行，电脑休眠时等待恢复。' : '自动检查由安卓系统调度，进度可在通知栏查看。系统中断后，下次继续已完成的步骤。') : '网页预览：离开页面会中断任务，已完成的步骤会保留。软件版可在后台运行。'
channel.onmessage = render
setInterval(render,1500); render()
