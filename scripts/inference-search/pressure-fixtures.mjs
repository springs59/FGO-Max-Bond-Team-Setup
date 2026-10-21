// Recreate the four previously tested synthetic pressure conditions from the
// public, frozen game catalogs; never upload archived account/case payloads.
import{publicDomain}from'../performance-wide-cases.mjs'
import{readFileSync}from'node:fs'
import{servantBondForms}from'../../src/recommend.js'
import{createHash}from'node:crypto'
export const PRESSURE_IDS=['CN-open','JP-open','six-own','full-request']
export function pressureCases(){
 const out=[]
 for(const region of ['CN','JP']){const opts=publicDomain(region,Infinity,Infinity,6);opts.allSupportAlternatives=false;out.push({id:region+'-open',kind:'core',opts})}
 const own=publicDomain('CN',Infinity,12,3);own.costLimit=113;own.layouts=[0];own.minimumOwn=6;own.allSupportAlternatives=false
 own.bonuses=Object.fromEntries(own.servants.map((s,i)=>[s.id,{totalSecondLayer:[0,.5,1,2][i%4],party:i%9===0?.05:0}]))
 out.push({id:'six-own',kind:'core',opts:own})
 const p=publicDomain('CN',Infinity,Infinity,6)
 const opts={servants:p.servants,ces:JSON.parse(readFileSync(new URL('../../src/data/ces.json',import.meta.url))),region:'CN',base:815,mode:'account',costLimit:null,
  useInventoryCurveSolver:true,accountProfileId:'wide-CNInfinitytrue',account:{region:'CN',
   servants:p.servants.map((s,i)=>({id:s.id,bondLv:i%14===0?15:5,bondCap:i%14===0?15:10,limitCount:4})),
   ces:p.ownCes.map(c=>({id:c.id,mlb:c.accountMlb!==false,limitCount:c.accountMlb!==false?4:0}))}}
 opts.validationForms=Object.fromEntries(opts.servants.map(s=>[s.id,servantBondForms(s)]))
 out.push({id:'full-request',kind:'worker',opts})
 return out.map(c=>({...c,sha256:createHash('sha256').update(JSON.stringify(c.opts)).digest('hex')}))
}
