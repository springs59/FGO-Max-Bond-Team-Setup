import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
const server=spawn('python3',['-m','http.server','5181','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5181/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  const page=await browser.newPage()
  await page.goto('http://127.0.0.1:5181/glossary.html')
  const results=await page.evaluate(async()=>{
    const {createBoundedWorker,postWorkerMessage}=await import('./src/worker-transport.js')
    const servants=Array.from({length:6},(_,i)=>({id:100+i,collectionNo:100+i,name:'S'+i,className:'saber',rarity:5,cost:i?16:3,traitIds:[100]}))
    const opts={servants,ces:[],base:1000,costLimit:20,lockSvtIds:[100],teapot:true,useInventoryCurveSolver:true,accountProfileId:'cache-check-a'}
    async function query(extra={}){
      const worker=createBoundedWorker('./src/recommend-worker.js',{type:'module'}),progress=[]
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('worker timeout')),30000)
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message))}
        worker.onmessage=({data})=>{
          if(data.type==='progress'){progress.push(data.progress);return}
          clearTimeout(timer);if(!data.ok){reject(Error(data.error));return}
          resolve({value:data.result.value,progress})
        }
        postWorkerMessage(worker,{id:1,opts:{...opts,...extra}}).catch(reject)
      })}finally{worker.terminate()}
    }
    const first=await query(),restart=await query(),otherProfile=await query({accountProfileId:'cache-check-b'}),otherBudget=await query({costLimit:3})
    return {first,restart,otherProfile,otherBudget}
  })
  for(const result of Object.values(results)){
    assert.ok(result.value.ok,result.value.error)
    assert.equal(result.value.solverStats.bestScore,result.value.total)
    for(const p of result.progress)assert.ok(p.bestScore<=result.value.total)
  }
  assert.equal(results.first.value.total,4960)
  assert.equal(results.restart.value.queryStats.cacheHit,true,'a new worker must reuse persistent results')
  assert.ok(!results.first.value.queryStats.cacheHit)
  assert.equal(results.otherProfile.value.queryStats.cacheHit,true,'an opaque profile ID must not split identical effective inputs')
  assert.ok(!results.otherBudget.value.queryStats.cacheHit,'conditions remain isolated')
  assert.equal(results.otherBudget.value.total,2480)
  console.log('Recommendation worker: feasible progress equals display settlement; persisted restart reuse, cross-profile reuse and COST isolation passed')
}finally{await browser?.close();server.kill()}
