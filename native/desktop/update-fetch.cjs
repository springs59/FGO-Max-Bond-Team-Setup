const {Readable}=require('node:stream')

function responseHeaders(values={}) {
  const headers=new Headers()
  for(const [name,value] of Object.entries(values))headers.set(name,Array.isArray(value)?value.join(', '):String(value))
  return headers
}

// net.fetch cancels manual redirects instead of returning their status/Location.
// Expose each hop to updater.request so its source checks run before connecting.
function createUpdateFetch(net) {
  return (url,{headers={},signal,redirect='manual'}={})=>new Promise((resolve,reject)=>{
    if(redirect!=='manual')return reject(new Error('更新请求必须逐次校验跳转'))
    if(signal?.aborted)return reject(signal.reason||new Error('更新请求已取消'))
    let settled=false,response
    const req=net.request({url,method:'GET',redirect:'manual',headers,credentials:'omit'})
    const cleanup=()=>signal?.removeEventListener('abort',abort)
    const fail=error=>{
      cleanup()
      if(!settled){settled=true;reject(error)}
      else response?.destroy(error)
    }
    const abort=()=>{fail(signal.reason||new Error('更新请求已取消'));req.abort()}
    req.once('error',fail)
    req.once('abort',()=>{if(!settled)fail(new Error('更新请求已取消'))})
    req.once('redirect',(status,method,location,values)=>{
      try {
        const h=responseHeaders(values);h.set('location',location)
        const result=new Response(null,{status,headers:h})
        cleanup();settled=true;resolve(result)
      }catch(error){fail(error)}
      // Stop this transaction; updater.request validates and opens the next URL.
      req.abort()
    })
    req.once('response',incoming=>{
      response=incoming
      incoming.once('end',cleanup);incoming.once('close',cleanup)
      incoming.once('aborted',()=>fail(new Error('更新下载连接中断')))
      try {
        const noBody=[204,205,304].includes(incoming.statusCode)
        const body=noBody?null:Readable.toWeb(incoming)
        const result=new Response(body,{status:incoming.statusCode,headers:responseHeaders(incoming.headers)})
        settled=true;resolve(result)
        if(noBody)incoming.resume()
      }catch(error){fail(error);req.abort()}
    })
    signal?.addEventListener('abort',abort,{once:true})
    if(signal?.aborted)abort()
    else req.end()
  })
}
module.exports={createUpdateFetch}
