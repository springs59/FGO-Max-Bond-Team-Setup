import fs from 'node:fs'
import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
const dir=process.argv[2],scenes=JSON.parse(fs.readFileSync(dir+'/scenes.json'))
let cursor=0
const computations=new Map()
async function run(cmd,args,stdio){await new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(args.join(' ')+' exited '+code)))})}
async function next(){while(cursor<scenes.length){const scene=scenes[cursor++],tag=scene.tag,key=createHash('sha256').update(fs.readFileSync(dir+'/'+tag+'.txt')).digest('hex')
 if(fs.existsSync(dir+'/'+tag+'-bank-v2.json')){if(!computations.has(key))computations.set(key,Promise.resolve(tag));console.log('Cached',tag);continue}
 if(!computations.has(key))computations.set(key,(async()=>{const log=fs.openSync(dir+'/'+tag+'-compute.log','w');try{await run(dir+'/quest-global-engine',[dir+'/'+tag+'.txt',dir+'/'+tag+'-reduced.txt'],['ignore','ignore',log])}finally{fs.closeSync(log)}return tag})())
 const computed=await computations.get(key);if(computed!==tag)fs.copyFileSync(dir+'/'+computed+'-reduced.txt',dir+'/'+tag+'-reduced.txt')
 await run(process.execPath,['scripts/quest-global-curves/parse-native.mjs',dir,tag],['ignore','inherit','inherit'])
}}
await Promise.all(Array.from({length:Number(process.env.GLOBAL_JOBS||2)},()=>next()))
