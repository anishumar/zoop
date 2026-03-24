#!/usr/bin/env bash
# Stream Android device/emulator logs in the terminal (Metro does not include these).
set -euo pipefail

if [ -z "${ANDROID_HOME:-}" ] && [ -d "/usr/local/share/android-commandlinetools" ]; then
  export ANDROID_HOME="/usr/local/share/android-commandlinetools"
  export ANDROID_SDK_ROOT="/usr/local/share/android-commandlinetools"
fi
if [ -n "${ANDROID_HOME:-}" ]; then
  export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/cmdline-tools/latest/bin:${PATH}"
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android platform-tools or set PATH to include adb." >&2
  exit 1
fi

adb start-server >/dev/null

if [ "${1:-}" = "all" ] || [ "${1:-}" = "--all" ]; then
  echo "Full logcat (Ctrl+C to stop). For JS-focused logs use: npm run android:logs" >&2
  exec adb logcat
fi

echo "React Native / Expo–focused logcat (Ctrl+C to stop). Use: npm run android:logs -- all" >&2
exec adb logcat '*:S' ReactNativeJS:V ReactNative:V ExpoModulesCore:V
