#!/usr/bin/env bash
set -euo pipefail
reports=native/android/app/build/reports/comparison
mkdir -p "$reports"
adb logcat -c
status=0
(cd native/android && gradle connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=cc.fgobond.app.ComparisonTest --no-daemon) || status=$?
adb logcat -b all -d > "$reports/logcat.txt" || true
if [[ "$status" != 0 ]]; then tail -150 "$reports/logcat.txt"; exit "$status"; fi
if adb shell pm list packages cc.fgobond.compare | grep -q '^package:cc.fgobond.compare'; then
  adb uninstall cc.fgobond.compare
fi
adb install release/FGO-Bond-Three-Versions-2.0.9-test.apk
adb shell am start -W -n cc.fgobond.compare/cc.fgobond.app.CompareActivity
adb shell uiautomator dump /sdcard/comparison-window.xml
adb pull /sdcard/comparison-window.xml "$reports/signed-launch.xml"
python3 - <<'PY'
from pathlib import Path
text=Path('native/android/app/build/reports/comparison/signed-launch.xml').read_text()
for label in ['2.0.0','2.0.8','2.0.9','导出三版本测试记录']:
    assert label in text, label
print('Signed standalone APK installed and all version choices are visible')
PY
