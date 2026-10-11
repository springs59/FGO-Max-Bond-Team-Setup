const {app,net}=require('electron')
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises')
const {tmpdir}=require('node:os'),{join}=require('node:path'),{createHash}=require('node:crypto')
const {createUpdateFetch}=require('./update-fetch.cjs'),{Updater,request}=require('./updater.cjs'),policy=require('./update-policy.cjs')
app.whenReady().then(async()=>{
  const root=await fs.mkdtemp(join(tmpdir(),'fgo-electron-update-'))
  const bytes=Buffer.from('real Electron streamed installer fixture'),hash=createHash('sha256').update(bytes).digest('hex')
  const version='0.1.10',tag='native-v'+version,download=policy.REPO+'/releases/download/'+tag+'/',assetHost='https://release-assets.githubusercontent.com/'
  const manifest={format:1,prerelease:false,version,androidCode:11,tag,releaseUrl:policy.REPO+'/releases/tag/'+tag,assets:{}}
  for(const [platform,label,ext] of [['windows','Windows','exe'],['android','Android','apk']]) {
    const name=`FGO-Bond-${label}-${version}.${ext}`;manifest.assets[platform]={name,url:download+name,size:bytes.length,sha256:hash}
  }
  let interrupted=false,interruptResponse,hold=false,heldResponse,started,visited=[]
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://fixture').searchParams.get('source');visited.push({url,range:req.headers.range})
    const redirect=(target,status=302)=>{res.writeHead(status,{Location:target});res.end()}
    if(url===policy.FEED)return redirect(download+'native-update.json')
    if(url===download+'native-update.json')return redirect(assetHost+'manifest.json',307)
    if(url===assetHost+'manifest.json'){res.end(JSON.stringify(manifest));return}
    if(url===manifest.assets.windows.url)return redirect(assetHost+'installer.exe')
    if(url===download+'bad')return redirect('https://evil.invalid/installer.exe')
    if(url===download+'missing'){res.writeHead(302);res.end();return}
    if(url===download+'loop')return redirect(download+'loop')
    if(url===assetHost+'installer.exe') {
      const offset=Number(req.headers.range?.match(/bytes=(\d+)-/)?.[1]||0)
      res.setHeader('Content-Type','application/octet-stream')
      res.setHeader('Content-Length',bytes.length-offset)
      if(offset)res.writeHead(206,{'Content-Range':`bytes ${offset}-${bytes.length-1}/${bytes.length}`})
      if(hold){heldResponse=res;res.write(bytes.subarray(0,5));started?.();return}
      if(!interrupted){interrupted=true;interruptResponse=res;res.write(bytes.subarray(0,8));return}
      res.end(bytes.subarray(offset));return
    }
    res.writeHead(404);res.end()
  })
  try {
    await new Promise(r=>server.listen(0,'127.0.0.1',r))
    const base=`http://127.0.0.1:${server.address().port}`
    // Keep the production policy and URLs; route their transactions to a local HTTP fixture.
    const fetch=createUpdateFetch({request:options=>net.request({...options,url:base+'/?source='+encodeURIComponent(options.url)})})
    await assert.rejects(net.fetch(base+'/?source='+encodeURIComponent(policy.FEED),{redirect:'manual'}),/Redirect was cancelled/,'reproduce the reported Electron failure')
    const u=new Updater({version:'0.1.9',dir:join(root,'normal'),fetch,install:async()=>{throw new Error('test never installs')},onState:state=>{
      if(state.state==='downloading'&&state.done===8&&interruptResponse){const res=interruptResponse;interruptResponse=null;setTimeout(()=>res.destroy(),20)}
    }})
    await u.check();assert.equal(u.status().state,'available',u.status().error)
    await u.download();assert.equal(u.status().state,'error')
    assert.equal((await fs.stat(join(root,'normal',manifest.assets.windows.name+'.part'))).size,8)
    await u.download();assert.equal(u.status().state,'ready',u.status().error)
    assert.equal(visited.filter(x=>x.url===assetHost+'installer.exe').at(-1).range,'bytes=8-')
    assert.deepEqual(await fs.readFile(join(root,'normal',manifest.assets.windows.name)),bytes)
    await assert.rejects(request(fetch,download+'bad'),/非仓库/)
    assert.ok(!visited.some(x=>x.url.startsWith('https://evil.invalid/')))
    await assert.rejects(request(fetch,download+'missing'),/跳转地址缺失/)
    await assert.rejects(request(fetch,download+'loop'),/跳转次数过多/)
    const paused=new Updater({version:'0.1.9',dir:join(root,'paused'),fetch,install:async()=>{}})
    await paused.check();hold=true
    const firstChunk=new Promise(r=>{started=r}),pending=paused.download()
    await firstChunk;setTimeout(()=>paused.pause(),50);await pending
    assert.equal(paused.status().state,'paused');heldResponse?.destroy()
    console.log('Real Electron updater passed: multi-hop redirect, checked source, interrupted resume, verified stream, missing Location, redirect cap and pause')
    app.exit(0)
  }catch(error){console.error(error);app.exit(1)}
  finally {server.closeAllConnections();server.close();await fs.rm(root,{recursive:true,force:true})}
}).catch(error=>{console.error(error);app.exit(1)})
