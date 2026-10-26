import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {mkdir,readFile} from 'node:fs/promises'
import {chromium} from 'playwright'
const server=spawn('python3',['-m','http.server','5197','--bind','127.0.0.1'],{stdio:'ignore'}),out='ui-checks/team-reports'
let browser
try{
  await mkdir(out,{recursive:true})
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:5197/index.html')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  browser=await chromium.launch({executablePath:process.env.FGO_BROWSER_EXECUTABLE||undefined})
  const page=await browser.newPage({viewport:{width:1240,height:1000}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.route(/https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort())
  // Use a CORS-safe raster image, so the downloaded PNG/PDF tests exercise
  // actual image embedding rather than DOM screenshots or external links.
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')
  await page.route('**/__report_art.png',r=>r.fulfill({contentType:'image/png',body:png}))
  await page.goto('http://127.0.0.1:5197/index.html');await page.locator('#recommendNow').waitFor()
  assert.equal(await page.locator('#teamReportFile').count(),1)
  await page.locator('#work-tab-team').click()
  assert.equal(await page.locator('[data-team-export="current"]').count(),1)
  await page.locator('[data-team-export-format="current"]').selectOption('json')
  await page.locator('#work-tab-conditions').click()
  await page.locator('#work-tab-team').click()
  assert.equal(await page.locator('[data-team-export-format="current"]').inputValue(),'json','Export format survives a planner rerender')
  const currentDownload=page.waitForEvent('download');await page.locator('[data-team-export="current"]').click()
  await(await currentDownload).saveAs(`${out}/current.json`)
  assert.equal(JSON.parse(await readFile(`${out}/current.json`,'utf8')).format,'fgo-team-report')
  // Build a small public synthetic report through the production settlement.
  await page.evaluate(async()=>{
    const m=await import('./src/ui/team-report.js')
    const servants=[{id:1,name:'合成从者甲',className:'saber',cost:3,rarity:1,traitIds:[]},{id:2,name:'合成从者乙',className:'saber',cost:3,rarity:1,traitIds:[]}]
    const slots=Array.from({length:6},(_,i)=>({position:i+1,filled:i<2,svtId:i<2?i+1:0,bondLv:1,bondCap:10}))
    const report=m.createTeamReport([{name:'测试队伍',slots}],{servants,ces:[],base:815,region:'CN'},{queryContext:{base:815,cost:116,quest:'合成关卡'},status:{bestScore:1956,maximumProven:true,complete:false,bestCount:1},scope:'当前推荐队伍'})
    for(const s of report.teams[0].slots)s.artUrls=['http://127.0.0.1:5197/__report_art.png']
    window.reportFixture=report
  })
  for(const format of ['json','html','png','pdf','docx']){
    const wait=page.waitForEvent('download')
    await page.evaluate(async format=>{await(await import('./src/ui/team-report.js')).exportTeamReport(window.reportFixture,format)},format)
    const download=await wait;await download.saveAs(`${out}/single.${format}`)
  }
  const html=await readFile(`${out}/single.html`,'utf8')
  assert.match(html,/data:image\/png;base64/);assert.match(html,/最高分已证明，正在补全/)
  const offline=await browser.newPage();let external=0
  await offline.route('**/*',r=>{external++;return r.abort()})
  await offline.setContent(html);await offline.waitForFunction(()=>document.querySelector('.report-picture')?.complete)
  assert.ok(await offline.locator('.report-picture').evaluate(img=>img.naturalWidth>0))
  assert.match(await offline.locator('body').innerText(),/总羁绊 1956/);assert.equal(external,0,'HTML is a single offline file')
  await offline.screenshot({path:`${out}/offline-html.png`,fullPage:true})
  await page.locator('#teamReportFile').setInputFiles(`${out}/single.html`)
  await page.locator('.team-report-dialog').waitFor();assert.match(await page.locator('.team-report-dialog').innerText(),/1956/)
  await page.locator('[data-report-close]').click()
  // Multi-team reports remain one PDF/DOCX, with no ZIP download/top-N cap.
  await page.evaluate(()=>{window.reportFixture.teams.push({...window.reportFixture.teams[0],name:'第二队伍'})})
  for(const format of ['pdf','docx']){
    const wait=page.waitForEvent('download');await page.evaluate(async format=>{await(await import('./src/ui/team-report.js')).exportTeamReport(window.reportFixture,format)},format)
    await(await wait).saveAs(`${out}/multiple.${format}`)
  }
  const check=spawnSync('python3',['-c',String.raw`
import zipfile,xml.etree.ElementTree as E,pathlib,re
p=pathlib.Path('ui-checks/team-reports')
for name in ['single','multiple']:
 with zipfile.ZipFile(p/(name+'.docx')) as z:
  assert z.testzip() is None
  root=E.fromstring(z.read('word/document.xml'))
  text=''.join(root.itertext())
  assert '1956' in text and '合成从者甲' in text
  if name=='multiple': assert '第二队伍' in text
 data=(p/(name+'.pdf')).read_bytes()
 assert data.startswith(b'%PDF-1.4') and data.endswith(b'%%EOF\n')
 xref=int(re.search(rb'startxref\n(\d+)',data).group(1));assert data[xref:xref+4]==b'xref'
 assert b'/Count '+(b'1' if name=='single' else b'2') in data
 assert b'/DCTDecode' in data
assert (p/'single.png').read_bytes().startswith(b'\x89PNG')
`],{encoding:'utf8'})
  assert.equal(check.status,0,check.stderr)
  // Streaming read includes both pages and the tail; no search Worker exists
  // in this fresh account-free viewer session.
  const lines=[{format:'fgo-all-score-teams',version:2,bestScore:1956,bestCount:70,complete:false,maximumProven:true},...Array.from({length:70},()=>({classification:'best',total:1956,cost:6,slots:[{position:1,filled:true,svtId:1,label:'归档成员'}]}))]
  await page.locator('#teamReportFile').setInputFiles({name:'archive.jsonl',mimeType:'application/x-ndjson',buffer:Buffer.from(lines.map(l=>JSON.stringify(l)).join('\n'))})
  await page.locator('.team-report-dialog .saved-team').last().waitFor();assert.equal(await page.locator('.team-report-dialog .saved-team').count(),64)
  await page.locator('[data-archive-next]').click();await page.waitForFunction(()=>document.querySelectorAll('.team-report-dialog .saved-team').length===6)
  assert.match(await page.locator('.team-report-dialog').innerText(),/方案 70/);await page.locator('[data-report-close]').click()
  for(const width of [320,390,834,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`Export controls fit width ${width}`)}
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({passed:true,formats:['HTML offline','PNG','PDF','DOCX','JSON','JSONL archive viewer'],multiPage:true,score:1956,archiveRecords:70}))
}finally{await browser?.close();server.kill()}
