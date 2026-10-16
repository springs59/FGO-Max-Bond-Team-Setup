import { solveInventoryCurves } from '../src/solver/inventory-curve-solver.js'
import { solveGeneral } from './general-ai-solver.mjs'
export function validWorkModel(m){
 const h=m?.w1?.length
 return Boolean(m?.format==='fgo-generic-search-work'&&m.featureVersion===3&&Array.isArray(m.features)&&m.features.length===35&&h>0&&h<=32&&
  m.w1.every(r=>Array.isArray(r)&&r.length===35&&r.every(Number.isFinite))&&m.b1?.length===h&&m.b1.every(Number.isFinite)&&
  m.w2?.length===5&&m.w2.every(r=>Array.isArray(r)&&r.length===h&&r.every(Number.isFinite))&&m.b2?.length===5&&m.b2.every(Number.isFinite))
}
export function createGeneralRuntime(model,gate){
 const qualified=validWorkModel(model)&&gate?.enabled===true&&gate.modelVersion===model.version
 return {
  qualified,
  solve(opts){
   if(!qualified||opts.ownCes.length<(gate.minRawStock||0))return {result:solveInventoryCurves({...opts,aiMode:'off'}),decision:{policy:0,reason:qualified?'cheap-input':'unqualified-model'}}
   return solveGeneral(opts,{model,gate})
  },
 }
}
