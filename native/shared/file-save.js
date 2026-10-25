const CHUNK=48*1024
let sequence=0,activeBridge=null
const pending=new Map()
function androidBridge(){
  const bridge=globalThis.window?.FgoFileExport
  if(!bridge?.postMessage){if(globalThis.window?.FgoAndroid)throw Error('当前安卓版本或系统 WebView 不支持保存文件，请更新后重试');return null}
  if(activeBridge!==bridge){
    activeBridge=bridge
    bridge.onmessage=event=>{
      let message;try{message=JSON.parse(event.data)}catch{return}
      const waiter=pending.get(message.id);if(!waiter)return
      pending.delete(message.id)
      if(message.error)waiter.reject(Error(message.error));else waiter.resolve(message)
    }
  }
  return bridge
}
function request(bridge,id,action,data={}){
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});try{bridge.postMessage(JSON.stringify({id,action,...data}))}catch(error){pending.delete(id);reject(error)}})
}
function base64(bytes){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary)}
async function saveAndroid(bridge,stream,name,size){
  const id=`save-${Date.now()}-${++sequence}`;let reader
  try{
    const ready=await request(bridge,id,'begin',{name,size})
    if(ready.cancelled)return {saved:false,cancelled:true}
    if(!ready.ready)throw Error('系统尚未准备好保存文件')
    reader=stream.getReader();let chunks=0
    for(;;){const {done,value}=await reader.read();if(done)break
      for(let offset=0;offset<value.length;offset+=CHUNK){
        await request(bridge,id,'chunk',{data:base64(value.subarray(offset,offset+CHUNK))})
        if(++chunks%16===0)await new Promise(r=>setTimeout(r,0))
      }
    }
    const result=await request(bridge,id,'finish')
    if(!result.saved)throw Error('文件未完成保存')
    return result
  }catch(error){try{bridge.postMessage(JSON.stringify({id,action:'abort'}))}catch{}throw error}
  finally{pending.delete(id);if(reader){await reader.cancel().catch(()=>{});reader.releaseLock()}else await stream.cancel().catch(()=>{})}
}
function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();return {saved:true,downloadStarted:true}}
export async function saveBlob(blob,name){
  const bridge=androidBridge()
  if(bridge)return saveAndroid(bridge,blob.stream(),name,blob.size)
  const url=URL.createObjectURL(blob)
  try{return download(url,name)}finally{setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
export async function saveUrl(url,name){
  const bridge=androidBridge()
  if(!bridge)return download(url,name)
  if(!String(url).startsWith('blob:'))throw Error('只能保存本机生成的导出文件')
  const response=await fetch(url);if(!response.ok||!response.body)throw Error('无法读取导出文件')
  const length=response.headers.get('content-length'),size=length==null?-1:Number(length)
  return saveAndroid(bridge,response.body,name,Number.isSafeInteger(size)&&size>=0?size:-1)
}
