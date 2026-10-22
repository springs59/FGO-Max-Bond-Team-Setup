import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const port=5189,origin=`http://127.0.0.1:${port}`,output='test-output/comprehensive-browser'
const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{stdio:'ignore'})
let browser
const ce=(id,rate,target='ptFull')=>({id,name:'C'+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target,rate,add:0,tvals:[],andTvals:[]}]}))})
const options=(n,base,ces)=>({servants:Array.from({length:n},(_,i)=>({id:i+1,collectionNo:i+1,name:'S'+i,className:'saber',rarity:3,cost:i%2+1,traitIds:[10]})),
 ces,base,allowSupport:false,costLimit:9,slotPins:[3,5,6].map(position=>({position,empty:true})),aiMode:'off',allScoreTeams:true})
const fixtures=[{id:'same-effects',opts:options(3,815,[ce(101,100),ce(102,100)])},
 {id:'zero-ties',opts:options(4,0,[])},{id:'self-fallback',opts:options(2,100,[ce(101,500,'self')])}]
const median=xs=>xs.slice().sort((a,b)=>a-b)[Math.floor(xs.length/2)]
try{
 for(let i=0;i<60;i++){try{if((await fetch(origin+'/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 const page=await browser.newPage();await page.goto(origin+'/index.html')
 const cases=[]
 for(const fixture of fixtures){
  const samples=[]
  for(let round=0;round<3;round++)for(const compact of round%2?[true,false]:[false,true]){
   const sample=await page.evaluate(async({opts,compact})=>{
    const worker=new Worker('/src/recommend-worker.js?bench='+Math.random(),{type:'module'}),began=performance.now()
    const receive=type=>new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>{worker.removeEventListener('message',listener);reject(Error('Browser worker deadline'))},60000)
     function listener(e){const m=e.data;if(m.type==='error'){clearTimeout(timer);worker.removeEventListener('message',listener);reject(Error(m.error))}
      else if(m.type===type){clearTimeout(timer);worker.removeEventListener('message',listener);resolve(m)}}
     worker.addEventListener('message',listener)
    })
    try{
     const completed=receive('score-complete');worker.postMessage({id:1,solverMode:'bond',opts:{...opts,scoreTeamAudit:{compact}}})
     const first=(await completed).result.value,coldMs=performance.now()-began
     const exportStart=performance.now(),exported=receive('score-export');worker.postMessage({id:1,type:'score-export'})
     const message=await exported;if(!message.ok)throw Error(message.error)
     const blob=await (await fetch(message.url)).blob();URL.revokeObjectURL(message.url)
     const exportMs=performance.now()-exportStart
     const warmStart=performance.now(),cached=receive('score-complete');worker.postMessage({id:2,solverMode:'bond',opts:{...opts,scoreTeamAudit:{compact}}})
     const warm=(await cached).result.value
     return {coldMs,exportMs,exportBytes:blob.size,cacheMs:performance.now()-warmStart,best:first.scoreTeamResults.bestScore,
      bestRecords:first.scoreTeamResults.bestCount,totalRecords:first.scoreTeamResults.total,diskBacked:first.scoreTeamResults.diskBacked,
      complete:first.scoreTeamResults.complete,stats:first.scoreTeamResults.stats,cacheHit:warm.scoreTeamResults.cacheHit,
      warmNodes:warm.scoreTeamResults.stats.nodes,warmEvaluated:warm.scoreTeamResults.stats.evaluated}
    }finally{
     worker.terminate()
     const root=await navigator.storage.getDirectory()
     await root.removeEntry('fgo-score-team-queries-v1',{recursive:true}).catch(()=>{})
    }
   },{opts:fixture.opts,compact})
   assert.equal(sample.complete,true);assert.equal(sample.diskBacked,true);assert.equal(sample.cacheHit,true)
   assert.equal(sample.warmNodes,0);assert.equal(sample.warmEvaluated,0);samples.push({round,compact,...sample})
  }
  assert.equal(new Set(samples.map(r=>r.best)).size,1)
  const physical=samples.filter(r=>!r.compact),grouped=samples.filter(r=>r.compact)
  const row={id:fixture.id,samples,physicalColdMs:median(physical.map(r=>r.coldMs)),groupedColdMs:median(grouped.map(r=>r.coldMs)),
   physicalExportMs:median(physical.map(r=>r.exportMs)),groupedExportMs:median(grouped.map(r=>r.exportMs)),
   physicalExportBytes:physical[0].exportBytes,groupedExportBytes:grouped[0].exportBytes}
  cases.push(row);console.log(JSON.stringify({...row,samples:undefined}))
 }
 await mkdir(output,{recursive:true})
 const report={passed:true,method:'Current application Worker and real OPFS, compact on/off control; three alternating cold workers, full obtained-result export, then warm-cache query. This isolates representation/storage cost, not historical UI implementations. Engine comparisons use separately pinned exact historical sources.',cases}
 await writeFile(output+'/comprehensive-browser.json',JSON.stringify(report,null,2)+'\n')
}finally{await browser?.close();server.kill('SIGTERM')}
