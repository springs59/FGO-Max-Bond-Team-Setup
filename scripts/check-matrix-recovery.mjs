import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const repository=process.cwd(),index=JSON.parse(fs.readFileSync('generated/quest-matrix/index.json'))
if(index.packed||!index.jobs.length)throw Error('Run against the original local matrix checkpoint')
const jobs=index.jobs.slice(0,3),files=jobs.flatMap(j=>j.files),kinds={}
for(const j of jobs)for(const [k,n] of Object.entries(j.kinds))kinds[k]=(kinds[k]||0)+n
function fixture(bad=false){
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'fgo-packed-recovery-'))
  fs.symlinkSync(path.join(repository,'src'),path.join(cwd,'src'),'dir');fs.symlinkSync(path.join(repository,'scripts'),path.join(cwd,'scripts'),'dir')
  for(const file of files){fs.mkdirSync(path.dirname(path.join(cwd,file.path)),{recursive:true});fs.copyFileSync(file.path,path.join(cwd,file.path))}
  const snapshot={...index,packed:true,completed:jobs.length,files,kinds,jobs:jobs.map(({files,...j})=>j)}
  if(bad)snapshot.sourceHashes={CN:'f'.repeat(64)}
  fs.writeFileSync(path.join(cwd,'generated/quest-matrix/index.json'),JSON.stringify(snapshot))
  return cwd
}
const directories=[]
try{
  const good=fixture();directories.push(good)
  for(let repeat=0;repeat<2;repeat++){
    const run=spawnSync(process.execPath,['scripts/precompute-quest-matrix.mjs'],{cwd:good,env:{...process.env,MATRIX_JOBS:'0'},encoding:'utf8'})
    assert.equal(run.status,0,run.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(good,'generated/quest-matrix/index.json'))).completed,jobs.length)
    const restored=JSON.parse(fs.readFileSync(path.join(good,'generated/quest-matrix/index.json')))
    assert.equal(restored.files.length,files.length);assert.deepEqual(restored.kinds,kinds)
  }
  const bad=fixture(true);directories.push(bad)
  const rejected=spawnSync(process.execPath,['scripts/precompute-quest-matrix.mjs'],{cwd:bad,env:{...process.env,MATRIX_JOBS:'0'},encoding:'utf8'})
  assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/snapshot changed/)
}finally{for(const cwd of directories){fs.rmSync(cwd,{recursive:true,force:true});fs.rmSync(path.join(os.tmpdir(),'fgo-matrix-'+createHash('sha256').update(cwd).digest('hex').slice(0,16)),{recursive:true,force:true})}}
console.log('Packed matrix recovery: public archives reconstruct all completed jobs/IDs, repeat safely and reject changed snapshots')
