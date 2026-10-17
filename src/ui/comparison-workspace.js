import { settleParty, normalizedForm } from '../party-state.js'
import { servantBondForms, formUnlocked } from '../recommend.js'
import { accountServantOf } from '../account.js'
import { comparisonSnapshot } from '../comparison-state.js'
import { matchRosterForm } from '../filter.js'
import { searchServantForms, searchByName } from '../atlas.js'
import { questPartyRules, minimumOwnCount, availableSystemSupports } from '../quest-party-rules.js'

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
// Only user-selected physical teams are copied. No solver state, catalog,
// recommendation pool or arrays of interchangeable members enter the workspace.
export function copyComparisonTeam(plan = {}, name = '自选队伍') {
  return comparisonSnapshot(plan,name)
}

export function editComparisonSlot(team, position, patch) {
  return {...team,slots:team.slots.map(s=>{
    if(s.position!==position)return patch.isSupport===true?{...s,isSupport:false}:s
    return {...s,...patch,...(patch.isSupport===true?{svtId:0,svtArtKey:'',bondLv:0,ceBondId:0,portrait:false,supportKind:'friend',traitIds:[],className:'',label:'助战'}:{}),
      ...(patch.isGrand===false?{ceBondId:0,ceRewardId:0}:{}),
      ...(patch.svtId!==undefined?{isSupport:false,supportKind:''}:{}),position}
  })}
}

export function swapComparisonSlots(team, from, to) {
  if(from===to||!team.slots.some(s=>s.position===to))return team
  return {...team,slots:team.slots.map(s=>s.position===from?{...s,position:to}:s.position===to?{...s,position:from}:s).sort((a,b)=>a.position-b.position)}
}

export function comparisonIssues(team, options) {
  const settled=settleParty(team.slots,options),issues=[],own=settled.slots.filter(s=>s.filled&&!s.isSupport)
  const support=settled.slots.filter(s=>s.filled&&s.isSupport),rules=questPartyRules(options.quest)
  const seen=new Set(),servants=new Map((options.servants||[]).map(s=>[Number(s.id),s]))
  const ces=new Map((options.ces||[]).map(c=>[Number(c.id),c])),used=new Map()
  if(!Number.isSafeInteger(options.base)||options.base<0)issues.push('请先设置有效的基础羁绊')
  if(!settled.ok)issues.push(settled.output.error||'当前编队无法结算')
  if(support.length>1)issues.push('最多只能编入一名助战')
  if(rules.noSupport&&support.length)issues.push('当前关卡不允许助战')
  if(rules.requiresSupport&&!support.length)issues.push('当前关卡必须编入助战')
  if(options.allowSupport===false&&support.length)issues.push('当前条件已关闭助战')
  if(rules.supportPolicy==='system'||support.some(s=>s.supportKind==='system')){
    const available=availableSystemSupports(options.quest||{},options.account)
    if(support.some(s=>s.supportKind!=='system'||!available.some(npc=>Number(npc.svtId)===Number(s.svtId)&&
      Number(npc.equips?.[0]?.ceId||0)===Number(s.ceId||0)&&(!s.ceId||Boolean(npc.equips?.[0]?.ceMlb)===(s.ceMlb!==false)))))issues.push('系统助战不符合当前关卡的固定从者或礼装')
  }
  if((options.quest?.restrictions||[]).some(r=>(r.restriction||r).type==='fixedSupportPosition')&&support.some(s=>s.position!==rules.supportPosition))issues.push(`助战必须位于位置 ${rules.supportPosition}`)
  if(!rules.supported)issues.push('当前关卡含尚未支持的编队限制，无法确认队伍合法性')
  if(own.length<Math.max(1,minimumOwnCount(rules,!!support.length)))issues.push('己方上场人数不足')
  if(rules.partyCount&&own.length+support.length<rules.partyCount)issues.push('当前关卡要求编满队伍')
  if(options.costLimit!==''&&options.costLimit!=null&&settled.costUsed>Number(options.costLimit))issues.push(`COST ${settled.costUsed} 超过上限 ${options.costLimit}`)
  for(const s of own){
    const svt=servants.get(Number(s.svtId)),rec=accountServantOf(options.account,s.svtId)
    if(!svt){issues.push(`位置 ${s.position} 尚未选择有效从者`);continue}
    if(seen.has(Number(s.svtId)))issues.push(`${svt.name} 重复上场（不同灵基仍属同一从者）`)
    seen.add(Number(s.svtId))
    const form=servantBondForms(svt).find(f=>f.key===normalizedForm(s.svtArtKey))
    if(!form)issues.push(`${svt.name} 的灵基无效`)
    if(options.mode==='account'&&!options.account?.virtual&&!rec)issues.push(`当前账号未持有 ${svt.name}`)
    if(form&&!formUnlocked(form,rec,options.mode))issues.push(`${svt.name} 的灵基尚未解锁`)
    if(form&&!matchRosterForm(svt,form,options.filter))issues.push(`${svt.name} 不符合当前从者筛选条件`)
    const allowed=options.questClass==='extra1'?['ruler','avenger','moonCancer','shielder']:
      options.questClass==='extra2'?['alterEgo','foreigner','pretender','beast','unBeast','beastEresh','unBeastOlgaMarie']:
      options.questClass?[options.questClass]:null
    if(allowed&&!allowed.includes(s.className))issues.push(`${svt.name} 不符合当前职阶限制`)
    if(!s.isGrand&&(s.ceBondId||s.ceRewardId))issues.push(`位置 ${s.position} 的额外礼装需要冠位编成`)
    if(s.isGrand&&options.questType!=='grand')issues.push(`位置 ${s.position} 的冠位编成不适用于当前关卡`)
    if(s.isGrand&&options.mode==='account'&&!options.account?.virtual&&!rec?.isGrand)issues.push(`${svt.name} 尚未登记为冠位`)
    for(const [field,mlbField] of [['ceId','ceMlb'],['ceBondId','ceBondMlb'],['ceRewardId','ceRewardMlb']]){
      const id=Number(s[field]);if(!id)continue
      const ce=ces.get(id)
      if(!ce){issues.push(`位置 ${s.position} 的礼装不存在于当前图鉴`);continue}
      if(field==='ceBondId'&&Number(ce.bondEquipOwner)!==Number(s.svtId))issues.push(`位置 ${s.position} 的羁绊礼装不属于该从者`)
      const count=used.get(id)||{total:0,mlb:0};count.total++;if(s[mlbField]!==false)count.mlb++;used.set(id,count)
    }
  }
  if(own.filter(s=>s.isGrand).length>1)issues.push('只能编入一名己方冠位从者')
  for(const [id,n] of used)if(options.mode==='account'&&!options.account?.virtual){
    const rec=(options.account?.ces||[]).find(c=>Number(c.id)===id),count=Number(rec?.count)||Number(!!rec)
    const mlb=Math.min(count,rec?.mlbCount==null?(rec?.mlb?count:0):Number(rec.mlbCount)||0)
    if(n.total>count||n.mlb>mlb||n.total-n.mlb>count-mlb)issues.push(`${ces.get(id)?.name||id} 超出持有数量或满破数量`)
  }
  for(const id of options.requiredIds||[])if(!seen.has(Number(id)))issues.push(`缺少锁定从者 ${servants.get(Number(id))?.name||id}`)
  for(const pin of options.slotPins||[]){
    const s=settled.slots.find(s=>s.position===pin.position)
    if(pin.empty&&s?.filled)issues.push(`位置 ${pin.position} 已锁定为空`)
    else if(pin.svtId&&(!s?.filled||s.isSupport||Number(s.svtId)!==Number(pin.svtId)))issues.push(`位置 ${pin.position} 不符合从者锁定`)
    for(const key of ['ceId','ceBondId','ceRewardId'])if(pin[key]&&(!s?.filled||Number(s[key])!==Number(pin[key])))issues.push(`位置 ${pin.position} 不符合礼装锁定`)
  }
  return [...new Set(issues)]
}

export function renderComparisonEditor(team, index, options, search = {}) {
  if(!team)return ''
  const settled=settleParty(team.slots,options),issues=comparisonIssues(team,options)
  const servants=new Map(options.servants.map(s=>[Number(s.id),s])),ces=new Map(options.ces.map(c=>[Number(c.id),c]))
  const lookup=(slot,kind,field)=>{
    const active=search.position===slot.position&&search.field===field,query=active?search.query:''
    const current=kind==='svt'?servants.get(Number(slot.svtId)):ces.get(Number(slot[field]))
    let hits=[]
    if(query){
      const pool=kind==='svt'?options.servants:options.ces
      const owned=options.mode==='account'&&!options.account?.virtual&&!slot.isSupport
        ?new Set(((kind==='svt'?options.account?.servants:options.account?.ces)||[]).map(s=>Number(s.id))):null
      const available=owned?pool.filter(s=>owned.has(Number(s.id))):pool
      hits=(kind==='svt'?searchServantForms(available,query):searchByName(available,query,c=>`${c.collectionNo} ${c.id} ${c.name}`)).slice(0,12)
      const exact=available.find(item=>String(item.id)===query.trim())
      if(exact&&!hits.some(item=>item.id===exact.id))hits=[exact,...hits].slice(0,12)
    }
    return `<div class="search"><label>${kind==='svt'?'从者':field==='ceBondId'?'羁绊礼装':field==='ceRewardId'?'报酬礼装':'礼装'}<input data-comparison-query="${slot.position}" data-field="${field}" value="${esc(active?query:current?.name||'')}" placeholder="搜名字 / 编号" autocomplete="off" /></label>
      ${hits.length?`<div class="suggest">${hits.map(item=>`<button type="button" class="suggest-item" data-comparison-pick="${slot.position}" data-field="${field}" data-id="${item.id}" data-form="${esc(item.formKey||item.artKey||'')}">${esc(item.name)}${item.formLabel?` · ${esc(item.formLabel)}`:''}</button>`).join('')}</div>`:''}
      <button type="button" data-comparison-clear-slot="${slot.position}" data-field="${field}">${kind==='svt'?'清空从者':'卸下礼装'}</button></div>`
  }
  return `<section class="comparison-editor" aria-label="编辑对比队伍"><div class="panel-heading"><h3>编辑队伍 ${index+1}</h3><button type="button" data-comparison-done>收起编辑</button></div>
    <label>队伍名称<input data-comparison-name maxlength="60" value="${esc(team.name)}" /></label>
    <p class="comparison-live" role="status">总羁绊 ${settled.total} · COST ${settled.costUsed} · ${issues.length?'请处理下方编队提示':'符合已检查的编队条件'}</p>
    ${issues.length?`<ul class="comparison-issues">${issues.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}
    <div class="comparison-editor-grid">${settled.slots.map(s=>{
      const svt=servants.get(Number(s.svtId)),rec=accountServantOf(options.account,s.svtId)
      const forms=svt?servantBondForms(svt).filter(f=>formUnlocked(f,rec,options.mode)):[]
      const toggle=(key,label)=>`<label class="check"><input type="checkbox" data-comparison-field="${s.position}" data-field="${key}" ${s[key]!==false&&(key==='ceMlb'||s[key])?'checked':''} />${label}</label>`
      const result=settled.output.results.find(r=>r.position===s.position)
      return `<article class="comparison-slot" data-comparison-position="${s.position}"><h4>${s.position<=3?'前排':'后排'} ${s.position} · ${result?.final||0} 羁绊</h4>
        <div class="toggles">${toggle('filled','上场')}${toggle('isSupport','助战')}${toggle('ceMlb','礼装满破')}${options.questType==='grand'?toggle('isGrand','冠位'):''}</div>
        ${s.isSupport?'<p>助战位 · 不获取羁绊</p>':lookup(s,'svt','svtId')}
        ${!s.isSupport&&forms.length?`<label>灵基 / 灵衣<select data-comparison-field="${s.position}" data-field="svtArtKey">${forms.map(f=>`<option value="${esc(f.key)}" ${normalizedForm(s.svtArtKey)===f.key?'selected':''}>${esc(f.name||f.key)}</option>`).join('')}</select></label>`:''}
        ${lookup(s,'ce','ceId')}
        ${s.isGrand&&!s.isSupport?lookup(s,'ce','ceBondId'):''}${s.isGrand?lookup(s,'ce','ceRewardId'):''}
        ${s.isGrand?`<div class="toggles">${!s.isSupport?toggle('ceBondMlb','羁绊礼装满破'):''}${toggle('ceRewardMlb','报酬礼装满破')}</div>`:''}
        ${!s.isSupport?`<div class="bond-row"><label>羁绊<input inputmode="numeric" type="number" min="0" max="16" data-comparison-field="${s.position}" data-field="bondLv" value="${s.bondLv||0}" ${options.mode==='account'?'disabled':''} /></label><label>上限<input inputmode="numeric" type="number" min="1" max="16" data-comparison-field="${s.position}" data-field="bondCap" value="${s.bondCap||10}" ${options.mode==='account'?'disabled':''} /></label></div>`:''}
        <label>交换站位<select data-comparison-swap="${s.position}"><option value="${s.position}">当前位置</option>${[1,2,3,4,5,6].filter(p=>p!==s.position).map(p=>`<option value="${p}">与位置 ${p} 交换</option>`).join('')}</select></label>
      </article>`
    }).join('')}</div></section>`
}
