import { get, put, status } from './store.js'
let worker
const channel = new BroadcastChannel('fgo-native-tasks')
async function start(command = {}) {
  if (worker) return
  worker = new Worker(new URL('./task-worker.js', import.meta.url), { type: 'module' })
  worker.onmessage = e => {
    channel.postMessage(e.data)
    window.fgoDesktop?.report(e.data)
    window.FgoAndroid?.report(JSON.stringify(e.data))
    if (['done', 'error'].includes(e.data.state)) { worker.terminate(); worker = null }
  }
  worker.onerror = async e => {
    worker?.terminate(); worker = null
    const s = { ...(await status()), state: 'error', phase: '后台计算无法启动', error: e.message || '请更新系统 WebView 后重试' }
    await put('meta','status',s); channel.postMessage(s)
    window.fgoDesktop?.report(s); window.FgoAndroid?.report(JSON.stringify(s))
  }
  worker.postMessage(command)
}
async function pause() {
  worker?.terminate(); worker = null
  const s = { ...(await status()), state: 'paused', updatedAt: Date.now(), phase: '已暂停，已完成的下载与计算可继续' }
  await put('meta', 'status', s); channel.postMessage(s)
  window.fgoDesktop?.report(s); window.FgoAndroid?.report(JSON.stringify(s))
}
window.nativeTaskCommand = command => command.action === 'pause' ? pause() : start(command)
window.fgoDesktop?.onCommand(window.nativeTaskCommand)
if (window.FgoAndroid) start(JSON.parse(window.FgoAndroid.options()))
if (!window.FgoAndroid && !window.fgoDesktop) channel.onmessage = e => { if(e.data?.action) window.nativeTaskCommand(e.data) }
