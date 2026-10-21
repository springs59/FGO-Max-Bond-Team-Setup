// One query-level graph, never a learned per-item scoring loop.
export const CONTEXT_FEATURES=['minimumOwn','required','requiredFront','requiredBack','fixed','empty','layouts','sixOwn','requiredSupportCE','allSupportAlternatives',
 'minimumServantCost','budgetPerSeat','minimumCECost','budgetSlack','cheapFraction','expensiveFraction','partialCoverage','coverageSpread','maximumSelf','auraFraction','maxedFraction','meanCEEfficiency','formMultiplicity','budgetUnlimited']
const mean=xs=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length)
export function appendQueryContext(e=[],s=[],c={}){
 const min=(xs,k)=>xs.length?Math.min(...xs.map(x=>x[k])):0
 const cap=Math.max(1,Math.round((s[0]?.[14]??e[0]?.[14]??5/6)*6))
 const inferred=s[0]?.[13]??e[0]?.[13]??2
 const unlimited=c.costLimit===null||c.costLimit===undefined&&inferred===2
 const budget=unlimited?null:c.costLimit??Math.max(0,Math.expm1(inferred*5))
 const layouts=c.layouts||[],required=c.requiredIds||[],seats=Object.values(c.requiredSeats||{})
 const mS=min(s,4),mE=min(e,4),coverage=e.map(x=>x[3])
 return [Math.max(1,c.minimumOwn||1)/6,required.length/6,seats.filter(x=>x==='front').length/3,seats.filter(x=>x==='back').length/3,
  Object.keys(c.fixedPositions||{}).length/6,(c.emptyPositions||[]).length/6,layouts.length/3,Number(layouts.includes(0)),Number(!!c.requireSupportEquipment),Number(!!c.allSupportAlternatives),
  mS,budget==null?2:Math.min(4,budget/(20*cap)),mE,budget==null?1:(budget-20*(mS+mE))/Math.max(1,budget),
  mean(s.map(x=>Number(x[4]<=.25))),mean(s.map(x=>Number(x[4]>=.6))),mean(coverage.map(v=>Number(v>0&&v<.8))),
  coverage.length?Math.max(...coverage)-Math.min(...coverage):0,Math.max(0,...s.map(x=>x[10])),mean(s.map(x=>Number(x[11]>0))),
  mean(s.map(x=>1-x[9])),mean(e.map(x=>x[6])),Math.min(3,s.length/Math.max(1,c.identitiesCount||s.length)),Number(unlimited)]
}
function validLayer(l,input,output){return l&&Array.isArray(l.w)&&l.w.length===output&&l.w.every(r=>Array.isArray(r)&&r.length===input&&r.every(Number.isFinite))&&Array.isArray(l.b)&&l.b.length===output&&l.b.every(Number.isFinite)}
export function validNeural(policy,features,actions){
 if(policy?.format!==2||policy.features?.join('|')!==features.join('|')||!Array.isArray(policy.mean)||policy.mean.length!==features.length||!policy.mean.every(Number.isFinite)||
  !Array.isArray(policy.scale)||policy.scale.length!==features.length||!policy.scale.every(x=>Number.isFinite(x)&&x>0))return false
 const n=features.length
 if(policy.architecture==='dense')return validLayer(policy.layers?.[0],n,32)&&validLayer(policy.layers?.[1],32,24)&&validLayer(policy.layers?.[2],24,actions)
 if(policy.architecture!=='grouped'||policy.branches?.length!==3)return false
 const used=[]
 for(const b of policy.branches){if(!Array.isArray(b.indices)||!b.indices.every(x=>Number.isInteger(x)&&x>=0&&x<n)||!validLayer(b.layer,b.indices.length,24))return false;used.push(...b.indices)}
 return used.length===n&&new Set(used).size===n&&validLayer(policy.fusion,72,16)&&validLayer(policy.output,16,actions)
}
function affine(x,l,relu=true){return l.w.map((row,i)=>{let v=l.b[i];for(let j=0;j<row.length;j++)v+=row[j]*x[j];return relu?Math.max(0,v):v})}
export function neuralProfile(policy,features){
 const x=features.map((v,i)=>Math.max(-8,Math.min(8,(v-policy.mean[i])/policy.scale[i])))
 let y
 if(policy.architecture==='dense')y=affine(affine(affine(x,policy.layers[0]),policy.layers[1]),policy.layers[2],false)
 else{
  const merged=policy.branches.flatMap(b=>affine(b.indices.map(i=>x[i]),b.layer))
  y=affine(affine(merged,policy.fusion),policy.output,false)
 }
 let at=0;for(let i=1;i<y.length;i++)if(y[i]>y[at])at=i
 return at
}
