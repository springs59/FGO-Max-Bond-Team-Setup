import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gzipSync} from 'node:zlib'
import 'fake-indexeddb/auto'
import {downloadQueryMatrix} from './query-matrix-download.js'
import {describeQuery,saveQuery,exportQueries,readQuery,QUERY_REVISION} from './query-library.js'
import {RULE_VERSION} from '../rules/versions.js'
import {UPDATE_URL,digest} from '../../native/shared/manifest.js'
const encoder=new TextEncoder(),description=await describeQuery('bond',{base:123,mode:'free'})
await saveQuery(description,{ok:true,total:321,slots:[]})
const archive=await exportQueries(),data=new Uint8Array(gzipSync(new Uint8Array(await archive.blob.arrayBuffer())))
const part={path:'generated/quest-matrix/part-'+ 'a'.repeat(64)+'-000.jsonl.gz',size:data.length,sha256:await digest(data)}
const index=encoder.encode(JSON.stringify({format:'fgo-quest-condition-matrix',version:1,ruleVersion:RULE_VERSION,queryRevision:QUERY_REVISION,files:[part]}))
const manifest=JSON.parse(fs.readFileSync('generated/native-data-manifest.json'))
manifest.matrix={path:'generated/quest-matrix/index.json',size:index.length,sha256:await digest(index)}
const revision=manifest.revision,base=`https://raw.githubusercontent.com/springs59/FGO-Max-Bond-Team-Setup/${revision}/`
const calls=[]
const fetchBytes=async(url,limit)=>{calls.push(url);const bytes=url===UPDATE_URL?encoder.encode(JSON.stringify(manifest)):url===base+manifest.matrix.path?index:url===base+part.path?data:null;assert.ok(bytes);assert.ok(bytes.length<=limit);return bytes}
assert.equal((await downloadQueryMatrix({fetchBytes})).files,1)
assert.equal(calls.length,3);calls.length=0
await downloadQueryMatrix({fetchBytes});assert.equal(calls.length,2,'already imported immutable files skip payload download')
const original=manifest.matrix
delete manifest.matrix
await assert.rejects(downloadQueryMatrix({fetchBytes}),/尚未提供/)
manifest.matrix=original
const bad=new Uint8Array(data);bad[bad.length-1]^=1
const other={...part,path:part.path.replace('a'.repeat(64),'b'.repeat(64))},badIndex=encoder.encode(JSON.stringify({format:'fgo-quest-condition-matrix',version:1,ruleVersion:RULE_VERSION,queryRevision:QUERY_REVISION,files:[other]}))
manifest.matrix={...original,size:badIndex.length,sha256:await digest(badIndex)}
await assert.rejects(downloadQueryMatrix({fetchBytes:async url=>url===UPDATE_URL?encoder.encode(JSON.stringify(manifest)):url.endsWith('index.json')?badIndex:bad}),/校验失败/)
assert.equal((await readQuery(description)).total,321)
console.log('Optional matrix download: pinned revision, size/hash verification, restart skipping and corrupt-payload preservation passed')
