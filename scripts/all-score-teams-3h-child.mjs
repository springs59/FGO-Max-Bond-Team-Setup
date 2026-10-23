import {execFileSync} from 'node:child_process'
const core=process.env.FGO_SCORE_CPU_CORE
if(core!=null){
  if(!/^\d+$/.test(core))throw Error('Invalid CPU core')
  const pin=`import os,sys,json,glob
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
  const actual=JSON.parse(execFileSync('python3',['-c',pin,String(process.pid),core],{encoding:'utf8'}))
  if(actual.some(value=>value.length!==1||value[0]!==Number(core)))throw Error('CPU affinity did not match requested core: '+JSON.stringify({core,actual}))
  process.send?.({type:'affinity',core:Number(core),verified:true,threadsChecked:actual.length})
}
await import('./all-score-teams-wide-child.mjs')
