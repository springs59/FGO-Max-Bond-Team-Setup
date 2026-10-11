import {readFile,stat,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'
import policy from '../native/desktop/update-policy.cjs'
export async function buildUpdate(dir,version,androidCode,notes='') {
  const assets={}
  for(const platform of ['windows','android']) {
    const name=`FGO-Bond-${platform==='windows'?'Windows':'Android'}-${version}.${platform==='windows'?'exe':'apk'}`,file=`${dir}/${name}`,h=createHash('sha256')
    for await(const chunk of createReadStream(file))h.update(chunk)
    assets[platform]={name,url:`${policy.REPO}/releases/download/native-v${version}/${name}`,size:(await stat(file)).size,sha256:h.digest('hex')}
  }
  const manifest={format:1,prerelease:false,version,androidCode:Number(androidCode),tag:`native-v${version}`,releaseUrl:`${policy.REPO}/releases/tag/native-v${version}`,notes,assets}
  policy.validate(manifest)
  await writeFile(`${dir}/native-update.json`,JSON.stringify(manifest,null,2)+'\n')
  return manifest
}
if(process.argv[1]?.endsWith('/build-native-update.mjs'))await buildUpdate('release',process.env.RELEASE_VERSION,process.env.ANDROID_VERSION_CODE,await readFile('docs/native-update-notes.md','utf8'))
