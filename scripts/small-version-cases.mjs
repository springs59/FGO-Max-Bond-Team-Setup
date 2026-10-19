import {wideCases,publicDomain} from './performance-wide-cases.mjs'
import {createHash} from 'node:crypto'
import {servantBondForms} from '../src/recommend.js'
const labels={
 'request-CN-30-false':'国服小账号／COST 95',
 'request-CN-240-false':'国服大账号／COST 95',
 'request-JP-Infinity-false':'日服全候选／COST 95',
 'random-31':'复杂混合光环与礼装',
 'special-0':'无助战',
 'special-1':'严格6人＋锁定空位（冲突）',
 'special-3':'助战固定前排',
 'special-6':'锁定前后排从者',
 'special-9':'活动自身与全队加成',
 'boundary-3':'零基数＋固定值礼装',
}
export function smallVersionCases(){
 const all=wideCases(),out=Object.keys(labels).map(id=>({...all.find(c=>c.id===id),label:labels[id]}))
 const capacity=structuredClone(out.find(c=>c.id==='special-0').opts)
 capacity.slotPins=[{position:5,empty:true}]
 out.push({id:'capacity-empty',label:'禁止助战／允许空位',kind:'worker',opts:capacity})
 const opts=publicDomain('CN',12,6,2)
 opts.costLimit=40;opts.minimumOwn=2;opts.requiredIds=opts.servants.slice(0,2).map(s=>s.id)
 opts.requiredSeats={[opts.requiredIds[0]]:'front',[opts.requiredIds[1]]:'back'}
 opts.fixedPositions={[opts.requiredIds[0]]:1,[opts.requiredIds[1]]:4};opts.emptyPositions=[5]
 out.push({id:'limited-mlb-pins',label:'COST 40／满破份数／必选及空位',kind:'core',opts})
 const s={id:990001,name:'预算不足测试',cost:16,traitIds:[]}
 out.push({id:'infeasible',label:'预算不足无解',kind:'core',opts:{servants:[s],ownCes:[],supportCes:[],
  forms:{[s.id]:[{key:'default',cost:16,traitIds:[]}]},states:{},bonuses:{},base:815,costLimit:0,
  layouts:[6,3],minimumOwn:1,requiredIds:[s.id],allSupportAlternatives:true}})
 return out.map(c=>{
  if(c.kind==='worker')c.opts.validationForms=Object.fromEntries(c.opts.servants.map(s=>[s.id,servantBondForms(s)]))
  return {...c,sha256:createHash('sha256').update(JSON.stringify(c.opts)).digest('hex')}
 })
}
