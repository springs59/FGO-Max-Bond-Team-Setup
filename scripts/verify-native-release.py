"""Check the actual staged EXE/APK and updater files before public release."""
import hashlib,json,os,struct,zipfile
from pathlib import Path
ROOT=Path('release')
u16=lambda b,p:struct.unpack_from('<H',b,p)[0]
u32=lambda b,p:struct.unpack_from('<I',b,p)[0]
u64=lambda b,p:struct.unpack_from('<Q',b,p)[0]
CERT='5cbd479396c404f4b7c9c1a9aa532544b3f946dad1c3b1c89ff8268630c0fb8b'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
def lp(b,p=0):
    n=u32(b,p);return b[p+4:p+4+n],p+4+n
def certificate(b):
    e=b.rfind(b'PK\x05\x06');assert e>=0
    cd=u32(b,e+16);assert b[cd-16:cd]==b'APK Sig Block 42'
    p=cd-u64(b,cd-24)
    while p<cd-24:
        n=u64(b,p);kind=u32(b,p+8);value=b[p+12:p+8+n];p+=8+n
        if kind==0x7109871a:
            signers,_=lp(value);signer,_=lp(signers);signed,_=lp(signer)
            _,at=lp(signed);certs,_=lp(signed,at);cert,_=lp(certs)
            return hashlib.sha256(cert).hexdigest()
    raise AssertionError('APK v2 signing block missing')
def xml_attrs(b):
    strings=[];out={};p=8
    while p<len(b):
        kind,header,size=struct.unpack_from('<HHI',b,p);assert size>=header and size>0
        if kind==1:
            count=u32(b,p+8);flags=u32(b,p+16);start=u32(b,p+20)
            def length(q,utf8):
                x=b[q] if utf8 else u16(b,q);q+=1 if utf8 else 2
                flag=0x80 if utf8 else 0x8000
                if x&flag:
                    y=b[q] if utf8 else u16(b,q);q+=1 if utf8 else 2
                    x=((x&(flag-1))<<(8 if utf8 else 16))|y
                return x,q
            for i in range(count):
                q=p+start+u32(b,p+header+4*i);n,q=length(q,bool(flags&0x100))
                if flags&0x100:n,q=length(q,True);s=b[q:q+n].decode('utf8')
                else:s=b[q:q+2*n].decode('utf-16le')
                strings.append(s)
        elif kind==0x102:
            name=strings[u32(b,p+20)];first=u16(b,p+24);stride=u16(b,p+26);count=u16(b,p+28);attrs={}
            for i in range(count):
                q=p+16+first+i*stride;k=strings[u32(b,q+4)];raw=u32(b,q+8);typ=b[q+15];v=u32(b,q+16)
                attrs[k]=strings[raw] if raw!=0xffffffff else strings[v] if typ==3 else bool(v) if typ==0x12 else v
            if name in ['manifest','application']:out[name]=attrs
        p+=size
    return out
def pe_versions(exe):
    assert exe[:2]==b'MZ' and exe[u32(exe,0x3c):u32(exe,0x3c)+4]==b'PE\0\0'
    pos=exe.find(struct.pack('<I',0xfeef04bd));assert pos>=0
    numbers=struct.unpack_from('<IIII',exe,pos+8)
    versions=['.'.join(map(str,[hi>>16,hi&65535,lo>>16,lo&65535])) for hi,lo in zip(numbers[::2],numbers[1::2])]
    return versions
def verify():
    version=os.environ['RELEASE_VERSION'];code=int(os.environ['ANDROID_VERSION_CODE']);source=os.environ['SOURCE_SHA']
    update=json.loads((ROOT/'native-update.json').read_text())
    assert update['version']==version and update['androidCode']==code
    sums={name:h for h,name in (line.split() for line in (ROOT/'SHA256SUMS.txt').read_text().splitlines())}
    for platform,a in update['assets'].items():
        p=ROOT/a['name'];assert p.stat().st_size==a['size'];assert sha(p)==a['sha256']==sums[a['name']]
    apk=ROOT/update['assets']['android']['name'];raw=apk.read_bytes();cert=certificate(raw);assert cert==CERT
    with zipfile.ZipFile(apk) as z:
        attrs=xml_attrs(z.read('AndroidManifest.xml'));m=attrs['manifest']
        assert m['versionName']==version and m['versionCode']==code and m['package']=='cc.fgobond.app'
        assert not attrs['application'].get('debuggable',False)
        prefix='assets/site/';bundled=json.loads(z.read(prefix+'generated/native-data-manifest.json'))
        assert bundled['revision']==source
        assert not any(name.startswith(prefix+'generated/quest-matrix/') for name in z.namelist()),'Warehouse payloads must not be bundled'
        for p in ['src/app.js','src/party-state.js','src/solver/account-plan-matches.js','src/solver/account-match-worker.js','src/ui/team-comparison.js','src/ui/library-curve.js','src/worker-transport.js','src/solver/query-library.js','src/solver/query-candidate-journal.js','src/solver/query-candidate-collector.js','native/shared/store.js','native/shared/file-save.js','src/ui/team-report.js','src/ui/comparison-art.js','src/ui/comparison-workspace.js','src/solver/score-team-variant-browser.js','src/solver/score-team-equipment-variants.js','src/solver/score-team-diversity.js','src/solver/score-team-support-filter.js','src/solver/score-team-dedup.js','src/solver/score-team-record.js','src/solver/score-team-ce-first.js','src/ui/query-context.js','src/solver/score-team-store.js','src/solver/score-team-variant-browser.js']:
            assert z.read(prefix+p)==Path(p).read_bytes(),('Bundled code differs',p)
        for p in ['src/ai-update.js','src/recommend.js','src/grand-selection.js','src/solver/score-team-enumerator.js','src/solver/quest-party-enumerator.js','src/solver/score-team-guidance.js','src/solver/score-team-priority-search.js','src/solver/score-team-phases.js','src/solver/score-team-worker.js','src/ui/score-team-results.js']:
            assert z.read(prefix+p)==Path(p).read_bytes(),('Bundled solver differs',p)
    versions=pe_versions((ROOT/update['assets']['windows']['name']).read_bytes())
    assert all(value==version+'.0' for value in versions),versions
    result={'version':version,'androidCode':code,'source':source,'apkCertificate':cert,'exeVersions':versions,'assets':update['assets'],'bundledFixesMatch':True,'checksumsMatch':True}
    print('Actual installer verification: '+json.dumps(result,ensure_ascii=False))
    (ROOT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':verify()
