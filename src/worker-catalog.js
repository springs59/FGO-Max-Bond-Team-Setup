
// Only immutable loaded catalogs belong here. Accounts and every editable
// condition are always sent afresh. Replacement by any new catalog resends all.
export const CATALOG_FIELDS=['servants','ces','game','bondBonuses','solverIndex','solutionIndex','factorIndex','joinedEffectIndex','curveIndex']
const sessions=new WeakMap()
let sequence=0
export async function postRecommendRequest(worker,message) {
  const opts={...message.opts},catalog={}
  for(const key of CATALOG_FIELDS){catalog[key]=opts[key];delete opts[key]}
  let session=sessions.get(worker)
  const changed=!session||CATALOG_FIELDS.some(key=>catalog[key]!==session.catalog[key])
  if(changed)session={id:++sequence,catalog}
  worker.postMessage({...message,opts,catalogRef:session.id,...(changed?{catalogUpdate:catalog}:{})})
  sessions.set(worker,session)
}
export function createCatalogReceiver() {
  let current
  return message=>{
    if(message.catalogUpdate)current={id:message.catalogRef,values:message.catalogUpdate}
    if(!message.catalogRef)return {opts:message.opts||{},catalog:null,id:null}
    if(current?.id!==message.catalogRef)throw Error('计算数据版本未同步，请重新开始计算')
    return {opts:{...current.values,...message.opts},catalog:current.values,id:current.id}
  }
}
