// Diagnostics only: timestamp the actual versioned archive function without
// changing its inputs, hashing, transaction ordering or stored record shape.
self.onmessage = async ({ data }) => {
  try {
    const root = new URL('../', import.meta.url), prefix = data.prefix
    const moduleUrl = new URL(prefix + 'src/solver/query-library.js', root)
    let source = await (await fetch(moduleUrl)).text()
    source = source.replace(/from (['"])(\.{1,2}\/[^'"]+)\1/g, (_, q, path) => 'from ' + JSON.stringify(new URL(path, moduleUrl).href))
    const change = (needle, replacement) => {
      if (!source.includes(needle)) throw Error('Archive trace marker missing: ' + needle)
      source = source.replace(needle, replacement)
    }
    self.archivePhases={candidatePreparation:0,physicalPreparation:0,database:0,batches:0}
    change('export async function saveComputedCandidates(values) {',
      "export async function saveComputedCandidates(values) { let traceAt=performance.now(); const mark=key=>{const now=performance.now();self.archivePhases[key]+=now-traceAt;traceAt=now}")
    change('const plans = new Map()', "mark('candidatePreparation'); const plans = new Map()")
    change('let added = 0', "mark('physicalPreparation'); let added = 0")
    change('return { added }', "mark('database'); self.archivePhases.batches++; return { added }")
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    const library = await import(url)
    const { recommendTeam } = await import(new URL(prefix + 'src/recommend.js', root))
    const { createDiskJournal,consumeDiskJournal } = await import(new URL(prefix + 'src/solver/query-candidate-journal.js', root))
    const dir=await navigator.storage.getDirectory(),file=await dir.getFileHandle('archive-profile.jsonl',{create:true})
    const handle=await file.createSyncAccessHandle();handle.truncate(0)
    const journal=createDiskJournal(handle)
    const value=recommendTeam({...data.opts,skipResultCache:true,onComputedCandidate:v=>journal.capture(v)})
    if(!value.ok||journal.error)throw Error(value.error||journal.error)
    journal.seal()
    const start=performance.now()
    const archived=await consumeDiskJournal(handle,library.saveComputedCandidates)
    const elapsedMs=performance.now()-start,stats=journal.stats()
    journal.close();await dir.removeEntry('archive-profile.jsonl');URL.revokeObjectURL(url)
    self.postMessage({ok:true,elapsedMs,phases:self.archivePhases,archived,stats,total:value.total})
  } catch(error) { self.postMessage({ok:false,error:String(error.stack||error)}) }
}
