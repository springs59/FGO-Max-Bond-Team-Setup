import {comparisonSnapshot,savedComparisonReport} from '../comparison-state.js'
import {settleParty} from '../party-state.js'
import {createTeamReport} from './team-report.js'
import {comparisonIssues} from './comparison-workspace.js'

// Capture one selected physical team, never the account/catalog/search archive.
export function captureComparisonTeam(plan,name,options,meta={}){
  const physical=comparisonSnapshot(plan,name)
  const live={...plan,name,slots:physical.slots};delete live.savedReport
  const report=createTeamReport([live],options,meta),team=report.teams[0],settled=settleParty(physical.slots,options)
  const conditional=new Set(team.grandRecommendation?.candidates.map(c=>c.svtId)||[])
  const warnings=comparisonIssues(physical,options).filter(message=>!message.endsWith('尚未登记为冠位')||!physical.slots.some(s=>conditional.has(s.svtId)&&message.startsWith(s.label||options.servants.find(v=>v.id===s.svtId)?.name||'\0')))
  for(const s of team.slots){
    const without=settleParty(physical.slots.map(v=>v.position===s.position?{...v,filled:false}:v),options)
    s.contribution=settled.output.results.filter(r=>r.position!==s.position).reduce((n,r)=>n+r.final-(without.output.results.find(x=>x.position===r.position)?.final||0),0)
    s.bonusLines=settled.output.results.find(r=>r.position===s.position)?.lines||[]
  }
  physical.savedReport=savedComparisonReport({...team,capturedAt:report.createdAt,issues:warnings})
  return physical
}

export function comparisonEntryKey(plan){
  return JSON.stringify([plan.slots,plan.savedReport?.queryContext,plan.savedReport?.grandRecommendation,plan.savedReport?.total])
}
