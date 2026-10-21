export const CONFIGS={off:{root:'query',aiMode:'off',model:'baseline',family:'off'}}
for(const [family,model]of [['H','baseline'],['T','teacher']]){
 CONFIGS[family+'_single']={root:'query',model,family,use:'single'}
 CONFIGS[family+'_budget']={root:'adaptive',model,family,use:'budget',description:'Multiple model decisions across budget probes; all distinct starts exactly verified'}
 CONFIGS[family+'_branch']={root:'adaptive',model,family,use:'branch',interval:1,description:'Reinfer on surviving residual CE/party domains, memoize repeated features'}
 CONFIGS[family+'_stalled']={root:'adaptive',model,family,use:'stalled',interval:32,description:'Reinfer after no incumbent improvement for 32 nodes'}
 CONFIGS[family+'_hybrid']={root:'adaptive',model,family,use:'budget-stalled',interval:32,description:'Budget-diverse starts plus feedback during stalled search'}
}
CONFIGS.N_single={root:'query',model:'neural-large',family:'N',use:'single'}
for(const [name,use,interval]of [['top2','top2',1],['top4','top4',1],['branch','branch',8],['stalled','stalled',32],['hybrid','top2-stalled',32]])
 CONFIGS['N_'+name]={root:'adaptive',model:'neural-large',family:'N',use,interval}
for(const [name,use,interval]of [['raw','candidate',1],['memo','candidate-memo',1],['branch','candidate-branch',1],['stalled','candidate-stalled',32]])
 CONFIGS['F_'+name]={root:'adaptive',model:'baseline',family:'F',use,interval}
