import { readFileSync,writeFileSync } from 'node:fs'
const folder='experiments/ai-general',meta=JSON.parse(readFileSync(folder+'/reports/calibration.json'))
if(meta.status!=='complete'||meta.errors.length)throw Error('Complete, error-free calibration is required')
const rows=readFileSync(folder+'/data/calibration-runs.jsonl','utf8').trim().split('\n').map(JSON.parse)
if(rows.length!==meta.n)throw Error('Incomplete calibration rows')
const sum=a=>a.reduce((a,b)=>a+b,0),q=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]
const off=rows.map(r=>r.offMs),families=[...new Set(rows.map(r=>r.family))],candidates=[]
for(const minRawStock of [5,7,9,11])for(const minGroups of [3,4,5,6])for(const gain of [.1,.2,.35,.55,.8])for(const work of [500,2000,10000,50000]){
 const gate={enabled:true,modelVersion:meta.model,minRawStock,minGroups,logGain:Math.log1p(gain),minLogWork:Math.log1p(work)}
 const on=rows.map(r=>{
  if(r.rawStock<minRawStock)return r.offMs
  const p=r.prediction
  return p&&p.policy>0&&p.groups>=minGroups&&p.logGain>=gate.logGain&&p.logWork>=gate.minLogWork?r.onMs:r.rejectMs
 })
 const active=rows.filter(r=>{const p=r.prediction;return r.rawStock>=minRawStock&&p&&p.policy>0&&p.groups>=minGroups&&p.logGain>=gate.logGain&&p.logWork>=gate.minLogWork}).length
 const ratio=sum(on)/sum(off)
 if(active<20||ratio>.98)continue
 const cohorts=families.map(f=>{const ids=rows.map((r,i)=>r.family===f?i:-1).filter(i=>i>=0),a=ids.map(i=>on[i]),b=ids.map(i=>off[i]);return {family:f,ratio:sum(a)/sum(b),p95Ratio:q(a,.95)/q(b,.95)}})
 if(cohorts.some(c=>c.ratio>1.01||c.p95Ratio>1.03))continue
 candidates.push({gate,active,ratio,on,cohorts})
}
candidates.sort((a,b)=>a.ratio-b.ratio)
const best=candidates[0],report={status:'complete',model:meta.model,source:'Calibration only; validation/test untouched for threshold choice',gridCount:4*4*5*4,eligible:candidates.length}
if(best){
 let s=18761;const rand=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296},ratios=[]
 for(let b=0;b<2000;b++){let a=0,z=0;for(let j=0;j<rows.length;j++){const i=Math.floor(rand()*rows.length);a+=best.on[i];z+=off[i]}ratios.push(a/z)}
 const ci=[q(ratios,.025),q(ratios,.975)],pass=ci[1]<1
 const gate={...best.gate,enabled:pass,qualification:'calibration-only',bootstrap95:ci,calibrationRatio:best.ratio}
 writeFileSync(folder+'/models/gate.json',JSON.stringify(gate,null,2)+'\n',{flush:true})
 report.selection={gate,active:best.active,cohorts:best.cohorts};report.passed=pass
}else{
 const gate={enabled:false,modelVersion:meta.model,minRawStock:0,minGroups:0,logGain:1e9,minLogWork:1e9,qualification:'no-calibrated-net-benefit'}
 writeFileSync(folder+'/models/gate.json',JSON.stringify(gate,null,2)+'\n',{flush:true});report.passed=false;report.selection={gate}
}
writeFileSync(folder+'/reports/gate-calibration.json',JSON.stringify(report,null,2)+'\n',{flush:true});console.log(JSON.stringify(report,null,2))
