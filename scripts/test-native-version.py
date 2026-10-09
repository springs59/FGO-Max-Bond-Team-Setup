import importlib.util
import json
from pathlib import Path
import re
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('native_version', ROOT / 'scripts/prepare-native-version.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NativeVersionTest(unittest.TestCase):
    def fresh(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        root = Path(temp.name)
        for name in ['native/desktop/package.json', 'native/desktop/package-lock.json', 'native/android/app/build.gradle']:
            destination = root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, destination)
        return root

    def assert_versions(self, root, version, code):
        package = json.loads((root / 'native/desktop/package.json').read_text())
        lock = json.loads((root / 'native/desktop/package-lock.json').read_text())
        gradle = (root / 'native/android/app/build.gradle').read_text()
        self.assertEqual([package['version'], lock['version'], lock['packages']['']['version']], [version] * 3)
        self.assertEqual(re.search(r"versionName\s+'([^']+)'", gradle)[1], version)
        self.assertEqual(int(re.search(r'versionCode\s+(\d+)', gradle)[1]), code)
        self.assertEqual(package['devDependencies'], json.loads((ROOT / 'native/desktop/package.json').read_text())['devDependencies'])

    def test_next_dispatch_and_retry_keep_matching_versions(self):
        for sequence, version, code in [(1, '0.1.0', 1), (2, '0.1.1', 2), (3, '0.1.2', 3), (101, '0.1.100', 101)]:
            with self.subTest(sequence=sequence):
                # Each Actions job/retry gets a fresh checkout, not the previous stamped directory.
                first, retry = self.fresh(), self.fresh()
                self.assertEqual(module.stamp(first, sequence), (version, code))
                self.assertEqual(module.stamp(retry, sequence), (version, code))
                self.assert_versions(first, version, code)
                self.assert_versions(retry, version, code)

    def test_build_jobs_apply_exact_reserved_values(self):
        root = self.fresh()
        module.stamp(root, version='0.1.5', code=6)
        module.stamp(root, version='0.1.5', code=6)
        self.assert_versions(root, '0.1.5', 6)

    def test_check_build_does_not_increment(self):
        root = self.fresh()
        self.assertEqual(module.stamp(root), ('0.1.0', 1))

    def test_reject_invalid_values_without_writes(self):
        for args in [{'sequence': -1}, {'version': 'bad', 'code': 2}, {'version': '0.1.1', 'code': 0}, {'version': '0.1.1', 'code': 2100000001}]:
            root = self.fresh()
            before = (root / 'native/desktop/package.json').read_bytes()
            with self.assertRaises(ValueError):
                module.stamp(root, **args)
            self.assertEqual((root / 'native/desktop/package.json').read_bytes(), before)

    def test_mismatched_base_versions_stop_release(self):
        root = self.fresh()
        path = root / 'native/android/app/build.gradle'
        path.write_text(path.read_text().replace("versionName '0.1.0'", "versionName '0.2.0'"))
        with self.assertRaises(ValueError):
            module.stamp(root, 2)


if __name__ == '__main__':
    unittest.main()
