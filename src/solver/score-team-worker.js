import {createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamStore,SCORE_PAGE_SIZE} from './score-team-store.js'
import {liveBondBonusCatalog} from '../bond/bonus.js'
const pause=()=>new Promise(resolve=>setTimeout(resolve,0))
export function createScoreTeamController({post,createSearch=createScoreTeamSearch,createStore=createScoreTeamStore,yieldTask=pause,now=()=>performance.now()}={}) {
  let current=null,generation=0,pending=null
  function invalidate(job){job.failed=true;job.cancelled=true;job.query.state.complete=false;job.query.state.maximumProven=false}
  function metadata(job,extra={}){
    return {...job.store.stats(job.query.state.bestScore),complete:job.query.state.complete,
      maximumProven:job.query.state.maximumProven,grouped:job.query.state.compact!==false,primary:job.opts.optimizeBy==='prefer'?'preferBond':'total',
      stopped:Boolean(job.cancelled&&job.finished&&!job.query.state.complete),stopping:Boolean(job.cancelled&&!job.finished),
      infeasible:Boolean(job.query.state.complete&&!Number.isFinite(job.query.state.bestScore)),
      elapsedMs:Math.max(0,(job.finishedAt??now())-job.startedAt),phase:job.finished?'finished':'searching',
      cacheHit:Boolean(job.reused),stats:job.reused?{nodes:0,evaluated:0,scorePruned:0,budgetPruned:0}:{...job.query.state.stats},...extra}
  }
  async function resultPage(job,{kind='best',offset=0}={}){
    let page
    for(let attempt=0;attempt<3;attempt++){
      const bestScore=job.query.state.bestScore,stats=job.store.stats(bestScore),count=kind==='best'?stats.bestCount:stats.otherCount
      const start=Math.min(offset,Math.floor(Math.max(0,count-1)/SCORE_PAGE_SIZE)*SCORE_PAGE_SIZE)
      page=await job.store.page({bestScore,kind,offset:start})
      if(page.bestScore===(Number.isFinite(job.query.state.bestScore)?job.query.state.bestScore:null))break
      page=null
    }
    if(!page){const error=Error('最高分正在更新，请刷新本页');error.name='ScorePageRequestError';throw error}
    offset=page.offset
    const plans=page.records.map(r=>job.query.hydrate(r))
    const previewOnly=kind==='best'&&!plans.length&&Boolean(job.preview)
    if(previewOnly)plans.push(job.preview)
    const first=plans[0]
    if(!first)return {ok:false,error:job.cancelled?'已停止，尚未计算出可展示的合法配队；这不表示当前条件无解。':job.query.state.complete&&!Number.isFinite(job.query.state.bestScore)?'当前条件下没有合法配队。请检查冠位位置、空位、锁定从者和礼装库存是否冲突。':'当前类别暂无已计算的合法配队',
      scoreTeamResults:metadata(job,{kind,offset,total:page.total,previewOnly:false}),
      resultStatus:{source:'all-score-teams',optimality:'candidate',allScoreTeamsComplete:false,maximumProven:false}}
    return {...first,plans,allPlans:plans,chosen:0,summary:job.cancelled&&!job.query.state.complete?
      '以下为停止前已计算出的可行结果；当前最高分尚未证明为全局最优，全部同分方案也尚未收齐。':
      '最高分方案按等效组合合并保留；组内保留替换选项及库存约束。其他方案仅来自搜索途中。',
      scoreTeamResults:metadata(job,{kind,offset,total:page.total,pageScore:page.bestScore,previewOnly}),
      queryStats:job.reused?{cacheHit:true,aiInferenceCalls:0,search:{nodes:0}}:undefined,
      resultStatus:{...first.resultStatus,ai:job.reused&&job.query.state.ai?{...job.query.state.ai,inferenceCalls:0,inferenceMs:0}:job.query.state.ai,allScoreTeamsComplete:job.query.state.complete,
        maximumProven:job.query.state.maximumProven,optimality:job.query.state.complete&&kind==='best'?'search-complete':'candidate'}}
  }
  async function start(id,opts){
    const startedGeneration=++generation
    const request=pending={id,cancelled:false,startedAt:now()}
    post({id,type:'score-progress',ok:true,progress:{phase:'preparing',elapsedMs:0,bestScore:null,bestCount:0,otherCount:0,grouped:true,stats:{nodes:0,evaluated:0,scorePruned:0,budgetPruned:0}}})
    let requestKey=null
    try{
      const slotPins=(opts.slotPins||[]).map(pin=>{
        const normalized={svtId:0,ceId:0,ceBondId:0,ceRewardId:0,formKey:'',...pin}
        if(pin.empty===true)Object.assign(normalized,{svtId:0,ceId:0,ceBondId:0,ceRewardId:0,formKey:''})
        return Object.fromEntries(Object.keys(normalized).sort().map(key=>[key,normalized[key]]))
      })
      requestKey=JSON.stringify({opts:{...opts,slotPins},activeBonuses:liveBondBonusCatalog(opts.bondBonuses,opts.quest)},(_key,value)=>value instanceof Map?{type:'Map',entries:[...value]}:value instanceof Set?{type:'Set',values:[...value]}:value)}catch{}
    if(!opts.skipResultCache&&requestKey!=null&&!current?.failed&&current?.query.state.complete&&current.requestKey===requestKey){
      const cached=current;cached.id=id;cached.reused=true;cached.cancelled=false
      try{
        const value=await resultPage(cached)
        if(startedGeneration===generation)post({id,type:'score-complete',ok:true,result:{kind:'bond',value}})
      }catch(error){
        invalidate(cached)
        if(startedGeneration===generation)post({id,type:'error',ok:false,partial:true,error:String(error.message||error),scoreTeamResults:metadata(cached,{complete:false,maximumProven:false})})
      }
      return
    }
    if(current){current.cancelled=true;await current.store?.dispose()}
    if(startedGeneration!==generation)return
    const query=createSearch(opts)
    if(!query.ok){post({id,type:'error',ok:false,error:query.error});return}
    const store=await createStore()
    if(startedGeneration!==generation){await store.dispose();return}
    const job={id,opts,query,store,requestKey,startedAt:request.startedAt,preview:query.initial,cancelled:request.cancelled,finished:false};current=job
    let lastPost=-Infinity,lastYield=now(),shown=false,lastPreviewScore=null,windowScore=null,windowCount=0
    try{
      if(job.preview&&!job.cancelled){
        post({id,type:'score-start',ok:true,result:{kind:'bond',value:{...job.preview,plans:[job.preview],
          scoreTeamResults:metadata(job,{kind:'best',offset:0,total:0}),resultStatus:{source:'all-score-teams',optimality:'candidate',ai:query.state.ai}}}})
        shown=true
      }
      if(!job.cancelled)for(const event of query.iterator){
        if(job.cancelled)break
        if(event.type==='best'&&event.record)job.preview=query.hydrate(event.record)
        if(event.type==='team'){
          await store.append(event.record)
          if(event.record.score===query.state.bestScore&&(!job.preview||event.record.score>(opts.optimizeBy==='prefer'?job.preview.preferBond:job.preview.total)))job.preview=query.hydrate(event.record)
        }
        const timestamp=now()
        if(!shown&&job.preview||timestamp-lastPost>=250){
          const previewScore=job.preview&&(opts.optimizeBy==='prefer'?job.preview.preferBond:job.preview.total)
          post({id,type:'score-progress',ok:true,progress:metadata(job),preview:previewScore!==lastPreviewScore?job.preview:null})
          lastPreviewScore=previewScore
          shown=Boolean(job.preview);lastPost=timestamp
          const count=store.stats(query.state.bestScore).bestCount
          if(count>=2&&(windowScore!==query.state.bestScore||windowCount<SCORE_PAGE_SIZE&&count>=SCORE_PAGE_SIZE)){
            const value=await resultPage(job)
            post({id,type:'score-window',ok:true,result:{kind:'bond',value}})
            windowScore=query.state.bestScore;windowCount=value.plans.length
          }
        }
        if(timestamp-lastYield>=16||event.type==='tick'){
          await yieldTask();lastYield=now()
        }
        if(job.cancelled)break
      }
      await store.seal()
      job.finished=true;job.finishedAt=now()
      if(job.failed)return
      if(!job.cancelled&&Number.isFinite(query.state.bestScore)&&!store.stats(query.state.bestScore).bestCount)throw Error('最高分起点未在完整配队枚举中还原，结果不能标记为完整')
      if(current===job&&startedGeneration===generation)post({id,type:job.cancelled&&!query.state.complete?'score-stopped':'score-complete',ok:true,result:{kind:'bond',value:await resultPage(job)}})
    }catch(error){
      invalidate(job)
      if(current===job&&startedGeneration===generation)post({id,type:'error',ok:false,error:String(error.message||error),partial:true,scoreTeamResults:metadata(job,{complete:false,maximumProven:false})})
    }
  }
  async function page(msg){
    const job=current
    if(!job||job.id!==msg.id)return
    try{post({id:msg.id,type:'score-page',request:msg.request,ok:true,result:{kind:'bond',value:await resultPage(job,msg)}})}
    catch(error){if(error.name!=='ScorePageRequestError')invalidate(job);post({id:msg.id,type:'score-page',request:msg.request,ok:false,error:String(error.message||error),...(job.failed?{scoreTeamResults:metadata(job)}:{})})}
  }
  async function exportTeams(msg){
    const job=current;if(!job||job.id!==msg.id)return
    try{
      const file=await job.store.exportFile({bestScore:job.query.state.bestScore,header:{complete:job.query.state.complete,
        maximumProven:job.query.state.maximumProven,grouped:job.query.state.compact!==false,primary:job.opts.optimizeBy==='prefer'?'preferBond':'total',
        stopped:Boolean(job.cancelled&&!job.query.state.complete),
        ...(!job.store.stats(job.query.state.bestScore).bestCount&&job.preview?{feasiblePreview:{total:job.preview.total,preferBond:job.preview.preferBond,slots:job.preview.slots}}:{}),
        ...(job.query.state.compact!==false?{version:2,resultUnit:'equivalence-group',equivalenceCatalogs:job.query.equivalenceCatalogs}:{})},transform:r=>{
        const plan=job.query.hydrate(r)
        return {...(r.packed.equivalence?{family:{domain:r.domain,packed:r.packed}}:{}),score:r.score,total:plan.total,preferBond:plan.preferBond,cost:plan.costUsed,curve:plan.curve,
          slots:plan.slots.map(s=>({position:s.position,filled:s.filled,isSupport:s.isSupport,isGrand:s.isGrand,
            svtId:s.svtId,svtArtKey:s.svtArtKey,...(s.supportKind?{supportKind:s.supportKind}:{}),...(s.fixedEquips?.length?{fixedEquips:s.fixedEquips.map(e=>({id:e.id,name:e.name,mlb:e.mlb}))}:{}),ceId:s.ceId,ceMlb:s.ceMlb,ceBondId:s.ceBondId,ceBondMlb:s.ceBondMlb,ceRewardId:s.ceRewardId,ceRewardMlb:s.ceRewardMlb}))}
      }})
      post({id:msg.id,type:'score-export',ok:true,url:URL.createObjectURL(file),name:'FGO-score-teams-'+Date.now()+'.jsonl'})
    }catch(error){if(error.name!=='ScorePageRequestError')invalidate(job);post({id:msg.id,type:'score-export',ok:false,error:String(error.message||error),...(job.failed?{scoreTeamResults:metadata(job)}:{})})}
  }
  return {start,page,exportTeams,cancel(id){if(pending?.id===id)pending.cancelled=true;if(current?.id===id)current.cancelled=true},get current(){return current}}
}

