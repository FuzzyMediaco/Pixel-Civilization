#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
xcodegen generate
for family in phone tablet; do
  device_id="$(python3 - "$family" <<'PY'
import json, re, subprocess, sys
groups=json.loads(subprocess.check_output(['xcrun','simctl','list','devices','available','-j']))['devices']
family=sys.argv[1]
pattern=re.compile(r'iPhone .*Pro Max' if family=='phone' else r'iPad Pro.*13-inch')
for runtime in sorted((k for k in groups if 'iOS-' in k),reverse=True):
    devices=[d for d in groups[runtime] if pattern.search(d['name']) and d.get('isAvailable',True)]
    if devices:
        print(devices[0]['udid']);break
else: raise SystemExit('No available '+family+' simulator with an accepted Apple screenshot size')
PY
)"
  xcrun simctl boot "$device_id" || true
  xcrun simctl bootstatus "$device_id" -b
  xcrun simctl status_bar "$device_id" override --time 9:41 --batteryState charged --batteryLevel 100
  xcodebuild test -scheme PixelCivilization -project PixelCivilization.xcodeproj \
    -destination "platform=iOS Simulator,id=$device_id" -derivedDataPath build/derived \
    -parallel-testing-enabled NO -resultBundlePath "build/$family.xcresult" CODE_SIGNING_ALLOWED=NO
  xcrun xcresulttool export attachments --path "build/$family.xcresult" --output-path "build/$family-screens"
  xcrun simctl shutdown "$device_id"
done
