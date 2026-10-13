// Recovery only: live calculation never sends candidate batches to this Worker.
import { saveComputedCandidates,promoteCompletedQuery } from './query-library.js'
import { recoverCandidateJournals } from './query-candidate-journal.js'
self.onmessage=async()=>{
  try{const result=await recoverCandidateJournals(saveComputedCandidates,{onRecovered:promoteCompletedQuery});self.postMessage({ok:true,...result})}
  catch(error){self.postMessage({ok:false,error:String(error.message||error)})}
}
