#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077
ulimit -c 0

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly NEAR_BINARY="/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near"
readonly NEAR_BINARY_SHA256="3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a"
readonly SIGNER_BINARY="/home/ubuntu/.local/lib/clavis-near/clavis-near-signer"
readonly SIGNER_BINARY_SHA256="b40428334ff96446ff8964bbce7ece1990ece1d5148dfb5952e5a55d2997b3bc"
readonly KEYRING_DATA_HOME="/home/ubuntu/.local/share/clavis-near-keyring"
readonly RUNTIME_PARENT="/run/user/$(id -u)"

mode="interactive"
if [[ "${1:-}" == "--preflight" && $# -eq 1 ]]; then
  mode="preflight"
elif [[ $# -ne 0 ]]; then
  echo "Usage: bash scripts/connect-near-signers.sh [--preflight]" >&2
  exit 2
fi

report_date="$(date +%Y%m%d)"
if [[ ! "$report_date" =~ ^[0-9]{8}$ ]]; then
  echo "Unable to determine the report date." >&2
  exit 2
fi
if [[ "$mode" == "preflight" ]]; then
  readonly REPORT_PATH="$ROOT_DIR/docs/reports/clavis-near-signer-preflight-${report_date}.md"
else
  readonly REPORT_PATH="$ROOT_DIR/docs/reports/clavis-near-signer-connection-${report_date}.md"
fi

if [[ "$mode" == "interactive" && ( ! -t 0 || ! -t 1 ) ]]; then
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
if [[ ! -d "$RUNTIME_PARENT" ]]; then
  echo "The current user's private runtime directory is unavailable." >&2
  exit 2
fi

install -d -m 700 "$KEYRING_DATA_HOME"
keyring_runtime="$(mktemp -d "$RUNTIME_PARENT/clavis-near-keyring.XXXXXX")"
keyring_control="$keyring_runtime/control"
mkdir -m 700 "$keyring_control"

credential_state() {
  local path="$1"
  stat -c '%i:%s:%Y:%a' "$path"
  sha256sum "$path" | awk '{print $1}'
}

legacy_state() {
  if [[ -d /home/ubuntu/.near-credentials ]]; then
    find /home/ubuntu/.near-credentials -type f -print0 \
      | sort -z \
      | xargs -0 -r sha256sum
  fi
}

before_legacy_state="$(legacy_state)"
before_agent_state="$(credential_state /opt/clavis/agent/config/agent-credentials.local.json)"

verify_preservation() {
  local after_legacy_state
  local after_agent_state
  after_legacy_state="$(legacy_state)"
  after_agent_state="$(credential_state /opt/clavis/agent/config/agent-credentials.local.json)"
  if [[ "$before_legacy_state" != "$after_legacy_state" ]]; then
    echo "Safety check failed: legacy plaintext credential state changed." >&2
    return 1
  fi
  if [[ "$before_agent_state" != "$after_agent_state" ]]; then
    echo "Safety check failed: backend agent credential changed." >&2
    return 1
  fi
}

cleanup_runtime() {
  case "$keyring_runtime" in
    "$RUNTIME_PARENT"/clavis-near-keyring.*)
      rm -rf -- "$keyring_runtime"
      ;;
    *)
      echo "Refusing to remove an unexpected runtime path." >&2
      return 1
      ;;
  esac
}

finish() {
  local status=$?
  trap - EXIT
  verify_preservation || status=1
  cleanup_runtime || status=1
  exit "$status"
}

trap finish EXIT

dbus-run-session -- env \
  CLAVIS_NEAR_ISOLATED_KEYRING=1 \
  XDG_DATA_HOME="$KEYRING_DATA_HOME" \
  XDG_RUNTIME_DIR="$keyring_runtime" \
  GNOME_KEYRING_CONTROL="$keyring_control" \
  "$SIGNER_BINARY" "$mode" \
  --near-binary "$NEAR_BINARY" \
  --report "$REPORT_PATH"

verify_preservation
trap - EXIT
cleanup_runtime

echo "Signer ${mode} finished without deployment or transaction submission."
echo "Review: $REPORT_PATH"
