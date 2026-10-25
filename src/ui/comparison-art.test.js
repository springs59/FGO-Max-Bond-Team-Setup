import assert from 'node:assert/strict'
import {comparisonArtUrls,renderComparisonServant,renderComparisonEquipment,hydrateComparisonArt} from './comparison-art.js'
import {handleImgError} from './image-loader.js'

const svt={id:1,name:'S<1>',forms:[{key:'c10',name:'另一灵衣'}]}
const nice={...svt,extraAssets:{charaGraph:{ascension:{1:'/asc1.png',3:'/asc3.png'},costume:{10:'/costume10.png'}}}}
assert.equal(comparisonArtUrls(svt,'default','CN',nice)[0],'/asc3.png')
assert.equal(comparisonArtUrls(svt,'a1','JP',nice)[0],'/asc1.png')
assert.deepEqual(comparisonArtUrls(svt,'c10','CN',nice),['/costume10.png'])
assert.deepEqual(comparisonArtUrls(svt,'c99','CN',nice),[],'A missing costume must not show a different form')
const slot={position:1,filled:true,svtId:1,svtArtKey:'c10',isGrand:true,ceId:101,ceMlb:false,ceRewardId:102,ceRewardMlb:true}
const opts={servants:[svt],ces:[{id:101,name:'A<CE>',face:'/ce101.png'},{id:102,name:'B',face:'/ce102.png'}],region:'JP'}
const html=renderComparisonServant(slot,opts,'S<1> · 另一灵衣')
assert.match(html,/data-comparison-form="c10"/);assert.match(html,/S&lt;1&gt;/);assert.match(html,/data-comparison-region="JP"/)
const ce=renderComparisonEquipment(slot,opts)
assert.match(ce,/data-comparison-role="ceRewardId"/);assert.match(ce,/普通 · 未满破/);assert.match(ce,/报酬 · 满破/);assert.doesNotMatch(ce,/>A<CE>/)
assert.equal(renderComparisonServant({...slot,filled:false},opts),'空位')
assert.doesNotMatch(renderComparisonServant({filled:true,isSupport:true,svtId:0},opts),/<img/)

const img=(form,region='CN')=>({dataset:{comparisonSvt:'1',comparisonForm:form,comparisonRegion:region},isConnected:true,style:{},hidden:true,src:''})
let resolve,calls=0
const first=img('a1'),costume=img('c10'),late=img('a1'),detached=img('a1'),changedId=img('a1')
const pending=new Promise(r=>resolve=r)
const operation=hydrateComparisonArt({querySelectorAll:()=>[first,costume,late,detached,changedId]},{fetchNice:()=>{calls++;return pending}})
late.dataset.comparisonForm='c99';detached.isConnected=false;changedId.dataset.comparisonSvt='2'
resolve(nice);await operation
assert.equal(calls,1,'One cached request can hydrate different forms of the same servant')
assert.equal(first.src,'/asc1.png');assert.equal(costume.src,'/costume10.png');assert.equal(first.hidden,false)
assert.equal(late.src,'');assert.equal(detached.src,'');assert.equal(changedId.src,'','Late results never replace a newly selected identity')
await assert.doesNotReject(hydrateComparisonArt({querySelectorAll:()=>[img('a1')]},{fetchNice:async()=>{throw Error('offline')}}))
const fallback={tagName:'IMG',currentSrc:'/failed.png',src:'/failed.png',dataset:{img:'comparison',fallbacks:'/working.png'},style:{},hidden:false}
assert.equal(handleImgError(fallback),true);assert.equal(fallback.src,'/working.png')
assert.equal(handleImgError(fallback),false);assert.equal(fallback.hidden,false,'Capturing and inline error handlers must not hide a pending fallback')
fallback.currentSrc='/working.png'
assert.equal(handleImgError(fallback),false);assert.equal(fallback.hidden,true,'The text placeholder appears only after all image URLs fail')
console.log('Comparison artwork: selected ascension/costume, CE role/MLB, safe labels, request sharing, offline fallback and stale response isolation passed')
