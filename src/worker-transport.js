// Large jobs and results cross the Worker boundary in acknowledged, transferable
// packets. At most one 64 KiB packet is in flight; no computation time limit.
export const WORKER_PACKET_BYTES=64*1024
const MARKER='fgo-bounded-worker-message-v1'
const workers=new WeakMap()
const encoder=new TextEncoder(),decoder=new TextDecoder()
function primitive(value) {
  if(value===undefined)return ['u']
  if(typeof value==='bigint')return ['big',String(value)]
  if(typeof value==='number'&&Object.is(value,-0))return ['num','-0']
  if(typeof value==='number'&&!Number.isFinite(value))return ['num',String(value)]
  if(typeof value==='function'||typeof value==='symbol')throw new DOMException('任务中含有不能传输的函数或 Symbol','DataCloneError')
  return ['v',value]
}
export function* workerRecords(value) {
  const seen=new WeakMap();let next=1
  function* visit(value,parent,key) {
    if(!value||typeof value!=='object') {
      if(typeof value==='string'&&value.length>2048) {
        const id=next++;yield ['text',id]
        for(let i=0;i<value.length;i+=2048)yield ['append',id,value.slice(i,i+2048)]
        yield ['text-end',id,parent,key];return
      }
      yield ['value',parent,key,...primitive(value)];return
    }
    if(seen.has(value)){yield ['ref',parent,key,seen.get(value)];return}
    const id=next++;seen.set(value,id)
    if(value instanceof ArrayBuffer) {
      yield ['buffer',id,value.byteLength]
      const bytes=new Uint8Array(value)
      for(let at=0;at<bytes.length;at+=8192)yield ['bytes',id,at,btoa(String.fromCharCode(...bytes.subarray(at,at+8192)))]
    }else if(ArrayBuffer.isView(value)) {
      const temporary=next++;yield ['array',temporary,1]
      yield* visit(value.buffer,temporary,0)
      yield ['view',id,value.constructor.name,seen.get(value.buffer),value.byteOffset,value instanceof DataView?value.byteLength:value.length]
      yield ['drop',temporary]
    }else if(value instanceof Date)yield ['date',id,...primitive(value.getTime())]
    else if(value instanceof RegExp)yield ['regex',id,value.source,value.flags]
    else if(value instanceof Map) {
      yield ['map',id];yield ['ref',parent,key,id]
      for(const [k,v] of value){const temporary=next++;yield ['array',temporary,2];yield* visit(k,temporary,0);yield* visit(v,temporary,1);yield ['map-entry',id,temporary]}
      return
    }else if(value instanceof Set) {
      yield ['set',id];yield ['ref',parent,key,id]
      for(const v of value){const temporary=next++;yield ['array',temporary,1];yield* visit(v,temporary,0);yield ['set-entry',id,temporary]}
      return
    }else {
      if(Array.isArray(value))yield ['array',id,value.length]
      else yield ['object',id]
      yield ['ref',parent,key,id]
      if(Array.isArray(value)) {
        for(let i=0;i<value.length;i++)if(Object.hasOwn(value,i))yield* visit(value[i],id,i)
        for(const k in value)if(Object.hasOwn(value,k)&&!(String(Number(k))===k&&Number(k)>=0&&Number(k)<4294967295))yield* visit(value[k],id,k)
      }else for(const k of Object.keys(value))yield* visit(value[k],id,k)
      return
    }
    yield ['ref',parent,key,id]
  }
  yield* visit(value,0,'value')
}
function decodePrimitive(type,value){if(type==='u')return undefined;if(type==='big')return BigInt(value);if(type==='num')return Number(value);if(type==='v')return value;throw Error('Invalid Worker primitive')}
export function workerDecoder() {
  const nodes=new Map([[0,{}]])
  const typed=new Map(['Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array','DataView'].map(k=>[k,globalThis[k]]))
  const assign=(id,key,value)=>Object.defineProperty(nodes.get(id),key,{value,enumerable:true,configurable:true,writable:true})
  return {
    accept(records) {
      for(const [kind,a,b,c,d,e] of records) {
        if(kind==='object')nodes.set(a,{})
        else if(kind==='array')nodes.set(a,new Array(b))
        else if(kind==='value')assign(a,b,decodePrimitive(c,d))
        else if(kind==='ref')assign(a,b,nodes.get(c))
        else if(kind==='text')nodes.set(a,[])
        else if(kind==='append')nodes.get(a).push(b)
        else if(kind==='text-end'){assign(b,c,nodes.get(a).join(''));nodes.delete(a)}
        else if(kind==='date')nodes.set(a,new Date(decodePrimitive(b,c)))
        else if(kind==='regex')nodes.set(a,new RegExp(b,c))
        else if(kind==='map')nodes.set(a,new Map())
        else if(kind==='set')nodes.set(a,new Set())
        else if(kind==='map-entry'){const pair=nodes.get(b);nodes.get(a).set(pair[0],pair[1]);nodes.delete(b)}
        else if(kind==='set-entry'){nodes.get(a).add(nodes.get(b)[0]);nodes.delete(b)}
        else if(kind==='buffer')nodes.set(a,new ArrayBuffer(b))
        else if(kind==='bytes'){const raw=atob(c),view=new Uint8Array(nodes.get(a),b,raw.length);for(let i=0;i<raw.length;i++)view[i]=raw.charCodeAt(i)}
        else if(kind==='view'){const C=typed.get(b);if(!C)throw Error('Unsupported Worker view');nodes.set(a,new C(nodes.get(c),d,e))}
        else if(kind==='drop')nodes.delete(a)
        else throw Error('Invalid Worker record')
      }
    },
    finish(){const value=nodes.get(0).value;nodes.clear();return value},
    dispose(){nodes.clear()},
  }
}
export function* workerPackets(value,maxBytes=WORKER_PACKET_BYTES) {
  let packet=[],bytes=2
  for(const record of workerRecords(value)) {
    const size=encoder.encode(JSON.stringify(record)).length+1
    if(size+2>maxBytes)throw Error('单个任务字段过大，不能进行安全分块传输')
    if(packet.length&&bytes+size>maxBytes){yield encoder.encode(JSON.stringify(packet)).buffer;packet=[];bytes=2}
    packet.push(record);bytes+=size
  }
  if(packet.length)yield encoder.encode(JSON.stringify(packet)).buffer
}
export async function sendWorkerPort(port,value,{signal=null,onPacket=null}={}) {
  let awaiting=null
  const error=()=>new DOMException('任务已取消','AbortError')
  const abort=()=>{awaiting?.reject(error());awaiting=null;port.close()}
  signal?.addEventListener('abort',abort,{once:true})
  port.onmessage=({data})=>{
    if(!awaiting)return
    const wait=awaiting;awaiting=null
    data.error?wait.reject(Error(data.error)):wait.resolve()
  }
  port.onmessageerror=()=>{awaiting?.reject(Error('Worker 分块消息读取失败'));awaiting=null}
  try {
    if(signal?.aborted)throw error()
    for(const buffer of workerPackets(value)) {
      const acknowledged=new Promise((resolve,reject)=>{awaiting={resolve,reject}})
      onPacket?.({bytes:buffer.byteLength,inFlight:1})
      port.postMessage({buffer},[buffer])
      await acknowledged
      if(signal?.aborted)throw error()
    }
    const acknowledged=new Promise((resolve,reject)=>{awaiting={resolve,reject}})
    port.postMessage({done:true});await acknowledged
  }finally{signal?.removeEventListener('abort',abort);port.onmessage=null;port.onmessageerror=null;port.close()}
}
export function receiveWorkerPort(port,{signal=null}={}) {
  const graph=workerDecoder()
  return new Promise((resolve,reject)=>{
    const abort=()=>{cleanup();reject(new DOMException('任务已取消','AbortError'))}
    const cleanup=()=>{graph.dispose();signal?.removeEventListener('abort',abort);port.onmessage=null;port.onmessageerror=null;port.close()}
    signal?.addEventListener('abort',abort,{once:true})
    port.onmessage=({data})=>{
      try {
        if(data.done){const value=graph.finish();port.postMessage({ack:true});cleanup();resolve(value);return}
        if(!(data.buffer instanceof ArrayBuffer)||data.buffer.byteLength>WORKER_PACKET_BYTES)throw Error('Worker 数据块格式或大小无效')
        graph.accept(JSON.parse(decoder.decode(data.buffer)));port.postMessage({ack:true})
      }catch(error){port.postMessage({error:error.message});cleanup();reject(error)}
    }
    port.onmessageerror=()=>{cleanup();reject(Error('Worker 分块消息读取失败'))}
    if(signal?.aborted)abort()
  })
}
export async function postWorkerMessage(target,value) {
  const channel=new MessageChannel(),signal=workers.get(target)?.signal
  try {
    target.postMessage({transport:MARKER,port:channel.port2,id:value?.id},[channel.port2])
    await sendWorkerPort(channel.port1,value,{signal})
  }catch(error){channel.port1.close();channel.port2.close();throw error}
}
export function attachWorkerTransport(worker) {
  if(workers.has(worker))return worker
  const controller=new AbortController();workers.set(worker,controller)
  const terminate=worker.terminate.bind(worker)
  worker.terminate=()=>{controller.abort();terminate()}
  worker.addEventListener('message',event=>{
    if(event.data?.transport!==MARKER)return
    event.stopImmediatePropagation()
    receiveWorkerPort(event.data.port,{signal:controller.signal}).then(data=>worker.dispatchEvent(new MessageEvent('message',{data}))).catch(error=>{
      if(error.name==='AbortError')return
      const message=String(error.message||error)
      worker.dispatchEvent(new MessageEvent('message',{data:{id:event.data.id,type:'error',kind:'error',ok:false,error:message,message}}))
    })
  })
  return worker
}
export function createBoundedWorker(url,options){return attachWorkerTransport(new Worker(url,options))}
export function installWorkerTransport(scope,handle) {
  scope.onmessage=async event=>{
    if(event.data?.transport!==MARKER){await handle(event);return}
    try{await handle({data:await receiveWorkerPort(event.data.port)})}
    catch(error){const message=String(error.message||error);scope.postMessage({id:event.data.id,type:'error',kind:'error',ok:false,error:message,message})}
  }
}
