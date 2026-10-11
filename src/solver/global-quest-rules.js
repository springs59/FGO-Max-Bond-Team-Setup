// Rules are applied to the full identity/form domain before equivalence pruning.
export function compileGlobalQuestRules(quest={}) {
  const flags=quest.flags||[],unsupported=[]
  let layouts=[1,2],ownMin=1,ownMax=6,totalMin=1,totalMax=6,supportPosition=0
  if(quest.noSupport||flags.includes('eventDeckNoSupport')||(flags.includes('noSupportList')&&!quest.npcSupportCount))layouts=[0]
  if(flags.includes('supportOnlyBattle'))unsupported.push('全队固定助战')
  if(flags.includes('supportSvtMultipleSet'))unsupported.push('多个剧情 NPC 的同时编队规则')
  if(flags.includes('supportOnlyForceBattle')||quest.supportServants?.some(s=>s.required)||(flags.includes('noSupportList')&&quest.npcSupportCount))unsupported.push('强制系统助战；不能替换为任意好友礼装')
  for(const row of quest.restrictions||[]) {
    const r=row.restriction||row,v=Number(r.targetVals?.[0])
    if(['mySvtNum','svtNum'].includes(r.type)&&r.targetVals?.length===1&&['equal','below','above'].includes(r.rangeType)&&Number.isInteger(v)&&v>=1&&v<=6){
      if(r.type==='mySvtNum'&&r.rangeType==='equal'&&v===6){layouts=[0];ownMax=6;continue}
      if(r.type==='mySvtNum'){if(r.rangeType!=='below')ownMin=Math.max(ownMin,v);if(r.rangeType!=='above')ownMax=Math.min(ownMax,v)}
      else {if(r.rangeType!=='below')totalMin=Math.max(totalMin,v);if(r.rangeType!=='above')totalMax=Math.min(totalMax,v)}
    }else if(r.type==='fixedSupportPosition'&&r.targetVals?.length===1&&v>=1&&v<=6){supportPosition=v;layouts=[v<=3?2:1]}
    else if(r.type==='supportOnly'&&!r.targetVals?.length)layouts=[supportPosition<=3?2:1]
    else unsupported.push(r.name||`${r.type}:${r.rangeType}`)
  }
  return {layouts,ownMin,ownMax,totalMin,totalMax,supportPosition,requireFront:true,unsupported,supported:!unsupported.length,friendOnly:Boolean(quest.npcSupportCount)}
}

export function globalClassMatches(className,questClass) {
  if(questClass==='extra1')return ['ruler','avenger','moonCancer','shielder'].includes(className)
  if(questClass==='extra2')return ['alterEgo','foreigner','pretender','beast','unBeast','beastEresh','unBeastOlgaMarie'].includes(className)
  return !questClass||className===questClass
}

export function restrictGlobalQuestSource(source,rules) {
  const ids=source.rows.map((r,i)=>i).filter(i=>globalClassMatches(source.rows[i].className,rules.questClass))
  const project=g=>({...g,rates:ids.map(i=>g.rates[i]),...(g.parts?{parts:g.parts.map(project)}:{})})
  const merge=groups=>{
    const map=new Map()
    for(const g of groups){const key=JSON.stringify([g.rates,g.flat,g.kind,g.items[0]?.rewardEligible]);if(!map.has(key))map.set(key,{...g,items:[]});map.get(key).items.push(...g.items)}
    return [...map.values()].map(g=>({...g,items:g.items.sort((a,b)=>a.cost-b.cost||a.id-b.id)}))
  }
  const rows=ids.map(i=>source.rows[i]),groups=merge(source.groups.map(project)),singles=source.supports.map(project)
  let supports=singles
  if(rules.grand){
    // Effect-equivalent pairs share one actual loadout witness. Own and friend
    // inventories are independent; within one friend two identities differ.
    const seen=new Set(),out=[]
    const put=s=>{const key=JSON.stringify([s.rates,s.flat,s.equipmentCount]);if(!seen.has(key)){seen.add(key);out.push(s)}}
    for(const g of singles)put({...g,equipmentCount:g.items.length?1:0,parts:[g]})
    for(let a=1;a<singles.length;a++)for(let b=a;b<singles.length;b++){
      const A=singles[a],B=singles[b],x=A.items[0],y=B.items.find(i=>i.id!==x.id)
      if(!y||!y.rewardEligible)continue
      const pa={...A,items:[x],slot:'通常槽'},pb={...B,items:[y],slot:'免费报酬槽'}
      put({rates:A.rates.map((r,i)=>r+B.rates[i]),flat:A.flat+B.flat,kind:'composite',items:[x,y],equipmentCount:2,parts:[pa,pb]})
    }
    supports=out
  }
  return {...source,rows,groups,supports,rules,identities:new Set(rows.map(r=>r.id)).size,forms:rows.length}
}
