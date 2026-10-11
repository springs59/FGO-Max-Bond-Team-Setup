import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import {globalMemberPositions} from '../../src/solver/global-curve-expand.js'
import {Worker as NodeWorker} from 'node:worker_threads'
const file=process.argv[2],html=fs.readFileSync(file,'utf8'),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]),elements=new Map(),blobs=new Map(),workers=new Set()
class Element{
 constructor(id='',kind='div'){this.id=id;this.kind=kind;this.value='';this.inner='';this.options=[];this.listeners=new Map();this.hidden=false;this.style={};this.dataset={};this.textContent='';this.clientWidth=720;this.clientHeight=380;this.children=[]}
 set innerHTML(s){this.inner=s;this.children=[];this.nodes=null;if(this.kind==='select'){this.options=[...s.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(m=>({value:m[1].match(/value="([^"]*)"/)?.[1]??m[2],disabled:/disabled/.test(m[1]),selected:/selected/.test(m[1])}));this.value=this.options.find(o=>o.selected)?.value??this.options[0]?.value??''}}
 get innerHTML(){return this.inner}
 setAttribute(k,v){this[k]=v}
 addEventListener(k,v){this.listeners.set(k,v)}
 focus(){} append(...v){this.children.push(...v)}
 querySelectorAll(q){if(!this.nodes)this.nodes=[...this.inner.matchAll(/<(select|button)([^>]*)>([\s\S]*?)<\/\1>|<(input)([^>]*)>/g)].flatMap(m=>{const attr=m[2]??m[5],tag=m[1]??m[4];if(!attr)return [];const n=new Element('',tag);for(const a of attr.matchAll(/data-([\w-]+)="([^"]*)"/g))n.dataset[a[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=a[2];n.value=attr.match(/value="([^"]*)"/)?.[1]??'';if(tag==='select')n.innerHTML=m[3];return [n]});const key=q.match(/\[data-([^\]]+)\]/)?.[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return key?this.nodes.filter(n=>key in n.dataset):[]}
}
for(const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(m[2],m[1]);el.hidden=/\bhidden\b/.test(m[0]);elements.set(m[2],el)}
for(const[id,value]of Object.entries({region:'CN',family:'normal','activity-mode':'none',cost:'113',reserve:'0',portraits:'10',maxbase:'6000',base:'1000',own:'-1',helpers:'-1','helper-front':'-1',capped:'-1',support:'-1'}))elements.get(id).value=value
for(const[id,i]of [['formation-data',1],['packed',2],['worker-code',3]])elements.get(id).textContent=scripts[i]
let lastActual
class WorkerShim{constructor(url){this.queue=[];this.dead=false;workers.add(this);blobs.get(url).text().then(source=>{if(this.dead)return;this.w=new NodeWorker(`const {parentPort}=require('node:worker_threads');global.self=globalThis;self.postMessage=m=>parentPort.postMessage(m);parentPort.on('message',data=>self.onmessage({data}));\n${source}`,{eval:true});this.w.on('message',data=>{if(data.kind==='solved')lastActual=data;this.onmessage?.({data})});this.w.on('error',e=>this.onerror?.(e));for(const x of this.queue)this.w.postMessage(x);this.queue=[]})}postMessage(x){if(this.w)this.w.postMessage(x);else this.queue.push(x)}terminate(){this.dead=true;this.w?.terminate();workers.delete(this)}}
const context=vm.createContext({console,setTimeout,clearTimeout,Response,Blob,Uint8Array,DecompressionStream,atob,Worker:WorkerShim,URL:{createObjectURL(b){const key=String(blobs.size);blobs.set(key,b);return key},revokeObjectURL(){}},ResizeObserver:class{observe(){}},document:{getElementById:id=>{assert.ok(elements.has(id),id);return elements.get(id)},createElement:()=>new Element()}})
const run=s=>vm.runInContext(s,context),el=id=>elements.get(id)
async function until(fn,timeout=120000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('UI timeout: '+el('summary').textContent+' / '+el('effect-status').textContent);await new Promise(r=>setTimeout(r,25))}}
async function computed(){await until(()=>run('Boolean(bank&&env?.ids.length&&!worker)'));assert.match(el('plot').innerHTML,/<path/)}
async function condition(values){for(const[id,v]of Object.entries(values))el(id).value=String(v);run('refreshEffects()');await computed()}
async function template(p){el('template').value=p.id;await run(`profile=catalog.profiles.find(p=>p.id===${JSON.stringify(p.id)});for(const id of ['own','helpers','helper-front','capped'])$(id).value='-1';refreshProfile()`);await computed()}
let checks=0
try{
 run(scripts[0]+'\n'+scripts[4]);await computed();checks++
 assert.ok(!html.includes('id="quest"')&&!html.includes('id="scene"'));assert.ok(el('optima-container').hidden===false);assert.ok(!/\bopen\b/.test(html.match(/<details id="optima-container"[^>]*>/)[0]));assert.match(el('optima').innerHTML,/基础羁绊取值范围/)
 const before=run('JSON.stringify(options)');run("tab('activity')");assert.equal(el('panel-activity').hidden,false);assert.equal(el('panel-formation').hidden,true);run("tab('curves')");assert.equal(run('JSON.stringify(options)'),before);checks++
 await condition({own:5,helpers:1,'helper-front':0,capped:0});assert.ok(run('bank.configs.every(c=>c.n===5&&c.support.external===1&&c.support.frontShare===0&&c.normal<=5&&c.free===0)'));checks++
 el('own').value='6';run('refreshEffects()');assert.match(el('summary').textContent,/6个物理位置/);assert.equal(el('plot').innerHTML,'');checks++
 const all=JSON.parse(run('JSON.stringify(catalog.profiles)')),noSupport=all.find(p=>p.region==='CN'&&p.family==='normal'&&p.rules.layouts.length===1&&p.rules.layouts[0]===0);await template(noSupport);await condition({own:6,helpers:0,'helper-front':0,capped:0});assert.ok(run('bank.configs.every(c=>c.n===6&&c.support.external===0&&c.normal<=6)'));run("$('all-start').onclick()");assert.equal(run('total'),30);assert.ok(run('pageCurves.every(c=>c.n===6&&c.support.external===0)'));checks++
 const exactlyThree=all.find(p=>p.region==='CN'&&p.family==='normal'&&p.rules.totalMin===3&&p.rules.totalMax===3);await template(exactlyThree);assert.ok(run('bank.configs.every(c=>c.n+c.support.external===3)'));checks++
 const grand=all.find(p=>p.region==='CN'&&p.family==='grand');await template(grand);await condition({own:5,helpers:1,'helper-front':0,capped:0});assert.ok(run('bank.configs.every(c=>c.free<=1&&c.normal<=5)'));assert.ok(run('bank.configs.some(c=>c.free===1)'));checks++
 const normal=all.find(p=>p.region==='CN'&&p.tag==='CN-quest-0');await template(normal);await condition({own:2,helpers:1,'helper-front':0,capped:0});el('activity-mode').value='current';run('setActivityMode()');assert.deepEqual(Array.from(run('profiles.map(p=>p.self)')),[500,200,0]);run('profiles.forEach(p=>p.own=p.self?1:0);refreshEffects()');await computed();assert.ok(run('bank.configs.every(c=>c.activity.mix.own.join(",")==="1,1,0")'));assert.ok(!/玛修|马修|阿尔托莉雅/.test(el('legend').innerHTML+el('activity-rows').innerHTML));checks++
 run('profiles=[{self:500,campaign:200,party:50,helperAllowed:true,own:1,helpers:1}];refreshEffects()');await computed();assert.ok(run('bank.configs.every(c=>c.activity.party===100)'));run("$('all-start').onclick()");assert.equal(run('total'),30);assert.match(el('results').innerHTML,/战役\+20%/);run("$('all-next').onclick()");assert.equal(run('total'),60);checks++
 run('profiles[0].helperAllowed=false;refreshEffects()');assert.match(el('summary').textContent,/不接受助战提供/);assert.equal(el('plot').innerHTML,'');checks++
 run("profiles=[];$('activity-mode').value='none'");await condition({own:5,helpers:1,'helper-front':0,capped:0});run("$('examples').onclick()");assert.deepEqual(Array.from(run('comparison.map(c=>effectValue(c,1000))')),[12320,12120,11920]);checks++
 el('reserve').value='114';run('refreshEffects()');assert.match(el('summary').textContent,/超过总预算/);assert.equal(el('optima').innerHTML,'');el('reserve').value='0';run('refreshEffects()');await computed();checks++
 for(const width of [320,360,720,1100]){el('plot').clientWidth=width;run('draw()');assert.equal(el('plot').viewBox,`0 0 ${width} 380`);assert.ok(!/NaN|Infinity/.test(el('plot').innerHTML));checks++}
 // Cancellation and old delayed responses cannot restore obsolete curves.
 run('refreshEffects()');run("$('cancel').onclick()");await new Promise(r=>setTimeout(r,100));assert.equal(el('plot').innerHTML,'');assert.equal(run('worker'),null);checks++
 // The support domain with two actual helpers is still subject to six seats.
 const multi=all.find(p=>p.region==='CN'&&p.shapes.some(s=>JSON.parse(s)[1]===2));await template(multi);const tuple=run('formationOptions(original.meta,{}).find(x=>x.helpers===2)');await condition({own:Math.max(1,Math.min(3,tuple.own)),helpers:2,'helper-front':tuple.helperFront,capped:0});assert.ok(run('bank.configs.every(c=>c.n+c.support.external<=6&&c.support.external===2)'));checks++
 el('activity-mode').value='custom';run('profiles=[{self:1000,campaign:0,party:0,helperAllowed:true,own:5,helpers:0}];refreshEffects()');assert.equal(el('plot').innerHTML,'');assert.match(el('summary').textContent,/活动己方对象数/);checks++
 // Changing templates preserves explicit activity counts and reports conflicts.
 await run(`profile=catalog.profiles.find(p=>p.id===${JSON.stringify(exactlyThree.id)});refreshProfile()`);assert.match(el('summary').textContent,/活动己方对象数/);assert.equal(run('profiles[0].own'),5);checks++
 // Current activity tiers in full automatic count mode, not just a fixture.
 el('activity-mode').value='current';run('setActivityMode()');await template(normal);await condition({own:5,helpers:1,'helper-front':0,capped:0,cost:113,portraits:10});run('setActivityMode();refreshEffects()');await computed();assert.ok(run('bank.configs.every(c=>c.activity.mix.own.reduce((s,v)=>s+v,0)<=c.n)'));checks++
 // An explicit identity is reprojected with fixed own/helper counts and an
 // independently remapped support domain, then verified in the real worker.
 el('activity-mode').value='none';run('profiles=[]');await template(grand);await condition({own:1,helpers:1,'helper-front':0,capped:0,cost:16,portraits:0});const identity=run('original.source.rows.find(r=>r.cost===16)');run(`required.set(${identity.id},${JSON.stringify(identity.name)})`);await run('actualSolve()');await until(()=>!run('actualWorker')&&Boolean(lastActual));assert.match(el('actual-result').innerHTML,/己方1人/);assert.ok(lastActual.bank.records.every(c=>c[3]===1&&c[0]===1&&globalMemberPositions(c).some(i=>lastActual.bank.meta.rows[c[14+i]].id===identity.id)));checks++
 const limited=all.find(p=>p.tag==='JP-special-2');el('region').value='JP';el('family').value='special';el('activity-mode').value='none';run('profiles=[]');await template(limited);assert.ok(run('formationOptions(original.meta,{}).every(x=>x.own===1)'));assert.ok(run('bank.configs.every(c=>c.n===1)'));checks++
 const report={formationUiChecks:checks,realWorkerExecuted:true,threeLinkedTabs:true,invalidConditionsClearResults:true,anonymousActivities:true,allResultsPaging:true,automaticActivityMixes:true,selectedIdentityReprojected:true,intervalsInitiallyCollapsed:true,six20Examples:[12320,12120,11920],realBrowserVisualQA:false};console.log(JSON.stringify(report))
}finally{for(const w of workers)w.terminate()}
