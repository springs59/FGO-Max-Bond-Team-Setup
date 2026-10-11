import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import{ceHasBondGain,isPlayableServant}from '../../src/game-data.js';
import{servantBondForms}from '../../src/recommend.js';
import{ceMilliLive}from '../../src/solver/solver-index.js';
import{pickCeSkill}from '../../src/atlas.js';
import{servantCost}from '../../src/servant-cost.js';
import{formatTraitCondition}from '../../src/ui/ce-effect-copy.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),out=process.env.GLOBAL_CURVE_OUTPUT||path.join(root,'generated/global-review'),region=process.argv[2]||'CN';
fs.mkdirSync(out,{recursive:true});
const data=region==='JP'?JSON.parse(fs.readFileSync(root+'/src/data/jp/bundle.json')):{servants:JSON.parse(fs.readFileSync(root+'/src/data/servants.json')),ces:JSON.parse(fs.readFileSync(root+'/src/data/ces.json'))};
const eventIndex=process.argv[3],scenario=eventIndex===undefined?null:JSON.parse(fs.readFileSync(out+'/'+region+'-event-'+eventIndex+'-effect.json')),tag=region+(scenario?'-event-'+eventIndex:'');
const bonuses=scenario?.bonuses||{};
const ss=data.servants.filter(isPlayableServant),cs=data.ces.filter(ceHasBondGain),rows=[],groups=[],supports=[],gm=new Map(),sm=new Map();
for(const s of ss)for(const form of servantBondForms(s))rows.push({id:s.id,form:form.key,formLabel:form.name||form.key,cost:servantCost(s,form),traits:form.traitIds,name:s.name,className:s.className,bondCeName:data.ces.find(c=>c.bondEquipOwner===s.id)?.name||'',activity:bonuses[s.id]||null,self:Math.round((bonuses[s.id]?.totalSecondLayer||0)*1000),party:Math.round((bonuses[s.id]?.party||0)*1000)});
for(const c of cs){const f=pickCeSkill(c,true).funcs;if(f.length!==1||f[0].eventId||f[0].target!=='ptFull')throw Error('Unsupported '+c.id);const flat=f[0].add||0;if(![0,50].includes(flat)||flat&&(f[0].tvals?.length||f[0].andTvals?.length)||f[0].rate<0)throw Error('Unsupported fixed/negative effect '+c.id);for(const sup of[false,true]){let rates=rows.map(r=>ceMilliLive(c,{traitIds:r.traits},sup,true));let sig=JSON.stringify([rates,flat]);let map=sup?sm:gm,list=sup?supports:groups;if(!map.has(sig)){map.set(sig,list.length);list.push({rates,flat,kind:flat?'portrait':f[0].tvals?.length||f[0].andTvals?.length?'conditional':'universal',items:[]})}list[map.get(sig)].items.push({id:c.id,name:c.name,cost:c.cost,nominalRate:(sup&&f[0].followerRate!=null?f[0].followerRate:f[0].rate)/10,condition:formatTraitCondition(f[0])})}}
// Keep six cheapest distinct identities per complete effect signature. One
// identity may appear in several signatures; the native DP still processes
// that identity once, so changing forms can never duplicate it.
if(rows.some(r=>r.cost>16||r.cost<0||r.self<0||r.party<0)||groups.length>20)throw Error('Snapshot exceeds the reviewed model bounds');
const rm=new Map();rows.forEach((r,i)=>{let sig=JSON.stringify([groups.map(g=>g.rates[i]),r.self,r.party]);if(!rm.has(sig))rm.set(sig,new Map());let m=rm.get(sig),prev=m.get(r.id);if(prev===undefined||r.cost<rows[prev].cost)m.set(r.id,i)});
let indices=[...rm.values()].flatMap(m=>[...m.values()].sort((a,b)=>rows[a].cost-rows[b].cost||rows[a].id-rows[b].id).slice(0,6));indices.sort((a,b)=>rows[a].id-rows[b].id||a-b);
for(let g of groups)g.items.sort((a,b)=>a.cost-b.cost||a.id-b.id);
const full={region,scenario,guestPartyMax:Math.max(0,...Object.values(bonuses).filter(b=>b.partyApplySupport!==0).map(b=>Math.round((b.party||0)*1000))),identities:ss.length,forms:rows.length,vectors:rm.size,rows,groups,supports:[{rates:rows.map(()=>0),flat:0,items:[]},...supports]};fs.writeFileSync(out+'/'+tag+'-source.json',JSON.stringify(full));
const meta={region,scenario,guestPartyMax:Math.max(0,...Object.values(bonuses).filter(b=>b.partyApplySupport!==0).map(b=>Math.round((b.party||0)*1000))),identities:ss.length,forms:rows.length,vectors:rm.size,rows:indices.map(i=>rows[i]),groups:groups.map(g=>({...g,rates:indices.map(i=>g.rates[i])})),supports:[{rates:indices.map(()=>0),flat:0,items:[]},...supports.map(g=>({...g,rates:indices.map(i=>g.rates[i])}))]};
fs.writeFileSync(out+'/'+tag+'.json',JSON.stringify(meta));let lines=[`${meta.rows.length} ${meta.groups.length} ${meta.supports.length} 168 ${meta.guestPartyMax}`];for(let r of meta.rows)lines.push(`${r.id} ${r.cost} ${r.self} ${r.party}`);for(let g of meta.groups)lines.push([g.flat,g.items.length,...g.items.map(x=>x.cost),...g.rates].join(' '));for(let s of meta.supports)lines.push([s.flat,...s.rates].join(' '));fs.writeFileSync(out+'/'+tag+'.txt',lines.join('\n'));console.log(region,meta.identities,meta.forms,meta.vectors,meta.rows.length,meta.groups.length,meta.supports.length);
