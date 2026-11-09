#!/usr/bin/env bash

set -euo pipefail
umask 077

readonly CLAVIS_CHROMIUM_EXECUTABLE="/snap/bin/chromium"
readonly CLAVIS_PROFILE_DIRECTORY="/home/ubuntu/snap/chromium/common/clavis-wallet-profile"
readonly CLAVIS_EXTENSION_ID="pcndjhkinnkaohffealmlmhaepkpmgkb"
readonly CLAVIS_APPLICATION_URL="https://clavisapp.vercel.app"
readonly CLAVIS_WALLET_URL="chrome-extension://${CLAVIS_EXTENSION_ID}/ext_index_popup.html"

if [[ ! -x "$CLAVIS_CHROMIUM_EXECUTABLE" ]]; then
  echo "Chromium is unavailable at $CLAVIS_CHROMIUM_EXECUTABLE" >&2
  exit 1
fi

if [[ ! -d "$CLAVIS_PROFILE_DIRECTORY" ]]; then
  echo "The dedicated Clavis wallet profile is missing: $CLAVIS_PROFILE_DIRECTORY" >&2
  exit 1
fi

if pgrep -f -- "--user-data-dir=$CLAVIS_PROFILE_DIRECTORY" >/dev/null; then
  echo "The dedicated Clavis wallet profile is already open." >&2
  exit 1
fi

export DISPLAY="${DISPLAY:-:10}"
export XAUTHORITY="${XAUTHORITY:-/home/ubuntu/.Xauthority}"
export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/1001/bus}"

if (( $# > 0 )); then
  readonly -a CLAVIS_BROWSER_URLS=("$@")
else
  readonly -a CLAVIS_BROWSER_URLS=("$CLAVIS_APPLICATION_URL" "$CLAVIS_WALLET_URL")
fi

exec "$CLAVIS_CHROMIUM_EXECUTABLE" \
  --user-data-dir="$CLAVIS_PROFILE_DIRECTORY" \
  --no-first-run \
  --no-default-browser-check \
  --disable-sync \
  "${CLAVIS_BROWSER_URLS[@]}"
