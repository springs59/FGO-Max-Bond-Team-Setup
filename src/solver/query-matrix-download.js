import {UPDATE_URL,validateManifest,digest,MAX_FILE_BYTES} from '../../native/shared/manifest.js'
import {get,put} from '../../native/shared/store.js'
import {importQueries,QUERY_REVISION} from './query-library.js'
import {RULE_VERSION} from '../rules/versions.js'
export async function downloadQueryMatrix({fetchBytes=null,onProgress=()=>{}}={}) {
  const bytes=fetchBytes||(async(url,limit)=>{
    const response=await fetch(url,{cache:'no-store'})
    if(!response.ok)throw Error(`下载失败：HTTP ${response.status}`)
    const reader=response.body.getReader(),chunks=[];let count=0
    try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>limit)throw Error('下载文件超过大小限制');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
    const output=new Uint8Array(count);let offset=0;for(const c of chunks){output.set(c,offset);offset+=c.length}return output
  })
  onProgress({phase:'正在读取预计算方案库目录',done:0,total:0})
  const manifest=validateManifest(JSON.parse(new TextDecoder().decode(await bytes(UPDATE_URL,1024*1024)))),entry=manifest.matrix
  if(entry?.path!=='generated/quest-matrix/index.json'||!Number.isSafeInteger(entry.size)||entry.size<1||entry.size>MAX_FILE_BYTES||!/^[a-f0-9]{64}$/.test(entry.sha256||''))throw Error('此版本尚未提供预计算方案库下载')
  const base=`https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/${manifest.revision}/`
  const indexBytes=await bytes(base+entry.path,MAX_FILE_BYTES)
  if(indexBytes.length!==entry.size||await digest(indexBytes)!==entry.sha256)throw Error('方案库目录校验失败')
  const index=JSON.parse(new TextDecoder().decode(indexBytes))
  if(index.format!=='fgo-quest-condition-matrix'||index.version!==1||index.ruleVersion!==RULE_VERSION||index.queryRevision!==QUERY_REVISION||!Array.isArray(index.files)||index.files.length>20000)throw Error('方案库需要新版软件')
  const seen=new Set()
  for(const f of index.files){if(!/^generated\/quest-matrix\/part-[a-f0-9]{64}-\d{3}\.jsonl\.gz$/.test(f.path)||seen.has(f.path)||!Number.isSafeInteger(f.size)||f.size<1||f.size>MAX_FILE_BYTES||!/^[a-f0-9]{64}$/.test(f.sha256||''))throw Error('方案库目录无效');seen.add(f.path)}
  let done=0,added=0
  for(const file of index.files){
    const key='query-matrix:'+file.path
    if(await get('meta',key)!==file.sha256){
      onProgress({phase:'正在下载与合并预计算方案',done,total:index.files.length})
      const data=await bytes(base+file.path,MAX_FILE_BYTES)
      if(data.length!==file.size||await digest(data)!==file.sha256)throw Error('方案文件校验失败；已有方案仍保留')
      const result=await importQueries(new Blob([data]));added+=result.added
      await put('meta',key,file.sha256)
    }
    onProgress({phase:'正在合并预计算方案',done:++done,total:index.files.length})
  }
  return {added,files:done}
}
