// Exact on-disk membership: a hash selects slots, but equality always checks
// the complete key. Only one fixed-size slot and one candidate key are read.
const encoder=new TextEncoder(),SLOT=16
const pause=()=>new Promise(r=>setTimeout(r,0))
export async function createScoreDedup(root,{yieldTask=pause,hashBytes=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return h>>>0}}={}){
  if(!root){const keys=new Set();return {async add(key){if(keys.has(key))return false;keys.add(key);return true},close(){keys.clear()}}}
  let capacity=1024,count=0,end=0,closed=false,side=0
  const open=async name=>(await root.getFileHandle(name,{create:true})).createSyncAccessHandle()
  let index=await open('seen-0.bin'),data=await open('seen-keys.bin');index.truncate(capacity*SLOT);data.truncate(0)
  function read(handle,bytes,at){let n=0;while(n<bytes.length){const got=handle.read(bytes.subarray(n),{at:at+n});if(!got)throw Error('配队去重索引缺失');n+=got}}
  function write(handle,bytes,at){let n=0;while(n<bytes.length){const got=handle.write(bytes.subarray(n),{at:at+n});if(!got)throw Error('配队去重索引写入失败');n+=got}}
  function locate(handle,size,hash,bytes=null){
    const slot=new Uint8Array(SLOT),v=new DataView(slot.buffer)
    for(let step=0,p=hash%size;step<size;step++,p=(p+1)%size){
      read(handle,slot,p*SLOT);const length=v.getUint32(4,true)
      if(!length)return {at:p*SLOT,slot,v,found:false}
      if(bytes&&v.getUint32(0,true)===hash&&length===bytes.length){
        const old=new Uint8Array(length);read(data,old,v.getFloat64(8,true))
        if(old.every((b,i)=>b===bytes[i]))return {found:true}
      }
    }
    throw Error('配队去重索引已满')
  }
  async function grow(){
    const next=await open(`seen-${1-side}.bin`);next.truncate(0);next.truncate(capacity*2*SLOT)
    try{
      const block=new Uint8Array(256*SLOT)
      for(let p=0;p<capacity;p+=256){
        if(closed)throw Error('配队结果已关闭')
        read(index,block,p*SLOT)
        for(let at=0;at<block.length;at+=SLOT){const slot=block.subarray(at,at+SLOT),v=new DataView(slot.buffer,slot.byteOffset,SLOT);if(!v.getUint32(4,true))continue
          const found=locate(next,capacity*2,v.getUint32(0,true));write(next,slot,found.at)
        }
        await yieldTask()
      }
      index.close();index=next;side=1-side;capacity*=2
    }catch(error){next.close();throw error}
  }
  return {
    async add(key){
      if(closed)throw Error('配队结果已关闭')
      const bytes=encoder.encode(key),hash=hashBytes(bytes)
      if(!bytes.length||bytes.length>0xffffffff)throw Error('配队去重键无效')
      let target=locate(index,capacity,hash,bytes);if(target.found)return false
      if((count+1)*10>capacity*7){await grow();if(closed)throw Error('配队结果已关闭');target=locate(index,capacity,hash,bytes)}
      if(!Number.isSafeInteger(end+bytes.length))throw Error('配队索引大小超出精确范围')
      write(data,bytes,end);target.v.setUint32(0,hash,true);target.v.setUint32(4,bytes.length,true);target.v.setFloat64(8,end,true)
      write(index,target.slot,target.at);end+=bytes.length;count++;return true
    },
    close(){if(closed)return;closed=true;index.close();data.close()},
  }
}
