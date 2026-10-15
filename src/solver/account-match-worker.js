import { installWorkerTransport } from '../worker-transport.js'
import { ensureAccountMatches } from './account-plan-matches.js'

let pending = new Map(), running = false
installWorkerTransport(self,async ({data}) => {
  for (const opts of data.tasks || []) pending.set(opts.accountProfileId,opts)
  if (running) return
  running = true
  try {
    while (pending.size) {
      const [id,opts] = pending.entries().next().value; pending.delete(id)
      try {
        const profile = await ensureAccountMatches(opts,{onProgress:progress => self.postMessage({profileId:id,progress})})
        self.postMessage({profileId:id,profile,ok:true})
      } catch (error) { self.postMessage({profileId:id,ok:false,error:String(error.message || error)}) }
    }
  } finally { running = false }
})
