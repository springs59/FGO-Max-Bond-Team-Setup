import { temporaryQueries } from './query-temporary.js'
self.onmessage=async({data})=>{
  try{self.postMessage({ok:true,...await temporaryQueries(data||{})})}
  catch(error){self.postMessage({ok:false,error:String(error.message||error)})}
}
