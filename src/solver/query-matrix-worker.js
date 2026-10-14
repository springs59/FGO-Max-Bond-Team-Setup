import {downloadQueryMatrix} from './query-matrix-download.js'
self.onmessage=async()=>{
  try{const result=await downloadQueryMatrix({onProgress:progress=>self.postMessage({progress})});self.postMessage({ok:true,...result})}
  catch(error){self.postMessage({ok:false,error:String(error.message||error)})}
}
