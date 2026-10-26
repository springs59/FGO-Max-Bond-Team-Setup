// Persist only physical compositions explicitly chosen by the user.
const fields = ['filled','isSupport','isGrand','svtId','svtArtKey','bondLv','bondCap','ceId','ceMlb',
  'ceBondId','ceBondMlb','ceRewardId','ceRewardMlb','portrait','supportKind']
const text=(v,n=2000)=>String(v??'').slice(0,n)
const urls=v=>(Array.isArray(v)?v:[]).filter(s=>typeof s==='string'&&/^https?:\/\//.test(s)).slice(0,12).map(s=>s.slice(0,2048))
export function savedComparisonReport(value){
  if(!value||!Number.isSafeInteger(value.total)||value.total<0||!Array.isArray(value.slots)||value.slots.length!==6)return null
  if(new Set(value.slots.map(s=>s?.position)).size!==6||value.slots.some(s=>!Number.isInteger(s?.position)||s.position<1||s.position>6))return null
  const queryContext=Object.fromEntries(Object.entries(value.queryContext||{}).slice(0,32).map(([k,v])=>[text(k,80),typeof v==='number'||typeof v==='boolean'?v:text(typeof v==='string'?v:JSON.stringify(v),8192)]))
  const out={name:text(value.name,120),total:value.total,cost:Number(value.cost)||0,queryContext,status:text(value.status),capturedAt:text(value.capturedAt,40),
    issues:(Array.isArray(value.issues)?value.issues:[]).slice(0,64).map(s=>text(s,500)),slots:value.slots.map(s=>({
      position:s.position,filled:!!s.filled,isSupport:!!s.isSupport,isGrand:!!s.isGrand,svtId:Number(s.svtId)||0,svtArtKey:text(s.svtArtKey,80),
      label:text(s.label,200),formLabel:text(s.formLabel,200),bondLv:Number(s.bondLv)||0,bondCap:Number(s.bondCap)||10,
      gain:Number.isFinite(s.gain)?s.gain:null,contribution:Number.isFinite(s.contribution)?s.contribution:null,artUrls:urls(s.artUrls),
      bonusLines:(Array.isArray(s.bonusLines)?s.bonusLines:[]).slice(0,64).map(l=>({label:text(l.label,300),pct:Number(l.pct)||0})),
      equipment:(Array.isArray(s.equipment)?s.equipment:[]).slice(0,3).map(e=>({id:Number(e.id)||0,role:text(e.role,20),mlb:e.mlb!==false,name:text(e.name,300),artUrls:urls(e.artUrls)}))
    }))}
  if(value.grandRecommendation?.requiresSelection)out.grandRecommendation={requiresSelection:true,text:text(value.grandRecommendation.text),candidates:(value.grandRecommendation.candidates||[]).slice(0,6).map(c=>({svtId:Number(c.svtId)||0,position:Number(c.position)||0,name:text(c.name,200)}))}
  return out
}
export function comparisonSnapshot(plan = {}, name = '自选队伍') {
  const savedReport=savedComparisonReport(plan.savedReport)
  return {name:String(name).slice(0,60),...(savedReport?{savedReport}:{}),slots:Array.from({length:6},(_,i)=>{
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
