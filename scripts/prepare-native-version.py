#!/usr/bin/env python3
"""Stamp matching installer versions; a major-update run number survives retries."""
import argparse
import json
import os
from pathlib import Path
import re


def stamp(root, sequence=0, version=None, code=None):
    package_path = root / 'native/desktop/package.json'
    lock_path = root / 'native/desktop/package-lock.json'
    gradle_path = root / 'native/android/app/build.gradle'
    package = json.loads(package_path.read_text(encoding='utf-8'))
    lock = json.loads(lock_path.read_text(encoding='utf-8'))
    gradle = gradle_path.read_text(encoding='utf-8')
    android_version = re.search(r"versionName\s+'([^']+)'", gradle)
    android_code = re.search(r'versionCode\s+(\d+)', gradle)
    base = package['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', base) or not android_version or android_version[1] != base or not android_code:
        raise ValueError('Windows and Android base versions must match')
    if sequence < 0:
        raise ValueError('Release sequence must not be negative')
    if version is None:
        major, minor, patch = map(int, base.split('.'))
        offset = max(sequence - 1, 0)
        version = f'{major}.{minor}.{patch + offset}'
        code = int(android_code[1]) + offset
        policy_path = root / 'native/release-version.json'
        if policy_path.is_file():
            policy = json.loads(policy_path.read_text(encoding='utf-8'))
            if not isinstance(policy, dict):
                raise ValueError('Invalid release version policy')
            target, start = policy.get('version'), policy.get('fromSequence')
            if (not isinstance(target, str) or
                    not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', target) or
                    type(start) is not int or start < 1):
                raise ValueError('Invalid release version policy')
            if sequence == 0 or sequence >= start:
                major, minor, patch = map(int, target.split('.'))
                version = f'{major}.{minor}.{patch + max(sequence - start, 0)}'
                # Keep the historical Android sequence; changing the visible version
                # must never reset versionCode or prevent an installed APK upgrading.
                code = int(android_code[1]) + max(sequence, start) - 1
            elif policy.get('history'):
                # Retain reserved historical versions when a later patch becomes
                # the default test build. Rebuilding an old sequence is stable.
                history = policy['history']
                if not isinstance(history, list) or any(
                    not isinstance(p, dict) or
                    not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', str(p.get('version', ''))) or
                    type(p.get('fromSequence')) is not int or not 1 <= p['fromSequence'] < start
                    for p in history
                ):
                    raise ValueError('Invalid historical release version policy')
                previous = [p for p in history if p['fromSequence'] <= sequence]
                if previous:
                    p = max(previous, key=lambda p: p['fromSequence'])
                    major, minor, patch = map(int, p['version'].split('.'))
                    version = f'{major}.{minor}.{patch + sequence - p["fromSequence"]}'
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or code is None or not 1 <= code <= 2100000000:
        raise ValueError('Invalid installer version or Android versionCode')
    package['version'] = version
    lock['version'] = version
    lock['packages']['']['version'] = version
    gradle = re.sub(r"versionName\s+'[^']+'", f"versionName '{version}'", gradle, count=1)
    gradle = re.sub(r'versionCode\s+\d+', f'versionCode {code}', gradle, count=1)
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    gradle_path.write_text(gradle, encoding='utf-8')
    return version, code


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sequence', type=int, default=0)
    parser.add_argument('--version')
    parser.add_argument('--code', type=int)
    args = parser.parse_args()
    if (args.version is None) != (args.code is None) or (args.version is not None and args.sequence):
        parser.error('Use --sequence OR the pair --version/--code')
    version, code = stamp(Path.cwd(), args.sequence, args.version, args.code)
    print(f'Installer version: {version}; Android versionCode: {code}')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write(f'value={version}\nandroid_code={code}\n')
