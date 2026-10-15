// Identical observer for all three versions. No result/condition manipulation.
const version=document.documentElement.dataset.comparisonVersion
const NativeWorker=globalThis.Worker,tracked=new WeakMap()
const output=document.createElement('div')
output.style.cssText='position:sticky;top:0;z-index:50;background:#102335;color:#fff;padding:8px;font:13px/1.5 sans-serif;overflow-wrap:anywhere'
output.textContent=version+' · 尚无测试记录 · 耗时包含请求传输和结果接收'
document.body.prepend(output)
globalThis.fgoBenchmarkStart=(worker,message)=>{
  const state=tracked.get(worker)
  if(!state||!message?.opts||message.id==null)return
  const opts=message.opts
  if(message.catalogUpdate)state.catalog=message.catalogUpdate
  const catalog=state.catalog||opts
  const conditions={}
  for(const key of ['base','costLimit','teapot','mode','allowSupport','lockSupportCeId','preferSvtIds','lockSvtIds','questType','questClass','filter','bond15Aura','optimizeBy','priorities','frontIds','pinCes','spriteMode','pinSprites','slotPins','grandPosition','region','reuseOnly'])
    if(opts[key]!==undefined)conditions[key]=opts[key]
  if(opts.quest)conditions.questId=opts.quest.id
  state.pending={id:message.id,start:performance.now(),at:new Date().toISOString(),conditions,solverMode:message.solverMode||'bond',progress:0,
    counts:{servants:catalog.servants?.length,ces:catalog.ces?.length,ownedServants:opts.account?.servants?.length,ownedCes:opts.account?.ces?.length}}
}
globalThis.Worker=class extends NativeWorker {
  constructor(url,options){
    super(url,options)
    if(!String(url).includes('/recommend-worker.js'))return
    tracked.set(this,{})
    this.addEventListener('message',({data})=>{
      const state=tracked.get(this),pending=state?.pending
      if(!pending||data?.id!==pending.id)return
      if(data.type==='progress'){pending.progress++;return}
      if(data.type!=='result'&&data.type!=='error')return
      const elapsed=performance.now()-pending.start
      const value=data.result?.value,plan=value?.bond||value?.team||value
      const record={version,at:pending.at,elapsedMs:Math.round(elapsed*100)/100,solverMode:pending.solverMode,conditions:pending.conditions,counts:pending.counts,
        ok:!!data.ok&&!!value?.ok,total:plan?.total,costUsed:plan?.costUsed,cacheHit:!!(value?.localResult?.hit||plan?.queryStats?.cacheHit),progressMessages:pending.progress,
        temporary:!!value?.localResult?.temporary,error:data.error||value?.error||null}
      state.pending=null
      output.textContent=`${version} · ${record.ok?'完成':'未成功'} ${record.elapsedMs} ms · ${record.cacheHit?'缓存命中':'非缓存命中'} · 总羁绊 ${record.total??'—'} · 不含渲染及手动保存`
      const rows=JSON.parse(localStorage.getItem('comparison-records')||'[]');rows.push(record);localStorage.setItem('comparison-records',JSON.stringify(rows.slice(-100)))
      globalThis.FgoAndroid?.recordComparison?.(JSON.stringify(record))
    })
    this.addEventListener('error',event=>{const state=tracked.get(this);if(state?.pending){output.textContent=version+' · Worker 错误：'+event.message;state.pending=null}})
  }
  postMessage(message,...rest){
    if(version==='2.0.0')globalThis.fgoBenchmarkStart(this,message)
    return super.postMessage(message,...rest)
  }
}
