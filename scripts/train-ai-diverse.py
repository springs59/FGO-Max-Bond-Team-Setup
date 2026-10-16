"""Offline only. Never writes src/solver/ai-model.js or reads sealed test labels."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
os.environ.setdefault('OMP_NUM_THREADS','2')
import gzip,json,hashlib,time,copy
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'experiments/ai-diverse'
(FOLDER/'models').mkdir(parents=True,exist_ok=True)
FEATURES=['meanRate','maxRate','topRate','hitFraction','cost','costShare','ratePerCost','flatRelative','availability','liveFraction','selfBonus','partyBonus','base','budget','capacity','preferred']
started=time.time()
report=json.loads((FOLDER/'reports/dataset.json').read_text())
if report['status']!='complete':raise RuntimeError('Label generation must finish before training')

def load(split):
    path=FOLDER/f'data/{split}.jsonl.gz'
    if hashlib.sha256(path.read_bytes()).hexdigest()!=report['files'][split]['sha256']:raise RuntimeError('Dataset digest mismatch')
    rows=[];seen=set()
    with gzip.open(path,'rt') as f:
        for line in f:
            q=json.loads(line)
            if q['index'] in seen or q['split']!=split:raise RuntimeError('Duplicate or mixed split row')
            seen.add(q['index'])
            if q.get('labels'):rows.append(q)
    if len(seen)!=report['counts'][split] or len(rows)!=report['splits'][split]['feasible']:raise RuntimeError('Dataset count mismatch')
    return sorted(rows,key=lambda r:r['index'])

def arrays(rows,head):
    xs=[];ys=[];weights=[];queries=[]
    for q in rows:
        samples=q['labels'][head]
        for s in samples:
            xs.append(s['x']);ys.append(s['y']);weights.append(1/max(1,len(samples)));queries.append(q['case']['id'])
    x=np.asarray(xs,dtype=np.float32);y=np.asarray(ys,dtype=np.float32);w=np.asarray(weights,dtype=np.float32);w/=w.mean()
    if x.shape[1]!=len(FEATURES) or not np.isfinite(x).all() or not np.isfinite(y).all():raise RuntimeError('Invalid teacher features')
    if not ((y>=0)&(y<=1)).all():raise RuntimeError('Targets out of range')
    return x,y,w,np.asarray(queries)

def predict(x,p):
    z=np.tanh(x@p['w1']+p['b1'])@p['w2']+p['b2']
    return 1/(1+np.exp(-np.clip(z,-30,30)))

def loss(x,y,w,p):
    z=predict(x,p);return float(np.sum(w*(-y*np.log(np.maximum(z,1e-8))-(1-y)*np.log(np.maximum(1-z,1e-8))))/np.sum(w))

def train(data,val,hidden,seed):
    x,y,w,_=data;vx,vy,vw,_=val;rng=np.random.default_rng(seed)
    mean=x.mean(axis=0);scale=np.maximum(x.std(axis=0),.1);x=(x-mean)/scale;vx=(vx-mean)/scale
    p={'w1':rng.normal(0,np.sqrt(2/(16+hidden)),(16,hidden)).astype(np.float32),'b1':np.zeros(hidden,np.float32),'w2':rng.normal(0,.2,hidden).astype(np.float32),'b2':np.zeros((),np.float32)}
    m={k:np.zeros_like(v) for k,v in p.items()};v={k:np.zeros_like(v) for k,v in p.items()}
    best=copy.deepcopy(p);bestloss=float('inf');patience=0;steps=0;history=[]
    epochs=int(os.environ.get('FGO_TRAIN_EPOCHS','120'))
    for epoch in range(epochs):
        order=rng.permutation(len(x));lr=.003*(.98**epoch)
        for start in range(0,len(x),512):
            idx=order[start:start+512];xx=x[idx];yy=y[idx];ww=w[idx]
            h=np.tanh(xx@p['w1']+p['b1']);z=h@p['w2']+p['b2'];out=1/(1+np.exp(-np.clip(z,-30,30)))
            dz=(out-yy)*ww/len(idx);dh=dz[:,None]*p['w2'][None,:]*(1-h*h)
            grads={'w1':xx.T@dh+.00005*p['w1'],'b1':dh.sum(axis=0),'w2':h.T@dz+.00005*p['w2'],'b2':dz.sum()}
            steps+=1
            for k,g in grads.items():
                g=np.clip(g,-5,5);m[k]=.9*m[k]+.1*g;v[k]=.999*v[k]+.001*g*g
                p[k]-=lr*(m[k]/(1-.9**steps))/(np.sqrt(v[k]/(1-.999**steps))+1e-8)
        l=loss(vx,vy,vw,p);history.append(l)
        if l<bestloss-1e-5:bestloss=l;best=copy.deepcopy(p);patience=0
        else:patience+=1
        if epoch%10==0:print('hidden',hidden,'epoch',epoch,'validation BCE',round(l,6),flush=True)
        if patience>=18:break
    folded=best['w1']/scale[:,None]
    head={'w1':np.round(folded.T,8).tolist(),'b1':np.round(best['b1']-mean@folded,8).tolist(),'w2':np.round(best['w2'],8).tolist(),'b2':float(best['b2'])}
    return head,{'epochs':len(history),'validationWeightedBCE':bestloss,'history':history}

def metrics(data,head):
    x,y,w,q=data;p={'w1':np.array(head['w1']).T,'b1':np.array(head['b1']),'w2':np.array(head['w2']),'b2':np.array(head['b2'])};pred=predict(x,p)
    pairs=right=ties=0
    for key in np.unique(q):
        mask=q==key;yy=y[mask];pp=pred[mask];dy=yy[:,None]-yy[None,:];dp=pp[:,None]-pp[None,:];valid=np.triu(np.abs(dy)>1e-8,1)
        pairs+=int(valid.sum());right+=int(((dy*dp>0)&valid).sum());ties+=int(((dp==0)&valid).sum())
    return {'samples':len(x),'queryBalancedBCE':loss(x,y,w,p),'MAE':float(np.abs(pred-y).mean()),'unequalTargetPairs':pairs,'correctlyOrderedPairs':right,'tiedPredictions':ties,'pairwiseAccuracy':right/pairs if pairs else None}

train_rows=load('train');val_rows=load('validation')
data={h:(arrays(train_rows,h),arrays(val_rows,h))for h in ['equipment','servant']}
# Only the old model weights are loaded for a ranking reference; no test labels.
import subprocess
old=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {SEARCH_MODEL} from './src/solver/ai-model.js';console.log(JSON.stringify(SEARCH_MODEL))"],cwd=ROOT,text=True))
summary={'schema':1,'status':'running','sourceDataSha256':report['dataSha256'],'trainFeasibleQueries':len(train_rows),'validationFeasibleQueries':len(val_rows),'sealedTestRead':False,'models':[],
         'reference':{'version':old['version'],'validation':{h:metrics(data[h][1],old['heads'][h])for h in data}}}
for hidden in [16,32,64]:
    heads={};histories={}
    for j,h in enumerate(data):heads[h],histories[h]=train(*data[h],hidden,63000+hidden+j)
    model={'featureVersion':1,'features':FEATURES,'heads':heads,'training':{'sourceDataSha256':report['dataSha256'],'datasetFiles':report['files'],'trainQueries':len(train_rows),'validationQueries':len(val_rows),'testLabelsUsed':False,'seed':63000+hidden,'hidden':hidden,'optimizer':'NumPy Adam, query-balanced soft BCE; standardized inputs folded into first layer'}}
    digest=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest();model['version']='offline-diverse-'+str(hidden)+'-'+digest[:12]
    path=FOLDER/'models'/f'candidate-{hidden}.json';path.write_text(json.dumps(model,separators=(',',':'))+'\n')
    result={'version':model['version'],'path':str(path.relative_to(ROOT)),'hidden':hidden,'validation':{h:metrics(data[h][1],heads[h])for h in data},'training':histories,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    summary['models'].append(result);(FOLDER/'reports/training.json').write_text(json.dumps(summary,indent=2)+'\n')
    print('exported',model['version'],flush=True)
best=min(summary['models'],key=lambda m:sum(m['validation'][h]['queryBalancedBCE']for h in data));summary.update(status='complete',elapsedSeconds=time.time()-started,selectedByValidationLoss=best['path'])
(FOLDER/'reports/training.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'selected':best['path'],'elapsedSeconds':summary['elapsedSeconds'],'models':[{k:v for k,v in m.items()if k!='training'}for m in summary['models']]},indent=2),flush=True)
