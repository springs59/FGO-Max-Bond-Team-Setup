export function taskPhase(task = {}) {
  if (/^下载与校验：/.test(task.phase || '')) return '下载并校验数据'
  if (/^下载重试/.test(task.phase || '')) return '网络连接不稳定，正在重试下载'
  return task.phase || '等待检查更新'
}

export function taskError(task = {}) {
  const raw = String(task.error || task.phase || '')
  if (/QuotaExceeded|IndexedDB|SecurityError|存储/i.test(raw)) return '本机数据存储暂不可用，请检查可用空间或重新打开软件后重试。'
  if (/校验|指纹|不完整/.test(raw)) return '新数据未通过完整性检查，可以稍后重试。'
  if (/HTTP\s*(401|403)/i.test(raw)) return '更新服务暂时拒绝访问，请稍后重试。'
  if (/HTTP\s*404/i.test(raw)) return '更新文件暂不可用，请稍后重试。'
  if (/HTTP\s*5\d\d/i.test(raw)) return '更新服务暂时不可用，请稍后重试。'
  if (/AbortError|Timeout|超时|Failed to fetch|NetworkError|网络/i.test(raw)) return '更新连接未完成，请检查网络后重试。'
  if (/后台计算|WebView/i.test(raw)) return '后台计算暂时无法启动，请重新打开软件后重试。'
  return '本次更新未完成，可以重试或继续使用原有数据。'
}
