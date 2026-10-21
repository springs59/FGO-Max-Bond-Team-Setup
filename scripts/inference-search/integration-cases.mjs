// Frozen configurations, additional full-Worker holdout. Four deterministic
// synthetic account variants plus two NPC/CE conditions not used for selection.
import{readFileSync,writeFileSync}from'node:fs'
import{brotliDecompressSync}from'node:zlib'
import{createHash}from'node:crypto'
const rows=JSON.parse(readFileSync(process.argv[2])),prior=JSON.parse(brotliDecompressSync(readFileSync(process.argv[3])))
if(rows.some(c=>c.stage==='integration'))throw Error('already extended')
const specs=[
 ['request-CN-30-false',30,65,943,351000001],
 ['request-CN-240-false',220,113,1015,352000001],
 ['request-JP-Infinity-false',140,65,1175,353000001],
 ['request-JP-Infinity-false',300,113,615,354000001],
]
for(const [id,count,costLimit,base,seed]of specs){
 const c=structuredClone(prior.find(c=>c.id===id)),o=c.opts
 const rank=s=>createHash('sha256').update(seed+':'+s.id).digest('hex')
 const owned=new Set(o.servants.map(s=>({id:s.id,rank:rank(s)})).sort((a,b)=>a.rank.localeCompare(b.rank)).slice(0,count).map(s=>s.id))
 o.servants=o.servants.filter(s=>owned.has(s.id));o.account.servants=o.account.servants.filter(s=>owned.has(s.id)).map((s,i)=>({...s,bondLv:i%9===0?15:5+(i+seed)%8,bondCap:15}))
 o.validationForms=Object.fromEntries(Object.entries(o.validationForms).filter(([id])=>owned.has(+id)))
 o.costLimit=costLimit;o.base=base;o.accountProfileId='synthetic-integration-'+seed
 rows.push({...c,id:'integration-synthetic-'+seed,stage:'integration',tier:'normal',scenario:'full-worker-account',opts:o})
}
for(const id of ['new-multiple-support-2','changed-support-equipment-2']){
 const c=structuredClone(prior.find(c=>c.id===id));if(!c)throw Error(id)
 rows.push({...c,id:'integration-archive-'+id,stage:'integration',tier:'normal',scenario:'npc-equipment-holdout'})
}
for(const c of rows.filter(c=>c.stage==='integration'))c.sha256=createHash('sha256').update(JSON.stringify(c.opts)).digest('hex')
writeFileSync(process.argv[2],JSON.stringify(rows)+'\n')
console.log(JSON.stringify({cases:rows.length,integration:6,retune:false}))
