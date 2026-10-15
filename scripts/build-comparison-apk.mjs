import {execFileSync} from 'node:child_process'
import {readFile,writeFile,mkdir,cp,rm,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'
const root=process.cwd(),dest='native/site'
await rm(dest,{recursive:true,force:true});await mkdir(dest,{recursive:true})
const temp='native/comparison-sources'
await rm(temp,{recursive:true,force:true});await mkdir(temp,{recursive:true})
const sources=[['200','2.0.0','6320a8ffd31c444fbc76a64e14e576f759e1de1c'],['208','2.0.8','d586ef21952b3b3db7dc5734036899ffed90484d'],['209','2.0.9',execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()]]
const manifest={format:1,applicationId:'cc.fgobond.compare',dataSource:'d586ef21952b3b3db7dc5734036899ffed90484d',dataFiles:[],versions:[]}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
async function collect(dir,prefix=''){
  const result=[]
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(item.name.startsWith('.')||item.name==='quest-matrix')continue
    const relative=path.posix.join(prefix,item.name),file=path.join(dir,item.name)
    if(item.isDirectory())result.push(...await collect(file,relative))
    else if(item.name.endsWith('.json'))result.push({path:relative,sha256:hash(await readFile(file))})
  }
  return result.sort((a,b)=>a.path.localeCompare(b.path))
}
await mkdir(`${temp}/208`,{recursive:true})
execFileSync('tar',['-x','-C',`${temp}/208`],{input:execFileSync('git',['archive','d586ef21952b3b3db7dc5734036899ffed90484d','src/data','generated'],{maxBuffer:100*1024*1024})})
for(const [folder,version,revision] of sources){
  let source=root
  if(folder!=='209'){
    source=path.resolve(temp,folder);await mkdir(source,{recursive:true})
    const archive=execFileSync('git',['archive',revision,'index.html','glossary.html','formation.html','src','generated','native/shared','native/tasks.html','native/tasks.css','native/host.html'],{maxBuffer:100*1024*1024})
    execFileSync('tar',['-x','-C',source],{input:archive})
  }
  const target=`${dest}/versions/${folder}`;await mkdir(target,{recursive:true})
  for(const name of ['index.html','glossary.html','formation.html','src','generated'])await cp(path.join(source,name),`${target}/${name}`,{recursive:true,filter:p=>!p.includes('/.atlas-raw')&&!p.includes('/.snapshot-staging')&&!p.endsWith('.test.js')&&!p.includes('/quest-matrix')&&!p.endsWith('native-data-manifest.json')})
  // Frozen, identical release snapshot. Only application/solver code differs.
  for(const name of ['src/data','generated']){
    await rm(`${target}/${name}`,{recursive:true,force:true})
    await cp(path.join(root,temp,'208',name),`${target}/${name}`,{recursive:true,filter:p=>!p.includes('/quest-matrix')&&!p.includes('/.')&&!p.endsWith('native-data-manifest.json')})
  }
  await mkdir(`${target}/native`,{recursive:true})
  await cp(path.join(source,'native/shared'),`${target}/native/shared`,{recursive:true})
  for(const file of ['index.html','glossary.html','formation.html']){
    let html=await readFile(`${target}/${file}`,'utf8')
    html=html.replace('<html lang="zh-CN">',`<html lang="zh-CN" data-comparison-version="${version}">`)
    html=html.replace(/<script type="module" src="\.\/native\/shared\/app-entry\.js"><\/script>/g,'')
    // Entry order ensures timing hooks attach before application Workers exist.
    html=html.replace(/<script type="module" src="([^\"]+)"><\/script>/,(_,entry)=>`<script type="module" src="./comparison-entry-${file.replace('.html','')}.js"></script>`)
    await writeFile(`${target}/${file}`,html)
    const original=await readFile(path.join(source,file),'utf8')
    const entry=[...original.matchAll(/<script type="module" src="([^\"]+)"><\/script>/g)].map(m=>m[1]).find(x=>!x.includes('app-entry'))
    if(entry)await writeFile(`${target}/comparison-entry-${file.replace('.html','')}.js`,`import './comparison-hook.js';\nawait import(${JSON.stringify(entry)});\n`)
  }
  await cp('native/comparison/hook.js',`${target}/comparison-hook.js`)
  if(folder!=='200'){
    const file=`${target}/src/worker-transport.js`,text=await readFile(file,'utf8')
    await writeFile(file,text.replace('export async function postWorkerMessage(target,value) {','export async function postWorkerMessage(target,value) {\n  globalThis.fgoBenchmarkStart?.(target,value)'))
  }
  manifest.versions.push({folder,version,revision,workerSha256:hash(await readFile(`${target}/src/recommend-worker.js`))})
  if(folder==='208')manifest.dataFiles=[...await collect(`${target}/src/data`,'src/data'),...await collect(`${target}/generated`,'generated')]
}
await writeFile(`${dest}/comparison-manifest.json`,JSON.stringify(manifest,null,2)+'\n')
await rm(temp,{recursive:true,force:true})
console.log('Three isolated versions staged; shared data files:',manifest.dataFiles.length)
