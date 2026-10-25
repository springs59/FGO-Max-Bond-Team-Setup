import {createScoreTeamSearch} from '../recommend.js'
import {createScoreTeamStore,SCORE_PAGE_SIZE} from './score-team-store.js'
import {liveBondBonusCatalog} from '../bond/bonus.js'
import {packedTeamOf,memberCompositionKey,memberPlacementKey,physicalVariantKey} from './score-team-diversity.js'
import {createVariantCursor} from './score-team-variant-browser.js'
import {createSupportIndex,supportCeIds,supportFamily} from './score-team-support-filter.js'
function familyRecord(record,catalog){
  if(!record||!catalog)return record
  if(record.packed.equivalence)return record
  const slots=record.packed.slots.map(s=>({...s,
    rg:s.f&&!s.s?catalog.rows.findIndex(pool=>pool.some(o=>o.svt===s.svt&&(o.art||'')===(s.art||''))):-1,
    cg:s.f&&s.ce?(s.s?catalog.supportCes:catalog.ownCes).findIndex(pool=>pool.some(o=>o.id===s.ce&&o.mlb===(s.mlb!==false))):-1}))
  if(slots.some(s=>s.f&&!s.s&&s.rg<0||s.f&&s.ce&&s.cg<0))return record
  return {...record,packed:{...record.packed,equivalence:1,slots}}
}
function archivePlan(plan){
  return {total:plan.total,preferBond:plan.preferBond,cost:plan.costUsed,curve:plan.curve,
    slots:plan.slots.map(s=>({position:s.position,filled:s.filled,isSupport:s.isSupport,isGrand:s.isGrand,label:s.label,formLabel:s.formLabel,bondLv:s.bondLv,bondCap:s.bondCap,
      gain:plan.output?.results?.find(r=>r.position===s.position)?.final??null,
      svtId:s.svtId,svtArtKey:s.svtArtKey,...(s.supportKind?{supportKind:s.supportKind}:{}),...(s.fixedEquips?.length?{fixedEquips:s.fixedEquips.map(e=>({id:e.id,name:e.name,mlb:e.mlb}))}:{}),ceId:s.ceId,ceMlb:s.ceMlb,ceBondId:s.ceBondId,ceBondMlb:s.ceBondMlb,ceRewardId:s.ceRewardId,ceRewardMlb:s.ceRewardMlb}))}
}
function archiveRecord(plan,record,catalog){
  const family=record&&familyRecord(record,catalog)
  return {...archivePlan(plan),...(record?{score:record.score}:{}),...(family?.packed.equivalence?{family:{domain:family.domain,packed:family.packed}}:{})}
}
const pause=()=>new Promise(resolve=>setTimeout(resolve,0))
export function createScoreTeamController({post,createSearch=createScoreTeamSearch,createStore=createScoreTeamStore,yieldTask=pause,now=()=>performance.now()}={}) {
  let current=null,generation=0,pending=null
  function invalidate(job){job.failed=true;job.cancelled=true;job.query.state.complete=false;job.query.state.maximumProven=false}
  const catalogOf=(job,record)=>job.query.equivalenceCatalogs?.[record?.domain]
  const previewRecord=job=>job.previewRecord||(job.preview?{score:job.query.state.bestScore,packed:{slots:packedTeamOf(job.preview)}}:null)
  function supportInfo(job,id=job.supportCeId??null){
    const stats=job.store.stats(job.query.state.bestScore),options=job.supportIndex.summary(job.query.state.bestScore),preview=previewRecord(job)
    if(!stats.bestCount&&preview)for(const ceId of supportCeIds(preview,catalogOf(job,preview))){
      const row=options.find(o=>o.id===ceId)
      if(row)row.preview=true;else options.push({id:ceId,score:preview.score,bestCount:0,otherCount:0,preview:true})
    }
    const row=id==null?null:options.find(o=>o.id===id)
    return {supportCeId:id,supportCeOptions:options,matchingBestCount:id==null?stats.bestCount:row?.bestCount||0,matchingOtherCount:id==null?stats.otherCount:row?.otherCount||0}
  }
  function metadata(job,extra={}){
    return {...job.store.stats(job.query.state.bestScore),...supportInfo(job),complete:job.query.state.complete,
      maximumProven:job.query.state.maximumProven,recoveries:job.query.state.recoveries||0,grouped:job.query.state.compact!==false,primary:job.opts.optimizeBy==='prefer'?'preferBond':'total',
      stopped:Boolean(job.cancelled&&job.finished&&!job.query.state.complete),stopping:Boolean(job.cancelled&&!job.finished),
      infeasible:Boolean(job.query.state.complete&&!Number.isFinite(job.query.state.bestScore)),
      elapsedMs:Math.max(0,(job.finishedAt??now())-job.startedAt),phase:job.finished?'finished':job.query.state.phase||'searching',
      cacheHit:Boolean(job.reused),stats:job.reused?{nodes:0,evaluated:0,scorePruned:0,budgetPruned:0}:{...job.query.state.stats},...extra}
  }
  async function resultPage(job,{kind=job.viewKind||'best',offset=job.viewOffset||0,supportCeId=job.supportCeId??null}={}){
    const visibilityToken=job.pageToken
    let page
    for(let attempt=0;attempt<3;attempt++){
      const bestScore=job.query.state.bestScore,info=supportInfo(job,supportCeId),count=kind==='best'?info.matchingBestCount:info.matchingOtherCount
      const start=Math.min(offset,Math.floor(Math.max(0,count-1)/SCORE_PAGE_SIZE)*SCORE_PAGE_SIZE)
      page=await job.store.page({bestScore,kind,offset:start,...(supportCeId==null?{}:{filter:{counts:job.supportIndex.counts(supportCeId),match:r=>supportCeIds(r,catalogOf(job,r)).includes(supportCeId),yieldTask}})})
      if(page.bestScore===(Number.isFinite(job.query.state.bestScore)?job.query.state.bestScore:null))break
      page=null
    }
    if(!page){const error=Error('最高分正在更新，请刷新本页');error.name='ScorePageRequestError';throw error}
    offset=page.offset
    const records=page.records.map(r=>supportFamily(r,catalogOf(job,r),supportCeId).record)
    const plans=records.map((r,index)=>{
      const plan=job.query.hydrate(r)
      if(supportCeId!=null&&plan.equivalence)plan.equivalence={...plan.equivalence,equipment:plan.equivalence.equipment.map(e=>e.support?{...e,options:e.options.filter(c=>c.id===supportCeId)}:e)}
      return {...plan,scoreFamilyRef:page.sourceOffsets?{kind,offset:page.sourceOffsets[index],index:0,score:r.score,filteredOffset:offset+index}:{kind,offset,index,score:r.score}}
    })
    const preview=previewRecord(job),selectedPreview=preview&&supportFamily(preview,catalogOf(job,preview),supportCeId)
    const previewOnly=kind==='best'&&!plans.length&&Boolean(job.preview)&&Boolean(selectedPreview)
    if(previewOnly)plans.push({...job.preview,...(job.previewRecord?job.query.hydrate(selectedPreview.record):{}),scoreFamilyRef:{preview:true,score:job.query.state.bestScore}})
    if(job.pageToken===visibilityToken&&(job.supportCeId??null)===supportCeId)job.visibleRecords=new Map(plans.map((plan,i)=>[physicalVariantKey(plan),records[i]||(job.previewRecord&&selectedPreview.record)]))
    const first=plans[0]
    if(!first)return {ok:false,error:supportCeId!=null?'该助战礼装在当前类别中暂无已得到的配队，请切换类别或取消筛选。':job.cancelled?'已停止，尚未计算出可展示的合法配队；这不表示当前条件无解。':job.query.state.complete&&!Number.isFinite(job.query.state.bestScore)?'当前条件下没有合法配队。请检查冠位位置、空位、锁定从者和礼装库存是否冲突。':'当前类别暂无已计算的合法配队',
      scoreTeamResults:metadata(job,{...supportInfo(job,supportCeId),kind,offset,total:page.total,previewOnly:false}),
      resultStatus:{source:'all-score-teams',optimality:'candidate',allScoreTeamsComplete:false,maximumProven:false}}
    return {...first,plans,allPlans:plans,chosen:0,lockSupportCeId:job.opts.lockSupportCeId||0,summary:job.cancelled&&!job.query.state.complete?
      (job.query.state.maximumProven?'以下为停止前已计算出的结果；最高分已证明，全部同分方案尚未收齐。':'以下为停止前已计算出的可行结果；当前最高分尚未证明为全局最优，全部同分方案也尚未收齐。'):
      '最高分方案按等效组合合并保留；组内保留替换选项及库存约束。其他方案仅来自搜索途中。',
      scoreTeamResults:metadata(job,{...supportInfo(job,supportCeId),kind,offset,total:page.total,pageScore:page.bestScore,previewOnly}),
      queryStats:job.reused?{cacheHit:true,aiInferenceCalls:0,search:{nodes:0}}:undefined,
      resultStatus:{...first.resultStatus,ai:job.reused&&job.query.state.ai?{...job.query.state.ai,inferenceCalls:0,inferenceMs:0}:job.query.state.ai,allScoreTeamsComplete:job.query.state.complete,
        maximumProven:job.query.state.maximumProven,optimality:kind==='best'?(job.query.state.complete?'search-complete':job.query.state.maximumProven?'maximum-proven':'candidate'):'candidate'}}
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
      const cached=current;cached.id=id;cached.reused=true;cached.cancelled=false;cached.supportCeId=null;cached.viewKind='best';cached.viewOffset=0;cached.variantCursors=null
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
    const job={id,opts,query,store,requestKey,startedAt:request.startedAt,preview:query.initial,cancelled:request.cancelled,finished:false,supportIndex:createSupportIndex(),supportCeId:null,viewKind:'best',viewOffset:0};current=job
    let lastPost=-Infinity,lastYield=now(),shown=false,lastPreviewScore=null,windowScore=null,windowCount=0
    try{
      if(job.preview&&!job.cancelled){
        post({id,type:'score-start',ok:true,result:{kind:'bond',value:{...job.preview,plans:[job.preview],
          scoreTeamResults:metadata(job,{kind:'best',offset:0,total:0}),resultStatus:{source:'all-score-teams',optimality:'candidate',ai:query.state.ai}}}})
        shown=true
      }
      if(!job.cancelled)for(const event of query.iterator){
        if(job.cancelled)break
        if(event.type==='best'&&event.record){job.previewRecord=event.record;job.variantCursors=null;job.selectedVariant=null;job.selectedVariantRecord=null;job.preview=query.hydrate(event.record)}
        if(event.type==='team'){
          await store.append(event.record)
          job.supportIndex.add(event.record,catalogOf(job,event.record))
          if(event.record.score===query.state.bestScore&&(!job.preview||event.record.score>(opts.optimizeBy==='prefer'?job.preview.preferBond:job.preview.total)))job.preview=query.hydrate(event.record)
        }
        const timestamp=now()
        if(event.type==='phase'||event.type==='best'||!shown&&job.preview||timestamp-lastPost>=250){
          const previewScore=job.preview&&(opts.optimizeBy==='prefer'?job.preview.preferBond:job.preview.total)
          post({id,type:'score-progress',ok:true,progress:metadata(job),preview:previewScore!==lastPreviewScore&&job.preview?{...job.preview,lockSupportCeId:job.opts.lockSupportCeId||0,scoreFamilyRef:{preview:true,score:previewScore}}:null})
          lastPreviewScore=previewScore
          shown=Boolean(job.preview);lastPost=timestamp
          const count=store.stats(query.state.bestScore).bestCount
          if(count>=2&&(windowScore!==query.state.bestScore||windowCount<SCORE_PAGE_SIZE&&count>=SCORE_PAGE_SIZE)){
            const value=await resultPage(job)
            post({id,type:'score-window',ok:true,result:{kind:'bond',value}})
            windowScore=query.state.bestScore;windowCount=value.plans.length
          }
        }
        if(event.recovery||timestamp-lastYield>=16||event.type==='tick'){
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
    const token=job.pageToken={}
    try{
      if(Object.hasOwn(msg,'supportCeId')){
        if(msg.supportCeId!=null&&(!Number.isSafeInteger(msg.supportCeId)||msg.supportCeId<0)){const error=Error('助战筛选无效');error.name='ScorePageRequestError';throw error}
        job.supportCeId=msg.supportCeId??null;job.variantRun=null;job.variantCursors=null
        const info=supportInfo(job)
        msg={...msg,kind:info.matchingBestCount||info.supportCeOptions.find(o=>o.id===job.supportCeId)?.preview?'best':info.matchingOtherCount?'other':'best',offset:0}
      }
      const kind=msg.kind||job.viewKind,offset=msg.offset??0
      if(!['best','other'].includes(kind)||!Number.isSafeInteger(offset)||offset<0){const error=Error('配队分页请求无效');error.name='ScorePageRequestError';throw error}
      job.viewKind=kind;job.viewOffset=offset
      const value=await resultPage(job,msg)
      if(job.pageToken===token&&current===job)post({id:msg.id,type:'score-page',request:msg.request,ok:true,result:{kind:'bond',value}})
    }
    catch(error){if(error.name!=='ScorePageRequestError')invalidate(job);post({id:msg.id,type:'score-page',request:msg.request,ok:false,error:String(error.message||error),...(job.failed?{scoreTeamResults:metadata(job)}:{})})}
  }
  async function exportTeams(msg){
    const job=current;if(!job||job.id!==msg.id)return
    try{
      const visible=job.visibleRecords?.get(msg.selectedKey)
      if(visible){job.selectedVariant=job.query.hydrate(visible);job.selectedVariantRecord=visible}
      const file=await job.store.exportFile({bestScore:job.query.state.bestScore,header:{complete:job.query.state.complete,
        maximumProven:job.query.state.maximumProven,recoveries:job.query.state.recoveries||0,grouped:job.query.state.compact!==false,primary:job.opts.optimizeBy==='prefer'?'preferBond':'total',
        stopped:Boolean(job.cancelled&&!job.query.state.complete),
        queryContext:msg.queryContext||null,createdAt:new Date().toISOString(),
        ...(job.selectedVariant&&msg.selectedKey===physicalVariantKey(job.selectedVariant)?{selectedTeam:archiveRecord(job.selectedVariant,job.selectedVariantRecord,job.query.equivalenceCatalogs[job.selectedVariantRecord?.domain])}:{}),
        ...(!job.store.stats(job.query.state.bestScore).bestCount&&job.preview?{feasiblePreview:archiveRecord(job.preview,job.previewRecord,job.query.equivalenceCatalogs[job.previewRecord?.domain])}:{}),
        ...(job.query.state.compact!==false?{version:2,resultUnit:'equivalence-group',equivalenceCatalogs:job.query.equivalenceCatalogs}:{})},transform:r=>{
        const plan=job.query.hydrate(r)
        return {...(r.packed.equivalence?{family:{domain:r.domain,packed:r.packed}}:{}),score:r.score,...archivePlan(plan)}
      }})
      post({id:msg.id,type:'score-export',ok:true,url:URL.createObjectURL(file),name:'FGO-score-teams-'+Date.now()+'.jsonl'})
    }catch(error){if(error.name!=='ScorePageRequestError')invalidate(job);post({id:msg.id,type:'score-export',ok:false,error:String(error.message||error),...(job.failed?{scoreTeamResults:metadata(job)}:{})})}
  }
  async function variant(msg){
    const job=current;if(!job||job.id!==msg.id)return
    const token={request:msg.request};job.variantRun=token
    const execute=async()=>{
      if(job.variantRun!==token||current!==job)return
      const ref=msg.ref||{},mode=msg.mode||'members'
      try{
        if(!['members','equipment','all'].includes(mode)||!Number.isSafeInteger(ref.score))throw Error('同分切换请求无效')
        const kind=ref.kind||'best',fixedMembers=mode==='equipment'?msg.currentTeam:null,bestAtStart=job.query.state.bestScore
        if(mode!=='members'&&!Array.isArray(msg.currentTeam))throw Error('请先选择当前队伍')
        const key=JSON.stringify([mode,ref.score,kind,job.query.state.bestScore,job.supportCeId,fixedMembers&&memberPlacementKey(fixedMembers)])
        job.variantCursors??=new Map()
        if(job.variantCursors.get(mode)?.key!==key)job.variantCursors.set(mode,{key,cursor:createVariantCursor(job,{mode,score:ref.score,kind,fixedMembers,asFamily:familyRecord,supportCeId:job.supportCeId})})
        const cursor=job.variantCursors.get(mode).cursor
        let lastPost=now()
        while(true){
          if(current!==job||job.variantRun!==token)return
          if(job.query.state.bestScore!==bestAtStart||kind==='best'&&ref.score!==job.query.state.bestScore)throw Error('最高分已更新，请刷新本页再切换')
          const next=await cursor.next()
          if(current!==job||job.variantRun!==token){if(!next.done)cursor.buffered=next.value;return}
          if(next.done){post({id:msg.id,type:'score-variant',request:msg.request,ok:true,plan:null,ref,mode,pending:!job.finished&&!job.failed,checked:cursor.checked});return}
          if(next.value.type==='tick'){
            if(now()-lastPost>=250){post({id:msg.id,type:'score-variant-progress',request:msg.request,mode,checked:cursor.checked});lastPost=now()}
            await yieldTask();continue
          }
          const {record,ref:sourceRef}=next.value,plan=job.query.hydrate(record);cursor.checked++
          if(mode==='members'?memberCompositionKey(plan)===msg.currentMembers:
            physicalVariantKey(plan)===physicalVariantKey(msg.currentTeam)||mode==='equipment'&&memberPlacementKey(plan)!==memberPlacementKey(msg.currentTeam))continue
          let pageResult
          const loaded=msg.page,absolute=sourceRef.filteredOffset??((sourceRef.offset||0)+(sourceRef.index||0))
          if(loaded&&!sourceRef.preview&&(loaded.kind!==(sourceRef.kind||'best')||absolute<loaded.offset||absolute>=loaded.offset+loaded.length)){
            pageResult=await resultPage(job,{kind:sourceRef.kind||'best',offset:Math.floor(absolute/SCORE_PAGE_SIZE)*SCORE_PAGE_SIZE})
            if(current!==job||job.variantRun!==token){cursor.buffered=next.value;return}
            if(job.query.state.bestScore!==bestAtStart||kind==='best'&&ref.score!==job.query.state.bestScore)throw Error('最高分已更新，请刷新本页再切换')
            pageResult.chosen=absolute-pageResult.scoreTeamResults.offset
          }
          job.selectedVariant=plan;job.selectedVariantRecord=record
          post({id:msg.id,type:'score-variant',request:msg.request,ok:true,plan:{...plan,scoreFamilyRef:sourceRef},...(pageResult?{pageResult}:{}),ref,mode,checked:cursor.checked});return
        }
      }catch(error){post({id:msg.id,type:'score-variant',request:msg.request,ok:false,ref,mode,error:String(error.message||error)})}
      finally{if(job.variantRun===token)job.variantRun=null}
    }
    const task=(job.variantTail||Promise.resolve()).then(execute);job.variantTail=task.catch(()=>{});await task
  }
  return {start,page,variant,exportTeams,cancelVariant(id,request,reset=false){if(current?.id!==id)return;if(request==null||current.variantRun?.request===request)current.variantRun=null;if(reset)current.variantCursors=null},cancel(id){if(pending?.id===id)pending.cancelled=true;if(current?.id===id)current.cancelled=true},get current(){return current}}
}

