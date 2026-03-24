#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8082}"
API_PORT="${API_PORT:-3000}"
EXPO_URL="exp://127.0.0.1:${PORT}"

free_port_if_needed() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    echo "Port ${port} is busy. Stopping existing process(es): ${pids}"
    # Best-effort graceful stop first.
    kill -15 ${pids} 2>/dev/null || true
    sleep 1

    pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "${pids}" ]; then
      echo "Force-stopping process(es) still on ${port}: ${pids}"
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # Load nvm when script is run in a fresh shell.
  # shellcheck disable=SC1090
  source "${HOME}/.nvm/nvm.sh"
  nvm use 20 >/dev/null
fi

# Ensure Android SDK paths are set for native builds/tools.
if [ -d "/usr/local/share/android-commandlinetools" ]; then
  export ANDROID_HOME="/usr/local/share/android-commandlinetools"
  export ANDROID_SDK_ROOT="/usr/local/share/android-commandlinetools"
  export PATH="${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/cmdline-tools/latest/bin:${PATH}"
fi

free_port_if_needed "${PORT}"

echo "Checking Android device connection..."
adb start-server >/dev/null

DEVICE_COUNT="$(adb devices | awk 'NR > 1 && $2 == "device" {count++} END {print count+0}')"
if [ "${DEVICE_COUNT}" -lt 1 ]; then
  echo "No Android device detected."
  echo "Connect your phone with USB + USB debugging, then rerun."
  exit 1
fi

echo "Configuring adb reverse for API and Metro..."
adb reverse "tcp:${API_PORT}" "tcp:${API_PORT}"
adb reverse "tcp:${PORT}" "tcp:${PORT}"
adb reverse --list

echo "Opening Expo Go on device: ${EXPO_URL}"
adb shell am start -a android.intent.action.VIEW -d "${EXPO_URL}" >/dev/null || true

echo "Starting Expo Metro on localhost:${PORT}..."
exec npx expo start -c --localhost --port "${PORT}"
