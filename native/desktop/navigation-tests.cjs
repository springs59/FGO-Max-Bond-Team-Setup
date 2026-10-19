const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm')
const {EventEmitter}=require('node:events')

// Run the production window handlers with a minimal Electron surface.
const windows=[]
class BrowserWindow extends EventEmitter {
  constructor(options) {
    super();this.options=options;this.visible=false;this.destroyed=false;this.loads=[]
    this.webContents=new EventEmitter()
    this.webContents.setWindowOpenHandler=handler=>{this.openHandler=handler}
    windows.push(this)
  }
  isDestroyed(){return this.destroyed}
  loadURL(url){this.url=url;this.loads.push(url)}
  show(){this.visible=true}
  focus(){this.focused=true}
  hide(){this.visible=false}
  navigate(url) {
    const event={preventDefault(){this.defaultPrevented=true},defaultPrevented:false}
    this.webContents.emit('will-navigate',event,url)
    if(!event.defaultPrevented)this.loadURL(url)
    return event
  }
}
const electron={BrowserWindow,app:{on(){},requestSingleInstanceLock:()=>true,whenReady:()=>({then(){}})},protocol:{registerSchemesAsPrivileged(){}}}
const context=vm.createContext({
  require:name=>name==='electron'?electron:name==='./updater.cjs'?{Updater:class{}}:name==='./update-fetch.cjs'?{createUpdateFetch(){}}:require(name),
  __dirname,process:{argv:[],env:{}},URL,setInterval,clearInterval,setTimeout,console,
})
vm.runInContext(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),context)
const run=source=>vm.runInContext(source,context)
run('showMain();showTasks()')
const [main,tasks]=windows
const retained={account:'local',query:'running',results:['team']}
main.teamState=retained
for(let i=0;i<30;i++) {
  assert.equal(tasks.visible,true)
  assert.equal(tasks.url,'app://fgo/native/tasks.html')
  const back=tasks.navigate('app://fgo/index.html'+(i%2?'?region=JP#team':''))
  assert.equal(back.defaultPrevented,true)
  assert.equal(main.visible,true)
  assert.equal(main.focused,true)
  assert.equal(tasks.visible,false)
  assert.equal(main.teamState,retained)
  assert.equal(main.loads.length,1,'return must not reload the active team query')
  assert.equal(tasks.loads.length,1,'return must not turn the task window into a second team page')
  run('showTasks()')
  assert.equal(windows.length,2,'repeated open/return must reuse both windows')
}
assert.equal(tasks.navigate('https://example.invalid/index.html').defaultPrevented,true)
assert.equal(main.navigate('https://example.invalid/').defaultPrevented,true)
assert.equal(tasks.openHandler().action,'deny')
// Closing the team window to the tray still allows the task page to restore it.
const close={preventDefault(){this.defaultPrevented=true}}
main.emit('close',close)
assert.equal(close.defaultPrevented,true)
assert.equal(main.visible,false)
tasks.navigate('app://fgo/index.html')
assert.equal(main.visible,true)
assert.equal(windows.length,2)
// A task window closed by the user is recreated once and gets the same handlers.
tasks.destroyed=true
run('showTasks()')
const replacement=windows.at(-1)
assert.equal(windows.length,3)
assert.equal(replacement.navigate('app://fgo/index.html').defaultPrevented,true)
assert.equal(replacement.url,'app://fgo/native/tasks.html')
assert.equal(replacement.visible,false)
console.log('Desktop navigation passed: 30 return/reopen cycles, retained team state, tray restore, closed-window recovery and external navigation protection')
