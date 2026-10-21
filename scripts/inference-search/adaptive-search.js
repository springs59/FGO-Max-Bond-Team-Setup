// Research implementation inserted into isolated copies of ai-search.js.
// Traversal and verified warm starts may change; exact feasibility and bounds do not.
export function createLearnedSearch({mode='auto',model=SEARCH_MODEL,size=0,minimum=4,
  querySession=createQuerySession(),equipmentFeatures=[],servantFeatures=[],queryContext={}}={}) {
  const started=performance.now(),valid=mode!=='off'&&validSearchModel(model)
  const use=model?.inferenceUse||'single',candidate=use.startsWith('candidate')
  const active=valid&&(candidate||validQueryPolicy(model.queryPolicy))&&(mode==='on'||size>=minimum)
  const session=querySession,rootFeatures=active&&!candidate?queryFeatures(equipmentFeatures,servantFeatures,queryContext):null
  const memo=session.dynamicMemo??=new Map(),headMemo=session.headMemo??=new Map()
  const stats={enabled:active,modelVersion:valid?model.version+'/'+use:null,ranked:0,
    inferenceCalls:session.inferenceCalls,inferenceMs:session.inferenceMs,queryProfile:null,
    dynamic:active&&(/branch|stalled/.test(use)),inferenceUse:use,
    branchRequests:0,branchInferences:0,stalledInferences:0,decisionMemoHits:0,scoreMemoHits:0,portfolioProfiles:0,
    seedAttempts:0,seedFeasible:0,seedMs:0,seedBestScore:null,seedReused:0,seedCertifiedStops:0,seedPendingRechecks:0,budgetPruned:0,lowerBoundPruned:0,dpStatePruned:0,
    reason:mode==='off'?'disabled':!active?'inactive':'adaptive-'+use}
  function count(began){session.inferenceCalls++;session.inferenceMs+=performance.now()-began;stats.inferenceCalls=session.inferenceCalls;stats.inferenceMs=session.inferenceMs}
  function infer(features,reason){
    const key=JSON.stringify(features.slice(0,model.queryPolicy.features.length))
    if(memo.has(key)){stats.decisionMemoHits++;return memo.get(key)}
    const began=performance.now()
    let choice
    if(model.queryPolicy.format===2){const ranks=neuralRankings(model.queryPolicy,features);choice={profile:Object.freeze({...QUERY_PROFILES[ranks[0]]}),ranks}}
    else choice={profile:inferQueryPolicy(model.queryPolicy,features)}
    count(began)
    if(memo.size>=512)memo.clear()
    memo.set(key,choice)
    return choice
  }
  let root=null
  if(active&&!candidate){
    if(!session.decision){root=infer(rootFeatures,'root');session.decision=root.profile;session.rootRanks=root.ranks}
    else root={profile:session.decision,ranks:session.rootRanks}
    stats.queryProfile=root.profile.name
  }
  function head(kind,features){
    const key=use==='candidate-memo'?kind+':'+features.join(','):null
    if(key&&headMemo.has(key)){stats.scoreMemoHits++;return headMemo.get(key)}
    const began=performance.now(),value=predictPriority(model.heads[kind],features);count(began)
    if(key){if(headMemo.size>=8192)headMemo.clear();headMemo.set(key,value)}
    return value
  }
  let lastBest=-Infinity,lastCost=Infinity,lastImprovement=0,lastInference=0
  function branchChoice(domainOf,meta){
    if(!stats.dynamic)return null
    stats.branchRequests++
    if(meta.bestScore>lastBest||meta.bestScore===lastBest&&meta.bestCost<lastCost){lastBest=meta.bestScore;lastCost=meta.bestCost;lastImprovement=meta.nodes}
    const stalled=use.includes('stalled'),interval=model.inferenceInterval??1
    const due=stalled?meta.nodes-lastImprovement>=interval&&meta.nodes-lastInference>=interval:meta.nodes%interval===0
    if(!due||meta.remaining<1)return null
    lastInference=meta.nodes
    if(candidate)return {candidate:true}
    const old=session.inferenceCalls,domain=domainOf()
    const choice=infer(queryFeatures(domain.equipment,domain.servants,domain.context),stalled?'stalled':'branch')
    stats.branchInferences+=session.inferenceCalls-old
    if(stalled)stats.stalledInferences+=session.inferenceCalls-old
    return choice
  }
  return {
    stats,dynamic:stats.dynamic,
    upperBoundPolicy:active&&!candidate?Object.freeze({factor:root.profile.upperFactor}):null,
    score(kind,features){
      if(!active)return null
      stats.ranked++
      return candidate?head(kind,features):fixedQueryPriority(root.profile,kind,features)
    },
    portfolio(){
      if(!active||candidate||!(/budget|top[24]/.test(use)))return []
      const profiles=[root.profile]
      if(/top[24]/.test(use)&&root.ranks){
        const n=use.includes('top4')?4:2
        for(const i of root.ranks.slice(0,n))profiles.push(QUERY_PROFILES[i])
      }
      if(use.includes('budget')){
        const cap=Math.max(1,Math.round((servantFeatures[0]?.[14]??5/6)*6))
        const budget=queryContext.costLimit??cap*16
        for(const factor of [.55,.8,1.3,1.7]){
          const limit=Math.max(1,Math.round(budget*factor))
          const adjust=x=>{const y=x.slice();y[5]=y[4]*20/limit;y[13]=Math.log1p(limit)/5;return y}
          const choice=infer(queryFeatures(equipmentFeatures.map(adjust),servantFeatures.map(adjust),{...queryContext,costLimit:limit}),'budget')
          profiles.push(choice.profile)
        }
      }
      const unique=[...new Map(profiles.map(p=>[p.name,p])).values()]
      stats.portfolioProfiles=unique.length
      return unique.filter(p=>p.name!==root.profile.name)
    },
    branchPriority(domainOf,featuresOf,meta){
      const choice=branchChoice(domainOf,meta);if(!choice)return null
      const old=session.inferenceCalls,value=choice.candidate?head(meta.kind||'equipment',featuresOf()):fixedQueryPriority(choice.profile,meta.kind||'equipment',featuresOf())
      stats.branchInferences+=session.inferenceCalls-old
      if(use.includes('stalled'))stats.stalledInferences+=session.inferenceCalls-old
      return value
    },
    branchOrder(items,featuresOf,domainOf,meta){
      const choice=branchChoice(domainOf,meta);if(!choice)return items
      const old=session.inferenceCalls
      const result=items.map((item,index)=>({item,index,score:choice.candidate?head('servant',featuresOf(item)):fixedQueryPriority(choice.profile,'servant',featuresOf(item))}))
        .sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.item)
      stats.branchInferences+=session.inferenceCalls-old
      if(use.includes('stalled'))stats.stalledInferences+=session.inferenceCalls-old
      return result
    },
    order(items,featuresOf,kind='equipment'){
      if(!active)return items
      return items.map((item,index)=>({item,index,score:this.score(kind,featuresOf(item))??-Infinity}))
        .sort((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.item)
    },
    finish(){return {...stats,inferenceCalls:session.inferenceCalls,inferenceMs:session.inferenceMs,setupMs:performance.now()-started-stats.inferenceMs}},
  }
}
