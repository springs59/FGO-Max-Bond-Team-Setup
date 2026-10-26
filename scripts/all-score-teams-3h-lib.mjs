import {writeFileSync,renameSync,mkdirSync} from 'node:fs'
import {dirname} from 'node:path'
export const MODELS=['off','baseline','teacher','neural-large']
export const LABELS={off:'关闭AI',baseline:'经典高起点AI',teacher:'扩展策略AI','neural-large':'大数据神经AI'}
export const isError=row=>!row||!['complete','timeout'].includes(row.status)
export function writeJson(path,value){mkdirSync(dirname(path),{recursive:true});const temp=path+'.writing';writeFileSync(temp,JSON.stringify(value,null,2)+'\n');renameSync(temp,path)}
export function validateRows(rows){
 const errors=[];const complete=rows.filter(r=>r?.status==='complete')
 for(const row of rows){
  if(isError(row))errors.push('异常或缺少结果：'+(row?.model||'unknown'))
  if(row?.status==='complete'&&(!row.complete||!row.maximumProven||!row.tiedTeamsSha256))errors.push('完成状态缺少完整性证明：'+row.model)
  if(row?.status==='timeout'&&row.complete)errors.push('超时错误标记为完整：'+row.model)
 }
 const proven=rows.filter(r=>r?.maximumProven)
 if(new Set(proven.map(r=>r.best)).size>1)errors.push('已证明的最高分不一致')
 if(proven.length&&rows.some(r=>r?.best!=null&&r.best>proven[0].best))errors.push('部分结果超过已证明的最高分')
 if(new Set(complete.map(r=>r.resultUnit||'physical-teams')).size>1)errors.push('不能混合比较物理队伍与等效方案组的计数或指纹')
 if(complete.length>1&&new Set(complete.map(r=>JSON.stringify([r.best,r.tiedTeams,r.tiedTeamsSha256]))).size!==1)errors.push('已完成模型的最高分/全体同分集合不一致')
 if(complete.length&&rows.some(r=>r?.best!=null&&r.best>complete[0].best))errors.push('部分结果超过已完成查询声称的最高分')
 return errors
}
export function compareCases(cases,ids,models=MODELS){
 const errors=[],records=[],byId=new Map()
 for(const item of cases){if(byId.has(item.id))errors.push('重复条件：'+item.id);byId.set(item.id,item)}
 for(const id of ids){
  const item=byId.get(id)
  if(!item){errors.push('缺少条件：'+id);for(const model of models)records.push({id,model,long:{status:'missing'}});continue}
  if(!item.finished)errors.push('条件未收尾：'+id)
  for(const stage of ['short','long'])errors.push(...validateRows(models.map(m=>item.stages?.[stage]?.models?.[m])).map(e=>id+'/'+stage+'：'+e))
  for(const model of models){
   const short=item.stages?.short?.models?.[model],long=item.stages?.long?.models?.[model]
   if(short?.status==='complete'&&long?.status==='complete'&&(short.resultUnit||'physical-teams')!==(long.resultUnit||'physical-teams'))errors.push(id+'/'+model+'：短测和长测输出单位不同，不能比较完整集合')
   if(short?.status==='complete'&&long?.status==='complete'&&JSON.stringify([short.best,short.tiedTeams,short.tiedTeamsSha256])!==JSON.stringify([long.best,long.tiedTeams,long.tiedTeamsSha256]))errors.push(id+'/'+model+'：同机短测和长测的完整结果不一致')
   if(short?.best!=null&&long?.best!=null&&long.best<short.best)errors.push(id+'/'+model+'：长测当前可行分数低于同机短测')
   records.push({id,model,cpuCore:item.cpuMapping?.[model],inputSha256:item.inputSha256,short,long,checkpoints:item.stages?.long?.checkpoints?.[model]||[]})
  }
  errors.push(...(item.errors||[]).map(e=>id+'：'+e))
 }
 return {records,errors,short:{complete:records.filter(r=>r.short?.status==='complete').length,timeout:records.filter(r=>r.short?.status==='timeout').length},
  long:{complete:records.filter(r=>r.long?.status==='complete').length,timeout:records.filter(r=>r.long?.status==='timeout').length,errors:records.filter(r=>isError(r.long)).length}}
}

