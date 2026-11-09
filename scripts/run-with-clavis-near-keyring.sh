#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077
ulimit -c 0

readonly NEAR_BINARY="/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near"
readonly NEAR_BINARY_SHA256="3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a"
readonly SIGNER_BINARY="/home/ubuntu/.local/lib/clavis-near/clavis-near-signer"
readonly SIGNER_BINARY_SHA256="c68ee164c0dfdff5f1d432574d871fcc7dd6c5b182a454cd4c3500871dae41bb"
readonly KEYRING_DATA_HOME="/home/ubuntu/.local/share/clavis-near-keyring"
readonly RUNTIME_PARENT="/run/user/$(id -u)"
readonly AGENT_CREDENTIALS="/opt/clavis/agent/config/agent-credentials.local.json"

if [[ $# -eq 0 ]]; then
  echo "Usage: bash scripts/run-with-clavis-near-keyring.sh COMMAND [ARG ...]" >&2
  exit 2
fi
if [[ ! -t 0 || ! -t 1 ]]; then
  echo "Run this command directly in a trusted interactive SSH terminal." >&2
  exit 2
fi
if [[ "$(id -u)" == "0" ]]; then
  echo "Run as the ubuntu deployment user, not root." >&2
  exit 2
fi
if [[ ! -x "$NEAR_BINARY" || ! -x "$SIGNER_BINARY" ]]; then
  echo "The verified Clavis signer tools are not installed." >&2
  exit 2
fi
if [[ "$(sha256sum "$NEAR_BINARY" | awk '{print $1}')" != "$NEAR_BINARY_SHA256" ]]; then
  echo "The pinned NEAR CLI binary failed its checksum verification." >&2
  exit 2
fi
if [[ "$(sha256sum "$SIGNER_BINARY" | awk '{print $1}')" != "$SIGNER_BINARY_SHA256" ]]; then
  echo "The reviewed Clavis signer binary failed its checksum verification." >&2
  exit 2
fi
if [[ "$($NEAR_BINARY --version)" != "near-cli-rs 0.31.1" ]]; then
  echo "The pinned NEAR CLI version is not the reviewed v0.31.1 release." >&2
  exit 2
fi
for required_command in dbus-run-session gdbus gnome-keyring-daemon; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required secure-keychain command is unavailable: $required_command" >&2
    exit 2
  fi
done
if [[ ! -d "$KEYRING_DATA_HOME" ]]; then
  echo "The dedicated Clavis NEAR keyring has not been initialized." >&2
  exit 2
fi
if [[ ! -d "$RUNTIME_PARENT" ]]; then
  echo "The current user's private runtime directory is unavailable." >&2
  exit 2
fi

credential_state() {
  local path="$1"
  stat -c '%i:%s:%Y:%a' "$path"
  sha256sum "$path" | awk '{print $1}'
}

readonly BEFORE_AGENT_STATE="$(credential_state "$AGENT_CREDENTIALS")"
keyring_runtime="$(mktemp -d "$RUNTIME_PARENT/clavis-near-keyring.XXXXXX")"
keyring_control="$keyring_runtime/control"
mkdir -m 700 "$keyring_control"

cleanup() {
  local status=$?
  trap - EXIT
  if [[ "$(credential_state "$AGENT_CREDENTIALS")" != "$BEFORE_AGENT_STATE" ]]; then
    echo "Safety check failed: backend agent credential changed." >&2
    status=1
  fi
  case "$keyring_runtime" in
    "$RUNTIME_PARENT"/clavis-near-keyring.*)
      rm -rf -- "$keyring_runtime"
      ;;
    *)
      echo "Refusing to remove an unexpected runtime path." >&2
      status=1
      ;;
  esac
  exit "$status"
}
trap cleanup EXIT

dbus-run-session -- env \
  CLAVIS_NEAR_ISOLATED_KEYRING=1 \
  XDG_DATA_HOME="$KEYRING_DATA_HOME" \
  XDG_RUNTIME_DIR="$keyring_runtime" \
  GNOME_KEYRING_CONTROL="$keyring_control" \
  "$SIGNER_BINARY" run -- "$@"
