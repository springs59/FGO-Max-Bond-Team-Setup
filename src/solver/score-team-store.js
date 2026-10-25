// Keep complete results on disk in independently readable pages. Only an
// four page buffers plus one reloaded tail are resident on the disk backend;
// there is no worker message backlog. Unsupported storage uses explicit RAM.
export const SCORE_PAGE_SIZE=64
import {createScoreDedup} from './score-team-dedup.js'
const encoder=new TextEncoder(),decoder=new TextDecoder()
export async function createScoreTeamStore({directory=null,pageSize=SCORE_PAGE_SIZE}={}) {
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>256)throw Error('配队分页大小无效')
  let root=directory
  if(!root&&globalThis.navigator?.storage?.getDirectory){
    try{
      const parent=await (await navigator.storage.getDirectory()).getDirectoryHandle('fgo-score-team-queries-v1',{create:true})
      root=await parent.getDirectoryHandle(crypto.randomUUID(),{create:true})
      const probe=await root.getFileHandle('probe',{create:true})
      if(typeof probe.createSyncAccessHandle!=='function')throw new DOMException('Synchronous OPFS unavailable','NotSupportedError')
      const handle=await probe.createSyncAccessHandle();handle.close();await root.removeEntry('probe')
    }catch(error){
      if(!['SecurityError','NotSupportedError'].includes(error.name))throw error
      root=null
    }
  }
  const buckets=new Map(),memory=new Map(),pendingBuckets=new Map()
  let total=0,closed=false,peakBufferedRecords=0,bufferedRecords=0,dedup=null
  const fileName=(score,page)=>`${score}-${page}.json`
  async function flush(b){
    if(!b.pending.length)return
    const page=Math.floor((b.count-b.pending.length)/pageSize),name=fileName(b.score,page)
    if(root){
      const handle=await (await root.getFileHandle(name,{create:true})).createSyncAccessHandle()
      try{
        const bytes=encoder.encode(JSON.stringify(b.pending));let offset=0
        while(offset<bytes.length){const n=handle.write(bytes.subarray(offset),{at:offset});if(!Number.isInteger(n)||n<=0)throw Error('配队分页写入失败');offset+=n}
        handle.truncate(bytes.length);handle.flush()
      }finally{handle.close()}
    }else memory.set(name,b.pending.slice())
    bufferedRecords-=b.pending.length;b.pending=[];pendingBuckets.delete(b.score)
  }
  async function read(b,page){
    const pendingPage=Math.floor((b.count-b.pending.length)/pageSize)
    if(b.pending.length&&page===pendingPage)return b.pending
    const name=fileName(b.score,page)
    if(!root)return memory.get(name)||[]
    const file=await (await root.getFileHandle(name)).getFile()
    return JSON.parse(await file.text())
  }
  return {
    get diskBacked(){return Boolean(root)},
    async appendUnique(record,key){
      if(closed)throw Error('配队结果已关闭')
      dedup??=await createScoreDedup(root)
      if(!await dedup.add(key))return false
      await this.append(record);return true
    },
    async append(record){
      if(closed)throw Error('配队结果已关闭')
      if(!Number.isSafeInteger(record.score)||record.score<0)throw Error('配队分数无效')
      let b=buckets.get(record.score)
      if(!b){b={score:record.score,count:0,pending:[]};buckets.set(record.score,b)}
      if(!b.pending.length&&b.count%pageSize){
        b.pending=(await read(b,Math.floor(b.count/pageSize))).slice();bufferedRecords+=b.pending.length
      }
      b.pending.push(record);b.count++;total++
      bufferedRecords++;pendingBuckets.delete(b.score);pendingBuckets.set(b.score,b)
      if(!Number.isSafeInteger(total))throw Error('配队数量超出精确计数范围')
      peakBufferedRecords=Math.max(peakBufferedRecords,bufferedRecords)
      if(b.pending.length===pageSize)await flush(b)
      while(bufferedRecords>pageSize*4)await flush(pendingBuckets.values().next().value)
    },
    stats(bestScore){return {bestScore:Number.isFinite(bestScore)?bestScore:null,
      bestCount:buckets.get(bestScore)?.count||0,otherCount:total-(buckets.get(bestScore)?.count||0),total,
      diskBacked:Boolean(root),pageSize,peakBufferedRecords}},
    async page({bestScore,kind='best',offset=0,limit=pageSize,filter=null}={}){
      if(!['all','best','other'].includes(kind)||!Number.isSafeInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>256){const error=Error('配队分页请求无效');error.name='ScorePageRequestError';throw error}
      const selected=[...buckets.values()].filter(b=>kind==='all'||(kind==='best'?b.score===bestScore:b.score!==bestScore)).sort((a,b)=>b.score-a.score)
      const count=selected.reduce((n,b)=>n+(filter?filter.counts.get(b.score)||0:b.count),0),records=[],sourceOffsets=[]
      let skip=offset,sourceBase=0
      for(const b of selected){
        if(filter){
          const matches=filter.counts.get(b.score)||0
          if(skip>=matches){skip-=matches;sourceBase+=b.count;continue}
          for(let page=0;page*pageSize<b.count&&records.length<limit;page++){
            const list=await read(b,page)
            for(let i=0;i<list.length&&records.length<limit;i++)if(filter.match(list[i])){
              if(skip){skip--;continue}
              records.push(list[i]);sourceOffsets.push(sourceBase+page*pageSize+i)
            }
            if(records.length<limit)await filter.yieldTask()
          }
          sourceBase+=b.count;if(records.length===limit)break
          continue
        }
        if(skip>=b.count){skip-=b.count;continue}
        while(skip<b.count&&records.length<limit){
          const page=Math.floor(skip/pageSize),at=skip%pageSize,list=await read(b,page)
          const take=Math.min(limit-records.length,list.length-at)
          if(take<=0)throw Error('配队分页缺失，不能宣告全部结果完整')
          records.push(...list.slice(at,at+take));skip+=take
        }
        skip=0;if(records.length===limit)break
      }
      return {...this.stats(bestScore),kind,offset,total:count,records,...(filter?{sourceOffsets}:{})}
    },
    async seal(){if(closed)return;for(const b of buckets.values())await flush(b);dedup?.close();closed=true},
    async exportFile({bestScore,header={},transform=r=>r}={}){
      if(!closed){const error=Error('请先等待计算结束或停止枚举，再导出完整的已得结果');error.name='ScorePageRequestError';throw error}
      const handle=root?await root.getFileHandle('teams.jsonl',{create:true}):null
      const writer=handle?await handle.createWritable():null,parts=[]
      const write=async text=>{if(writer)await writer.write(text);else parts.push(text)}
      try{
        await write(JSON.stringify({format:'fgo-all-score-teams',version:1,...header,...this.stats(bestScore)})+'\n')
        for(const kind of ['best','other']){
          const count=kind==='best'?this.stats(bestScore).bestCount:this.stats(bestScore).otherCount
          for(let offset=0;offset<count;offset+=pageSize){
            const page=await this.page({bestScore,kind,offset})
            await write(page.records.map(r=>JSON.stringify({classification:kind,...transform(r)})).join('\n')+'\n')
          }
        }
        if(writer){await writer.close();return handle.getFile()}
        return new Blob(parts,{type:'application/x-ndjson'})
      }catch(error){await writer?.abort().catch(()=>{});throw error}
    },
    async dispose(){
      closed=true
      dedup?.close()
      if(root)for await(const [name] of root.entries())await root.removeEntry(name)
      buckets.clear();memory.clear()
    },
  }
}
