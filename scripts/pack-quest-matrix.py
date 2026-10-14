"""Repack all committed observations into fewer portable gzip archives."""
import gzip, hashlib, json, pathlib, sys, subprocess
root=pathlib.Path.cwd()
dest=pathlib.Path(sys.argv[1]).resolve();dest.mkdir(parents=True,exist_ok=True)
index=json.loads((root/'generated/quest-matrix/index.json').read_text())
# Capture the input index for ordering while the generator publishes new jobs.
ordering_input=dest/'input-index.json';ordering_input.write_text(json.dumps(index))
ordering=json.loads(subprocess.check_output(['node','scripts/matrix-publish-order.mjs',str(ordering_input)],text=True))
index['sourceHashes']=ordering['sourceHashes']
index['jobs'].sort(key=lambda j:ordering['order'][j['id']])
base=index.get('baseArchiveFiles',[])
entries=base+[f for job in index['jobs'] for f in job.get('files',[])]
if not entries:entries=index['files']
out=dest/'generated/quest-matrix';out.mkdir(parents=True,exist_ok=True)
header=json.dumps({'format':'fgo-local-query-results','version':1,'exportedAt':index['startedAt']},separators=(',',':')).encode()+b'\n'
block=bytearray(header);count=0;files=[]
def flush():
 global block,count
 if not count:return
 data=gzip.compress(block,compresslevel=6,mtime=0);sha=hashlib.sha256(data).hexdigest()
 path=f'generated/quest-matrix/part-{sha}-000.jsonl.gz'
 (dest/path).write_bytes(data);files.append({'path':path,'size':len(data),'sha256':sha,'records':count,'unpackedBytes':len(block)})
 block=bytearray(header);count=0
for entry in entries:
 data=(root/entry['path']).read_bytes()
 assert len(data)==entry['size'] and hashlib.sha256(data).hexdigest()==entry['sha256']
 original=0
 with gzip.open(root/entry['path'],'rb') as reader:
  assert json.loads(reader.readline())['format']=='fgo-local-query-results'
  for line in reader:
   if len(block)+len(line)>16*1024*1024:flush()
   block.extend(line);count+=1;original+=1
 assert original==entry['records']
flush()
assert sum(f['records'] for f in files)==sum(index['kinds'].values())
index['files']=files
index.pop('baseArchiveFiles',None)
for job in index['jobs']:job.pop('files',None)
index['packed']=True
(out/'index.json').write_text(json.dumps(index,separators=(',',':'))+'\n')
print(json.dumps({'completed':index['completed'],'files':len(files),'records':sum(index['kinds'].values()),'bytes':sum(f['size'] for f in files),'output':str(dest)}))
