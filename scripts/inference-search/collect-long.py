"""Collect sanitized cell summaries, explicitly retaining censoring and failures."""
import datetime
import json
import os
from pathlib import Path
import sys

source,out,request_file=map(Path,sys.argv[1:4])
request=json.loads(request_file.read_text())
out.mkdir(parents=True,exist_ok=True)
allowed={'schema','requestId','caseId','key','inputSha256','kind','deadlineMs','prefixMs','smoke','status','startedAt','finishedAt','productCommit','harnessCommit','runId','environment','validatedCheckpoints','checkpoint','progress','inferenceCallsObserved','inferenceMsObserved','prefix','trace','observedMs','initMs','provenComplete','valid','facts','solveMs','cpuMs','nodes','inferenceCallsExact','inferenceMsExact','inferenceCountKind','heapMiB','rssMiB','validationMs','cacheHit','alternativesSha256','errorSha256','exitCode','signal'}
cells={}
issues=[]
for path in sorted(source.rglob('*.json')):
    r=json.loads(path.read_text())
    identity=(r.get('caseId'),r.get('key'))
    assert identity not in cells,'Duplicate cell artifact'
    assert identity[0] in request['cases'] and identity[1] in request['configs'],'Unknown cell'
    assert r.get('requestId')==request['requestId'] and r.get('deadlineMs')==request['deadlineMs'] and r.get('smoke') is False,'Wrong protocol'
    assert r.get('inputSha256')==request['cases'][identity[0]],'Input mismatch'
    assert r.get('productCommit')==request['productCommit'],'Wrong product commit'
    cells[identity]={k:v for k,v in r.items() if k in allowed}
rows=[]
for case in request['cases']:
    for key in request['configs']:
        r=cells.get((case,key),{'caseId':case,'key':key,'status':'missing'})
        rows.append(r)
        if r['status'] not in ['complete','timeout']:issues.append({'caseId':case,'key':key,'status':r['status']})
        if r['status']=='complete' and (r.get('valid') is not True or r.get('provenComplete') is not True):
            issues.append({'caseId':case,'key':key,'status':'uncertified-completion'})
comparisons=[]
for case in request['cases']:
    complete=[r for r in rows if r['caseId']==case and r['status']=='complete' and r.get('valid') and r.get('provenComplete')]
    objectives={json.dumps([r['facts'],r.get('alternativesSha256')],sort_keys=True) for r in complete}
    consistent=len(objectives)<=1
    if not consistent:issues.append({'caseId':case,'status':'objective-mismatch'})
    baseline=next((r for r in complete if r['key']=='off'),None)
    comparisons.append({'caseId':case,'completedCertified':len(complete),'completedObjectivesAgree':consistent,
        'relativeToOff':{r['key']:r['solveMs']/baseline['solveMs'] for r in complete} if baseline and consistent else None})
run_id=os.environ.get('GITHUB_RUN_ID')
run_url='https://github.com/'+os.environ.get('GITHUB_REPOSITORY','springs59/FGO-Max-Bond-Team-Setup')+'/actions/runs/'+str(run_id)
summary={'schema':1,'request':request,'runUrl':run_url,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'counts':{s:sum(r['status']==s for r in rows) for s in sorted({r['status'] for r in rows})},'passed':not issues,
    'issues':issues,'comparisons':comparisons,'cells':rows}
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(out/'checks.json').write_text(json.dumps({'passed':not issues,'expectedCells':36,'receivedCells':len(cells),'issues':issues},indent=2)+'\n')
lines=['# 三小时压力测试','',f'[GitHub Actions 运行记录]({run_url})','',
'每个场景 × 配置独立冷启动一次，求解上限 **10,800 秒（3 小时）**；准备数据及加载模块不计入求解时间。4 个场景、9 种配置，共 36 组，分批排队运行。未限制模型推理次数。','',
'沿用上一轮的合成输入、模型权重、生产代码和压力观测代码；输入 SHA-256 及全部 20 个实验运行时文件均在启动前校验。原生与新用法保持上一轮的配置：H 单次/预算加停滞反馈、T 单次/停滞反馈、N 单次/停滞反馈；F 为原候选评分框架参考。','',
'表中“超时”仅表示截至 3 小时尚未完成；其合法检查点不能作为最优解。调用次数带 ≥ 的是最后观测到的下界，完成项为精确计数。第 30 秒检查点来自同一次未中断查询；30 秒前已完成的项目使用最终结果。','',
'本轮运行在独立 GitHub 标准 Ubuntu runner。硬件及 Node 版本记录在 JSON 中；与此前本地 30 秒测试的耗时不能直接相除作为加速比。单次冷启动不代表统计显著性。', '',
'状态计数：'+json.dumps(summary['counts'],ensure_ascii=False)+'。校验：'+('通过' if not issues else '存在缺失、错误或结果不一致，详见 checks.json')+'。','']
def facts(r,prefix=False):
    if prefix:
        if r.get('solveMs',float('inf'))<=request['prefixMs']:return r.get('facts')
        return (r.get('prefix') or {}).get('checkpoint',{}) and (r.get('prefix') or {}).get('checkpoint',{}).get('facts')
    return r.get('facts') or (r.get('checkpoint') or {}).get('facts')
def display(v):return '—' if not v else f'{v[0]:g} / {v[1]:g}'
for case in request['cases']:
    lines += ['## '+case,'','| 配置 | 状态 | 求解秒数 | 调用次数 | 30秒时分数 / COST | 最终或检查点分数 / COST | 已证明完成 |','|---|---|---:|---:|---:|---:|---|']
    for r in rows:
        if r['caseId']!=case:continue
        elapsed=f"{r['solveMs']/1000:.3f}" if 'solveMs' in r else ('≥10800' if r['status']=='timeout' else '—')
        calls=str(r['inferenceCallsExact']) if 'inferenceCallsExact' in r else '≥'+str(r.get('inferenceCallsObserved',0))
        lines.append(f"| {r['key']} | {r['status']} | {elapsed} | {calls} | {display(facts(r,True))} | {display(facts(r))} | {'是' if r.get('provenComplete') and r.get('valid') else '否'} |")
    comparison=next(c for c in comparisons if c['caseId']==case)
    if comparison['relativeToOff']:
        lines += ['', '已完成且结果一致的项目相对关闭 AI 的耗时比（小于 1 更快）：'+ '，'.join(f"{k} {v:.3f}" for k,v in comparison['relativeToOff'].items())+'。']
    lines.append('')
lines += ['完整数值、每分钟进度、CPU/内存、源版本和输入校验值见 [summary.json](summary.json)，完整性检查见 [checks.json](checks.json)。公开日志仅包含数值观测，不包含输入账户、配队方案或原始数据包。','']
(out/'README.md').write_text('\n'.join(lines))
print(json.dumps({'counts':summary['counts'],'passed':summary['passed'],'report':str(out)}))
