"""Query/prefix-conditioned masked count policy. Does not read sealed test."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
os.environ.setdefault('OMP_NUM_THREADS','2')
import copy,gzip,hashlib,json,time
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]
folder=root/'experiments/ai-conditioned'
report=json.loads((folder/'reports/dataset.json').read_text())
started=time.time()

def load(split):
    path=folder/f'data/{split}.jsonl.gz'
    assert hashlib.sha256(path.read_bytes()).hexdigest()==report['splits'][split]['sha256']
    rows=[json.loads(l)for l in gzip.open(path,'rt')]
    x=[];y=[];w=[];m=[]
    for r in rows:
        for s in r['steps']:
            x.append(s['x']);y.append(s['y']);w.append(1/max(1,len(r['steps'])))
            m.append([k in s['legal']for k in range(7)])
    x=np.array(x,np.float32);y=np.array(y,np.int64);w=np.array(w,np.float32);w/=w.mean()
    assert x.shape[1]==len(report['features']) and np.isfinite(x).all()
    return x,y,w,np.array(m,bool),len(rows)

tx,ty,tw,tm,tn=load('train');vx,vy,vw,vm,vn=load('validation')
mean=tx.mean(axis=0);scale=np.maximum(tx.std(axis=0),.1)
tx=(tx-mean)/scale;vx=(vx-mean)/scale

def forward(x,p,mask):
    a=[x]
    for i in range(3):
        z=a[-1]@p[f'w{i}']+p[f'b{i}']
        a.append(np.maximum(0,z)if i<2 else z)
    z=np.where(mask,a[-1],-1e9);z-=z.max(axis=1,keepdims=True)
    out=np.exp(z);out/=out.sum(axis=1,keepdims=True)
    return out,a

def metrics(x,y,w,mask,p):
    out,_=forward(x,p,mask)
    return {'crossEntropy':float(np.sum(-np.log(np.maximum(out[np.arange(len(y)),y],1e-9))*w)/w.sum()),
            'teacherForcedAccuracy':float((out.argmax(axis=1)==y).mean()),'steps':len(y)}

summary={'schema':2,'features':len(report['features']),'trainQueries':tn,'validationQueries':vn,'sealedTestRead':False,
         'sourceDataSha256':report['sourceDataSha256'],'models':[]}
(folder/'models').mkdir(exist_ok=True)
for hidden in [64,128]:
    rng=np.random.default_rng(87200+hidden);dims=[len(mean),hidden,hidden//2,7]
    p={}
    for i in range(3):
        p[f'w{i}']=rng.normal(0,np.sqrt(2/dims[i]),(dims[i],dims[i+1])).astype(np.float32)
        p[f'b{i}']=np.zeros(dims[i+1],np.float32)
    moments={k:np.zeros_like(v)for k,v in p.items()};variances={k:np.zeros_like(v)for k,v in p.items()}
    best=copy.deepcopy(p);loss=float('inf');stale=0;step=0;history=[]
    for epoch in range(int(os.environ.get('FGO_CONFIG_EPOCHS','100'))):
        order=rng.permutation(len(tx));lr=.0015*.985**epoch
        for start in range(0,len(tx),512):
            ids=order[start:start+512];x=tx[ids];y=ty[ids];w=tw[ids]
            out,a=forward(x,p,tm[ids]);out[np.arange(len(y)),y]-=1;grad=out*w[:,None]/len(y)
            grads={}
            for i in [2,1,0]:
                grads[f'w{i}']=a[i].T@grad+.00002*p[f'w{i}'];grads[f'b{i}']=grad.sum(axis=0)
                if i:grad=(grad@p[f'w{i}'].T)*(a[i]>0)
            step+=1
            for k,g in grads.items():
                g=np.clip(g,-5,5);moments[k]=.9*moments[k]+.1*g;variances[k]=.999*variances[k]+.001*g*g
                p[k]-=lr*(moments[k]/(1-.9**step))/(np.sqrt(variances[k]/(1-.999**step))+1e-8)
        m=metrics(vx,vy,vw,vm,p);history.append(m['crossEntropy'])
        if m['crossEntropy']<loss-1e-5:loss=m['crossEntropy'];best=copy.deepcopy(p);stale=0
        else:stale+=1
        if epoch%10==0:print('hidden',hidden,'epoch',epoch,m,flush=True)
        if stale>=15:break
    trained=metrics(vx,vy,vw,vm,best)
    folded=best['w0']/scale[:,None];best['b0']-=mean@folded;best['w0']=folded
    model={'format':'fgo-conditioned-count-policy','featureVersion':2,'features':report['features'],
           'layers':[{'w':np.round(best[f'w{i}'].T,8).tolist(),'b':np.round(best[f'b{i}'],8).tolist()}for i in range(3)],
           'training':{'seed':87200+hidden,'hidden':[hidden,hidden//2],'trainQueries':tn,'validationQueries':vn,
                       'testLabelsUsed':False,'sourceDataSha256':report['sourceDataSha256'],'optimizer':'Adam, query-balanced masked count cross-entropy','searchTimeLimit':'none'}}
    digest=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest()
    model['version']=f'conditioned-v2-{hidden}-{digest[:12]}'
    path=folder/f'models/conditioned-{hidden}.json';path.write_text(json.dumps(model,separators=(',',':'))+'\n')
    summary['models'].append({'path':str(path.relative_to(root)),'version':model['version'],'hidden':hidden,'validation':trained,'epochs':len(history),'history':history,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    (folder/'reports/training.json').write_text(json.dumps(summary,indent=2)+'\n')
    print('exported',model['version'],trained,flush=True)
summary.update(status='complete',elapsedSeconds=time.time()-started,selected=min(summary['models'],key=lambda m:m['validation']['crossEntropy'])['path'])
(folder/'reports/training.json').write_text(json.dumps(summary,indent=2)+'\n')
print('Selected',summary['selected'],flush=True)
