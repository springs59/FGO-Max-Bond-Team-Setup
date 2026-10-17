// A suffix relaxation: each identity may be skipped or occupy one seat.
// Ignore COST, aura equality and mandatory members, so this can only increase
// the best completion score. Entries mean AT MOST f front and b back seats.
export function scoreCompletionBounds(entries, frontCap, backCap, flat, isLive, requiredSeats) {
  const width=backCap+1,size=(frontCap+1)*width
  const suffix=Array(entries.length+1)
  suffix[entries.length]=new Float64Array(size)
  for(let i=entries.length-1;i>=0;i--){
    const [id,choices]=entries[i],after=suffix[i+1],next=after.slice()
    let front=-Infinity,back=-Infinity
    for(const x of choices){
      const add=isLive(x.row)?flat:0
      if(requiredSeats[id]!=='back')front=Math.max(front,x.f+add)
      if(requiredSeats[id]!=='front')back=Math.max(back,x.b+add)
    }
    for(let f=0;f<=frontCap;f++)for(let b=0;b<=backCap;b++){
      const at=f*width+b
      if(f)next[at]=Math.max(next[at],front+after[at-width])
      if(b)next[at]=Math.max(next[at],back+after[at-1])
    }
    suffix[i]=next
  }
  return suffix
}
