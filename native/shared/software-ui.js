const $=id=>document.getElementById(id)
export async function softwareStatus() {
  if(window.fgoDesktop?.softwareStatus)return await window.fgoDesktop.softwareStatus()
  if(window.FgoAndroid?.softwareStatus)return JSON.parse(window.FgoAndroid.softwareStatus())
  return null
}
export async function softwareCommand(action) {
  if(window.fgoDesktop?.softwareCommand)return await window.fgoDesktop.softwareCommand(action)
  if(window.FgoAndroid?.softwareCommand){window.FgoAndroid.softwareCommand(action);return await softwareStatus()}
  return null
}
export function softwareView(s,android=false) {
  const state=s.state||'idle',busy=['checking','downloading','verifying','installing'].includes(state),candidate=s.latestVersion&&s.latestVersion!==s.currentVersion
  const labels={idle:'等待检查',checking:'正在检查',current:'已是最新',available:'发现新版本',downloading:'下载中',verifying:'校验中',ready:'可升级',paused:'下载已暂停',permission:'需要安装权限',installing:'正在升级',error:'更新未完成'}
  const phases={idle:'检查仓库已正式发布的版本。',checking:'正在读取仓库发布信息…',current:'当前软件已是最新版本。',available:'发现新版本，选择下载后再升级。',downloading:'正在下载安装包，可以继续使用软件。',verifying:'正在校验安装包完整性…',ready:android?'安装包已就绪，升级时在系统界面确认安装。':'安装包已就绪，升级将退出软件并在完成后重新打开。',paused:'已完成的下载会保留，继续时尝试续传。',permission:'请在系统设置中允许此应用安装软件，返回后继续覆盖升级。',installing:'正在退出并升级软件…',error:'更新未完成，可重试；账号和配队数据仍可使用。'}
  return {state,label:labels[state]||labels.idle,phase:phases[state]||phases.idle,busy,download:!!candidate&&!busy&&['available','paused','error'].includes(state),install:['ready','permission'].includes(state),pause:state==='downloading',progress:['downloading','verifying','paused'].includes(state),downloadLabel:state==='paused'?'继续下载':state==='error'?'重试下载':'下载新版本'}
}
if(typeof document!=='undefined' && $('software-update')) {
  let running=false,actionError='',acting=false
  async function render() {
    if(running)return;running=true
    try {
      const s=await softwareStatus();if(!s)return
      $('software-update').hidden=false
      const android=!!window.FgoAndroid,v=softwareView(s,android)
      $('software-state').textContent=v.label;$('software-state').dataset.state=v.state
      $('software-version').textContent=`当前版本 v${s.currentVersion||'—'}${s.latestVersion?' · 仓库版本 v'+s.latestVersion:''}`
      $('software-phase').textContent=v.phase
      $('software-progress').hidden=!v.progress;$('software-progress').max=s.total||1;$('software-progress').value=Math.min(s.done||0,s.total||1)
      $('software-bytes').textContent=s.total?`${((s.done||0)/1048576).toFixed(1)} / ${(s.total/1048576).toFixed(1)} MB${s.checkedAt?' · 最近检查 '+new Date(s.checkedAt).toLocaleString('zh-CN',{hour12:false}):''}`:s.checkedAt?'最近检查 '+new Date(s.checkedAt).toLocaleString('zh-CN',{hour12:false}):''
      $('software-check').disabled=v.busy||acting
      $('software-download').hidden=!v.download;$('software-download').textContent=v.downloadLabel;$('software-download').disabled=acting
      $('software-pause').hidden=!v.pause
      $('software-install').hidden=!v.install;$('software-install').disabled=acting||s.supported===false
      $('software-install').textContent=android?'覆盖升级（系统确认）':'退出并升级'
      const error=actionError||s.error||'';$('software-error').hidden=!error;$('software-error').textContent=error
      $('software-auto').checked=s.auto!==false
      $('software-notes-box').hidden=!s.notes||v.state==='current';$('software-notes').textContent=s.notes||''
      $('software-help').textContent=android?'覆盖升级保留账号、设置和本地计算数据。首次需允许本应用安装软件，最后在系统界面确认；取消安装后仍可再次升级。':'覆盖升级保留账号、设置和本地计算数据。点击“退出并升级”会关闭软件，完成后重新打开。'
    }catch(e){actionError=String(e.message||e);$('software-error').hidden=false;$('software-error').textContent=actionError}
    finally{running=false}
  }
  async function send(action){acting=true;actionError='';render();try{await softwareCommand(action)}catch(e){actionError=String(e.message||e)}finally{acting=false;render()}}
  for(const action of ['check','download','pause','install'])$('software-'+action).onclick=()=>send(action)
  $('software-auto').onchange=async()=>{
    actionError='';try{const value=$('software-auto').checked;if(window.fgoDesktop)await window.fgoDesktop.softwareAuto(value);else if(window.FgoAndroid)window.FgoAndroid.softwareAuto(value)}catch(e){actionError=String(e.message||e)}render()
  }
  setInterval(render,1000);render()
}
