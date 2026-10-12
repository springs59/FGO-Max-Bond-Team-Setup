// Candidate recording is synchronous disk I/O in the calculation Worker.
// It never queues structured clones while a long synchronous search runs.
export const JOURNAL_DIRECTORY = 'fgo-candidate-journals-v1'
export const JOURNAL_BUFFER_BYTES = 256 * 1024
export const JOURNAL_BATCH_RECORDS = 128
export const JOURNAL_LINE_BYTES = 1024 * 1024
const HEADER = JSON.stringify({format:'fgo-computed-candidates',version:1})+'\n'
const encoder = new TextEncoder()
export async function journalDirectory() {
  if (!globalThis.navigator?.storage?.getDirectory) throw Error('当前运行环境不支持磁盘候选日志，请更新系统 WebView 或浏览器')
  return (await navigator.storage.getDirectory()).getDirectoryHandle(JOURNAL_DIRECTORY,{create:true})
}
export function createDiskJournal(handle,{now=Date.now}={}) {
  let offset=handle.getSize(),closed=false,error=null,count=0,lastFlush=now()
  const buffer=new Uint8Array(JOURNAL_BUFFER_BYTES)
  let used=0,bufferedRecords=0,peakBytes=0
  function write(bytes) {
    let at=0,start=offset
    try { while(at<bytes.length) {
      const size=handle.write(bytes.subarray(at),{at:offset})
      if(!Number.isInteger(size)||size<=0)throw Error('磁盘日志写入中断')
      at+=size;offset+=size
    }}catch(error){try{handle.truncate(start);offset=start}catch{}throw error}
  }
  function flush() {
    if(used){write(buffer.subarray(0,used));used=0;bufferedRecords=0}
    handle.flush();lastFlush=now()
  }
  if(!offset)write(encoder.encode(HEADER))
  return {
    capture(value) {
      if(closed||error)return
      try {
        const bytes=encoder.encode(JSON.stringify(value)+'\n')
        if(bytes.length>JOURNAL_LINE_BYTES)throw Error('单条候选超过磁盘日志的安全大小')
        if(used+bytes.length>buffer.length)flush()
        if(bytes.length>buffer.length){write(bytes);handle.flush();lastFlush=now()}
        else{buffer.set(bytes,used);used+=bytes.length;bufferedRecords++;peakBytes=Math.max(peakBytes,used)}
        count++
        if(bufferedRecords>=JOURNAL_BATCH_RECORDS||now()-lastFlush>=1000)flush()
      }catch(e){error=`已计算候选未能全部保存：${e.message||e}`}
    },
    checkpoint(force=false){if(!closed&&!error&&used&&(force||now()-lastFlush>=1000)){try{flush()}catch(e){error=`候选磁盘检查点未完成：${e.message||e}`}}},
    seal() {
      if(closed)return
      try{if(!error)flush()}catch(e){error=`已计算候选未能全部保存：${e.message||e}`}
      closed=true
    },
    close(){this.seal();handle.close()},
    get error(){return error},
    stats(){return {records:count,bytes:offset+used,bufferedBytes:used,peakBufferedBytes:peakBytes,queuedWorkerMessages:0}},
  }
}
// Read fixed-size disk blocks and await every IndexedDB transaction. Recovery
// can repeat committed prefixes safely because the library is content-addressed.
export async function consumeDiskJournal(handle,saveBatch,{onProgress=null}={}) {
  const block=new Uint8Array(64*1024),line=new Uint8Array(JOURNAL_LINE_BYTES)
  const decoder=new TextDecoder('utf-8',{fatal:true})
  let position=0,used=0,header=false,batch=[],added=0,records=0,batchBytes=0
  async function commit() {
    if(!batch.length)return
    const saved=await saveBatch(batch)
    added+=saved?.added||0;records+=batch.length;batch=[];batchBytes=0
    onProgress?.({records,bytes:position,added})
  }
  while(position<handle.getSize()) {
    const size=handle.read(block,{at:position});if(!size)throw Error('磁盘日志读取中断')
    for(let i=0;i<size;i++) {
      position++
      if(block[i]===10) {
        const value=JSON.parse(decoder.decode(line.subarray(0,used)))
        if(!header){if(value.format!=='fgo-computed-candidates'||value.version!==1)throw Error('候选日志格式无效');header=true}
        else {
          if(batch.length&&batchBytes+used>JOURNAL_BUFFER_BYTES)await commit()
          batch.push(value);batchBytes+=used
          if(batch.length>=JOURNAL_BATCH_RECORDS)await commit()
        }
        used=0
      } else {
        if(used>=line.length)throw Error('候选日志单条数据过大')
        line[used++]=block[i]
      }
    }
  }
  if(!header)throw Error('候选日志缺少完整头部')
  // A terminated Worker can leave an unfinished last record. Preserve all
  // complete preceding records; never invent a complete query answer from it.
  await commit()
  return {added,records,incompleteTail:used>0}
}
export async function recoverCandidateJournals(saveBatch,{directory=null,onProgress=null}={}) {
  const dir=directory||await journalDirectory()
  let records=0,added=0,recovered=0,busy=0
  for await(const [name,file] of dir.entries()) {
    if(file.kind!=='file'||!name.endsWith('.jsonl'))continue
    let handle
    try {handle=await file.createSyncAccessHandle()}
    catch(e){if(['NoModificationAllowedError','InvalidStateError'].includes(e.name)){busy++;continue}throw e}
    try {
      const result=await consumeDiskJournal(handle,saveBatch,{onProgress})
      records+=result.records;added+=result.added;recovered++
    }finally{handle.close()}
    await dir.removeEntry(name)
  }
  return {recovered,records,added,busy}
}
