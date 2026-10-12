"""Exercise release parsers against actual previously published installers."""
import importlib.util,urllib.request,hashlib,io,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('release_verifier',Path(__file__).with_name('verify-native-release.py'))
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
base='https://github.com/springs59/FGO-Max-Bond-Team-Setup/releases/download/native-v2.0.2/'
with urllib.request.urlopen(base+'FGO-Bond-Android-2.0.2.apk',timeout=60) as response:apk=response.read()
assert hashlib.sha256(apk).hexdigest()=='86e7c73909ec9126607f373290bb3147caf8557c42afd0f7025a19fe08c52293'
assert v.certificate(apk)==v.CERT
with zipfile.ZipFile(io.BytesIO(apk)) as z:
    attrs=v.xml_attrs(z.read('AndroidManifest.xml'))
assert attrs['manifest']['versionName']=='2.0.2' and attrs['manifest']['versionCode']==12
assert attrs['manifest']['package']=='cc.fgobond.app'
req=urllib.request.Request(base+'FGO-Bond-Windows-2.0.2.exe',headers={'Range':'bytes=0-1048575'})
with urllib.request.urlopen(req,timeout=60) as response:prefix=response.read(1048576)
assert v.pe_versions(prefix)==['2.0.2.0','2.0.2.0']
print('Release parser reference: real published APK checksum/certificate/manifest and EXE PE version passed')
