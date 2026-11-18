// Only complete stable releases published by this repository are update sources.
const REPO = 'https://github.com/springs59/FGO-Max-Bond-Team-Setup'
const FEED = `${REPO}/releases/latest/download/native-update.json`
function parts(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('无效的软件版本')
  const p=version.split('.').map(Number)
  if(p.some(n=>!Number.isSafeInteger(n)))throw new Error('无效的软件版本')
  return p
}
function compare(a,b) {const x=parts(a),y=parts(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0}
function validate(manifest, platform='windows') {
  if (!manifest || manifest.format!==1 || manifest.prerelease!==false) throw new Error('发布信息不完整，暂不升级')
  parts(manifest.version)
  const tag=`native-v${manifest.version}`, releaseUrl=`${REPO}/releases/tag/${tag}`
  if(manifest.tag!==tag || manifest.releaseUrl!==releaseUrl)throw new Error('发布来源不匹配')
  for(const name of ['windows','android']) {
    const a=manifest.assets?.[name], filename=`FGO-Bond-${name==='windows'?'Windows':'Android'}-${manifest.version}.${name==='windows'?'exe':'apk'}`
    if(!a || a.name!==filename || a.url!==`${REPO}/releases/download/${tag}/${filename}` || !Number.isSafeInteger(a.size) || a.size<1 || a.size>1024**3 || !/^[a-f0-9]{64}$/.test(a.sha256))throw new Error('安装包信息或校验值无效')
  }
  if(!Number.isInteger(manifest.androidCode)||manifest.androidCode<1||manifest.androidCode>2100000000)throw new Error('无效的安卓版本序号')
  if(!['windows','android'].includes(platform))throw new Error('不支持的平台')
  return {version:manifest.version,androidCode:manifest.androidCode,releaseUrl,asset:manifest.assets[platform],notes:String(manifest.notes||'').slice(0,12000)}
}
function allowedUrl(value) {
  const u=new URL(value)
  return u.protocol==='https:' && !u.username && !u.password && !u.port && ((u.hostname==='github.com' && u.pathname.startsWith('/springs59/FGO-Max-Bond-Team-Setup/releases/')) || ['release-assets.githubusercontent.com','objects.githubusercontent.com','github-releases.githubusercontent.com'].includes(u.hostname))
}
module.exports={REPO,FEED,compare,validate,allowedUrl}
