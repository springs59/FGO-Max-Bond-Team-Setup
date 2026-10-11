import fs from 'node:fs'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {once} from 'node:events'
const dir=process.argv[2],tags=process.argv.slice(3),tasks=[],children=new Set();let cursor=0
process.on('SIGINT',()=>{for(const p of children)p.kill('SIGTERM');process.exit(130)})
function run(cmd,args,stdio,env){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio,env});children.add(p);p.on('error',reject);p.on('exit',code=>{children.delete(p);code===0?resolve():reject(Error(args.join(' ')+' exited '+code))})})}
for(const tag of tags){const lines=fs.readFileSync(`${dir}/${tag}.txt`,'utf8').trim().split('\n'),header=lines[0].split(' ').map(Number),[R,G,S]=header,base=lines.slice(1,1+R+G),supports=lines.slice(1+R+G);if(supports.length!==S)throw Error('Bad support count');const size=22;fs.mkdirSync(`${dir}/chunks`,{recursive:true});for(let start=0;start<S;start+=size){const h=[...header];h[2]=Math.min(size,S-start);const part=`${dir}/chunks/${tag}-${start}`;fs.writeFileSync(part+'.txt',[h.join(' '),...base,...supports.slice(start,start+size)].join('\n'));tasks.push({tag,start,part})}}
async function work(){while(cursor<tasks.length){const t=tasks[cursor++],log=fs.openSync(t.part+'.log','w');try{await run(dir+'/quest-global-engine',[t.part+'.txt',t.part+'-out.txt'],['ignore','ignore',log],{...process.env,FRONT_CACHE_LIMIT:process.env.FRONT_CACHE_LIMIT||'128'})}finally{fs.closeSync(log)}console.log('Done',t.tag,'supports',t.start)}}
await Promise.all(Array.from({length:8},work))
for(const tag of tags){const out=fs.createWriteStream(`${dir}/${tag}-reduced.txt`);for(const t of tasks.filter(t=>t.tag===tag)){const input=createInterface({input:fs.createReadStream(t.part+'-out.txt'),crlfDelay:Infinity});for await(const line of input){if(!line)continue;const fields=line.split(' ');fields[1]=String(Number(fields[1])+t.start);if(!out.write(fields.join(' ')+'\n'))await once(out,'drain')}}out.end();await once(out,'finish');await run(process.execPath,['scripts/quest-global-curves/parse-native.mjs',dir,tag],['ignore','inherit','inherit']);console.log('Merged',tag)}
