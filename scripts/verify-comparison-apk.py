import hashlib,json,sys,zipfile,subprocess
apk=sys.argv[1]
manifest=json.load(open('native/site/comparison-manifest.json'))
with zipfile.ZipFile(apk) as archive:
    names=archive.namelist()
    assert not any('/quest-matrix/' in name for name in names)
    for version in manifest['versions']:
        folder=version['folder'];prefix=f'assets/site/versions/{folder}/'
        worker=archive.read(prefix+'src/recommend-worker.js')
        assert hashlib.sha256(worker).hexdigest()==version['workerSha256']
        if folder!='209':
            original=subprocess.check_output(['git','show',version['revision']+':src/recommend-worker.js'])
            assert worker==original
        for row in manifest['dataFiles']:
            assert hashlib.sha256(archive.read(prefix+row['path'])).hexdigest()==row['sha256'],(folder,row['path'])
        assert b'comparison-hook.js' in archive.read(prefix+'comparison-entry-index.js')
print('Three worker revisions, identical frozen snapshots and excluded warehouse verified')
