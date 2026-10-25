import { ceImageUrls } from '../assets/ce-images.js'
import { normalizedForm } from '../party-state.js'

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const unique=urls=>[...new Set(urls.filter(Boolean))]

// Use only artwork for the selected form. In particular, a missing costume
// image must not silently become another costume or the base ascension.
export function comparisonArtUrls(svt,formKey='',region='CN',nice=null){
 if(!svt)return []
 const key=normalizedForm(formKey),kind=key.startsWith('c')?'costume':'ascension',raw=key==='default'?'3':key.slice(1)
 const form=svt.forms?.find(f=>f.key===key),assets=nice?.extraAssets||svt.extraAssets||{}
 const urls=[assets.charaGraph?.[kind]?.[raw],assets.narrowFigure?.[kind]?.[raw],assets.faces?.[kind]?.[raw],form?.face]
 if(kind==='ascension')for(const code of region==='JP'?['JP','CN']:['CN','JP'])urls.push(`https://static.atlasacademy.io/${code}/Faces/f_${Number(svt.id)}${raw}.png`)
 return unique(urls)
}

function picture(urls,alt,extra=''){
 const [first,...rest]=urls
 return `<span class="comparison-art-frame"><img ${first?`src="${esc(first)}"`:'hidden'} alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-img="comparison" data-fallbacks="${esc(rest.join('|'))}" ${extra} onerror="window.handleAtlasImgError&&window.handleAtlasImgError(this)" /><span class="comparison-art-missing" aria-hidden="true">暂无图片</span></span>`
}

export function renderComparisonServant(slot,options,label=''){
 if(!slot?.filled)return '空位'
 const svt=(options.servants||[]).find(s=>Number(s.id)===Number(slot.svtId))
 const text=label||(slot.isSupport?'助战':`${svt?.name||slot.label||'未选择从者'} · ${slot.formLabel||'默认'}`)
 if(!svt)return `<span class="comparison-selected-label">${esc(text)}</span>`
 const form=normalizedForm(slot.svtArtKey),region=options.region||'CN'
 return `<figure class="comparison-selected comparison-servant">${picture(comparisonArtUrls(svt,form,region),text,
  `data-comparison-svt="${Number(svt.id)}" data-comparison-form="${esc(form)}" data-comparison-region="${esc(region)}"`)}<figcaption>${esc(text)}${slot.isGrand?'<span class="comparison-art-tag">冠位</span>':''}</figcaption></figure>`
}

export function renderComparisonEquipment(slot,options){
 if(!slot?.filled)return '—'
 const fields=[['ceId','普通','ceMlb'],...(!slot.isSupport&&(slot.isGrand||slot.ceBondId)?[['ceBondId','羁绊','ceBondMlb']]:[]),...(slot.isGrand||slot.ceRewardId?[['ceRewardId','报酬','ceRewardMlb']]:[])]
 const cards=fields.filter(([field])=>slot[field]).map(([field,role,mlb])=>{
  const ce=(options.ces||[]).find(c=>Number(c.id)===Number(slot[field])),name=ce?.name||String(slot[field])
  return `<figure class="comparison-selected comparison-equipment" data-comparison-ce="${Number(slot[field])}" data-comparison-role="${field}">${picture(ce?ceImageUrls(ce):[],name)}<figcaption><strong>${role} · ${slot[mlb]===false?'未满破':'满破'}</strong><span>${esc(name)}</span></figcaption></figure>`
 })
 return cards.length?`<div class="comparison-equipment-list">${cards.join('')}</div>`:'无礼装'
}

// Artwork loads independently of search/settlement. Detached nodes from an
// earlier edit/region are never updated by a late network response.
export async function hydrateComparisonArt(root,{fetchNice,region='CN'}={}){
 if(!fetchNice)return
 const images=[...root.querySelectorAll('[data-comparison-svt]')],pending=new Map()
 await Promise.allSettled(images.map(async img=>{
  const id=Number(img.dataset.comparisonSvt),form=img.dataset.comparisonForm,selectedRegion=img.dataset.comparisonRegion||region,key=selectedRegion+':'+id
  if(!pending.has(key))pending.set(key,fetchNice(id,selectedRegion))
  const nice=await pending.get(key)
  if(!nice||!img.isConnected||Number(img.dataset.comparisonSvt)!==id||img.dataset.comparisonForm!==form||img.dataset.comparisonRegion!==selectedRegion)return
  const urls=comparisonArtUrls(nice,form,selectedRegion,nice)
  if(!urls.length)return
  img.dataset.fallbacks=urls.slice(1).join('|');delete img.dataset.errSrc
  img.style.display='';img.hidden=false;img.src=urls[0]
 }))
}
