const { app, BrowserWindow, protocol, net, ipcMain, Tray, Menu, nativeImage, Notification, dialog } = require('electron')
const path = require('node:path'), fs = require('node:fs'), { pathToFileURL } = require('node:url')
const { spawn } = require('node:child_process')
const { Updater } = require('./updater.cjs')
const { createUpdateFetch } = require('./update-fetch.cjs')
const { exportQueryFile } = require('./query-export.cjs')
protocol.registerSchemesAsPrivileged([{ scheme:'app', privileges:{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, stream:true } }])
let main, tasks, host, tray, quitting=false, interval, lastState='', ready=false
const softwareSmoke=process.argv.includes('--software-update-smoke')
const smoke=process.argv.includes('--smoke')||softwareSmoke
if(smoke&&process.env.FGO_SMOKE_PROFILE)app.setPath('userData',process.env.FGO_SMOKE_PROFILE)
let settings={auto:true,softwareAuto:true}, updater, softwareInterval
const origin='app://fgo'
function siteRoot() { return app.isPackaged ? path.join(process.resourcesPath,'site') : path.resolve(__dirname,'../site') }
function opts(show=true) { return { width:1400,height:980,minWidth:390,minHeight:620,show,title:'通关羁绊',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false} } }
function protect(win) {
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault()})
}
function showMain() {
  if(!main || main.isDestroyed()) { main=new BrowserWindow(opts(!smoke)); protect(main); main.loadURL(origin+'/index.html'); main.on('close',event=>{if(!quitting){event.preventDefault();main.hide()}}) }
  if(!smoke){main.show();main.focus()}
}
function showTasks() {
  if(!tasks || tasks.isDestroyed()) {tasks=new BrowserWindow({...opts(),width:920});protect(tasks);tasks.loadURL(origin+'/native/tasks.html')}
  tasks.show();tasks.focus()
}
function command(value={}) { if(ready)host.webContents.send('native-host-command',{action:value.action==='pause'?'pause':'start',force:value.force===true,accountOnly:value.accountOnly===true,offline:smoke}) }
function schedule() {clearInterval(interval); if(settings.auto)interval=setInterval(()=>command(),6*60*60*1000)}
function trusted(event) { return [main,tasks,host].some(w=>w&&!w.isDestroyed()&&w.webContents===event.sender) && event.senderFrame?.url.startsWith(origin+'/') }
app.on('window-all-closed',()=>{})
app.on('before-quit',()=>{quitting=true})
if(!app.requestSingleInstanceLock())app.quit()
else app.on('second-instance',showMain)
app.whenReady().then(()=>{
  const config=path.join(app.getPath('userData'),'native-settings.json')
  try{settings=JSON.parse(fs.readFileSync(config,'utf8'))}catch{}
  updater=new Updater({version:app.getVersion(),dir:path.join(app.getPath('userData'),'software-updates'),fetch:createUpdateFetch(net),auto:settings.softwareAuto!==false,supported:app.isPackaged&&process.platform==='win32',install:file=>new Promise((resolve,reject)=>{
    // NSIS updates in place; the profile and IndexedDB are outside the install directory.
    const child=spawn(file,['--updated','/S','--force-run','/D='+path.dirname(app.getPath('exe'))],{detached:true,stdio:'ignore'})
    child.once('error',reject);child.once('spawn',()=>{child.unref();quitting=true;app.quit();resolve()})
  })})
  if(softwareSmoke){
    updater.check().then(state=>{
      fs.writeFileSync(process.env.FGO_SMOKE_OUTPUT||path.join(app.getPath('userData'),'software-smoke.json'),JSON.stringify(state,null,2))
      app.exit(['current','available','ready'].includes(state.state)?0:1)
    }).catch(error=>{console.error(error);app.exit(1)})
    return
  }
  const softwareSchedule=()=>{clearInterval(softwareInterval);if(settings.softwareAuto!==false&&!smoke)softwareInterval=setInterval(()=>updater.check(),6*60*60*1000)}
  softwareSchedule()
  if(!smoke)updater.restore().then(()=>{if(settings.softwareAuto!==false)updater.check()})
  protocol.handle('app', async request => {
    const url=new URL(request.url)
    if(url.hostname!=='fgo')return new Response('Forbidden',{status:403})
    let rel
    try{rel=decodeURIComponent(url.pathname)}catch{return new Response('Bad path',{status:400})}
    const root=siteRoot(), dest=path.resolve(root,'.'+rel)
    if(!dest.startsWith(root+path.sep)||rel.includes('..'))return new Response('Forbidden',{status:403})
    try {
      const r=await net.fetch(pathToFileURL(dest).href)
      const h=new Headers(r.headers)
      h.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://springs59.github.io https://raw.githubusercontent.com; frame-src 'self'; object-src 'none'")
      return new Response(r.body,{status:r.status,headers:h})
    }catch{return new Response('Not found',{status:404})}
  })
  ipcMain.on('native-command',(event,value)=>{if(trusted(event))command(value)})
  ipcMain.on('native-auto',(event,value)=>{if(trusted(event)){settings.auto=value===true;fs.writeFileSync(config,JSON.stringify(settings));schedule()}})
  ipcMain.on('native-open-tasks',event=>{if(trusted(event))showTasks()})
  ipcMain.handle('native-export-queries',async(event,name,bytes)=>{
    if(!trusted(event))throw Error('Untrusted export command')
    return exportQueryFile(name,bytes,filename=>dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{
      title:'导出本地查询结果',defaultPath:path.join(app.getPath('downloads'),filename),
      filters:[{name:'查询结果备份',extensions:filename.endsWith('.gz')?['gz']:['jsonl']}] }))
  })
  ipcMain.handle('native-software-status',event=>trusted(event)?updater.status():null)
  ipcMain.handle('native-software-command',async(event,action)=>{
    if(!trusted(event))throw new Error('Untrusted update command')
    if(action==='check')return updater.check()
    if(action==='download')return updater.download()
    if(action==='pause')return updater.pause()
    if(action==='install')return updater.apply()
    return updater.status()
  })
  ipcMain.handle('native-software-auto',(event,value)=>{if(trusted(event)){settings.softwareAuto=value===true;fs.writeFileSync(config,JSON.stringify(settings));updater.set({auto:settings.softwareAuto});softwareSchedule();return updater.status()}})
  ipcMain.on('native-apply',event=>{if(trusted(event)){showMain();main.reload();tasks?.close()}})
  ipcMain.on('native-report',(event,s)=>{
    if(event.sender!==host?.webContents||!s||typeof s.state!=='string')return
    tray?.setToolTip(('通关羁绊 · '+String(s.phase)).slice(0,120))
    if(smoke&&['done','error'].includes(s.state)){
      fs.writeFileSync(process.env.FGO_SMOKE_OUTPUT||path.join(app.getPath('userData'),'smoke.json'),JSON.stringify(s,null,2));app.exit(s.state==='done'?0:1);return
    }
    if(lastState==='running'&&['done','error'].includes(s.state)&&Notification.isSupported())new Notification({title:s.state==='done'?'图鉴与预计算已就绪':'数据更新失败',body:s.state==='done'?'点击任务中心查看结果，旧数据仍可继续使用。':String(s.error||s.phase).slice(0,150)}).show()
    lastState=s.state
  })
  if(!smoke){tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')));tray.setToolTip('通关羁绊');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开配队',click:showMain},{label:'更新与后台任务',click:showTasks},{label:'检查软件更新',click:()=>{showTasks();updater.check()}},{label:'检查数据更新',click:()=>command()},{label:'暂停后台任务',click:()=>command({action:'pause'})},{type:'separator'},{label:'退出软件',click:()=>app.quit()}]));tray.on('double-click',showMain)}
  showMain()
  host=new BrowserWindow({...opts(false),width:300,height:200});protect(host)
  if(smoke)host.webContents.on('console-message',(e,...args)=>console.log(e.message||args[1]||''))
  host.webContents.on('did-finish-load',()=>{ready=true;if(settings.auto||smoke)command()})
  host.webContents.on('render-process-gone',()=>{ready=false;host.reload()})
  host.loadURL(origin+'/native/host.html');schedule()
  if(smoke)setTimeout(()=>{fs.writeFileSync(process.env.FGO_SMOKE_OUTPUT||'smoke.json',JSON.stringify({state:'error',error:'background smoke timeout'}));app.exit(1)},120000)
})
