import {expandScoreTeamFamily} from './score-team-equivalence.js'
import {distinctMemberTeams,physicalVariantKey} from './score-team-diversity.js'

// Membership in a lossless family can be checked with at most six role
// assignments. This avoids storing an expanded-key history for previews.
function belongsToFamily(record,family,catalog){
  if(!family.packed.equivalence||!catalog)return false
  const actual=record.packed.slots,source=family.packed.slots,art=s=>!s.art||s.art==='default'||s.art==='d'?'':s.art
  const matches=(a,b)=>{
    if(!!a.f!==!!b.f)return false
    if(!a.f)return true
    if(!!a.s!==!!b.s||!!a.g!==!!b.g)return false
    if(a.s){if(a.svt!==b.svt||art(a)!==art(b))return false}
    else if(!catalog.rows[a.rg]?.some(r=>r.svt===b.svt&&(!r.art||r.art==='default'?'':r.art)===art(b)))return false
    for(const [f,m] of [['bond','bondMlb'],['reward','rewardMlb']])if((a[f]||0)!==(b[f]||0)||a[f]&&(a[m]!==false)!==(b[m]!==false))return false
    return a.cg>=0?(a.s?catalog.supportCes:catalog.ownCes)[a.cg]?.some(c=>c.id===b.ce&&c.mlb===(b.mlb!==false)):!b.ce
  }
  return catalog.seatGroups.every(group=>{
    const taken=new Set()
    function visit(at){
      if(at===group.length)return true
      for(const p of group)if(!taken.has(p)&&matches(source[p-1],actual[group[at]-1])){taken.add(p);if(visit(at+1))return true;taken.delete(p)}
      return false
    }
    return visit(0)
  })
}

// Read one family/page at a time. The cursor survives an empty partial tail,
// so a later click can read newly collected families without restarting.
export function createVariantCursor(job,{mode,score,kind,fixedMembers,asFamily}){
  const cursor={offset:0,previewSeen:false,iterator:null,buffered:null,checked:0,previewSignature:null,warmKeys:new Set()}
  const signature=(r,c)=>r.packed.equivalence&&c?JSON.stringify([r.domain,c.seatGroups.map(group=>group.map(p=>{
    const s=r.packed.slots[p-1]
    return JSON.stringify(s.f?[s.s||0,s.g||0,s.s?s.svt||0:s.rg,s.cg??-1,s.bond||0,s.bondMlb!==false,s.reward||0,s.rewardMlb!==false]:[])
  }).sort())]):null
  function* expand(record,ref,preview=false){
    const catalog=job.query.equivalenceCatalogs[record.domain],family=asFamily(record,catalog)
    const familySignature=signature(family,catalog)
    if(!preview&&familySignature&&familySignature===cursor.previewSignature)return
    if(preview){cursor.previewSignature=familySignature;cursor.warmKeys.add(physicalVariantKey(record.packed.slots))}
    const variants=mode==='members'?distinctMemberTeams(family,catalog):expandScoreTeamFamily(family,catalog,{fixedMembers,cooperative:true})
    for(const variant of variants){if(variant.type==='tick')yield variant;else if(preview||!cursor.warmKeys.has(physicalVariantKey(variant.packed.slots)))yield {record:variant,ref}}
    if(preview){
      if(mode!=='equipment')for(const variant of job.query.memberAlternatives?.(record)||[]){if(variant.type==='tick')yield variant;else if(!belongsToFamily(variant,family,catalog)){cursor.warmKeys.add(physicalVariantKey(variant.packed.slots));yield {record:variant,ref}}}
      if(mode!=='members')for(const variant of job.query.equipmentAlternatives?.(record)||[]){if(variant.type==='tick')yield variant;else if(!belongsToFamily(variant,family,catalog)){cursor.warmKeys.add(physicalVariantKey(variant.packed.slots));yield {record:variant,ref}}}
    }
  }
  async function* stream(){
    if(!cursor.previewSeen){
      cursor.previewSeen=true
      if(kind==='best'&&!job.store.stats(job.query.state.bestScore).bestCount&&job.previewRecord?.score===score)
        yield* expand(job.previewRecord,{preview:true,score},true)
    }
    while(true){
      const stats=job.store.stats(job.query.state.bestScore),count=kind==='best'?stats.bestCount:stats.otherCount
      if(cursor.offset>=count)return
      const page=await job.store.page({bestScore:job.query.state.bestScore,kind,offset:cursor.offset})
      if(!page.records.length)throw Error('同分方案分页缺失，请刷新本页')
      for(const record of page.records){
        const offset=cursor.offset++
        yield {type:'tick'}
        if(record.score===score)yield* expand(record,{kind,offset,index:0,score})
      }
    }
  }
  cursor.next=async()=>{
    if(cursor.buffered){const value=cursor.buffered;cursor.buffered=null;return {done:false,value}}
    cursor.iterator??=stream()
    const next=await cursor.iterator.next();if(next.done)cursor.iterator=null
    return next
  }
  return cursor
}
