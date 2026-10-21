// A final compressed export is emitted directly from the completed driver.
// This allows the caller to restore exact bytes if asynchronous file snapshots
// lag behind process output. It never fabricates missing benchmark records.
import{spawn}from'node:child_process'
import{readFileSync,writeFileSync,mkdirSync,copyFileSync}from'node:fs'
import{once}from'node:events'
import{brotliCompressSync,constants}from'node:zlib'
import{createHash}from'node:crypto'
import assert from'node:assert/strict'
const[work,stage]=process.argv.slice(2)
const log=work+'/'+stage+'-sealed-retry.log'
writeFileSync(log,'')
const p=spawn(process.execPath,[new URL('./run.mjs',import.meta.url).pathname,work,stage],{env:process.env,stdio:['ignore','pipe','inherit']})
p.stdout.on('data',b=>{process.stdout.write(b);import('node:fs').then(fs=>fs.appendFileSync(log,b))})
const[code]=await once(p,'exit');assert.equal(code,0)
const path=work+'/results/'+stage+'.json',bytes=readFileSync(path),x=JSON.parse(bytes)
assert.equal(x.status,'complete');assert.equal(x.records.length,x.cases.length)
assert.ok(x.records.every(r=>r.objectivesAgree&&r.alternativesAgree&&r.checkpointsValid&&(stage==='pressure'||r.complete)))
const br=brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11}})
mkdirSync(work+'/sealed',{recursive:true});writeFileSync(work+'/sealed/'+stage+'.json.br',br)
mkdirSync(work+'/committed-results',{recursive:true});copyFileSync(path,work+'/committed-results/'+stage+'.json')
process.stdout.write('FINAL_DATA:'+JSON.stringify({stage,sha256:createHash('sha256').update(bytes).digest('hex'),cases:x.records.length,compressedBytes:br.length,b64:br.toString('base64')})+'\n')
