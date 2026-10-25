import {settleParty} from '../party-state.js'
import {comparisonArtUrls} from './comparison-art.js'
import {ceImageUrls} from '../assets/ce-images.js'
import {scoreTeamProgressText} from './score-team-results.js'
import {evaluateBondCurve} from '../solver/bond-curve.js'
import {expandScoreTeamFamily} from '../solver/score-team-equivalence.js'
import {packedTeamOf,physicalVariantKey,memberPlacementKey} from '../solver/score-team-diversity.js'

const enc=new TextEncoder()
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const fields=[['ceId','ceMlb','普通'],['ceBondId','ceBondMlb','羁绊'],['ceRewardId','ceRewardMlb','报酬']]
export function createTeamReport(plans,options,meta={}){
  const servants=new Map(options.servants.map(s=>[s.id,s])),ces=new Map(options.ces.map(c=>[c.id,c]))
  return {format:'fgo-team-report',version:1,createdAt:new Date().toISOString(),queryContext:meta.queryContext||{},
    status:meta.status?scoreTeamProgressText(meta.status):'自选队伍 · 按导出时条件结算，未证明最优',
    scope:meta.scope||'当前队伍',teams:plans.map((p,i)=>{
      const settled=settleParty(p.slots,options)
      const exact=evaluateBondCurve(settled.curve,Number(options.base)||0,{teapot:options.teapot,preferIds:options.preferIds})
      return {name:p.name||`队伍 ${i+1}`,total:exact.total,cost:settled.costUsed,slots:settled.slots.map(s=>{
        const svt=servants.get(s.svtId)
        return {position:s.position,filled:!!s.filled,isSupport:!!s.isSupport,isGrand:!!s.isGrand,svtId:s.svtId||0,svtArtKey:s.svtArtKey||'',
          label:s.isSupport?(svt?.name?`助战 · ${svt.name}`:'助战'):s.label||String(s.svtId||''),formLabel:s.formLabel||'默认灵基',bondLv:s.bondLv||0,bondCap:s.bondCap||10,
          gain:exact.results.find(r=>r.position===s.position)?.final||0,
          artUrls:s.filled&&svt?comparisonArtUrls(svt,s.svtArtKey,options.region):[],
          equipment:fields.filter(([id])=>s.filled&&s[id]).map(([id,mlb,role])=>({id:s[id],role,mlb:s[mlb]!==false,name:ces.get(s[id])?.name||String(s[id]),artUrls:ceImageUrls(ces.get(s[id])||{id:s[id]})}))}
      })}
    })}
}
const conditionLines=r=>Object.entries(r.queryContext||{}).map(([key,value])=>`${({region:'区服',pool:'范围',quest:'关卡',bonus:'关卡加成',base:'基础羁绊',cost:'COST上限',version:'版本',deployment:'出战条件'})[key]||key}：${typeof value==='object'?JSON.stringify(value):value}`)
const equipmentText=s=>(s.equipment||[]).map(e=>`${e.role}：${e.name}（${e.mlb?'满破':'未满破'}）`).join('；')||'无礼装'
export function teamReportHtml(report,{standalone=false,pictures=[]}={}){
  const body=`<h1>FGO 羁绊配队档案</h1><p>${escape(report.scope)} · ${escape(report.createdAt)}</p><p>${escape(report.status)}</p><details open><summary>保存时条件</summary>${conditionLines(report).map(t=>`<p>${escape(t)}</p>`).join('')}</details>${report.teams.map((t,i)=>`<section class="saved-team"><h2>${escape(t.name)} · 总羁绊 ${Number(t.total)||0} · COST ${t.cost==null?'未保存':Number(t.cost)||0}</h2>${pictures[i]?`<img class="report-picture" src="${pictures[i]}" alt="${escape(t.name)}配队图" />`:''}<table><thead><tr><th>位置</th><th>从者 / 灵基</th><th>礼装 / 满破</th><th>羁绊</th></tr></thead><tbody>${t.slots.map(s=>`<tr><td>${s.position<=3?'前排':'后排'} ${Number(s.position)}${s.isGrand?' · 冠位':''}</td><td>${s.filled?`${escape(s.label)}<br>${escape(s.formLabel||'默认灵基')}`:'空位'}</td><td>${s.filled?escape(equipmentText(s)):'—'}</td><td>${s.gain==null?'未保存':Number(s.gain)||0}</td></tr>`).join('')}</tbody></table></section>`).join('')}`
  if(!standalone)return body
  const json=JSON.stringify(report).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FGO 羁绊配队档案</title><style>${reportCss}</style><main>${body}</main><script type="application/json" id="fgo-team-report">${json}</script></html>`
}
export const reportCss='body{font-family:system-ui,sans-serif;color:#18324d;background:#f0f4fa;margin:0;padding:24px}main{max-width:1040px;margin:auto}table{width:100%;border-collapse:collapse;font-size:14px}td,th{border:1px solid #ced8e7;padding:12px;text-align:left;overflow-wrap:anywhere}.saved-team{background:white;padding:20px;margin:24px 0;break-inside:avoid}h1{font-size:26px}h2{font-size:20px}.report-picture{width:100%;height:auto}details p{margin:6px 0}@media print{body{background:white;padding:0}.saved-team{break-before:page;box-shadow:none}.report-picture+table{display:none}}'
export function validateTeamReport(value){
  if(value?.format!=='fgo-team-report'||value.version!==1||!Array.isArray(value.teams)||!value.teams.length)throw Error('不是支持的队伍档案')
  for(const t of value.teams)if(!Array.isArray(t.slots)||t.slots.length>6||!Number.isFinite(t.total)||t.slots.some(s=>!Number.isInteger(s.position)||s.position<1||s.position>6||!Array.isArray(s.equipment)||s.equipment.some(e=>typeof e.name!=='string')))throw Error('队伍档案内容损坏')
  return value
}
export async function readTeamReport(file){
  const raw=await file.text()
  if(raw.trimStart().startsWith('<')){
    const node=new DOMParser().parseFromString(raw,'text/html').querySelector('script#fgo-team-report[type="application/json"]')
    if(!node)throw Error('HTML 中没有队伍档案数据')
    return validateTeamReport(JSON.parse(node.textContent))
  }
  return validateTeamReport(JSON.parse(raw))
}
export function downloadReport(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
}
async function loadPicture(urls,cache){
  const key=JSON.stringify(urls||[])
  if(!cache.has(key))cache.set(key,(async()=>{
    const deadline=performance.now()+3500
    for(const url of urls||[])try{
      const left=deadline-performance.now();if(left<=0)break
      const response=await fetch(url,{signal:AbortSignal.timeout(Math.max(1,Math.min(1200,Math.floor(left)))),credentials:'omit'})
      if(response.ok)return await createImageBitmap(await response.blob())
    }catch{}
    return null
  })())
  return cache.get(key)
}
function wrapped(ctx,text,x,y,width,lineHeight){
  let line=''
  for(const c of String(text)){if(ctx.measureText(line+c).width>width){ctx.fillText(line,x,y);y+=lineHeight;line=''}line+=c}
  ctx.fillText(line,x,y);return y+lineHeight
}
export async function renderTeamReportCanvas(report,team,index=0,cache=new Map()){
  await document.fonts?.ready
  const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754)
  ctx.fillStyle='#18324d';ctx.font='bold 34px system-ui,sans-serif';ctx.fillText('FGO 羁绊配队档案',48,65)
  ctx.font='bold 28px system-ui,sans-serif';ctx.fillText(`${team.name} · 总羁绊 ${team.total} · COST ${team.cost??'未保存'}`,48,112)
  ctx.font='20px system-ui,sans-serif'
  let y=wrapped(ctx,report.status,48,155,1144,28)
  for(const line of conditionLines(report).filter(t=>!t.startsWith('版本：')))y=wrapped(ctx,line,48,y+2,1144,26)
  y=Math.max(y+22,380)
  const height=Math.min(200,Math.floor((1630-y)/6))
  // Resolve independent images together, with bounded URL timeout and a
  // shared cache. Missing/CORS-blocked art leaves names and roles intact.
  const images=await Promise.all(team.slots.map(async s=>({art:await loadPicture(s.artUrls,cache),equipment:await Promise.all((s.equipment||[]).map(e=>loadPicture(e.artUrls,cache)))})))
  for(let at=0;at<team.slots.length;at++){
    const s=team.slots[at],picture=images[at],top=y+at*height
    ctx.fillStyle=at<3?'#eef4ff':'#f5f1fa';ctx.fillRect(40,top,1160,height-8)
    ctx.fillStyle='#18324d';ctx.font='bold 21px system-ui,sans-serif';ctx.fillText(`${s.position<=3?'前':'后'}排 ${s.position}${s.isGrand?' · 冠位':''}`,55,top+29)
    if(!s.filled){ctx.fillText('空位',190,top+70);continue}
    if(picture.art){const scale=Math.min(100/picture.art.width,(height-55)/picture.art.height);ctx.drawImage(picture.art,55,top+40,picture.art.width*scale,picture.art.height*scale)}
    ctx.font='bold 23px system-ui,sans-serif';wrapped(ctx,s.label,175,top+31,700,28)
    ctx.font='19px system-ui,sans-serif';ctx.fillText(`${s.formLabel} · ${s.bondLv==null?'羁绊等级未保存':`${s.bondLv}/${s.bondCap}绊`}`,175,top+62)
    ctx.fillText(`获取羁绊 ${s.gain??'未单独保存'}`,930,top+31)
    for(let j=0;j<s.equipment.length;j++){
      const e=s.equipment[j],x=175+j*320,img=picture.equipment[j]
      if(img)ctx.drawImage(img,x,top+78,52,58)
      ctx.font='18px system-ui,sans-serif';ctx.fillText(`${e.role} · ${e.mlb?'满破':'未满破'}`,x+60,top+96)
      wrapped(ctx,e.name,x+60,top+122,240,23)
    }
  }
  ctx.fillStyle='#52667e';ctx.font='17px system-ui,sans-serif';wrapped(ctx,`${report.createdAt} · ${report.scope} · ${index+1}/${report.teams.length} · 保存时分数；条件或账号变化后请重新核实`,48,1695,1144,24)
  return canvas
}
const bytesFromDataUrl=url=>Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0))
// PDF image pages avoid missing Chinese fonts and preserve the PNG layout.
// Offsets/stream lengths are measured as bytes, not UTF-16 string positions.
export function imagePagesPdf(pages){
  const parts=[enc.encode('%PDF-1.4\n')],offsets=[0];let length=parts[0].length
  const push=b=>{const data=typeof b==='string'?enc.encode(b):b;parts.push(data);length+=data.length}
  const object=(id,body)=>{offsets[id]=length;push(`${id} 0 obj\n`);for(const b of body)push(b);push('\nendobj\n')}
  object(1,['<< /Type /Catalog /Pages 2 0 R >>'])
  object(2,[`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`])
  pages.forEach((p,i)=>{
    const id=3+i*3,content='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q'
    object(id,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`])
    object(id+1,[`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`,p.bytes,'\nendstream'])
    object(id+2,[`<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream`])
  })
  const xref=length;push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`)
  for(let i=1;i<offsets.length;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`)
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts,{type:'application/pdf'})
}
// Stored ZIP entries are sufficient for small OOXML reports, avoiding a
// runtime CDN/dependency. ZIP is the DOCX container, not the delivered format.
function zip(files){
  const parts=[],central=[];let offset=0
  const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let j=0;j<8;j++)n=n&1?(n>>>1)^0xedb88320:n>>>1}return (n^0xffffffff)>>>0}
  for(const [name,value] of Object.entries(files)){
    const path=enc.encode(name),data=enc.encode(value),sum=crc(data),head=new Uint8Array(30+path.length),h=new DataView(head.buffer)
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,path.length,true);head.set(path,30)
    const dir=new Uint8Array(46+path.length),d=new DataView(dir.buffer)
    d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint16(14,33,true);d.setUint32(16,sum,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,path.length,true);d.setUint32(42,offset,true);dir.set(path,46)
    parts.push(head,data);central.push(dir);offset+=head.length+data.length
  }
  const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer)
  v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true)
  return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
}
export function teamReportDocx(report){
  const p=(text,bold=false)=>`<w:p><w:pPr><w:spacing w:after="100"/></w:pPr><w:r><w:rPr>${bold?'<w:b/>':''}<w:rFonts w:ascii="Calibri" w:eastAsia="Microsoft YaHei"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${escape(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')}</w:t></w:r></w:p>`
  const row=values=>`<w:tr>${values.map(t=>`<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${p(t)}</w:tc>`).join('')}</w:tr>`
  const body=report.teams.map((t,i)=>`${i?'<w:p><w:r><w:br w:type="page"/></w:r></w:p>':''}${p('FGO 羁绊配队档案',true)}${p(`${t.name} · 总羁绊 ${t.total} · COST ${t.cost??'未保存'}`,true)}${p(report.status)}${conditionLines(report).map(t=>p(t)).join('')}<w:tbl><w:tblPr><w:tblW w:w="9900" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:color="CED8E7"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1000"/><w:gridCol w:w="2600"/><w:gridCol w:w="5000"/><w:gridCol w:w="1300"/></w:tblGrid>${row(['位置','从者 / 灵基','礼装 / 满破','羁绊'])}${t.slots.map(s=>row([`${s.position<=3?'前排':'后排'} ${s.position}${s.isGrand?' 冠位':''}`,s.filled?`${s.label} / ${s.formLabel}`:'空位',s.filled?equipmentText(s):'—',String(s.gain??'未保存')])).join('')}</w:tbl>${p(`${report.createdAt} · ${report.scope} · 保存时条件与分数`)}`).join('')
  return zip({'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="700" w:right="700" w:bottom="700" w:left="700"/></w:sectPr></w:body></w:document>`})
}
export async function exportTeamReport(report,format){
  validateTeamReport(report)
  let blob
  if(format==='json')blob=new Blob([JSON.stringify(report)],{type:'application/json'})
  else if(format==='docx')blob=teamReportDocx(report)
  else{
    if(format==='png'&&report.teams.length>1)throw Error('图片导出请选择一支队伍；多支队伍可导出单个 PDF、Word 或 HTML 档案')
    const pictures=[],pages=[],cache=new Map()
    try{
      for(let i=0;i<report.teams.length;i++){
        const canvas=await renderTeamReportCanvas(report,report.teams[i],i,cache)
        if(format==='png')blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))
        else if(format==='html')pictures.push(canvas.toDataURL('image/png'))
        else if(format==='pdf')pages.push({width:canvas.width,height:canvas.height,bytes:bytesFromDataUrl(canvas.toDataURL('image/jpeg',0.94))})
        else throw Error('不支持的导出格式')
        canvas.width=canvas.height=0
      }
      if(format==='pdf')blob=imagePagesPdf(pages)
      if(format==='html')blob=new Blob([teamReportHtml(report,{standalone:true,pictures})],{type:'text/html;charset=utf-8'})
    }finally{for(const promise of cache.values()){const image=await promise;image?.close()}}
  }
  if(!blob)throw Error('无法生成导出文件')
  downloadReport(blob,`FGO-teams-${Date.now()}.${format}`)
  return blob
}
export function showTeamReport(report){
  const dialog=document.createElement('dialog');dialog.className='team-report-dialog';dialog.setAttribute('aria-label','已保存队伍档案')
  dialog.innerHTML=`<button type="button" data-report-close>关闭档案</button><p>显示保存时的队伍、条件和分数；无需搜索。条件变化后需重新核实。</p>${teamReportHtml(validateTeamReport(report))}`
  dialog.querySelector('[data-report-close]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal()
}
export async function* scoreArchiveLines(file){
  const reader=file.stream().getReader(),decoder=new TextDecoder();let pending=''
  try{while(true){const {done,value}=await reader.read();pending+=decoder.decode(value,{stream:!done});let end
    while((end=pending.indexOf('\n'))>=0){const line=pending.slice(0,end);pending=pending.slice(end+1);if(line.trim())yield JSON.parse(line)}
    if(done){if(pending.trim())yield JSON.parse(pending);break}
  }}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
export async function showScoreArchive(file,{servants=[],ces=[]}={}){
  const iterator=scoreArchiveLines(file),first=await iterator.next(),header=first.value
  if(header?.format!=='fgo-all-score-teams'||![1,2].includes(header.version)){await iterator.return();throw Error('不是支持的完整方案档案')}
  const dialog=document.createElement('dialog');dialog.className='team-report-dialog';dialog.setAttribute('aria-label','完整方案档案')
  dialog.innerHTML='<button data-report-close>关闭档案</button><h1>完整方案档案</h1><p data-archive-status></p><label>导出所选队伍 <select data-archive-format><option value="json">JSON 档案</option><option value="html">单文件 HTML</option><option value="png">PNG 图片</option><option value="pdf">PDF</option><option value="docx">Word DOCX</option></select></label><div data-archive-page></div><button data-archive-next>读取下一页</button>'
  dialog.querySelector('[data-archive-status]').textContent=scoreTeamProgressText({...header,imported:true})+' · 显示保存时结果，不重新搜索；合并组内的替换目录仍保留在文件中。'
  const svts=new Map(servants.map(s=>[s.id,s])),equips=new Map(ces.map(c=>[c.id,c]));let count=0,closed=false,generation=0,entries=[]
  const convert=(r,name)=>({name,total:r.total??r.score,cost:r.cost??null,slots:(r.slots||[]).map(s=>({...s,label:s.label||(s.isSupport?'助战':svts.get(s.svtId)?.name||String(s.svtId)),equipment:fields.filter(([id])=>s[id]).map(([id,mlb,role])=>({id:s[id],role,mlb:s[mlb]!==false,name:equips.get(s[id])?.name||String(s[id]),artUrls:ceImageUrls(equips.get(s[id])||{id:s[id]})}))}))})
  const next=dialog.querySelector('[data-archive-next]'),page=dialog.querySelector('[data-archive-page]')
  const report=teams=>({format:'fgo-team-report',version:1,scope:'保存时的同分方案',createdAt:header.createdAt||'',status:scoreTeamProgressText(header),queryContext:header.queryContext,teams})
  function card(entry,index){
    return `<div data-archive-entry="${index}">${teamReportHtml(report([entry.team]))}${entry.raw.family?`<button data-archive-variant="equipment" data-archive-index="${index}">从者不变，换礼装</button><button data-archive-variant="all" data-archive-index="${index}">其他从者／礼装组合</button>`:''}<button data-archive-save="${index}">导出当前这支队伍</button><p data-archive-variant-status role="status">${escape(entry.notice||'')}</p></div>`
  }
  page.onclick=async event=>{
    const button=event.target.closest('[data-archive-variant],[data-archive-save]');if(!button)return
    const index=Number(button.dataset.archiveIndex??button.dataset.archiveSave),entry=entries[index],version=generation
    if(!entry)return
    const block=button.closest('[data-archive-entry]'),hint=block.querySelector('[data-archive-variant-status]')
    for(const b of block.querySelectorAll('button'))b.disabled=true
    try{
      if(button.dataset.archiveSave!=null){await exportTeamReport(report([entry.team]),dialog.querySelector('[data-archive-format]').value);hint.textContent='已导出当前所选从者与礼装';return}
      const mode=button.dataset.archiveVariant,current=packedTeamOf(entry.raw.slots),key=mode+':'+(mode==='equipment'?memberPlacementKey(current):'')
      if(entry.cursors.get(mode)?.key!==key)entry.cursors.set(mode,{key,iterator:expandScoreTeamFamily({score:entry.raw.score,domain:entry.raw.family.domain,packed:entry.raw.family.packed},header.equivalenceCatalogs?.[entry.raw.family.domain],{fixedMembers:mode==='equipment'?current:null,cooperative:true})})
      const variants=entry.cursors.get(mode).iterator;hint.textContent='正在读取档案中的同分组合…'
      for(const value of variants){
        if(closed||generation!==version)return
        if(value.type==='tick'){await new Promise(r=>setTimeout(r,0));continue}
        if(physicalVariantKey(value.packed.slots)===physicalVariantKey(current)||mode==='equipment'&&memberPlacementKey(value.packed.slots)!==memberPlacementKey(current))continue
        const old=new Map(entry.raw.slots.filter(s=>s.filled).map(s=>[s.svtId,s])),region=header.queryContext?.region==='日服'?'JP':'CN'
        entry.raw={...entry.raw,slots:packedTeamOf(value.packed.slots).map(s=>({position:s.p,filled:!!s.f,isSupport:!!s.s,isGrand:!!s.g,svtId:s.svt,svtArtKey:s.art,
          label:s.s?'助战':svts.get(s.svt)?.name||old.get(s.svt)?.label||String(s.svt),formLabel:((!s.art&&['','default','d'].includes(old.get(s.svt)?.svtArtKey||'')||s.art===old.get(s.svt)?.svtArtKey)&&old.get(s.svt)?.formLabel)||svts.get(s.svt)?.forms?.find(f=>f.key===(s.art||'default'))?.name||s.art||'默认灵基',
          bondLv:old.get(s.svt)?.bondLv??null,bondCap:old.get(s.svt)?.bondCap??null,gain:null,artUrls:comparisonArtUrls(svts.get(s.svt),s.art,region),
          ceId:s.ce,ceMlb:s.mlb,ceBondId:s.bond,ceBondMlb:s.bondMlb,ceRewardId:s.reward,ceRewardMlb:s.rewardMlb}))}
        entry.team=convert(entry.raw,entry.team.name);entry.notice='已读取同分替换，保存时总分与 COST 不变；此替换的逐位收益未单独保存。未启动搜索。'
        block.outerHTML=card(entry,index);return
      }
      hint.textContent='本组对应组合已浏览完，可查看其他方案组。'
    }catch(error){hint.textContent='读取或导出失败：'+error.message}
    finally{for(const b of block.querySelectorAll('button'))b.disabled=false}
  }
  async function readPage(){
    next.disabled=true;generation++;entries=[]
    const add=r=>{const name=`${r.classification==='selected'?'当前保存队伍':r.classification==='other'?'途中其他':'最高分'} · 方案 ${++count}`;entries.push({raw:r,team:convert(r,name),cursors:new Map()})}
    try{
      const firstPage=!count
      if(firstPage&&header.selectedTeam)add({...header.selectedTeam,classification:'selected'})
      if(firstPage&&header.feasiblePreview&&(!header.selectedTeam||physicalVariantKey(header.selectedTeam)!==physicalVariantKey(header.feasiblePreview)))add({...header.feasiblePreview,cost:header.feasiblePreview.cost??header.feasiblePreview.costUsed??null})
      while(entries.length<64&&!closed){const line=await iterator.next();if(line.done){next.hidden=true;break}add(line.value)}
      if(!closed)page.innerHTML=entries.length?entries.map(card).join(''):'<p>已读完全部已保存队伍。</p>'
    }catch(error){page.textContent='档案读取失败：'+error.message;next.hidden=true}
    finally{next.disabled=false}
  }
  next.onclick=readPage;dialog.querySelector('[data-report-close]').onclick=()=>dialog.close()
  dialog.onclose=()=>{closed=true;generation++;iterator.return();dialog.remove()};document.body.append(dialog);dialog.showModal();await readPage()
}
