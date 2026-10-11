import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const dir=process.argv[2],scenes=JSON.parse(fs.readFileSync(dir+'/scenes.json')),results=[]
for(const s of scenes){
 const file=dir+'/'+s.tag+'-theory.json',bytes=fs.readFileSync(file),p=JSON.parse(bytes),m=JSON.parse(fs.readFileSync(dir+'/'+s.tag+'-meta.json')),rules=m.rules
 assert.equal(p.records.length,p.configurations.length)
 for(let i=0;i<p.records.length;i++){
  const [n,k,nf,cf,cost,ceCost,normal,free,flat,base,si,...counts]=p.configurations[i],sup=p.supports[si],r=p.records[i],nb=n-k-nf,owned=counts.reduce((a,b)=>a+b,0),prices=[]
  assert.equal(counts.length,p.types.length);assert.ok(n>=Math.max(rules.ownMin??1,(rules.totalMin??1)-sup.external));assert.ok(n<=Math.min(rules.ownMax??6,(rules.totalMax??6)-sup.external,sup.front+sup.back));assert.ok(k>=0&&k<=Math.max(0,Math.min(5,n-1)));assert.ok(nf>=0&&nf<=sup.front&&nb>=0&&nb<=sup.back);assert.ok(cf>=0&&cf<=k&&nf+cf<=sup.front&&nb+k-cf<=sup.back);assert.ok(nf+cf+sup.frontShare/40>=(rules.frontMin??1))
  let ownFlat=0,unrestricted=1000+250*k,conditional=0
  counts.forEach((count,j)=>{const t=p.types[j];assert.ok(Number.isInteger(count)&&count>=0&&count<=t.items.length);prices.push(...t.items.slice(0,count).map(x=>x.cost));ownFlat+=t.flat*count;if(t.conditional)conditional+=t.rate*count;else unrestricted+=t.rate*count})
  sup.types.forEach(t=>{if(t.conditional)conditional+=t.rate;else unrestricted+=t.rate})
  assert.equal(base,unrestricted);assert.equal(flat,ownFlat+sup.types.reduce((a,t)=>a+t.flat,0));assert.equal(normal,owned-free);assert.ok(normal<=n&&normal>=0);assert.ok(free>=0&&free<=Math.min(n,rules.grandSlots??(rules.grand?1:0)));assert.ok(ownFlat<=500)
  if(rules.grandPositions?.length){const front=rules.grandPositions.filter(pos=>pos<=3&&sup.freePositions.includes(pos-1)).length,back=rules.grandPositions.filter(pos=>pos>=4&&sup.freePositions.includes(pos-1)).length;assert.ok(free<=Math.min(nf+cf,front)+Math.min(n-nf-cf,back))}
  prices.sort((a,b)=>b-a);assert.equal(ceCost,prices.slice(free).reduce((a,b)=>a+b,0));assert.equal(cost,ceCost);assert.equal(r[7],cost);assert.equal(r[2]*50,ownFlat);assert.equal(r[3],n);assert.equal(r[4],nf);assert.equal(r[5],k);assert.ok(cost<=168)
  for(let at=0;at<6;at++)assert.equal(r[8+at],at<nf||at>=3&&at<3+nb?base+conditional:0)
  assert.equal(p.meta.supports[r[1]].frontShare,sup.frontShare);assert.equal(p.meta.supports[r[1]].flat,flat-ownFlat)
 }
 results.push({tag:s.tag,configurations:p.enumerated,retained:p.records.length,sha256:createHash('sha256').update(bytes).digest('hex'),passed:true});console.log(s.tag,p.records.length,'anonymous configs verified');global.gc?.()
}
fs.writeFileSync(dir+'/theory-validation.json',JSON.stringify({passed:true,sceneCount:results.length,enumerated:results.reduce((a,s)=>a+s.configurations,0),retained:results.reduce((a,s)=>a+s.retained,0),scenes:results},null,2))
