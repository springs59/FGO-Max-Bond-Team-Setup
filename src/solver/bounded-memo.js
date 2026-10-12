// Eviction changes only whether an already computed value is recomputed.
// It never removes a candidate from the search or substitutes an answer.
export class BoundedMemo {
  constructor({entries=4096,bytes=16*1024*1024,weight=()=>1}={}){this.limit=entries;this.budget=bytes;this.weight=weight;this.map=new Map();this.bytes=0}
  get(key){const row=this.map.get(key);if(!row)return undefined;this.map.delete(key);this.map.set(key,row);return row.value}
  has(key){return this.get(key)!==undefined}
  set(key,value){const old=this.map.get(key);if(old){this.bytes-=old.bytes;this.map.delete(key)}const bytes=this.weight(value,key);if(bytes>this.budget)return this;this.map.set(key,{value,bytes});this.bytes+=bytes;while(this.map.size>this.limit||this.bytes>this.budget){const first=this.map.keys().next().value;this.bytes-=this.map.get(first).bytes;this.map.delete(first)}return this}
  add(key){return this.set(key,true)}
  get size(){return this.map.size}
}
