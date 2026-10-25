import assert from 'node:assert/strict'
import {saveBlob,saveUrl} from './file-save.js'
const bytes=Uint8Array.from({length:260001},(_,i)=>i*31%256)
function bridge({cancel=false,fail=false}={}){
  const parts=[],calls=[];let inFlight=0,peak=0
  const api={parts,calls,get peak(){return peak},postMessage(raw){
    const m=JSON.parse(raw);calls.push(m);peak=Math.max(peak,++inFlight)
    queueMicrotask(()=>{
      inFlight--;let value={id:m.id}
      if(m.action==='begin')value=cancel?{...value,cancelled:true}:{...value,ready:true}
      if(m.action==='chunk'){assert.ok(m.data.length<=65536);parts.push(Buffer.from(m.data,'base64'));value=fail?{...value,error:'disk full'}:{...value,written:parts.reduce((n,b)=>n+b.length,0)}}
      if(m.action==='finish')value.saved=true
      api.onmessage?.({data:JSON.stringify(value)})
    })
  }};return api
}
try{
  let api=bridge();globalThis.window={FgoAndroid:{},FgoFileExport:api}
  assert.equal((await saveBlob(new Blob([bytes]),'FGO-teams-test.png')).saved,true)
  assert.deepEqual(Buffer.concat(api.parts),Buffer.from(bytes));assert.equal(api.peak,1,'Only one bounded chunk waits for an acknowledgement')
  assert.equal(api.calls[0].size,bytes.length);assert.equal(api.calls.at(-1).action,'finish')
  api=bridge({cancel:true});window.FgoFileExport=api
  assert.equal((await saveBlob(new Blob([bytes]),'FGO-teams-test.pdf')).cancelled,true);assert.equal(api.parts.length,0)
  api=bridge({fail:true});window.FgoFileExport=api
  await assert.rejects(saveBlob(new Blob([bytes]),'FGO-teams-test.docx'),/disk full/);assert.equal(api.calls.at(-1).action,'abort')
  api=bridge();window.FgoFileExport=api
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/x-ndjson'}))
  try{assert.equal((await saveUrl(url,'FGO-score-teams-test.jsonl')).saved,true);assert.deepEqual(Buffer.concat(api.parts),Buffer.from(bytes))}finally{URL.revokeObjectURL(url)}
  await assert.rejects(saveUrl('https://example.com/private','FGO-score-teams-test.jsonl'),/本机/)
  window.FgoFileExport=null
  await assert.rejects(saveBlob(new Blob(['test']),'FGO-teams-test.json'),/更新/)
  console.log('Native file save: bounded binary/JSONL chunks, exact bytes, one in-flight acknowledgement, cancel, error/abort and unsupported Android reporting passed')
}finally{delete globalThis.window}
