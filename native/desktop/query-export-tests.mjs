import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const {exportQueryFile,createQueryExport}=createRequire(import.meta.url)('./query-export.cjs')
const folder=await mkdtemp(join(tmpdir(),'fgo-query-export-'))
try {
  const path=join(folder,'backup.jsonl'),bytes=new TextEncoder().encode('{"format":"fgo-local-query-results"}\n{"fixture":"整库数据"}\n')
  assert.deepEqual(await exportQueryFile('FGO-query-results-2026-10-12.jsonl',bytes,async()=>({filePath:path})),{saved:true})
  assert.deepEqual(new Uint8Array(await readFile(path)),bytes)
  assert.deepEqual(await exportQueryFile('FGO-query-results-2026-10-12.jsonl',bytes,async()=>({canceled:true})),{saved:false,canceled:true})
  let choices=0
  const stream=await createQueryExport('FGO-query-results-2026-10-12.jsonl',async()=>{choices++;return {filePath:path}})
  for(const part of [bytes.subarray(0,1),bytes.subarray(1,3),bytes.subarray(3)])await stream.append(part)
  assert.deepEqual(await stream.finish(),{saved:true})
  assert.equal(choices,1,'one destination for the whole stream')
  assert.deepEqual(new Uint8Array(await readFile(path)),bytes)
  const cancel=await createQueryExport('FGO-query-results-2026-10-12.jsonl',async()=>({filePath:path}))
  await cancel.append(Uint8Array.from([1,2,3]));await cancel.finish(true)
  assert.deepEqual(new Uint8Array(await readFile(path)),bytes,'cancel preserves an existing backup')
  assert.equal(await createQueryExport('FGO-query-results-2026-10-12.jsonl',async()=>({canceled:true})),null)
  const invalid=await createQueryExport('FGO-query-results-2026-10-12.jsonl',async()=>({filePath:path}))
  await assert.rejects(invalid.append(new Uint8Array(1024*1024+1)),/数据块/);await invalid.finish(true)
  await assert.rejects(exportQueryFile('../private.txt',bytes,async()=>{throw Error('must not open picker')}),/文件名/)
  await assert.rejects(exportQueryFile('FGO-query-results-2026-10-12.jsonl','text',async()=>({filePath:path})),/内容/)
}finally{await rm(folder,{recursive:true,force:true})}
console.log('Desktop query backup: byte preservation, cancellation and invalid inputs passed')
