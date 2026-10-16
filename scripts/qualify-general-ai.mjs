import { readFileSync,writeFileSync } from 'node:fs'
const folder='experiments/ai-general',split=process.env.FGO_GENERAL_SPLIT||'validation',meta=JSON.parse(readFileSync(folder+'/reports/'+split+'.json')),audit=JSON.parse(readFileSync(folder+'/reports/split-audit.json'))
if(meta.status!=='complete'||meta.errors.length||audit.status!=='complete')throw Error('Complete integrity-checked evaluation required')
const rows=readFileSync(folder+'/data/'+split+'-runs.jsonl','utf8').trim().split('\n').map(JSON.parse)
const q=(a,p)=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]
let state=88201;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
const ratios=[],boundRatios=[]
for(let b=0;b<2000;b++){
 let a=0,z=0,bound=0;for(let j=0;j<rows.length;j++){const r=rows[Math.floor(rand()*rows.length)];a+=r.onMs;z+=r.offMs;bound+=r.boundMs}ratios.push(a/z);boundRatios.push(a/bound)
}
const ci=[q(ratios,.025),q(ratios,.975)],boundCI=[q(boundRatios,.025),q(boundRatios,.975)]
const checks={exactParity:meta.summary.exactParity,structuralAndNearIsolation:audit.violations.length===0,
 netAtLeast2PercentFaster:meta.summary.ratio<=.98,bootstrapUpperBelowOne:ci[1]<1,
 fasterThanAlwaysBoundControl:meta.summary.onSumMs<meta.summary.boundSumMs,boundControlBootstrapUpperBelowOne:boundCI[1]<1,
 noFamilyTotalRegressionOver1Percent:Object.values(meta.summary.cohorts).every(c=>c.ratio<=1.01),
 noFamilyP95RegressionOver3Percent:Object.values(meta.summary.cohorts).every(c=>c.onP95<=c.offP95*1.03),zeroQueryDiskWrites:meta.ordinaryQueryDiskWrites===0,
 activeExamples:meta.summary.active>=30}
const report={schema:3,split,model:meta.model,checks,passed:Object.values(checks).every(Boolean),bootstrap95:ci,ratio:meta.summary.ratio,boundControlRatio:meta.summary.onSumMs/meta.summary.boundSumMs,boundControlBootstrap95:boundCI,
 scope:'Offline exact inventory solver; user-visible full query and device validation still required before software integration. Timing includes AI extraction/inference and all exact bound/order costs.'}
writeFileSync(folder+'/reports/'+split+'-qualification.json',JSON.stringify(report,null,2)+'\n',{flush:true});console.log(JSON.stringify(report,null,2))
