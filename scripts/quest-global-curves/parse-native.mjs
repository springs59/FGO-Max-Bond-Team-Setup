import fs from 'node:fs'
import readline from 'node:readline'
import {once} from 'node:events'
import {globalMemberPositions} from '../../src/solver/global-curve-expand.js'
const [dir,tag]=process.argv.slice(2),meta=JSON.parse(fs.readFileSync(`${dir}/${tag}-meta.json`)),out=fs.createWriteStream(`${dir}/${tag}-bank-v2.json.tmp`)
async function put(s){if(!out.write(s))await once(out,'drain')}
await put('{"meta":'+JSON.stringify(meta)+',"records":[')
let count=0
for await(const line of readline.createInterface({input:fs.createReadStream(`${dir}/${tag}-reduced.txt`),crlfDelay:Infinity})){
 if(!line.trim())continue
 const c=line.split(' ').map(Number),frontOwn=meta.rules.generic?c.pop():null,rewardCounts=meta.rules.grandSlots>1?c.splice(-meta.groups.length):null,rewardGroup=c.pop(),extra={}
 c[1]=meta.precomputedSupports[c[1]]
 if(rewardCounts?.some(Boolean))extra.rewardCounts=rewardCounts
 if(rewardGroup>=0)extra.rewardGroup=rewardGroup
 if(meta.rules.generic){const free=meta.supports[c[1]].freePositions,old=[...Array(frontOwn).keys(),...Array.from({length:c[3]-frontOwn},(_,i)=>3+i)],positions=[...free.filter(j=>j<3).slice(0,frontOwn),...free.filter(j=>j>=3).slice(0,c[3]-frontOwn)],a=c.slice(8,14),r=c.slice(14,20);c.fill(0,8,20);old.forEach((at,j)=>{c[8+positions[j]]=a[at];c[14+positions[j]]=r[at]});extra.ownPositions=positions}
 else if(c[0]&&meta.rules.supportPosition&&meta.rules.supportPosition!==(c[0]===2?3:6)){const old=globalMemberPositions(c),free=Array.from({length:6},(_,i)=>i).filter(i=>i!==meta.rules.supportPosition-1),positions=old.map(i=>free.filter(j=>(j<3)===(i<3))[old.filter(j=>(j<3)===(i<3)).indexOf(i)]),a=c.slice(8,14),r=c.slice(14,20);c.fill(0,8,20);old.forEach((at,j)=>{c[8+positions[j]]=a[at];c[14+positions[j]]=r[at]});extra.ownPositions=positions}
 if(Object.keys(extra).length)c.push(extra)
 await put((count++?',':'')+JSON.stringify(c))
}
await put(']}');out.end();await once(out,'finish');fs.renameSync(`${dir}/${tag}-bank-v2.json.tmp`,`${dir}/${tag}-bank-v2.json`);console.log(tag,count,'curves')
