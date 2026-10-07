const { app, BrowserWindow, protocol, net, ipcMain, Tray, Menu, nativeImage, Notification } = require('electron')
const path = require('node:path'), fs = require('node:fs'), { pathToFileURL } = require('node:url')
protocol.registerSchemesAsPrivileged([{ scheme:'app', privileges:{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true, stream:true } }])
let main, tasks, host, tray, quitting=false, interval, lastState='', ready=false
const smoke=process.argv.includes('--smoke')
let settings={auto:true}
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
function command(value={}) { if(ready)host.webContents.send('native-host-command',{action:value.action==='pause'?'pause':'start',force:value.force===true,offline:smoke}) }
function schedule() {clearInterval(interval); if(settings.auto)interval=setInterval(()=>command(),6*60*60*1000)}
function trusted(event) { return [main,tasks,host].some(w=>w&&!w.isDestroyed()&&w.webContents===event.sender) && event.senderFrame?.url.startsWith(origin+'/') }
app.on('window-all-closed',()=>{})
app.on('before-quit',()=>{quitting=true})
if(!app.requestSingleInstanceLock())app.quit()
else app.on('second-instance',showMain)
app.whenReady().then(()=>{
  const config=path.join(app.getPath('userData'),'native-settings.json')
  try{settings=JSON.parse(fs.readFileSync(config,'utf8'))}catch{}
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
  if(!smoke){tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')));tray.setToolTip('通关羁绊');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开配队',click:showMain},{label:'更新与后台任务',click:showTasks},{label:'检查更新',click:()=>command()},{label:'暂停后台任务',click:()=>command({action:'pause'})},{type:'separator'},{label:'退出软件',click:()=>app.quit()}]));tray.on('double-click',showMain)}
  showMain()
  host=new BrowserWindow({...opts(false),width:300,height:200});protect(host)
  if(smoke)host.webContents.on('console-message',(e,...args)=>console.log(e.message||args[1]||''))
  host.webContents.on('did-finish-load',()=>{ready=true;if(settings.auto||smoke)command()})
  host.webContents.on('render-process-gone',()=>{ready=false;host.reload()})
  host.loadURL(origin+'/native/host.html');schedule()
  if(smoke)setTimeout(()=>{fs.writeFileSync(process.env.FGO_SMOKE_OUTPUT||'smoke.json',JSON.stringify({state:'error',error:'background smoke timeout'}));app.exit(1)},120000)
})
