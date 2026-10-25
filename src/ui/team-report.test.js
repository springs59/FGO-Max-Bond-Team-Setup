import assert from 'node:assert/strict'
import {writeFile,mkdir} from 'node:fs/promises'
import {createTeamReport,teamReportHtml,teamReportDocx,validateTeamReport,scoreArchiveLines} from './team-report.js'
import {scoreTeamTabLabel} from './score-team-results.js'
const options={servants:[{id:1,name:'合成从者<&>',className:'saber',cost:3,rarity:1,traitIds:[]}],ces:[],base:815,region:'CN'}
const source={name:'自选 <script>alert(1)</script>',total:999999,slots:Array.from({length:6},(_,i)=>({position:i+1,filled:i===0,svtId:i===0?1:0,bondLv:1,bondCap:10}))}
const report=createTeamReport([source],options,{queryContext:{base:815,cost:116,quest:'合成关卡'},status:{maximumProven:true,bestScore:978,bestCount:0,complete:false},scope:'当前推荐队伍'})
assert.equal(report.teams[0].total,978,'The saved score is literal settlement, never an unverified stale total')
assert.equal(report.teams[0].slots[0].gain,978)
assert.match(report.status,/最高分已证明，正在补全/)
const html=teamReportHtml(report,{standalone:true})
assert.ok(!html.includes('<script>alert'));assert.match(html,/\\u003cscript/)
assert.match(html,/&lt;script&gt;/);assert.match(html,/总羁绊 978/)
assert.deepEqual(validateTeamReport(JSON.parse(JSON.stringify(report))),report)
assert.throws(()=>validateTeamReport({format:'other'}))
assert.equal(scoreTeamTabLabel({maximumProven:true,complete:false},true,true),'最高分已证明 · 补全同分中')
assert.notEqual(scoreTeamTabLabel(null,false,true),'已完成')
assert.equal(scoreTeamTabLabel({complete:true},false,true),'全部完成')
assert.equal(scoreTeamTabLabel({stopped:true},false,true),'已停止 · 部分结果')
const lines=[];for await(const line of scoreArchiveLines(new Blob(['{"format":"fgo-all-score-teams"}\n',...Array.from({length:137},(_,i)=>JSON.stringify({total:i,label:'中文'})+'\n')])))lines.push(line)
assert.equal(lines.length,138);assert.equal(lines.at(-1).total,136)
const docx=teamReportDocx(report);assert.equal(docx.type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
const bytes=new Uint8Array(await docx.arrayBuffer());assert.deepEqual([...bytes.slice(0,4)],[80,75,3,4])
if(process.env.FGO_REPORT_FIXTURES){await mkdir(process.env.FGO_REPORT_FIXTURES,{recursive:true});await writeFile(process.env.FGO_REPORT_FIXTURES+'/report.docx',bytes);await writeFile(process.env.FGO_REPORT_FIXTURES+'/report.json',JSON.stringify(report))}
console.log('Team reports: literal scores, snapshot roundtrip, escaping, status stages, streaming archives beyond one page and real DOCX package passed')
