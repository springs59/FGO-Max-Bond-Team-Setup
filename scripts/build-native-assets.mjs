import { readdir, readFile, mkdir, cp, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { RULE_VERSION } from '../src/rules/versions.js'
import { SOLVER_INDEX_VERSION } from '../src/solver/solver-index.js'
const revision = execFileSync('git',['rev-parse','HEAD']).toString().trim()
const sha = data => createHash('sha256').update(data).digest('hex')
const files=[]
async function collect(dir) {
  for(const item of await readdir(dir,{withFileTypes:true})) {
    if(item.name.startsWith('.') || item.name === 'native-data-manifest.json') continue
    const path=`${dir}/${item.name}`
    if(item.isDirectory()) await collect(path)
    else if(item.name.endsWith('.json')) {const data=await readFile(path); files.push({path,size:data.length,sha256:sha(data)})}
  }
}
await collect('src/data');await collect('generated');files.sort((a,b)=>a.path.localeCompare(b.path))
const manifest={format:1,runtime:1,ruleVersion:RULE_VERSION,solverVersion:SOLVER_INDEX_VERSION,id:sha(JSON.stringify(files)),revision,generatedAt:new Date().toISOString(),files}
await writeFile('generated/native-data-manifest.json',JSON.stringify(manifest)+'\n')
if(process.argv.includes('--manifest-only'))process.exit(0)
const dest='native/site'
await mkdir(dest,{recursive:true})
for(const name of ['index.html','glossary.html','src','generated']) await cp(name,`${dest}/${name}`,{recursive:true,filter:source=>!source.includes('/.atlas-raw')&&!source.includes('/.snapshot-staging')&&!source.endsWith('.test.js')})
await mkdir(`${dest}/native`,{recursive:true})
for(const name of ['tasks.html','tasks.css','host.html','shared'])await cp(`native/${name}`,`${dest}/native/${name}`,{recursive:true})
console.log(`Native assets: ${files.length} files, ${Math.round(files.reduce((s,f)=>s+f.size,0)/1024/1024)} MiB, ${manifest.id.slice(0,12)}`)
