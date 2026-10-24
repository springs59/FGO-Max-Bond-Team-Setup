import {createHash} from 'node:crypto'

// Compare streamed result multisets without retaining every result or
// assuming that AI choices visit equal-score families in the same order.
export function canonicalResultJson(value){
 const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x
 return JSON.stringify(canonical(value))
}
export function createUnorderedResultDigest(){
 const mask=(1n<<256n)-1n
 let sum=0n,xor=0n,count=0
 return {
  update(value){
   const h=BigInt('0x'+createHash('sha256').update(canonicalResultJson(value)).digest('hex'))
   sum=(sum+h)&mask;xor^=h;count++
  },
  digest(){
   return createHash('sha256').update([count,sum.toString(16).padStart(64,'0'),xor.toString(16).padStart(64,'0')].join('\n')).digest('hex')
  }
 }
}
