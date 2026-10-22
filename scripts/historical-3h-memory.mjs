import os from 'node:os'
import {readFileSync} from 'node:fs'
const MiB=1048576
export function memoryBudget({processes,profile='legacy-768',totalMiB,cgroupMiB=Infinity}={}){
 if(!Number.isInteger(processes)||processes<1)throw Error('Invalid process count')
 const effectiveMiB=Math.floor(Math.min(totalMiB,cgroupMiB))
 if(!Number.isFinite(effectiveMiB)||effectiveMiB<1)throw Error('Invalid available memory')
 if(profile==='legacy-768')return {profile,processes,heapMiB:768,effectiveMiB,reserveMiB:null}
 if(profile!=='paired-auto'||processes>2)throw Error('Memory recovery requires at most two concurrent solvers')
 const reserveMiB=Math.max(2048,Math.ceil(effectiveMiB*0.15))
 // Leave host/supervisor headroom, plus another 10% for V8 young space,
 // native allocations and imported catalog data outside the old-space cap.
 const heapMiB=Math.min(6144,Math.floor((effectiveMiB-reserveMiB)*0.9/processes/256)*256)
 if(heapMiB<2048)throw Error('Insufficient RAM for the recovery profile')
 return {profile,processes,heapMiB,effectiveMiB,reserveMiB}
}
export function hostMemoryBudget(processes,profile){
 let cgroupMiB=Infinity
 for(const path of ['/sys/fs/cgroup/memory.max','/sys/fs/cgroup/memory/memory.limit_in_bytes'])try{
  const n=Number(readFileSync(path,'utf8').trim());if(Number.isFinite(n)&&n>0)cgroupMiB=Math.min(cgroupMiB,n/MiB)
 }catch{}
 return memoryBudget({processes,profile,totalMiB:os.totalmem()/MiB,cgroupMiB})
}
export function classifyExit(stderr){return /JavaScript heap out of memory|Reached heap limit|Ineffective mark-compacts near heap limit/.test(stderr)?'memory-limit':'process-error'}
export function peakRssFromStatus(text){return Number(text.match(/^VmHWM:\s+(\d+)\s+kB/m)?.[1]||0)/1024}
export function processPeakRssMiB(pid){try{return peakRssFromStatus(readFileSync('/proc/'+pid+'/status','utf8'))}catch{return 0}}
