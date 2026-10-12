import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {chromium} from 'playwright'
const server=spawn('python3',['-m','http.server','5186','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5186/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5186/glossary.html')
 const results=await page.evaluate(async()=>{
  const base=location.origin+'/',transport=await import('./src/worker-transport.js')
  // Reject the old whole-object postMessage path deterministically, while real
  // MessagePorts still transfer a multi-megabyte request and response.
  const echoSource=`import {installWorkerTransport,postWorkerMessage} from '${base}src/worker-transport.js';installWorkerTransport(self,async({data})=>{await postWorkerMessage(self,{echo:data})})`
  const echoURL=URL.createObjectURL(new Blob([echoSource],{type:'text/javascript'}))
  const echo=transport.createBoundedWorker(echoURL,{type:'module'}),nativePost=echo.postMessage.bind(echo)
  echo.postMessage=(value,transfer)=>{if(!value.transport)throw Error('unbounded Worker clone');nativePost(value,transfer)}
  const payload={rows:Array.from({length:25000},(_,i)=>({id:i,text:'长消息😀'.repeat(40)+i}))}
  payload.alias=payload.rows;payload.self=payload
  const response=new Promise((resolve,reject)=>{echo.onmessage=({data})=>resolve(data.echo);echo.onerror=e=>reject(Error(e.message))})
  await transport.postWorkerMessage(echo,payload);const received=await response
  const echoed={count:received.rows.length,last:received.rows.at(-1).text,alias:received.alias===received.rows,cycle:received.self===received}
  echo.terminate();URL.revokeObjectURL(echoURL)
  // Real OPFS capture, four simulated hours, no storage Worker backlog.
  const source=`import {candidateCollector} from '${base}src/solver/query-candidate-collector.js';self.onmessage=async()=>{const c=await candidateCollector();self.activeCollector=c;const realNow=Date.now;let now=realNow();Date.now=()=>now;for(let i=0;i<24000;i++){if(i%100===0)now+=60000;c.capture({engine:'equipment-curve',stressMarker:'memory-stress-v1',sample:i%64,cost:i%64,curve:{terms:[{front:1200,second:1400,flat:i%64,eligible:true}]},padding:'保留全部候选'.repeat(70)})}c.checkpoint?.(true);Date.now=realNow;self.postMessage({staged:true,stats:c.stats(),simulatedMs:now-realNow()});for(;;){} }`
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=new Worker(url,{type:'module'})
  const staged=await new Promise((resolve,reject)=>{worker.onmessage=({data})=>resolve(data);worker.onerror=e=>reject(Error(e.message));worker.postMessage({start:true})})
  const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
  const active=await recoverArchivedCandidates()
  worker.terminate();URL.revokeObjectURL(url)
  const recovered=await recoverArchivedCandidates(),library=await import('./src/solver/query-library.js')
  const rows=(await library.listQueries()).filter(r=>r.kind==='computed-candidate')
  const again=await recoverArchivedCandidates()
  return {echoed,staged,active,recovered,again,unique:rows.length}
 })
 assert.equal(results.echoed.count,25000);assert.equal(results.echoed.alias,true);assert.equal(results.echoed.cycle,true)
 assert.equal(results.staged.stats.records,24000);assert.equal(results.staged.stats.queuedWorkerMessages,0)
 assert.ok(results.staged.stats.peakBufferedBytes<=256*1024)
 assert.ok(results.staged.simulatedMs>2*60*60*1000)
 assert.equal(results.active.busy,1,'live journal lock is not stolen')
 assert.equal(results.recovered.records,24000,'every flushed candidate survives termination')
 assert.equal(results.unique,64,'identical content deduplicates after durable recovery')
 assert.equal(results.again.recovered,0,'completed journal is removed only after committed recovery')
 console.log('Browser worker memory: multi-megabyte request/result with no whole-object clones; 24,000 disk candidates, four-hour virtual lifecycle, live-lock isolation and full post-termination recovery passed')
}finally{await browser?.close();server.kill()}
