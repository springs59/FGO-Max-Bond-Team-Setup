import assert from 'node:assert/strict'
import {workerPackets,workerDecoder,sendWorkerPort,receiveWorkerPort,WORKER_PACKET_BYTES} from './worker-transport.js'
const shared={name:'共有记录',v:-0},buffer=new ArrayBuffer(200000)
new Uint8Array(buffer).forEach((_,i,a)=>a[i]=i%251)
const input={one:shared,two:shared,unset:undefined,nan:NaN,infinity:Infinity,big:10n,
  text:'测试😀'.repeat(100000),date:new Date(100),invalidDate:new Date(NaN),regex:/abc/gi,
  bytes:new Uint8Array(buffer,10,81920),view:new DataView(buffer,12,18),buffer,
  map:new Map([[shared,new Set([shared,3])]])}
input.self=input;input.sparse=Array(12);input.sparse[5]=42;input.sparse['01']='额外属性'
const graph=workerDecoder();let packets=0,peak=0
for(const packet of workerPackets(input)) {packets++;peak=Math.max(peak,packet.byteLength);graph.accept(JSON.parse(new TextDecoder().decode(packet)))}
const result=graph.finish()
assert.ok(packets>10);assert.ok(peak<=WORKER_PACKET_BYTES)
assert.equal(result.self,result);assert.equal(result.one,result.two);assert.equal(result.text,input.text)
assert.ok(Object.is(result.one.v,-0));assert.ok(Number.isNaN(result.nan));assert.equal(result.infinity,Infinity)
assert.equal(result.big,10n);assert.equal(result.unset,undefined);assert.ok(Object.hasOwn(result,'unset'))
assert.equal(result.date.getTime(),100);assert.ok(Number.isNaN(result.invalidDate.getTime()))
assert.equal(result.regex.source,'abc');assert.equal(result.regex.flags,'gi')
assert.deepEqual(new Uint8Array(result.buffer),new Uint8Array(buffer));assert.equal(result.bytes.buffer,result.buffer)
assert.equal(result.bytes.byteOffset,10);assert.equal(result.view.byteOffset,12);assert.equal(result.view.byteLength,18)
assert.equal(result.map.get(result.one).has(result.one),true)
assert.equal(0 in result.sparse,false);assert.equal(result.sparse[5],42);assert.equal(result.sparse['01'],'额外属性')
const proto=Object.defineProperty({},'__proto__',{value:{safe:true},enumerable:true})
const d=workerDecoder();for(const p of workerPackets(proto))d.accept(JSON.parse(new TextDecoder().decode(p)))
assert.equal(Object.getPrototypeOf(d.finish()),Object.prototype)
// Pausing the consumer reproduces the old producer-faster-than-storage case.
// Only one transferred packet may be emitted until its ACK arrives.
const channel=new MessageChannel();let sent=0
const sending=sendWorkerPort(channel.port1,input,{onPacket:()=>sent++})
await new Promise(r=>setTimeout(r,40));assert.equal(sent,1)
const receiving=receiveWorkerPort(channel.port2)
const [_,received]=await Promise.all([sending,receiving]);assert.equal(received.text,input.text);assert.equal(received.one,received.two)
// No wall-clock timeout is used: delaying an ACK beyond two virtual hours
// cannot cancel or change a task.
const realNow=Date.now,late=new MessageChannel();let now=1000;Date.now=()=>now
try {
 const pending=sendWorkerPort(late.port1,{list:Array.from({length:5000},(_,i)=>i)})
 now+=3*60*60*1000
 const reading=receiveWorkerPort(late.port2)
 const [__,value]=await Promise.all([pending,reading]);assert.equal(value.list.length,5000)
}finally{Date.now=realNow}
const canceled=new MessageChannel(),controller=new AbortController()
const cancel=sendWorkerPort(canceled.port1,input,{signal:controller.signal});controller.abort()
await assert.rejects(cancel,{name:'AbortError'});canceled.port2.close()
assert.throws(()=>[...workerPackets({callback(){}})],{name:'DataCloneError'})
// A serialization failure after successful packets releases both halves,
// rather than leaving the receiver waiting with a partial graph indefinitely.
const failed=new MessageChannel()
const receivingFailure=receiveWorkerPort(failed.port2)
const sendingFailure=sendWorkerPort(failed.port1,{text:input.text,callback(){}})
await Promise.all([assert.rejects(sendingFailure,{name:'DataCloneError'}),assert.rejects(receivingFailure,/函数或 Symbol/)])
console.log(`Worker transport: aliases/cycles/Unicode/typed views preserved, ${packets} bounded packets, paused-consumer backpressure, cancellation and >2-hour lifecycle passed`)
