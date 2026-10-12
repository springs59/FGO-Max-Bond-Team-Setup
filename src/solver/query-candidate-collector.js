export function candidateCollector() {
  const worker = new Worker(new URL('./query-candidate-writer.js',import.meta.url),{type:'module'})
  let buffer = [], failed = null, resolveDone, done = false
  const completion = new Promise(resolve => { resolveDone = resolve })
  worker.onerror = event => {
    failed = {saved:false,error:`已计算候选未能全部保存：${event.message || '存储进程不可用'}`}
    resolveDone(failed)
  }
  worker.onmessage = ({data}) => resolveDone(data)
  function flush() {
    if (!buffer.length) return
    if (!failed) worker.postMessage({type:'batch',values:buffer})
    buffer = []
  }
  return {
    capture(value) { if (done) return; buffer.push(value); if (buffer.length >= 128) flush() },
    async finish() {
      if (!done) { done = true; flush(); if (!failed) worker.postMessage({type:'finish'}) }
      try { return await completion } finally { worker.terminate() }
    },
    cancel() { worker.terminate(); done = true; buffer = [] },
  }
}
