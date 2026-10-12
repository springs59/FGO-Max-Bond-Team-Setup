const {writeFile}=require('node:fs/promises')
async function exportQueryFile(name,input,choosePath) {
  if(!/^FGO-query-results-\d{4}-\d{2}-\d{2}\.jsonl(?:\.gz)?$/.test(name))throw Error('备份文件名无效')
  const bytes=input instanceof ArrayBuffer?new Uint8Array(input):ArrayBuffer.isView(input)?new Uint8Array(input.buffer,input.byteOffset,input.byteLength):null
  if(!bytes||bytes.byteLength>256*1024*1024)throw Error('备份文件内容无效或过大')
  const selected=await choosePath(name)
  if(selected.canceled||!selected.filePath)return {saved:false,canceled:true}
  await writeFile(selected.filePath,bytes)
  return {saved:true}
}
module.exports={exportQueryFile}
