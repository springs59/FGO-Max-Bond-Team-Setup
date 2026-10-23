import {readFileSync,existsSync,appendFileSync} from 'node:fs'
const [path,pidPath,minutesRaw='30']=process.argv.slice(2),deadline=Date.now()+Number(minutesRaw)*60000
let lastLog=0
while(Date.now()<deadline){
 let value=null;try{value=JSON.parse(readFileSync(path,'utf8'))}catch{}
 if(value?.finished){if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'done=true\n');console.log(JSON.stringify({id:value.id,status:value.status,finished:true}));process.exit(0)}
 if(Date.now()-lastLog>=60000){console.log(JSON.stringify({finished:false,id:value?.id,phase:value?.phase,models:Object.fromEntries(Object.entries(value?.progress||{}).map(([m,r])=>[m,{ms:r.ms,best:r.best,tiedTeams:r.tiedTeams}]))}));lastLog=Date.now()}
 if(existsSync(pidPath))try{process.kill(Number(readFileSync(pidPath,'utf8').trim()),0)}catch{throw Error('Test supervisor exited before writing a final result')}
 await new Promise(resolve=>setTimeout(resolve,1000))
}
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,'done=false\n')
