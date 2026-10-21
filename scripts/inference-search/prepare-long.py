"""Rebuild a frozen public runtime and verify all prior experiment hashes."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

control, frozen, work = map(lambda p: Path(p).resolve(), sys.argv[1:4])
request=json.loads((control/'.github/ai-pressure-3h-request.json').read_text())
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=frozen,text=True).strip()==request['productCommit']
# Reuse only public research source, never import archived user/account payloads.
for name in ['inference-search','inference-modes']:
    target=frozen/'scripts'/name
    if target.exists():shutil.rmtree(target)
    shutil.copytree(control/'scripts'/name,target)
for name in ['ai-search-cases.mjs','performance-wide-cases.mjs','version-report-validate.mjs']:
    shutil.copy2(control/'scripts'/name,frozen/'scripts'/name)
for name, expected in request['jpBlobs'].items():
    req=urllib.request.Request('https://api.github.com/repos/springs59/FGO-Max-Bond-Team-Setup/git/blobs/'+expected['gitBlob'],
        headers={'Accept':'application/vnd.github+json','Authorization':'Bearer '+os.environ['GH_TOKEN']})
    with urllib.request.urlopen(req,timeout=120) as response:blob=json.load(response)
    payload=base64.b64decode(blob['content'])
    assert hashlib.sha256(payload).hexdigest()==expected['sha256'], 'JP hash mismatch'
    (frozen/'src/data/jp'/name).write_bytes(payload)
subprocess.run([sys.executable,str(frozen/'scripts/inference-search/prepare.py'),str(work)],check=True)
prior=control/'docs/test-results/2026-10-21-adaptive-inference'
expected=json.loads((prior/'runtime-manifest.json').read_text())
actual=json.loads((work/'runtime-manifest.json').read_text())
for field in ['javascriptSha256','data','weights']:
    assert actual[field]==expected[field], 'Frozen manifest mismatch: '+field
expected_roots=json.loads((prior/'final-source-manifest.json').read_text())['roots']
for root, files in expected_roots.items():
    for name, digest in files.items():
        assert hashlib.sha256((work/root/name).read_bytes()).hexdigest()==digest, 'Variant mismatch: '+root+'/'+name
shutil.copy2(control/'.github/ai-pressure-3h-request.json',work/'long-request.json')
print(json.dumps({'verified':True,'runtimeFiles':sum(map(len,expected_roots.values())),
    'javascriptSha256':actual['javascriptSha256'],'data':actual['data'],'weights':actual['weights']}))
