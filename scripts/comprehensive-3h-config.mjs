import {resolve} from 'node:path'
export const SOURCE='23e50c082636f58f1acba9179880b9617d054a03'
export const PREVIOUS='a1dc0437238a56473f529ffec269132ed544f92b'
export const HISTORY={v200:'6320a8ffd31c444fbc76a64e14e576f759e1de1c',v212:'13d8fa7ed273c0f86c2babd9b2b6bc9c78767519',
 interval:'0ae9b27aa91c1bd344e8392b996dc96c788de64c',v213:'10d13ee1214cd18288c971b1c87ec7e9c2d42dfd',v216:'2d21ebd76b14139051af9f4dad9b926d6aad0577',previous:PREVIOUS}
export const MODELS=['off','baseline','teacher','neural-large']
const names={off:'关闭AI',baseline:'经典高起点AI',teacher:'扩展策略AI','neural-large':'大数据神经AI'}
export const VERSIONS={
 v200:{label:'2.0.0原版',source:'v200',mode:'native',model:'off'},
 v212:{label:'2.1.2',source:'v212',mode:'native',model:'bundled'},
 interval:{label:'早期区间剪枝版',source:'interval',mode:'native',model:'bundled'},
 v213:{label:'2.1.3框架版',source:'v213',mode:'native',model:'bundled'},
 v216:{label:'2.1.6发布版',source:'v216',mode:'native',model:'bundled'},
 ...Object.fromEntries(MODELS.flatMap(model=>[
  ['native-'+model,{label:'上一版原生代表解／'+names[model],source:'previous',mode:'native',model}],
  ['literal-'+model,{label:'上一版逐队同分／'+names[model],source:'previous',mode:'literal',model}],
  ['group-'+model,{label:'当前等效合并／'+names[model],source:'current',mode:'group',model}],
 ])),
 'group-no-bounds':{label:'当前合并关闭分数剪枝（归因对照）',source:'current',mode:'group',model:'off',bounds:false},
}
export const ANCHOR='group-off'
export const CONTENDERS=Object.keys(VERSIONS).filter(v=>v!==ANCHOR)
export const runtimeRoot=v=>{
 const meta=VERSIONS[v];if(!meta)throw Error('Unknown variant '+v)
 return meta.source==='current'?process.cwd():resolve(process.env.FGO_COMPARE_BASELINES||'baselines',meta.source)
}
export const expectedCommit=v=>VERSIONS[v].source==='current'?SOURCE:HISTORY[VERSIONS[v].source]
export const FULL=v=>VERSIONS[v].mode!=='native'
export const SMALL=new Set(['conditional','self-flat','six-own','prefer','pins-stock-aura','active-event','grand','fixed-npc','CN-small','JP-small'])
export const RUNTIME_FILES=['src/recommend.js','src/solver/inventory-curve-solver.js','src/solver/ai-model.js',
 'src/solver/score-team-enumerator.js','src/solver/score-team-equivalence.js','src/solver/query-ai.js','src/solver/ai-search.js',
 'src/solver/query-models.js','src/solver/query-policies/T.js','src/solver/query-policies/N8192.js']
export const DATA_FILES=['src/data/servants.json','src/data/ces.json','src/data/jp/bundle.json','src/data/bond-bonuses.json']
export const physicalKey=r=>JSON.stringify([r.score,r.packed.cost,r.packed.slots.map(s=>[s.p,!!s.f,!!s.s,!!s.g,s.svt,s.art||'default',
 s.ce||0,s.ce?s.mlb!==false:true,s.bond||0,s.bond?s.bondMlb!==false:true,s.reward||0,s.reward?s.rewardMlb!==false:true])])
export function pairMatrix(ids){return ids.flatMap(id=>CONTENDERS.map(contender=>({id,contender,sourceKey:VERSIONS[contender].source,
 baselineRef:VERSIONS[contender].source==='current'?'':expectedCommit(contender)})))}
