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
        for name in ['native/desktop/package.json', 'native/desktop/package-lock.json', 'native/android/app/build.gradle', 'native/release-version.json']:
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
        for sequence, version, code in [(1, '0.1.0', 1), (2, '0.1.1', 2), (9, '0.1.8', 9), (10, '2.0.0', 10), (18, '2.0.8', 18), (19, '2.1.2', 19), (20, '2.1.3', 20), (21, '2.1.4', 21), (22, '2.1.5', 22), (23, '2.1.6', 23), (24, '2.1.7', 24), (25, '2.1.8', 25), (26, '2.1.9', 26), (27, '2.1.10', 27), (28, '2.1.11', 28), (29, '2.1.12', 29), (30, '2.1.13', 30), (31, '2.1.14', 31), (32, '2.1.15', 32), (33, '2.1.16', 33), (34, '2.1.17', 34), (35, '2.1.18', 35), (36, '2.1.19', 36), (37, '2.1.20', 37), (38, '2.1.21', 38), (101, '2.1.84', 101)]:
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
        self.assertEqual(module.stamp(root), ('2.1.21', 38))

    def test_displayed_app_version_matches_release_policy(self):
        source = (ROOT / 'src/ai-update.js').read_text()
        displayed = re.search(r"APP_VERSION\s*=\s*'([^']+)'", source)[1]
        target = json.loads((ROOT / 'native/release-version.json').read_text())['version']
        self.assertEqual(displayed, target)

    def test_version_two_build_jobs_use_reserved_values(self):
        root = self.fresh()
        module.stamp(root, version='2.0.0', code=10)
        module.stamp(root, version='2.0.0', code=10)
        self.assert_versions(root, '2.0.0', 10)

    def test_legacy_policy_free_checkout_keeps_historical_sequence(self):
        root = self.fresh()
        (root / 'native/release-version.json').unlink()
        self.assertEqual(module.stamp(root, 9), ('0.1.8', 9))

    def test_invalid_version_policy_does_not_write_installer_metadata(self):
        for policy in [{'version': '2.0', 'fromSequence': 10}, {'version': '02.0.0', 'fromSequence': 10}, {'version': '2.0.0', 'fromSequence': 0}, {'version': '2.0.0', 'fromSequence': True}]:
            root = self.fresh()
            (root / 'native/release-version.json').write_text(json.dumps(policy))
            before = (root / 'native/desktop/package.json').read_bytes()
            with self.assertRaises(ValueError):
                module.stamp(root, 10)
            self.assertEqual((root / 'native/desktop/package.json').read_bytes(), before)

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
