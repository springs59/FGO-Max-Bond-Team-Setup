import { journalDirectory,createDiskJournal } from './query-candidate-journal.js'
export async function candidateCollector({summary=''}={}) {
  let directory,handle,journal,name
  try {
    directory=await journalDirectory()
    name=crypto.randomUUID()+'.jsonl'
    handle=await (await directory.getFileHandle(name,{create:true})).createSyncAccessHandle()
    journal=createDiskJournal(handle,{summary})
  }catch(e){
    handle?.close()
    return {capture(){},cancel(){},stats:()=>({queuedWorkerMessages:0,bufferedBytes:0}),
      prepareCompletion:()=>({saved:false}),retain:async()=>({temporary:false,error:`临时缓存不可用：${e.message||e}；本次计算仍可完成`}),discardEmpty:async()=>{}}
  }
  let closed=false
  function close(){if(!closed){closed=true;journal.close()}}
  return {
    capture:value=>journal.capture(value),checkpoint:force=>journal.checkpoint(force),stats:()=>journal.stats(),
    prepareCompletion() {
      journal.seal()
      return { saved: !journal.error, name, ...journal.stats(), ...(journal.error?{error:journal.error}:{}) }
    },
    async discardEmpty(){if(journal.stats().records)throw Error('不能丢弃非空候选日志');close();await directory.removeEntry(name)},
    async retain() {
      const status=this.prepareCompletion()
      close()
      return { ...status, saved:false, temporary:status.saved, name }
    },
    // Explicit cancellation still preserves every flushed candidate for the
    // next recovery pass. The CPU search itself has no elapsed-time limit.
    cancel(){close()},
  }
}
