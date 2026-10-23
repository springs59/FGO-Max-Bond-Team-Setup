// A query's Grand seat follows a uniquely pinned, account-designated Grand.
// This derives a query constraint; it never changes account designation or
// persists an automatic choice as a manual position.
export function resolveGrandSelection({questType,mode,account,grandPosition=0,slotPins=[],frontIds=[],allowSupport=true}={}){
 if(questType!=='grand')return {position:0,svtId:0,automatic:false}
 const explicit=Number(grandPosition)||0
 if(explicit>=1&&explicit<=6)return {position:explicit,svtId:0,automatic:false}
 if(mode!=='account'||!account||account.virtual)return {position:0,svtId:0,automatic:false}
 const ids=new Set((account.servants||[]).filter(s=>s.isGrand===true||s.isGrand===1||s.isGrand==='1').map(s=>Number(s.id)))
 const pins=new Map(frontIds.map((id,i)=>[i+1,{position:i+1,svtId:Number(id)}]))
 for(const pin of slotPins)pins.set(Number(pin.position),pin)
 const candidates=[...pins.values()].filter(p=>!p.empty&&!p.support&&Number(p.position)>=1&&Number(p.position)<=6&&!(allowSupport&&Number(p.position)===6)&&ids.has(Number(p.svtId)))
 if(candidates.length!==1)return {position:0,svtId:0,automatic:false}
 return {position:Number(candidates[0].position),svtId:Number(candidates[0].svtId),automatic:true}
}
