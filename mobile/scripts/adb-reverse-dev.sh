#!/usr/bin/env bash
# Forward host ports to the USB-connected device so 127.0.0.1 in the app hits your Mac.
# Defaults: API 3000 (backend), Metro 8081.
set -euo pipefail

API_PORT="${API_PORT:-3000}"
METRO_PORT="${METRO_PORT:-8081}"

if [ -z "${ANDROID_HOME:-}" ] && [ -d "/usr/local/share/android-commandlinetools" ]; then
  export ANDROID_HOME="/usr/local/share/android-commandlinetools"
  export ANDROID_SDK_ROOT="/usr/local/share/android-commandlinetools"
fi
if [ -n "${ANDROID_HOME:-}" ]; then
  export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/cmdline-tools/latest/bin:${PATH}"
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install platform-tools or add adb to PATH." >&2
  exit 1
fi

adb start-server >/dev/null
echo "adb reverse tcp:${API_PORT} tcp:${API_PORT}   (API)"
adb reverse "tcp:${API_PORT}" "tcp:${API_PORT}"
echo "adb reverse tcp:${METRO_PORT} tcp:${METRO_PORT}   (Metro)"
adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
echo ""
adb reverse --list
