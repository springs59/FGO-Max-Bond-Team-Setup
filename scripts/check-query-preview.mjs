// A completed answer remains temporary until the user chooses save. Test an
// abrupt exit between durable staging and unlock, plus the real inline UI.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdirSync,writeFileSync} from 'node:fs'
import {chromium} from 'playwright'
const out=process.env.FGO_PREVIEW_OUTPUT||'/tmp/fgo-preview'
mkdirSync(out,{recursive:true})
const server=spawn('python3',['-m','http.server','5190','--bind','127.0.0.1'],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5190/glossary.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
 const context=await browser.newContext(),page=await context.newPage()
 await page.goto('http://127.0.0.1:5190/glossary.html')
 const recovered=await page.evaluate(async()=>{
  const transport=await import('./src/worker-transport.js'),library=await import('./src/solver/query-library.js')
  const {isPlayableServant,ceHasBondGain}=await import('./src/game-data.js')
  const [servants,ces]=await Promise.all(['servants','ces'].map(async n=>(await fetch('./src/data/'+n+'.json')).json()))
  const opts={servants:servants.filter(isPlayableServant).slice(0,30),ces:ces.filter(ceHasBondGain).slice(0,36),mode:'free',base:800,costLimit:95,useInventoryCurveSolver:true}
  const url=new URL('./src/recommend-worker.js',location.href)
  let source=await(await fetch(url)).text()
  source=source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(new URL(p,url).href))
  const marker='    const temporary = collector ? await collector.retain()'
  if(!source.includes(marker))throw Error('Temporary pause marker missing')
  source=source.replace(marker,"    self.postMessage({type:'checkpoint-ready',total:copy.total,completion});await new Promise(()=>{})\n"+marker)
  const blob=URL.createObjectURL(new Blob([source],{type:'text/javascript'})),worker=transport.createBoundedWorker(blob,{type:'module'})
  const ready=await new Promise((resolve,reject)=>{
   worker.onerror=e=>reject(Error(e.message))
   worker.onmessage=({data})=>{if(data.type==='checkpoint-ready')resolve(data);else if(data.ok===false)reject(Error(data.error))}
   transport.postWorkerMessage(worker,{id:1,opts}).catch(reject)
  })
  const check=(ok,message)=>{if(!ok)throw Error(message)}
  check(ready.total===7956,'Unexpected settlement')
  const description=await library.describeQuery('bond',opts)
  check(!await library.readQuery(description),'Staged answer was reused without a user choice')
  const {recoverArchivedCandidates}=await import('./src/ui/query-recovery.js')
  const live=await recoverArchivedCandidates();check(live.busy===1,'Live log was stolen')
  worker.terminate();URL.revokeObjectURL(blob)
  let pending=await recoverArchivedCandidates()
  for(let i=0;pending.busy&&i<100;i++){await new Promise(r=>setTimeout(r,50));pending=await recoverArchivedCandidates()}
  check(pending.ok&&!pending.busy&&pending.entries.length===1,'Completed journal recovery failed')
  check((await library.aggregateLibrary()).count===0,'Listing imported temporary observations')
  const saved=await recoverArchivedCandidates({action:'save',name:pending.entries[0].name})
  check(saved.ok&&saved.exact&&saved.records===ready.completion.records,'Explicit save lost observations or exact answer')
  const answer=await library.readQuery(description);check(answer?.total===7956,'Completed mathematical work was lost')
  const backup=await library.exportQueries(),text=await backup.blob.text()
  check(!text.includes('@completed-query:')&&text.trim().split('\n').length===backup.count+1,'Temporary state escaped to backup')
  return {live,pending,saved,total:answer.total,records:backup.count}
 })
 await context.close()
 const uiContext=await browser.newContext(),ui=await uiContext.newPage(),errors=[]
 ui.on('pageerror',e=>errors.push(e.message))
 await uiContext.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
 await uiContext.route('**/src/recommend-worker.js?*',async route=>{
  const response=await route.fetch()
  let source=await response.text()
  source=source.replace('  const opts = msg.opts || {}',`  const opts={...msg.opts,base:800,costLimit:95,account:null,mode:'free',game:null,quest:null,bondBonuses:null,filter:null,preferSvtIds:[],lockSvtIds:[],frontIds:[],pinCes:[],pinSprites:[],slotPins:[],allowSupport:true,accountProjection:null,solverIndex:null,solutionIndex:null,factorIndex:null,joinedEffectIndex:null,curveIndex:null};
  const {isPlayableServant,ceHasBondGain}=await import('./game-data.js');
  opts.servants=opts.servants.filter(isPlayableServant).slice(0,30);opts.ces=opts.ces.filter(ceHasBondGain).slice(0,36);`)
  await route.fulfill({response,body:source})
 })
 let dialogs=0;ui.on('dialog',async d=>{dialogs++;await d.dismiss()})
 await ui.goto('http://127.0.0.1:5190/index.html')
 await ui.locator('#recommendNow').waitFor()
 await ui.locator('#base').fill('800');await ui.locator('#base').blur()
 await ui.locator('#recommendNow').click()
 await ui.locator('.recommend').waitFor({timeout:120000})
 assert.match(await ui.locator('.recommend').innerText(),/7956/)
 await ui.locator('[data-temp-discard]').waitFor({timeout:30000})
 assert.equal(await ui.evaluate(async()=>(await(await import('./src/solver/query-library.js')).aggregateLibrary()).count),0)
 await ui.locator('[data-temp-discard]').click()
 await ui.locator('#temporaryQueries [role=status]').filter({hasText:'已删除临时文件'}).waitFor()
 assert.equal(await ui.locator('[data-temp-save]').count(),0)
 await ui.locator('#work-tab-conditions').click();await ui.locator('#recommendNow').click()
 await ui.locator('[data-temp-save]').waitFor({timeout:120000})
 await ui.locator('[data-temp-save]').click()
 await ui.locator('#temporaryQueries [role=status]').filter({hasText:'已保存到方案库'}).waitFor({timeout:120000})
 assert.ok(await ui.evaluate(async()=>(await(await import('./src/solver/query-library.js')).aggregateLibrary()).count)>0)
 assert.equal(dialogs,0);assert.deepEqual(errors,[])
 await uiContext.close()
 const report={passed:true,recovered,ui:{explicitSave:true,explicitDiscard:true,noDialogs:true},endedAt:new Date().toISOString()}
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('TEMPORARY_RECOVERY_PASSED',JSON.stringify(report))
}finally{await browser?.close();server.kill()}
