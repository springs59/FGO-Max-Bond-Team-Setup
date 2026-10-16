import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {randomSource,makeSearchCase} from './ai-search-cases.mjs'
import {isPlayableServant} from '../src/game-data.js'
import {pickCeSkill} from '../src/atlas.js'
import {servantBondForms} from '../src/recommend.js'
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)))
const cn={servants:read('src/data/servants.json'),ces:read('src/data/ces.json')},jp=read('src/data/jp/bundle.json')
const valid=c=>{const fs=pickCeSkill(c,true)?.funcs||[];return fs.length===1&&!fs[0].eventId&&fs[0].target==='ptFull'&&((!fs[0].add&&fs[0].rate>0)||(fs[0].add===50&&!fs[0].rate&&!fs[0].tvals?.length&&!fs[0].andTvals?.length))}
export const FAMILIES=['synthetic','cn-small','jp-small','cn-medium','jp-medium','cn-large','jp-large','cn-full','jp-full','tight-cost','mixed-stock','forms','event-self','event-party','bond15-aura','pins-empty','no-support-six-own','rounding-flat','trait-overlap','inventory-changes','general-normal','general-grand','general-target-bonus','general-system-npc']
export const DATA_SHA=createHash('sha256').update(JSON.stringify([cn,jp])).digest('hex')
export const SPLIT_SEEDS={train:12000000,validation:22000000,test:32000000}
export function makeDiverseCase(split,index){
  const seed=SPLIT_SEEDS[split]+index,fi=index%FAMILIES.length,family=FAMILIES[fi],rand=randomSource(seed),int=(a,b)=>a+Math.floor(rand()*(b-a+1)),pick=xs=>xs[int(0,xs.length-1)]
  const sample=(xs,n)=>{const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=int(0,i);[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,n)}
  const synthetic=makeSearchCase(seed).opts
  let servants=synthetic.servants,ownCes=synthetic.ownCes,supportCes=synthetic.supportCes,
    states=Object.fromEntries(servants.map(s=>[s.id,synthetic.stateOf(s)])),bonuses=synthetic.bonuses,
    forms=Object.fromEntries(servants.map(s=>[s.id,synthetic.formsOf(s)])),base=synthetic.base,
    costLimit=synthetic.costLimit,layouts=synthetic.layouts,requiredIds=[],requiredSeats={},fixedPositions={},emptyPositions=[],minimumOwn=1
  const ce=(id,rate,cost,traits=[],flat=0)=>({id,collectionNo:id,name:'training CE '+id,cost,rarity:4,
    skills:[0,4].map(mlb=>({condLimitCount:mlb,funcs:[{target:'ptFull',rate:mlb?rate:Math.floor(rate/2),followerRate:mlb?rate+50:Math.floor(rate/2),add:flat,eventId:0,tvals:traits.map(id=>({id})),andTvals:[]}]}))})
  let region='synthetic'
  if(fi>=1&&fi<=8){
    region=fi%2?'CN':'JP';const data=region==='CN'?cn:jp,all=data.servants.filter(isPlayableServant)
    const n=fi<=2?int(6,16):fi<=4?pick([30,60,120]):fi<=6?pick([120,240]):all.length
    servants=sample(all,n);const ces=sample(data.ces.filter(valid),n>100?int(3,6):int(3,7))
    ownCes=ces.flatMap(c=>Array.from({length:int(1,3)},()=>({...c,accountMlb:rand()>.3})));supportCes=ces
    states=Object.fromEntries(servants.map(s=>[s.id,{maxed:rand()<.12,aura:0}]))
    forms=Object.fromEntries(servants.map(s=>[s.id,servantBondForms(s)]));bonuses={}
    base=pick([1,49,165,500,815,1000,1500,2400])+int(0,17);costLimit=pick([20,40,60,80,95,113,null]);layouts=pick([[0],[6],[3],[6,3]])
    if(fi>=3&&rand()<.5)bonuses=Object.fromEntries(servants.map(s=>[s.id,{totalSecondLayer:rand()<.12?pick([.5,1,2]):0,party:0}]))
  }
  if(fi===9)costLimit=pick([0,1,3,6,9,12,16,20,30])
  if(fi===10){ownCes=ownCes.flatMap(c=>Array.from({length:int(0,3)},()=>({...c,accountMlb:rand()<.5})));bonuses={}}
  if(fi===11){servants=servants.map((s,i)=>({...s,forms:[{key:'c1',cost:pick([0,3,7,12,16]),traitIds:sample([10,11,12,13],2)},{key:'a1',cost:s.cost,traitIds:[10+i%4]}]}));forms=Object.fromEntries(servants.map(s=>[s.id,servantBondForms(s)]))}
  if(fi===12)bonuses=Object.fromEntries(servants.map(s=>[s.id,{totalSecondLayer:pick([0,.2,.3,.5,1,1.5,2,3]),party:0}]))
  if(fi===13)bonuses=Object.fromEntries(servants.map(s=>[s.id,{totalSecondLayer:pick([0,.5,1]),party:pick([0,.05,.1,.2])}]))
  if(fi===14){states=Object.fromEntries(servants.map((s,i)=>[s.id,{maxed:i%3===0,aura:i%3===0?250:0}]));bonuses={}}
  if(fi===15){requiredIds=servants.slice(0,int(1,Math.min(2,servants.length))).map(s=>s.id);layouts=[6];requiredIds.forEach((id,i)=>{requiredSeats[id]=i?'back':'front';fixedPositions[id]=i?4:1});emptyPositions=pick([[5],[2,5],[]])}
  if(fi===16){layouts=[0];minimumOwn=pick([1,4,6]);costLimit=pick([30,60,95,113,null]);bonuses={}}
  if(fi===17){base=pick([0,1,2,49,50,51,164,165,166,249,250,251,499,500,501,814,815,816,1249,1250,1251]);ownCes=[...ownCes,ce(6999,0,5,[],50)];supportCes=[...supportCes,ce(6998,0,5,[],50)]}
  if(fi===18){supportCes=[ce(6100,250,12,[10]),ce(6101,250,12,[11]),ce(6102,150,5),ce(6103,300,9,[12]),ce(6104,0,1,[],50)];ownCes=supportCes.flatMap(c=>[{...c,accountMlb:true},{...c,accountMlb:false}]);costLimit=pick([9,16,30,50,80,95]);bonuses={}}
  if(fi===19){states=Object.fromEntries(servants.map((s,i)=>[s.id,{maxed:i%2===0,aura:i%4===0?250:0}]));ownCes=ownCes.filter((_,i)=>i%2);costLimit=pick([12,30,60,95])}
  if(fi>=20){
    const count=int(5,8);servants=Array.from({length:count},(_,i)=>({id:700000+i,collectionNo:700000+i,name:'general '+i,className:'saber',rarity:3,cost:pick([0,1,3,4,7]),attribute:'earth',traitIds:[10+i%3],forms:[]}))
    const ces=[ce(710000,100,3),ce(710001,200,5,[10]),ce(710002,250,7,[11])]
    const opts={servants,ces,base:pick([49,165,815,1000,1400])+int(0,30),costLimit:pick([12,20,30,50,80,null]),mode:'free',allowSupport:rand()<.6,
      useInventoryCurveSolver:false,skipResultCache:true,skipSolutionLookup:true,aiMode:'off',teapot:rand()<.2}
    if(fi===20){opts.slotPins=rand()<.5?[{position:5,empty:true}]:[];opts.lockSvtIds=rand()<.4?[servants[0].id]:[]}
    if(fi===21){opts.questType='grand';opts.questClass='saber';opts.grandPosition=pick([0,1,2,5])}
    if(fi===22){opts.quest={id:880001,eventId:880,flags:rand()<.5?['eventDeckNoSupport']:[]};opts.bondBonuses={extraPassives:servants.filter((_,i)=>i%2).map(s=>({servantId:s.id,rate:pick([.5,1,2]),target:'self',eventId:880,skillId:940194,startedAt:1,endedAt:4102444800,applySupportSvt:1})),questFriendships:[{eventId:880,value:200,rate:.2,startedAt:1,endedAt:4102444800,targetIds:servants.slice(0,2).map(s=>s.id),questIds:[880001],exceptedQuestIds:[],allQuests:false}]}}
    if(fi===23){opts.quest={id:880002,partyMetadataComplete:true,supportPolicy:'system',supportServants:[{id:990001,svtId:servants[0].id,required:true,openedAt:1,closedAt:4102444800,releaseConditions:[]}]};opts.allowSupport=true}
    return pack({kind:'general',opts,region:'synthetic'})
  }
  const opts={servants,ownCes,supportCes,forms,states,bonuses,base,costLimit,layouts,requiredIds,requiredSeats,fixedPositions,emptyPositions,minimumOwn,allSupportAlternatives:false}
  return pack({kind:'inventory',opts,region})
  function pack(value){return {...value,id:`${split}-${family}-${seed}`,seed,index,family,split,inputSha256:createHash('sha256').update(JSON.stringify(value.opts)).digest('hex')}}
}
export const materialize=opts=>({...opts,formsOf:s=>opts.forms[s.id],stateOf:s=>opts.states[s.id]})
