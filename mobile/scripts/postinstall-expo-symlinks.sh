#!/usr/bin/env bash
# npm hoists packages; Metro sometimes resolves them under nested node_modules paths
# that npm leaves empty. Recreate symlinks so Metro can read package.json there.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1) expo-constants under expo/node_modules/
NEST="${ROOT}/node_modules/expo/node_modules"
TARGET="${NEST}/expo-constants"
if [ -e "${ROOT}/node_modules/expo-constants/package.json" ]; then
  mkdir -p "${NEST}"
  if [ -e "$TARGET" ]; then
    if [ -L "$TARGET" ] && [ -f "$TARGET/package.json" ]; then
      :
    elif [ ! -L "$TARGET" ] && [ -d "$TARGET" ] && [ -f "$TARGET/package.json" ]; then
      :
    else
      rm -rf "$TARGET"
      ln -sf ../../expo-constants "$TARGET"
    fi
  else
    ln -sf ../../expo-constants "$TARGET"
  fi
fi

# 2) @react-native/* under react-native/node_modules/@react-native/ (often empty)
HOISTED="${ROOT}/node_modules/@react-native"
NEST_RN="${ROOT}/node_modules/react-native/node_modules/@react-native"
if [ -d "$HOISTED" ] && [ -d "${ROOT}/node_modules/react-native" ]; then
  mkdir -p "${NEST_RN}"
  for pkg in "$HOISTED"/*; do
    [ -e "$pkg" ] || continue
    name="$(basename "$pkg")"
    if [ ! -f "$pkg/package.json" ]; then
      continue
    fi
    target="${NEST_RN}/${name}"
    if [ -e "$target" ]; then
      if [ -L "$target" ] && [ -f "$target/package.json" ]; then
        continue
      fi
      if [ ! -L "$target" ] && [ -d "$target" ] && [ -f "$target/package.json" ]; then
        continue
      fi
      rm -rf "$target"
    fi
    ln -sf "../../../@react-native/${name}" "$target"
  done
fi

# 3) expo-constants under node_modules/expo-* (expo-asset, expo-camera, …) — Metro reads
# nested paths like expo-asset/node_modules/expo-constants/package.json; npm often hoists only.
CONST="${ROOT}/node_modules/expo-constants"
if [ -f "${CONST}/package.json" ]; then
  for dir in "${ROOT}/node_modules/expo-"*; do
    [ -d "$dir" ] || continue
    base="$(basename "$dir")"
    [ "$base" = "expo-constants" ] && continue
    [ -f "${dir}/package.json" ] || continue
    if ! grep -q '"expo-constants"' "${dir}/package.json" 2>/dev/null; then
      continue
    fi
    nest="${dir}/node_modules"
    target="${nest}/expo-constants"
    mkdir -p "${nest}"
    if [ -e "$target" ]; then
      if [ -L "$target" ] && [ -f "$target/package.json" ]; then
        continue
      fi
      if [ ! -L "$target" ] && [ -d "$target" ] && [ -f "$target/package.json" ]; then
        continue
      fi
      rm -rf "$target"
    fi
    # Two levels up from …/expo-asset/node_modules/ → project node_modules
    ln -sf ../../expo-constants "$target"
  done
fi
