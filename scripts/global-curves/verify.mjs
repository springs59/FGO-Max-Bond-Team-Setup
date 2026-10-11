import fs from 'node:fs';import path from 'node:path';import {applyCraftEssences} from '../../src/atlas.js';import{calcParty}from '../../src/bond.js';import{buildGlobalEnvelope,globalWinnerAt,globalCurveValue}from '../../src/solver/global-envelope.js';
const folder=process.argv[2],root=path.resolve('src/data');let counts={records:0,independentSettlements:0,envelopeDifferentials:0};
for(const tag of ['CN','JP','CN-event-0']){
 const m=JSON.parse(fs.readFileSync(folder+'/'+tag+'.json')),bank=fs.readFileSync(folder+'/'+tag+'-reduced.txt','utf8').trim().split('\n').map(s=>s.split(' ').map(Number));
 const ces=tag==='JP'?JSON.parse(fs.readFileSync(root+'/jp/bundle.json')).ces:JSON.parse(fs.readFileSync(root+'/ces.json'));
 function members(c){const n=c[3],nf=c[4],k=c[5],fc=c[0]===2?2:3,nb=n-k-nf;let inds=[...Array(nf).keys(),...Array.from({length:nb},(_,i)=>3+i)];let f=nf,b=3+nb;for(let j=0;j<k;j++)inds.push(f<fc?f++:b++);return inds;}
 for(let id=0;id<bank.length;id++){
  const c=bank[id],indices=members(c),team=indices.map(i=>m.rows[c[14+i]]),ids=new Set(team.map(r=>r.id)),ownparty=team.reduce((s,r)=>s+r.party,0);
  if(ids.size!==team.length)throw Error('Duplicate identity '+tag+' '+id);
  let cost=team.reduce((s,r)=>s+r.cost,0),equipped=0,flat=0;
  for(let g=0;g<m.groups.length;g++){const cnt=c[20+g];if(cnt>m.groups[g].items.length)throw Error('Inventory');equipped+=cnt;flat+=cnt*m.groups[g].flat;cost+=m.groups[g].items.slice(0,cnt).reduce((s,x)=>s+x.cost,0);}
  if(cost!==c[7]||equipped>team.length||flat!==50*c[2]||c[0]===0&&c[1]!==0)throw Error('COST/equipment '+tag+' '+id);
  for(let j=0;j<indices.length-c[5];j++){let i=indices[j],ridx=c[14+i],r=m.rows[ridx];let expected=1000+r.self+ownparty+250*c[5]+m.supports[c[1]].rates[ridx]+c[6]*m.guestPartyMax;for(let g=0;g<m.groups.length;g++)expected+=c[20+g]*m.groups[g].rates[ridx];if(c[8+i]!==expected)throw Error('Coefficient '+tag+' '+id);}
  for(let j=indices.length-c[5];j<indices.length;j++)if(c[8+indices[j]]!==0)throw Error('Capped earned bond');
  if(id%149===0){
   const slots=indices.map((i,j)=>({position:i+1,filled:true,svtId:team[j].id,traitIds:team[j].traits,bondMaxed:j>=indices.length-c[5],bond15:j>=indices.length-c[5],eventPassive:(team[j].self+ownparty+c[6]*m.guestPartyMax)/1000,ceId:0,ceMlb:true}));
   let worn=0;for(let g=0;g<m.groups.length;g++)for(let z=0;z<c[20+g];z++)slots[worn++].ceId=m.groups[g].items[z].id;
   if(c[0])slots.push({position:c[0]===2?3:6,filled:true,isSupport:true,ceId:m.supports[c[1]].items[0]?.id||0,ceMlb:true});
   applyCraftEssences(slots,ces);
   for(const base of[0,1,249,250,999,1000,2000,100003]){const actual=calcParty(base,false,slots).results.reduce((s,r)=>s+r.final,0),expected=globalCurveValue(c,m,base);if(actual!==expected)throw Error('Settlement '+tag+' '+id+' '+base+' '+actual+' '+expected);counts.independentSettlements++;}
  }
  counts.records++;
 }
 for(const opts of[{cost:113,portraitCap:1,capped:0},{cost:60,portraitCap:6,capped:1,layout:0},{cost:114,portraitCap:6,capped:-1,layout:2},{cost:130,portraitCap:0,capped:0,support:1},{cost:168,portraitCap:6,capped:0}]){
  const started=Date.now(),e=buildGlobalEnvelope(bank,m,opts);console.log(tag,JSON.stringify(opts),'eligible',e.ids.length,'viable',e.viable,'lines',e.residueLines,'period',e.period,'ms',Date.now()-started);
  const bases=new Set([0,1,2,3,249,250,251,999,1000,2000,10000,1000003]);for(let z=0;z<80;z++)bases.add(Math.floor(z*7919.17)%30000);
  // Verify at every envelope transition and its preceding integer q, as well
  // as random-looking bases. Directly maximize the entire eligible curve bank.
  for(let r=0;r<e.period;r+=Math.max(1,Math.floor(e.period/100)))for(const[q]of e.hulls[r]||[]){bases.add(q*e.period+r);if(q>0)bases.add((q-1)*e.period+r)}
  for(const base of bases){const id=globalWinnerAt(e,base);let best=-1,cost=Infinity;for(const i of e.ids){let s=globalCurveValue(bank[i],m,base);if(s>best||s===best&&bank[i][7]<cost){best=s;cost=bank[i][7]}}if(id===null){if(e.ids.length)throw Error('Missing hull');continue}if(globalCurveValue(bank[id],m,base)!==best||bank[id][7]!==cost)throw Error('Envelope '+tag+' '+base);counts.envelopeDifferentials++;}
 }
 fs.writeFileSync(folder+'/'+tag+'-bank.json',JSON.stringify({meta:m,records:bank}));
}
fs.writeFileSync(folder+'/validation.json',JSON.stringify({...counts,passed:true},null,2));console.log(counts);
