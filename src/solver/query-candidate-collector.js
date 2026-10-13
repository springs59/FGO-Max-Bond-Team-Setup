import { saveComputedCandidates,promoteCompletedQuery } from './query-library.js'
import { journalDirectory,createDiskJournal,consumeDiskJournal,recoverCandidateJournals } from './query-candidate-journal.js'
export async function candidateCollector({onProgress=null}={}) {
  let directory,handle,journal,name
  try {
    directory=await journalDirectory()
    await recoverCandidateJournals(saveComputedCandidates,{directory,onProgress,onRecovered:promoteCompletedQuery})
    name=crypto.randomUUID()+'.jsonl'
    handle=await (await directory.getFileHandle(name,{create:true})).createSyncAccessHandle()
    journal=createDiskJournal(handle)
  }catch(e){
    handle?.close()
    return {capture(){},cancel(){},stats:()=>({queuedWorkerMessages:0,bufferedBytes:0}),
      prepareCompletion:()=>({saved:false}),discardEmpty:async()=>{},finish:async()=>({saved:false,added:0,error:`完整候选保存暂不可用：${e.message||e}；本次计算仍可完成`})}
  }
  let completion=null,closed=false
  function close(){if(!closed){closed=true;journal.close()}}
  return {
    capture:value=>journal.capture(value),checkpoint:force=>journal.checkpoint(force),stats:()=>journal.stats(),
    prepareCompletion() {
      journal.seal()
      return { saved: !journal.error, name, ...journal.stats(), ...(journal.error?{error:journal.error}:{}) }
    },
    async discardEmpty(){if(journal.stats().records)throw Error('不能丢弃非空候选日志');close();await directory.removeEntry(name)},
    finish({beforeRemove=null}={}) {
      if(!completion)completion=(async()=>{
        try {
          journal.seal()
          if(journal.error)return {saved:false,added:0,error:journal.error}
          const result=await consumeDiskJournal(handle,saveComputedCandidates,{onProgress})
          await beforeRemove?.(result)
          close();await directory.removeEntry(name)
          return {saved:true,...result,...journal.stats()}
        }catch(e){return {saved:false,added:0,error:`候选入库未完成，磁盘日志已保留待恢复：${e.message||e}`}}
        finally{close()}
      })()
      return completion
    },
    // Explicit cancellation still preserves every flushed candidate for the
    // next recovery pass. The CPU search itself has no elapsed-time limit.
    cancel(){close()},
  }
}
