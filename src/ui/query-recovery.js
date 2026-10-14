export function recoverArchivedCandidates(options={}) {
  const worker=new Worker(new URL('../solver/query-candidate-writer.js',import.meta.url),{type:'module'})
  return new Promise(resolve=>{
    worker.onmessage=({data})=>{worker.terminate();resolve(data)}
    worker.onerror=event=>{worker.terminate();resolve({ok:false,error:event.message})}
    worker.postMessage(options)
  })
}
