const fs=require('node:fs/promises'), path=require('node:path'), crypto=require('node:crypto')
const {createReadStream}=require('node:fs')
const {FEED,validate,compare,allowedUrl}=require('./update-policy.cjs')
async function request(fetch,url,headers={},signal) {
  for(let i=0;i<6;i++) {
    if(!allowedUrl(url))throw new Error('拒绝非仓库下载来源')
    const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'FGO-Bond-Updater','Cache-Control':'no-cache',...headers},signal})
    if([301,302,303,307,308].includes(r.status)) {const location=r.headers.get('location');await r.body?.cancel();if(!location)throw new Error('更新服务跳转地址缺失');url=new URL(location,url).href;continue}
    if(!r.ok) {await r.body?.cancel();throw new Error(`更新服务 HTTP ${r.status}`)}
    return r
  }
  throw new Error('下载跳转次数过多')
}
async function hash(file) {const h=crypto.createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex')}
class Updater {
  constructor({version,dir,fetch,install,onState=()=>{},auto=true,supported=true}) {
    Object.assign(this,{version,dir,fetch,install,onState,supported});this.state={state:'idle',currentVersion:version,auto,supported};this.busy=false;this.candidate=null
  }
  status(){return {...this.state}}
  set(patch){Object.assign(this.state,patch);this.onState(this.status());return this.status()}
  file(){return path.join(this.dir,this.candidate.asset.name)}
  async verified(){try{return (await fs.stat(this.file())).size===this.candidate.asset.size && await hash(this.file())===this.candidate.asset.sha256}catch{return false}}
  async restore() {
    try {const m=JSON.parse(await fs.readFile(path.join(this.dir,'candidate.json'),'utf8'));this.candidate=validate(m);if(compare(this.candidate.version,this.version)<=0){this.candidate=null;await this.cleanup();return}
      this.set({state:await this.verified()?'ready':'available',latestVersion:this.candidate.version,notes:this.candidate.notes,total:this.candidate.asset.size,error:''})
    }catch{this.candidate=null}
  }
  async cleanup(){for(const name of await fs.readdir(this.dir).catch(()=>[]))if(name.endsWith('.exe')||name.endsWith('.part')||name.startsWith('candidate.json'))await fs.rm(path.join(this.dir,name),{force:true})}
  async check() {
    if(this.busy || this.state.state==='installing')return this.status()
    const previouslyReady=this.state.state==='ready'
    this.busy=true;this.set({state:'checking',error:''})
    try {
      const r=await request(this.fetch,FEED,{},AbortSignal.timeout(30000)),chunks=[];let size=0
      for await(const b of r.body){size+=b.length;if(size>65536)throw new Error('发布信息过大');chunks.push(b)}
      const manifest=JSON.parse(Buffer.concat(chunks).toString('utf8')), candidate=validate(manifest)
      if(compare(candidate.version,this.version)<=0){this.candidate=null;await this.cleanup();return this.set({state:'current',latestVersion:candidate.version,checkedAt:Date.now(),total:0,done:0})}
      if(this.candidate?.version!==candidate.version||this.candidate.asset.sha256!==candidate.asset.sha256)await this.cleanup()
      this.candidate=candidate
      // Store the original validated manifest so restoration uses the same validation.
      await fs.mkdir(this.dir,{recursive:true});await fs.writeFile(path.join(this.dir,'candidate.json.tmp'),JSON.stringify(manifest));await fs.rename(path.join(this.dir,'candidate.json.tmp'),path.join(this.dir,'candidate.json'))
      return this.set({state:await this.verified()?'ready':'available',latestVersion:candidate.version,notes:candidate.notes,total:candidate.asset.size,checkedAt:Date.now(),done:0})
    }catch(e){return this.set({state:previouslyReady?'ready':'error',error:String(e.message||e)})}finally{this.busy=false}
  }
  async download() {
    if(this.busy || !this.candidate || compare(this.candidate.version,this.version)<=0)return this.status()
    this.busy=true;this.controller=new AbortController();this.set({state:'downloading',error:''})
    const target=this.file(), partial=target+'.part', a=this.candidate.asset
    try {
      if(await this.verified())return this.set({state:'ready',done:a.size})
      let done=(await fs.stat(partial).catch(()=>({size:0}))).size
      if(done>a.size){await fs.rm(partial,{force:true});done=0}
      if(done<a.size) {
        const signal=AbortSignal.any([this.controller.signal,AbortSignal.timeout(30*60*1000)])
        const r=await request(this.fetch,a.url,done?{Range:`bytes=${done}-`}:{},signal)
        if(r.status===206){const range=r.headers.get('content-range');if(!range?.startsWith(`bytes ${done}-`)||!range.endsWith(`/${a.size}`))throw new Error('下载续传范围无效')}
        else done=0
        const h=await fs.open(partial,done?'a':'w');let last=0
        try{for await(const b of r.body){if(this.controller.signal.aborted)throw new Error('paused');done+=b.length;if(done>a.size)throw new Error('安装包大小不匹配');await h.write(b);if(Date.now()-last>250){last=Date.now();this.set({done,total:a.size})}}}finally{await h.close()}
      }
      this.set({state:'verifying',done,total:a.size})
      if(done!==a.size || await hash(partial)!==a.sha256){await fs.rm(partial,{force:true});throw new Error('安装包校验失败，已丢弃，请重新下载')}
      await fs.rename(partial,target);return this.set({state:'ready',done:a.size})
    }catch(e){return this.set({state:this.controller.signal.aborted?'paused':'error',error:this.controller.signal.aborted?'':String(e.message||e)})}finally{this.busy=false;this.controller=null}
  }
  pause(){this.controller?.abort();return this.status()}
  async apply() {
    if(this.busy || !this.supported || !this.candidate || this.state.state!=='ready')return this.status()
    this.busy=true
    try{this.set({state:'verifying',error:''});if(!await this.verified())throw new Error('安装包已损坏，请重新下载');this.set({state:'installing'});await this.install(this.file());return this.status()}
    catch(e){return this.set({state:'error',error:String(e.message||e)})}finally{this.busy=false}
  }
}
module.exports={Updater,request,hash}
