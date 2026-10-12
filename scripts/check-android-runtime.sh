#!/usr/bin/env bash
set -euo pipefail
report_dir=native/android/app/build/reports/android-runtime
mkdir -p "$report_dir"
adb logcat -c
status=0
(cd native/android && gradle connectedDebugAndroidTest --no-daemon) || status=$?
if [[ "$status" -eq 0 ]]; then
  bash scripts/check-android-upgrade.sh || status=$?
fi
# Capture Android's actual crash reason before emulator-runner destroys the VM.
# Preserve the original test failure; diagnostics never turn a failed gate green.
adb logcat -b all -d -v threadtime > "$report_dir/logcat.txt" || true
adb shell dumpsys activity exit-info cc.fgobond.app > "$report_dir/exit-info.txt" || true
adb shell dumpsys meminfo cc.fgobond.app > "$report_dir/memory.txt" || true
if [[ "$status" -ne 0 ]]; then
  python3 - <<'PY'
from pathlib import Path
import re
text=Path('native/android/app/build/reports/android-runtime/logcat.txt').read_text(errors='replace')
lines=text.splitlines()
pattern=re.compile(r'FATAL EXCEPTION|Fatal signal|AndroidRuntime|crash|SIGSEGV|chromium|FGOBond|cc\.fgobond\.app|am_kill',re.I)
selected=[line for line in lines if pattern.search(line)]
print('\n'.join(selected[-200:]))
print(Path('native/android/app/build/reports/android-runtime/exit-info.txt').read_text(errors='replace'))
PY
fi
exit "$status"
