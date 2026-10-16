"""Small generic search-work predictor; never reads calibration/validation/test."""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
os.environ.setdefault('OMP_NUM_THREADS','2')
import json,hashlib,time,copy
from pathlib import Path
import numpy as np
folder=Path(__file__).resolve().parents[1]/'experiments/ai-general'
meta=json.loads((folder/'reports/teacher.json').read_text());assert meta['status']=='complete' and not meta['errors']
path=folder/'data/teacher-rows.jsonl';assert hashlib.sha256(path.read_bytes()).hexdigest()==meta['sha256']
rows=[json.loads(l)for l in path.read_text().splitlines()];assert len(rows)==meta['requested'] and len({r['index']for r in rows})==len(rows)
exact=set();near=set();usable=[];duplicates=0
for r in rows:
    if r['inputSha256'] in exact or r['nearSha256'] in near:duplicates+=1;continue
    exact.add(r['inputSha256']);near.add(r['nearSha256'])
    if r.get('x') is not None:usable.append(r)
assert len(usable)>100
features=usable[0]['features'];assert len(features)==35
x=np.array([r['x']for r in usable],np.float32)
work=np.array([[v['work']for v in r['variants']]for r in usable],np.float32)
y=np.log1p(work);y[:,1:]-=y[:,:1]
fit=np.array([r['index']%7!=0 for r in usable]);hold=~fit
mean=x[fit].mean(axis=0);scale=np.maximum(x[fit].std(axis=0),.1);x=(x-mean)/scale
weights=np.where(np.min(work[:,1:],axis=1)<work[:,0]*.85,2.,1.).astype(np.float32)
loss_weights=np.array([.08,1,1,1,1],np.float32)
started=time.time();summary={'status':'running','teacherSha256':meta['sha256'],'teacherSourceSha':meta['sourceSha'],'queries':len(usable),'generated':len(rows),'duplicateOrNearDuplicateExcluded':duplicates,
 'internalFit':int(fit.sum()),'internalHoldback':int(hold.sum()),'externalValidationRead':False,'sealedTestRead':False,'models':[]}
(folder/'models').mkdir(exist_ok=True)
def forward(xx,p):
 h=np.tanh(xx@p['w1']+p['b1']);return h@p['w2']+p['b2'],h
def loss(xx,yy,ww,p):
 pred,_=forward(xx,p);d=np.clip(pred-yy,-10,10)
 return float(np.mean(np.sum(d*d*loss_weights,axis=1)*ww))
for hidden in [8,16,32]:
 rng=np.random.default_rng(99600+hidden)
 p={'w1':rng.normal(0,.1,(35,hidden)).astype(np.float32),'b1':np.zeros(hidden,np.float32),'w2':rng.normal(0,.1,(hidden,5)).astype(np.float32),'b2':np.zeros(5,np.float32)}
 p['b2'][0]=float(y[fit,0].mean())
 m={k:np.zeros_like(v)for k,v in p.items()};v={k:np.zeros_like(a)for k,a in p.items()};step=0;best=copy.deepcopy(p);best_loss=float('inf');stale=0;history=[]
 ids=np.where(fit)[0]
 for epoch in range(int(os.environ.get('FGO_GENERAL_EPOCHS','160'))):
  order=rng.permutation(ids);lr=.002*.99**epoch
  for start in range(0,len(order),512):
   ii=order[start:start+512];xx=x[ii];yy=y[ii];ww=weights[ii]
   pred,h=forward(xx,p);d=2*(pred-yy)*loss_weights*ww[:,None]/len(ii);dh=(d@p['w2'].T)*(1-h*h)
   grads={'w1':xx.T@dh+.0001*p['w1'],'b1':dh.sum(axis=0),'w2':h.T@d+.0001*p['w2'],'b2':d.sum(axis=0)}
   step+=1
   for k,g in grads.items():
    g=np.clip(g,-5,5);m[k]=.9*m[k]+.1*g;v[k]=.999*v[k]+.001*g*g
    p[k]-=lr*(m[k]/(1-.9**step))/(np.sqrt(v[k]/(1-.999**step))+1e-8)
  l=loss(x[hold],y[hold],weights[hold],p);history.append(l)
  if l<best_loss-1e-5:best_loss=l;best=copy.deepcopy(p);stale=0
  else:stale+=1
  if epoch%20==0:print('general',hidden,epoch,'internal loss',l,flush=True)
  if stale>=20:break
 # Internally predict baseline log-work plus relative policy log-work. Fold
 # that representation and input normalization into a cheap 35->H->5 runtime.
 w1=best['w1']/scale[:,None];b1=best['b1']-mean@w1;w2=best['w2'].copy();b2=best['b2'].copy()
 w2[:,1:]+=w2[:,:1];b2[1:]+=b2[0]
 model={'format':'fgo-generic-search-work','featureVersion':3,'features':features,'w1':np.round(w1.T,8).tolist(),'b1':np.round(b1,8).tolist(),'w2':np.round(w2.T,8).tolist(),'b2':np.round(b2,8).tolist(),
 'training':{'queries':len(usable),'hidden':hidden,'seed':99600+hidden,'teacherSha256':meta['sha256'],'sourceSha':meta['sourceSha'],'target':'log exact DP transitions + upper-bound row visits + search nodes; not score imitation','testLabelsUsed':False}}
 digest=hashlib.sha256(json.dumps(model,sort_keys=True).encode()).hexdigest();model['version']=f'generic-work-v3-{hidden}-{digest[:12]}'
 file=folder/f'models/generic-{hidden}.json';file.write_text(json.dumps(model,separators=(',',':'))+'\n')
 summary['models'].append({'path':str(file.relative_to(folder.parents[1])),'version':model['version'],'hidden':hidden,'internalLoss':best_loss,'epochs':len(history),'history':history,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
 (folder/'reports/training.json').write_text(json.dumps(summary,indent=2)+'\n')
 print('exported',model['version'],flush=True)
summary.update(status='complete',elapsedSeconds=time.time()-started,selected=min(summary['models'],key=lambda m:m['internalLoss'])['path'])
(folder/'reports/training.json').write_text(json.dumps(summary,indent=2)+'\n')
(folder/'data/split-audit-train.json').write_text(json.dumps({'exact':sorted(exact),'near':sorted(near),'families':sorted({r['structureKey']for r in rows})})+'\n')
print(summary['selected'],flush=True)
