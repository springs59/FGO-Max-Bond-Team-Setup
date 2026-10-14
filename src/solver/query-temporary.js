import { journalDirectory, consumeDiskJournal } from './query-candidate-journal.js'
import { saveComputedCandidates, promoteCompletedQuery, discardCompletedQuery } from './query-library.js'

// Startup only lists journals. No candidate is imported before a user choice.
export async function temporaryQueries({directory=null,action='list',name=null,onProgress=null}={}) {
  const dir=directory||await journalDirectory()
  if(action!=='list') {
    if(!['save','discard'].includes(action)||typeof name!=='string'||!/^[\w-]+\.jsonl$/.test(name))throw Error('临时任务无效')
    const file=await dir.getFileHandle(name),handle=await file.createSyncAccessHandle()
    try {
      if(action==='save') {
        const archive=await consumeDiskJournal(handle,saveComputedCandidates,{onProgress})
        const exact=await promoteCompletedQuery(name,archive)
        if(!exact.saved&&!exact.missing)throw Error(exact.error||'完整答案保存失败')
        await discardCompletedQuery(name)
        handle.close();await dir.removeEntry(name)
        return {saved:true,exact:exact.saved,...archive}
      }
      await discardCompletedQuery(name)
      handle.close();await dir.removeEntry(name)
      return {discarded:true}
    } catch(error) {try{handle.close()}catch{};throw error}
  }
  const entries=[];let busy=0
  for await(const [name,file] of dir.entries()) {
    if(file.kind!=='file'||!name.endsWith('.jsonl'))continue
    let handle
    try {handle=await file.createSyncAccessHandle()}
    catch(error){if(['NoModificationAllowedError','InvalidStateError'].includes(error.name)){busy++;continue}throw error}
    const bytes=handle.getSize();let summary=''
    try{const chunk=new Uint8Array(Math.min(bytes,64*1024)),size=handle.read(chunk,{at:0}),line=new TextDecoder().decode(chunk.subarray(0,size)).split('\n')[0];summary=JSON.parse(line).summary||''}catch{}
    handle.close()
    entries.push({name,bytes,summary})
  }
  return {entries,busy}
}
