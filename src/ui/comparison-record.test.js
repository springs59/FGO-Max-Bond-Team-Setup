import assert from 'node:assert/strict'
import {captureComparisonTeam,comparisonEntryKey} from './comparison-record.js'
import {copyComparisonTeam,editComparisonSlot,swapComparisonSlots} from './comparison-workspace.js'
import {createTeamReport,teamReportHtml,teamReportDocx,renderTeamReportCanvas,validateTeamReport} from './team-report.js'
import {comparePartyRows} from './team-comparison.js'
import {plannerFromState,applyPlanner} from '../user-data.js'
import {settleParty} from '../party-state.js'

const servants=[{id:1,name:'剑队从者',className:'saber',cost:1,rarity:5,traitIds:[1]},
 {id:2,name:'弓队从者',className:'archer',cost:2,rarity:4,traitIds:[2]}]
const ces=[{id:101,name:'保存时礼装',cost:2,skills:[0,4].map(condLimitCount=>({condLimitCount,funcs:[{target:'ptFull',rate:200,add:0,tvals:[]}]}))}]
const opts={servants,ces,mode:'free',region:'CN',base:1000,teapot:false,bond15Aura:true,costLimit:116,quest:{id:11,name:'冠位剑',eventId:99},questType:'grand',questClass:'saber'}
const plan=id=>({slots:[{position:1,filled:true,isGrand:true,svtId:id,bondLv:5,bondCap:10,ceId:101,ceMlb:true}]})
const ctx=(quest,base,settings='茶壶关')=>({quest,base,cost:116,region:'国服',配队设置:settings})
const live={extraPassives:[{servantId:1,eventId:99,skillId:1,name:'活动期间加成',target:'self',rate:.5,startedAt:0,endedAt:9999999999}]}
const sword=captureComparisonTeam(plan(1),'剑队',{...opts,bondBonuses:live},{queryContext:ctx('冠位剑',1000)})
assert.equal(sword.savedReport.total,2040)
assert.equal(sword.savedReport.slots[0].gain,2040)
const bow=captureComparisonTeam(plan(2),'弓队',{...opts,base:2000,teapot:true,quest:{id:22,name:'冠位弓'},questClass:'archer'},
 {queryContext:ctx('冠位弓',2000,'茶壶开'),status:{maximumProven:true,bestScore:5760,complete:false}})
assert.equal(bow.savedReport.total,5760)
const current={...opts,mode:'account',region:'JP',base:9999,teapot:false,quest:{id:33,name:'当前其他副本'},questClass:'caster',
 servants:servants.map(s=>({...s,name:'当前新名字',cost:99})),ces:ces.map(c=>({...c,name:'当前礼装',cost:100})),account:{servants:[{id:1,bondLv:15,bondCap:15}],ces:[]},bondBonuses:null}
const restored=applyPlanner({},JSON.parse(JSON.stringify(plannerFromState({comparisonTeams:[sword,bow]})))).comparisonTeams
assert.deepEqual(restored,[sword,bow])
const report=createTeamReport(restored,current,{queryContext:ctx('当前其他副本',9999),scope:'全部对比队伍'})
assert.deepEqual(report.teams.map(t=>t.total),[2040,5760])
assert.deepEqual(report.teams.map(t=>t.queryContext.quest),['冠位剑','冠位弓'])
assert.deepEqual(report.teams.map(t=>t.queryContext.base),[1000,2000])
assert.equal(report.teams[0].slots[0].equipment[0].name,'保存时礼装')
assert.equal(report.teams[0].slots[0].label,'剑队从者')
assert.equal(report.teams[0].slots[0].bondLv,5)
assert.equal(report.teams[0].cost,3)
assert.deepEqual(validateTeamReport(JSON.parse(JSON.stringify(report))),report)
assert.deepEqual(comparePartyRows(restored,current).find(r=>r.label==='总羁绊').values,['2040','5760'])
assert.deepEqual(comparePartyRows(restored,current).find(r=>r.label==='保存时关卡').values,['冠位剑','冠位弓'])
const html=teamReportHtml(report,{standalone:true})
assert.match(html,/关卡：冠位剑/);assert.match(html,/关卡：冠位弓/);assert.doesNotMatch(html,/当前其他副本|当前新名字|当前礼装/)
const doc=Buffer.from(await teamReportDocx(report).arrayBuffer()).toString()
assert.match(doc,/关卡：冠位剑/);assert.match(doc,/关卡：冠位弓/);assert.doesNotMatch(doc,/当前其他副本/)
const samePartyOtherQuest=captureComparisonTeam(plan(1),'另一副本',opts,{queryContext:ctx('另一个副本',1000)})
assert.notEqual(comparisonEntryKey(sword),comparisonEntryKey(samePartyOtherQuest),'Same physical party in another quest is a separate saved result')
assert.equal(comparisonEntryKey(sword),comparisonEntryKey(copyComparisonTeam(sword,'更名')))
const copied=copyComparisonTeam(sword,'副本')
copied.savedReport.slots[0].equipment[0].name='修改副本'
assert.equal(sword.savedReport.slots[0].equipment[0].name,'保存时礼装')
const edited=captureComparisonTeam(editComparisonSlot(sword,1,{ceId:0}),sword.name,{...opts,base:500},{queryContext:ctx('编辑后的关卡',500)})
assert.equal(edited.savedReport.total,600)
assert.equal(edited.savedReport.queryContext.quest,'编辑后的关卡')
assert.equal(sword.savedReport.total,2040)
const moved=captureComparisonTeam(swapComparisonSlots(sword,1,4),sword.name,opts,{queryContext:ctx('冠位剑',1000)})
assert.equal(moved.savedReport.total,1200)
const conditionalOpts={...opts,mode:'account',account:{servants:[{id:1,bondLv:5,bondCap:10,isGrand:false},{id:2,bondLv:5,bondCap:10,isGrand:true}],ces:[{id:101,count:1,mlbCount:1}]}}
const conditional=captureComparisonTeam(plan(1),'待选冠位',conditionalOpts,{queryContext:ctx('冠位剑',1000)})
assert.equal(conditional.savedReport.grandRecommendation.requiresSelection,true)
assert.ok(!conditional.savedReport.issues.some(s=>s.endsWith('尚未登记为冠位')))
assert.match(createTeamReport([conditional],{...conditionalOpts,account:{...conditionalOpts.account,servants:conditionalOpts.account.servants.map(s=>({...s,isGrand:true}))}}).teams[0].queryContext.冠位选择条件,/需先选择冠位/)
const withHugeData={...sword,allPlans:Array(10000).fill({large:'unused'}),savedReport:{...sword.savedReport,account:{huge:Array(10000).fill('private')},catalog:Array(10000).fill({})}}
assert.ok(JSON.stringify(plannerFromState({comparisonTeams:[withHugeData]})).length<20000,'Persistence contains selected teams and frozen output, not accounts/catalogs/archives')
const legacy=copyComparisonTeam(plan(1))
assert.equal(createTeamReport([legacy],opts).teams[0].total,settleParty(legacy.slots,opts).total)
assert.match(comparePartyRows([legacy],opts).find(r=>r.label==='保存时关卡').values[0],/未保存原条件/)

// PDF/PNG/HTML rendering must print each team's own conditions and leave room
// for all six slots, even when the saved header spans multiple lines.
const printed=[],canvas={width:0,height:0,getContext:()=>context},context={font:'',fillRect(){},fillText:t=>printed.push(String(t)),measureText:t=>({width:String(t).length*12}),drawImage(){}}
globalThis.document={fonts:{ready:Promise.resolve()},createElement:()=>canvas}
globalThis.fetch=async()=>({ok:false})
await renderTeamReportCanvas(report,report.teams[0])
assert.ok(printed.some(t=>t.includes('关卡：冠位剑')));assert.ok(!printed.some(t=>t.includes('冠位弓')||t.includes('当前其他副本')))
printed.length=0
const long={...report.teams[1],queryContext:{...report.teams[1].queryContext,说明:'完整保存条件'.repeat(300)}}
await renderTeamReportCanvas(report,long,1)
assert.ok(canvas.height>1754);assert.ok(printed.some(t=>t.includes('关卡：冠位弓')))
assert.ok(printed.some(t=>t.includes('后排 6')))
console.log('Per-team snapshots: mixed quests/bases/teapot, expired effects, ownership/data changes, exact slot gains, independent copy/edit, persistence/dedup, Grand prerequisites and HTML/JSON/Word/PNG/PDF context passed')
