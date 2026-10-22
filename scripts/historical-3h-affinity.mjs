import {execFileSync} from 'node:child_process'
export function pinCpu(){
 const core=process.env.FGO_SCORE_CPU_CORE
 if(!/^\d+$/.test(core||''))throw Error('A numeric CPU core is required')
 const script=`import os,sys,json,glob
pid=int(sys.argv[1]);core=int(sys.argv[2])
def tasks():
 return [int(p.rsplit('/',1)[1]) for p in glob.glob('/proc/'+str(pid)+'/task/[0-9]*')] or [pid]
for attempt in range(3):
 for tid in tasks():
  try: os.sched_setaffinity(tid,{core})
  except ProcessLookupError: pass
os.sched_setaffinity(pid,{core})
actual=[]
for tid in tasks():
 try: actual.append(sorted(os.sched_getaffinity(tid)))
 except ProcessLookupError: pass
print(json.dumps(actual))`
 const actual=JSON.parse(execFileSync('python3',['-c',script,String(process.pid),core],{encoding:'utf8'}))
 if(!actual.length||actual.some(a=>a.length!==1||a[0]!==Number(core)))throw Error('CPU affinity verification failed')
 process.send?.({type:'affinity',core:Number(core),verified:true})
}
