const {app,BrowserWindow,protocol,net,session}=require('electron')
const {readFile,mkdtemp,rm}=require('node:fs/promises')
const {tmpdir}=require('node:os'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict')
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}])
app.whenReady().then(async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'fgo-report-save-')),root=path.resolve(__dirname,'../site'),origin='app://fgo'
  const source=await readFile(path.join(__dirname,'main.cjs'),'utf8'),policy=source.match(/h\.set\('Content-Security-Policy',"([^"]+)"\)/)[1]
  protocol.handle('app',async request=>{
    const url=new URL(request.url)
    if(url.pathname==='/file-test.html')return new Response('<!doctype html><html><body>File export</body></html>',{headers:{'Content-Type':'text/html','Content-Security-Policy':policy}})
    if(url.pathname==='/blob-worker.js')return new Response("self.postMessage(URL.createObjectURL(new Blob(['{\"format\":\"fixture\"}\\n'],{type:'application/x-ndjson'})))",{headers:{'Content-Type':'application/javascript'}})
    const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403})
    const response=await net.fetch(pathToFileURL(file).href);return new Response(response.body,{headers:response.headers,status:response.status})
  })
  protocol.handle('https',request=>new Response('public image fixture',{headers:{'Access-Control-Allow-Origin':'*'}}))
  const win=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}})
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault()})
  const download=(name)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Export download did not finish: '+name)),20000)
    session.defaultSession.once('will-download',(_event,item)=>{
      item.setSavePath(path.join(folder,name));item.once('done',(_event,state)=>{clearTimeout(timer);if(state==='completed')resolve(path.join(folder,name));else reject(Error(state))})
    })
  })
  try{
    await win.loadURL(origin+'/file-test.html')
    assert.equal(await win.webContents.executeJavaScript("fetch('https://static.atlasacademy.io/CN/Faces/test.png').then(r=>r.text())"),'public image fixture')
    assert.equal(await win.webContents.executeJavaScript("fetch('https://untrusted.example/test').then(()=>false).catch(()=>true)"),true,'Unrelated connections remain blocked')
    for(const ext of ['json','html','png','pdf','docx']){
      const name='FGO-teams-electron-test.'+ext,bytes=[0,1,255,10,13,65,66],saved=download(name)
      await win.webContents.executeJavaScript(`import('/native/shared/file-save.js').then(m=>m.saveBlob(new Blob([new Uint8Array(${JSON.stringify(bytes)})]),${JSON.stringify(name)}))`,true)
      assert.deepEqual([...await readFile(await saved)],bytes)
    }
    const url=await win.webContents.executeJavaScript("new Promise(r=>{window.fixtureWorker=new Worker('/blob-worker.js');fixtureWorker.onmessage=e=>r(e.data)})")
    assert.match(await win.webContents.executeJavaScript(`fetch(${JSON.stringify(url)}).then(r=>r.text())`),/fixture/,'Worker-created blob is readable under production CSP')
    const name='FGO-score-teams-electron-test.jsonl',saved=download(name)
    await win.webContents.executeJavaScript(`import('/native/shared/file-save.js').then(m=>m.saveUrl(${JSON.stringify(url)},${JSON.stringify(name)}))`,true)
    assert.match(await readFile(await saved,'utf8'),/fixture/)
    console.log('Real Electron: production CSP, PNG/PDF/DOCX/HTML/JSON and Worker JSONL exact downloads passed')
  }finally{win.destroy();await rm(folder,{recursive:true,force:true})}
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
