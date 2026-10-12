const {writeFile,open,rename,unlink}=require('node:fs/promises')
const {randomUUID}=require('node:crypto')
async function exportQueryFile(name,input,choosePath) {
  if(!/^FGO-query-results-\d{4}-\d{2}-\d{2}\.jsonl(?:\.gz)?$/.test(name))throw Error('备份文件名无效')
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):null
  if(!bytes||bytes.byteLength>256*1024*1024)throw Error('备份文件内容无效或过大')
  const selected=await choosePath(name)
  if(selected.canceled||!selected.filePath)return {saved:false,canceled:true}
  await writeFile(selected.filePath,bytes)
  return {saved:true}
}
async function createQueryExport(name,choosePath) {
  if(!/^FGO-query-results-\d{4}-\d{2}-\d{2}\.jsonl(?:\.gz)?$/.test(name))throw Error('备份文件名无效')
  const selected=await choosePath(name)
  if(selected.canceled||!selected.filePath)return null
  const temporary=selected.filePath+'.'+randomUUID()+'.partial',file=await open(temporary,'wx')
  let closed=false
  return {
    async append(input) {
      const bytes=input instanceof ArrayBuffer?new Uint8Array(input):ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):null
      if(closed||!bytes||bytes.length>1024*1024)throw Error('备份数据块无效')
      let offset=0
      while(offset<bytes.length){const {bytesWritten}=await file.write(bytes,offset,bytes.length-offset);if(!bytesWritten)throw Error('备份写入中断');offset+=bytesWritten}
    },
    async finish(cancel=false) {
      if(closed)return {saved:false,canceled:true}
      closed=true
      try {await file.close();if(cancel){await unlink(temporary);return {saved:false,canceled:true}}await rename(temporary,selected.filePath);return {saved:true}}
      catch(error){await unlink(temporary).catch(()=>{});throw error}
    },
  }
}
module.exports={exportQueryFile,createQueryExport}
