#!/usr/bin/env bash
set -euo pipefail
package=cc.fgobond.app
fixture=native/android/app/src/androidTest/assets/upgrade-fixture.apk
test -s "$fixture"
# Gradle's managed connected test run uninstalls its target afterwards. Install
# the baseline again and seed a real offline cache with a direct instrument run.
adb install -r native/android/app/build/outputs/apk/debug/app-debug.apk
adb install -r native/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell pm grant "$package" android.permission.POST_NOTIFICATIONS
adb shell am instrument -w -e class 'cc.fgobond.app.BackgroundTest#packagedCatalogPrecomputesInBackground' "$package.test/androidx.test.runner.AndroidJUnitRunner" | tee /tmp/fgo-android-upgrade-seed.txt
grep -Fq 'OK (1 test)' /tmp/fgo-android-upgrade-seed.txt
adb shell am force-stop "$package"
# Exercise a real package replacement after instrumentation has finished.
adb shell "run-as $package sh -c 'mkdir -p files; echo preserved-account-and-settings > files/upgrade-sentinel.txt'"
before_code=$(adb shell dumpsys package "$package" | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' | head -1 | tr -d '\r')
adb shell "run-as $package find app_webview -type f -path '*IndexedDB*' -exec sha256sum {} \;" | tr -d '\r' | sort > /tmp/fgo-android-before.txt
test -s /tmp/fgo-android-before.txt
adb install -r "$fixture"
after_code=$(adb shell dumpsys package "$package" | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' | head -1 | tr -d '\r')
test "$after_code" -gt "$before_code"
adb shell run-as "$package" cat files/upgrade-sentinel.txt | tr -d '\r' | grep -Fx preserved-account-and-settings
adb shell "run-as $package find app_webview -type f -path '*IndexedDB*' -exec sha256sum {} \;" | tr -d '\r' | sort > /tmp/fgo-android-after.txt
diff -u /tmp/fgo-android-before.txt /tmp/fgo-android-after.txt
adb shell am start -W -n "$package/.MainActivity" | tee /tmp/fgo-android-upgrade-start.txt
grep -q 'Status: ok' /tmp/fgo-android-upgrade-start.txt
echo 'Real Android same-signature newer package replacement passed; profile and IndexedDB files survived unchanged.'
