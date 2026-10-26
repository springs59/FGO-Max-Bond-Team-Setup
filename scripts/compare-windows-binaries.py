import hashlib, json, os, struct
from pathlib import Path

ROOT = Path(os.environ['WIN_COMPARE_ROOT'])
OUT = Path('binary-diagnostics')
OUT.mkdir(exist_ok=True)
u16 = lambda b, p: struct.unpack_from('<H', b, p)[0]
u32 = lambda b, p: struct.unpack_from('<I', b, p)[0]
sha = lambda b: hashlib.sha256(b).hexdigest()

def asar_file(path, name):
    with path.open('rb') as f:
        prefix = f.read(16)
        header_size, json_size = u32(prefix, 4), u32(prefix, 12)
        assert 0 < json_size <= header_size < 100_000_000
        header = json.loads(f.read(json_size))
        entry = header
        for component in name.split('/'):
            entry = entry['files'][component]
        f.seek(8 + header_size + int(entry['offset']))
        return f.read(entry['size'])

def pe_info(path):
    data = path.read_bytes()
    assert data[:2] == b'MZ', 'Missing DOS executable header'
    pe = u32(data, 0x3c)
    assert data[pe:pe + 4] == b'PE\0\0', 'Missing PE signature'
    machine, count, stamp = struct.unpack_from('<HHI', data, pe + 4)
    size = u16(data, pe + 20)
    opt = pe + 24
    magic = u16(data, opt)
    assert machine == 0x8664 and magic == 0x20b, 'Expected Windows x64 PE32+'
    sections = []
    for i in range(count):
        at = opt + size + i * 40
        name = data[at:at+8].rstrip(b'\0').decode('ascii')
        virtual_size, virtual_address, raw_size, raw_offset = struct.unpack_from('<IIII', data, at + 8)
        assert raw_offset + raw_size <= len(data), (name, 'section exceeds executable size')
        sections.append(dict(name=name, virtualSize=virtual_size, virtualAddress=virtual_address,
                             rawSize=raw_size, rawOffset=raw_offset, sha256=sha(data[raw_offset:raw_offset+raw_size])))
    result = dict(size=len(data), sha256=sha(data), machine=hex(machine), optionalMagic=hex(magic),
                  timestamp=stamp, entryPoint=u32(data,opt+16), osVersion=[u16(data,opt+40),u16(data,opt+42)],
                  subsystemVersion=[u16(data,opt+48),u16(data,opt+50)], imageSize=u32(data,opt+56),
                  checksum=u32(data,opt+64), subsystem=u16(data,opt+68), dllCharacteristics=hex(u16(data,opt+70)),
                  certificateDirectory=list(struct.unpack_from('<II',data,opt+112+4*8)), sections=sections)
    return data, result

def differences(a, b):
    ranges = []
    count = 0
    for offset in range(0, min(len(a),len(b)),4096):
        aa,bb = a[offset:offset+4096],b[offset:offset+4096]
        if aa == bb:
            continue
        for n,(x,y) in enumerate(zip(aa,bb)):
            if x == y:
                continue
            at = offset+n
            count += 1
            if ranges and ranges[-1][1] == at:
                ranges[-1][1] += 1
            else:
                ranges.append([at,at+1])
    return dict(changedBytes=count, sizeDifference=len(b)-len(a), ranges=ranges[:200], rangeCount=len(ranges))

all_bytes = {}
report = {'artifacts': {}}
for label in ['old','original','rebuilt']:
    root = ROOT / ('FGO compare ' + label)
    blob, pe = pe_info(root/'FGO Bond.exe')
    all_bytes[label] = blob
    asar = root/'resources/app.asar'
    package = json.loads(asar_file(asar,'package.json'))
    pe.update(appVersion=package['version'], main=package['main'],
              mainCodeSHA256=sha(asar_file(asar,'main.cjs')),
              siteRevision=json.loads((root/'resources/site/generated/native-data-manifest.json').read_text())['revision'])
    report['artifacts'][label] = pe
old_sections = {s['name']:s['sha256'] for s in report['artifacts']['old']['sections']}
for label in ['original','rebuilt']:
    cur = report['artifacts'][label]
    changed = [s['name'] for s in cur['sections'] if old_sections.get(s['name']) != s['sha256']]
    report[label+'ComparedWithOld'] = dict(changedSections=changed, **differences(all_bytes['old'],all_bytes[label]))
report['originalComparedWithRebuilt'] = differences(all_bytes['original'],all_bytes['rebuilt'])
report['allMainCodeIdentical'] = len({p['mainCodeSHA256'] for p in report['artifacts'].values()}) == 1
report['allNativeCodeSectionsIdentical'] = all(
    report[label+'ComparedWithOld']['changedSections'] in ([], ['.rsrc']) for label in ['original','rebuilt'])
(OUT/'pe-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print('ACTUAL_PE_COMPARISON='+json.dumps(report,separators=(',',':')))
