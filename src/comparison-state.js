// Persist only physical compositions explicitly chosen by the user.
const fields = ['filled','isSupport','isGrand','svtId','svtArtKey','bondLv','bondCap','ceId','ceMlb',
  'ceBondId','ceBondMlb','ceRewardId','ceRewardMlb','portrait','supportKind']
export function comparisonSnapshot(plan = {}, name = '自选队伍') {
  return {name:String(name).slice(0,60),slots:Array.from({length:6},(_,i)=>{
    const source=(Array.isArray(plan.slots)?plan.slots:[]).find(s=>Number(s?.position)===i+1)||{}
    const slot={position:i+1,filled:false,isSupport:false,isGrand:false,svtId:0,svtArtKey:'',ceId:0,ceMlb:true,
      ceBondId:0,ceBondMlb:true,ceRewardId:0,ceRewardMlb:true,portrait:false,
      bondLv:0,bondCap:10,...Object.fromEntries(fields.filter(k=>source[k]!==undefined&&['boolean','string','number'].includes(typeof source[k])).map(k=>[k,source[k]]))}
    // System guest traits and class can affect conditional support equipment.
    if(slot.isSupport&&source.supportKind==='system'){
      slot.label=String(source.label||'系统助战');slot.className=String(source.className||'')
      slot.traitIds=(Array.isArray(source.traitIds)?source.traitIds:[]).filter(Number.isFinite)
    }
    return slot
  })}
}
export function comparisonSnapshots(plans) {
  return (Array.isArray(plans)?plans:[]).filter(p=>p&&Array.isArray(p.slots)).map((p,i)=>comparisonSnapshot(p,p.name||`队伍 ${i+1}`))
}
