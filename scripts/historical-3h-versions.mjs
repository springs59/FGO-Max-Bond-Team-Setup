import {resolve} from 'node:path'
export const CURRENT_SOURCE='8196a7c65d4b9f48f5460ffecb2fc8c7bc55dabe'
export const VERSIONS={
 v200:{label:'2.0.0 原版',ref:'6320a8ffd31c444fbc76a64e14e576f759e1de1c',ai:'off'},
 v212:{label:'2.1.2 固定对照版',ref:'13d8fa7ed273c0f86c2babd9b2b6bc9c78767519',ai:'on'},
 interval:{label:'早期区间剪枝版',ref:'0ae9b27aa91c1bd344e8392b996dc96c788de64c',ai:'on'},
 v213:{label:'2.1.3 框架版',ref:'10d13ee1214cd18288c971b1c87ec7e9c2d42dfd',ai:'on'},
 v216:{label:'2.1.6 已发布版',ref:'2d21ebd76b14139051af9f4dad9b926d6aad0577',ai:'on'},
 'current-off':{label:'当前版：关闭 AI',ref:CURRENT_SOURCE,ai:'off'},
 'current-baseline':{label:'当前版：经典高起点 AI',ref:CURRENT_SOURCE,ai:'on',model:'baseline'},
 'current-teacher':{label:'当前版：扩展策略 AI',ref:CURRENT_SOURCE,ai:'on',model:'teacher'},
 'current-neural-large':{label:'当前版：大数据神经 AI',ref:CURRENT_SOURCE,ai:'on',model:'neural-large'},
}
// Every cohort has the same current-off anchor. Never rank raw times from
// different hosts as though they were measurements on one machine.
export const COHORTS={
 historical:['v200','v212','interval','current-off'],
 released:['v213','v216','current-baseline','current-off'],
 models:['current-off','current-baseline','current-teacher','current-neural-large'],
}
export function versionRoot(id){
 if(!VERSIONS[id])throw Error('Unknown version '+id)
 return id.startsWith('current-')?process.cwd():resolve(process.env.FGO_HISTORY_ROOT||'baselines',id)
}
