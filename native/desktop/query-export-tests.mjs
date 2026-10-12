import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createRequire} from 'node:module'
const {exportQueryFile}=createRequire(import.meta.url)('./query-export.cjs')
const folder=await mkdtemp(join(tmpdir(),'fgo-query-export-'))
try {
  const path=join(folder,'backup.gz'),bytes=Uint8Array.from([31,139,0,123,10])
  assert.deepEqual(await exportQueryFile('FGO-query-results-2026-10-12.jsonl.gz',bytes,async()=>({filePath:path})),{saved:true})
  assert.deepEqual(new Uint8Array(await readFile(path)),bytes)
  assert.deepEqual(await exportQueryFile('FGO-query-results-2026-10-12.jsonl.gz',bytes,async()=>({canceled:true})),{saved:false,canceled:true})
  await assert.rejects(exportQueryFile('../private.txt',bytes,async()=>{throw Error('must not open picker')}),/文件名/)
  await assert.rejects(exportQueryFile('FGO-query-results-2026-10-12.jsonl.gz','text',async()=>({filePath:path})),/内容/)
}finally{await rm(folder,{recursive:true,force:true})}
console.log('Desktop query backup: byte preservation, cancellation and invalid inputs passed')
