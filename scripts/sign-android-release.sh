#!/usr/bin/env bash
set -euo pipefail

# Signing secrets are provided by GitHub Actions, never by repository files.
: "${ANDROID_SIGNING_KEY_BASE64:?Android signing key is not configured}"
: "${ANDROID_SIGNING_PASSWORD:?Android signing password is not configured}"
: "${ANDROID_HOME:?Android SDK is not configured}"
input_apk=${1:?Unsigned APK path is required}
output_apk=${2:?Signed APK path is required}
sdk_tools="$ANDROID_HOME/build-tools/35.0.0"
umask 077
signing_dir=$(mktemp -d)
trap 'rm -rf "$signing_dir"' EXIT
export FGO_SIGNING_DIR="$signing_dir"
python3 - <<'PY'
import base64, os
from pathlib import Path
target = Path(os.environ['FGO_SIGNING_DIR'])
target.joinpath('key.p12').write_bytes(base64.b64decode(os.environ['ANDROID_SIGNING_KEY_BASE64'], validate=True))
target.joinpath('password.txt').write_text(os.environ['ANDROID_SIGNING_PASSWORD'], encoding='utf-8')
PY
mkdir -p "$(dirname "$output_apk")"
"$sdk_tools/zipalign" -f -p 4 "$input_apk" "$signing_dir/aligned.apk"
"$sdk_tools/apksigner" sign --ks "$signing_dir/key.p12" --ks-type PKCS12 \
  --ks-key-alias fgo-bond --ks-pass "file:$signing_dir/password.txt" \
  --key-pass "file:$signing_dir/password.txt" --min-sdk-version 26 \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$output_apk" "$signing_dir/aligned.apk"
"$sdk_tools/apksigner" verify --verbose --print-certs "$output_apk" > "$signing_dir/verification.txt"
cat "$signing_dir/verification.txt"
# Keep existing installations upgradeable by rejecting a different signing key.
grep -q 'certificate SHA-256 digest: 5cbd479396c404f4b7c9c1a9aa532544b3f946dad1c3b1c89ff8268630c0fb8b' "$signing_dir/verification.txt"
