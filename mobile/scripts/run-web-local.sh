#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8081}"

free_port_if_needed() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "${pids}" ]; then
    echo "Port ${port} is busy. Stopping existing process(es): ${pids}"
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
  # shellcheck disable=SC1090
  source "${HOME}/.nvm/nvm.sh"
  nvm use 20 >/dev/null
fi

free_port_if_needed "${PORT}"

echo "Starting Expo Web on localhost:${PORT}..."
exec npx expo start -c --web --localhost --port "${PORT}"
