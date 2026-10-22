import {readFileSync} from 'node:fs'
import {isPlayableServant,ceHasBondGain} from '../src/game-data.js'
import {servantBondForms} from '../src/recommend.js'
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)))
const ce=(id,rate,target='ptFull',flat=0)=>({id,name:'Synthetic CE '+id,cost:1,skills:[0,4].map(n=>({condLimitCount:n,funcs:[{target,rate:n?rate:rate/2,followerRate:rate+50,add:flat,tvals:[],andTvals:[]}]}))})
const roster=n=>Array.from({length:n},(_,i)=>({id:i+1,collectionNo:i+1,name:'Synthetic '+i,className:'saber',rarity:3,cost:i%4+1,traitIds:[10+i%2]}))
const pins=positions=>positions.map(position=>({position,empty:true}))
const small=(n=4)=>({servants:roster(n),ces:[ce(101,100),ce(102,300)],base:815,costLimit:12,allowSupport:true,quest:{restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]},slotPins:pins([3,5])})
export const WIDE_CASE_IDS=['conditional','self-flat','six-own','prefer','pins-stock-aura','active-event','grand','fixed-npc','CN-small','JP-small','CN-medium','JP-medium','CN-open','JP-open','dense-zero']
export function wideFixture(id){
 let opts=small(),stress=false
 if(id==='conditional')for(const s of opts.ces[1].skills)s.funcs[0].tvals=[{id:10}]
 else if(id==='self-flat'){opts.ces=[ce(101,300,'self'),ce(102,0,'ptFull',50)];opts.teapot=true;opts.base=1}
 else if(id==='six-own'){opts={...small(6),allowSupport:false,quest:null,slotPins:[],ces:[],costLimit:30}}
 else if(id==='prefer'){opts.optimizeBy='prefer';opts.preferSvtIds=[1];opts.lockSvtIds=[2]}
 else if(id==='pins-stock-aura'){opts.mode='account';opts.account={region:'CN',servants:opts.servants.map((s,i)=>({id:s.id,bondLv:i===2?15:5,bondCap:i===2?15:10,limitCount:4})),ces:[{id:101,count:2,mlbCount:1},{id:102,count:1,mlbCount:0}]};opts.slotPins.push({position:1,svtId:1,ceId:101});opts.lockSupportCeId=102}
 else if(id==='active-event'){opts=small(3);opts.quest={...opts.quest,eventId:1};opts.bondBonuses={events:[],questFriendships:[],extraPassives:opts.servants.map((s,i)=>({servantId:s.id,skillId:i+1,eventId:1,target:i?'self':'ptFull',rate:i?0.5:0.05,startedAt:1,endedAt:4102444800}))}}
 else if(id==='grand'){opts={...small(2),allowSupport:false,quest:null,questType:'grand',questClass:'saber',grandPosition:1,slotPins:pins([3,4,5,6]),ces:[ce(101,100)]}}
 else if(id==='fixed-npc'){const fixed=ce(991,500);opts={...small(2),ces:[],allowSupport:false,slotPins:pins([3,4,5,6]),quest:{flags:['noSupportList'],npcSupportCount:1,partyMetadataComplete:true,restrictions:[{type:'fixedSupportPosition',targetVals:[1]}],supportServants:[{id:9,svtId:700100,name:'Synthetic fixed NPC',required:true,releaseConditions:[],equips:[{ceId:991,ceMlb:false,ce:fixed}]}]}}}
 else if(id==='dense-zero'){opts={servants:roster(20),ces:[],base:0,allowSupport:false,costLimit:null};stress=true}
 else if(/^(CN|JP)-(small|medium|open)$/.test(id)){
  const [region,size]=id.split('-'),data=region==='CN'?{servants:read('src/data/servants.json'),ces:read('src/data/ces.json')}:read('src/data/jp/bundle.json')
  const playable=data.servants.filter(isPlayableServant),servants=size==='small'?playable.slice(0,2):size==='medium'?playable.filter(s=>s.cost<=7).slice(0,8):playable
  const ownCes=size==='small'?[]:data.ces.filter(ceHasBondGain).slice(0,size==='medium'?2:4)
  opts={region,servants:data.servants,ces:data.ces,mode:'account',base:815,costLimit:size==='open'?113:32,allowSupport:true,
   account:{region,servants:servants.map((s,i)=>({id:s.id,bondLv:size==='open'&&i%14===0?15:5,bondCap:size==='open'&&i%14===0?15:10,limitCount:4,maxAscension:4,unlockedCostumes:servantBondForms(s).filter(f=>f.key.startsWith('c')).map(f=>Number(f.key.slice(1)))})),ces:ownCes.map(c=>({id:c.id,count:2,mlbCount:1}))}}
  if(size==='medium'){opts.quest={restrictions:[{type:'fixedSupportPosition',targetVals:[6]}]};opts.slotPins=pins([3,4,5])}
  if(size==='small'&&region==='CN')opts.bondBonuses=read('src/data/bond-bonuses.json')
  stress=size==='open'
 }else throw Error('Unknown fixture '+id)
 return {id,stress,opts,domain:{region:opts.region||'synthetic',catalogServants:opts.servants.length,ownedIdentities:opts.account?.servants.length||opts.servants.length,ceTypes:opts.ces.length,base:opts.base,costLimit:opts.costLimit??null,primary:opts.optimizeBy||'total',support:opts.allowSupport}}
}
