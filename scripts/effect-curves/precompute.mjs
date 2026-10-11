import fs from 'node:fs'
import {anonymousEnvelopeBank,packAnonymousBank,anonymousCatalog,anonymousSupports} from '../../src/solver/anonymous-effects.js'
const dir=process.argv[2],scenes=JSON.parse(fs.readFileSync(dir+'/scenes.json')),report=[],cache=new Map()
for(const s of scenes){const meta=JSON.parse(fs.readFileSync(dir+'/'+s.tag+'-meta.json')),r=meta.rules,key=JSON.stringify([anonymousCatalog(meta),anonymousSupports(meta),[r.ownMin,r.ownMax,r.totalMin,r.totalMax,r.frontMin,r.grand,r.grandSlots,r.grandPositions]]);let p=cache.get(key);if(!p){p=packAnonymousBank(anonymousEnvelopeBank(meta,{cost:168,portraitCap:10,capped:-1}));cache.set(key,p)}fs.writeFileSync(dir+'/'+s.tag+'-theory.json',JSON.stringify(p));report.push({tag:s.tag,configurations:p.enumerated,retained:p.records.length});console.log(s.tag,p.enumerated,p.records.length);global.gc?.()}
fs.writeFileSync(dir+'/theory-precomputation.json',JSON.stringify({scenes:report,budget:168,portraitCap:10,anonymous:true},null,2))
