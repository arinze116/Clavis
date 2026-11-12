#!/usr/bin/env bash

set -euo pipefail
set +x
umask 077
ulimit -c 0

readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly NEAR_BINARY="/home/ubuntu/.local/lib/clavis-near/near-v0.31.1/near"
readonly NEAR_BINARY_SHA256="3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a"
readonly SIGNER_BINARY="/home/ubuntu/.local/lib/clavis-near/clavis-near-signer"
readonly SIGNER_BINARY_SHA256="c8ae8598d74f7366e4496f1ed4fd187b647531341901614bf783c3dcae14c9af"
readonly KEYRING_DATA_HOME="/home/ubuntu/.local/share/clavis-near-keyring"
readonly RUNTIME_PARENT="/run/user/$(id -u)"
readonly AGENT_CREDENTIALS="/opt/clavis/agent/config/agent-credentials.local.json"
readonly RECOVERY_FILE="/home/ubuntu/factory-signer-recovery.json"

mode="factory-interactive"
report_kind="connection"
if [[ $# -eq 0 && -f "$RECOVERY_FILE" && ! -L "$RECOVERY_FILE" ]]; then
  mode="factory-recovery"
elif [[ "${1:-}" == "--preflight" && $# -eq 1 ]]; then
  mode="factory-preflight"
  report_kind="preflight"
elif [[ "${1:-}" == "--verify-existing" && $# -eq 1 ]]; then
  mode="factory-verify-existing"
elif [[ "${1:-}" == "--inspect-recovery-file" && $# -eq 1 ]]; then
  mode="factory-recovery-inspect"
elif [[ "${1:-}" == "--recover-file" && $# -eq 1 ]]; then
  mode="factory-recovery"
elif [[ "${1:-}" == "--verify-all-existing" && $# -eq 1 ]]; then
  mode="verify-all-existing"
elif [[ $# -ne 0 ]]; then
  echo "Usage: bash scripts/connect-factory-signer.sh [--preflight|--verify-existing|--inspect-recovery-file|--recover-file|--verify-all-existing]" >&2
  exit 2
fi

report_date="$(date +%Y%m%d)"
if [[ ! "$report_date" =~ ^[0-9]{8}$ ]]; then
  echo "Unable to determine the report date." >&2
  exit 2
fi
readonly REPORT_PATH="$ROOT_DIR/docs/reports/clavis-near-factory-signer-${report_kind}-${report_date}.md"

if [[ "$mode" != "factory-preflight" && "$mode" != "factory-recovery-inspect" && ( ! -t 0 || ! -t 1 ) ]]; then
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
if [[ "$mode" == "factory-recovery" || "$mode" == "factory-recovery-inspect" ]]; then
  if [[ ! -f "$RECOVERY_FILE" || -L "$RECOVERY_FILE" ]]; then
    echo "The protected factory recovery file is unavailable or unsafe." >&2
    exit 2
  fi
  if [[ "$(stat -Lc '%u:%a:%h' "$RECOVERY_FILE")" != "$(id -u):600:1" ]]; then
    echo "The factory recovery file must be owned by the current user, mode 0600, with one hard link." >&2
    exit 2
  fi
fi
if [[ "$mode" == "factory-recovery" ]]; then
  echo "Protected recovery file detected; running import, fresh verification, and verified cleanup."
fi
if [[ "$mode" == "factory-recovery" ]] && ! command -v shred >/dev/null 2>&1; then
  echo "The secure recovery-file removal command is unavailable." >&2
  exit 2
fi

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

readonly BEFORE_LEGACY_STATE="$(legacy_state)"
readonly BEFORE_AGENT_STATE="$(credential_state "$AGENT_CREDENTIALS")"
keyring_runtime=""

verify_preservation() {
  if [[ "$(legacy_state)" != "$BEFORE_LEGACY_STATE" ]]; then
    echo "Safety check failed: legacy plaintext credential state changed." >&2
    return 1
  fi
  if [[ "$(credential_state "$AGENT_CREDENTIALS")" != "$BEFORE_AGENT_STATE" ]]; then
    echo "Safety check failed: backend agent credential changed." >&2
    return 1
  fi
}

cleanup_runtime() {
  if [[ -z "$keyring_runtime" ]]; then
    return 0
  fi
  case "$keyring_runtime" in
    "$RUNTIME_PARENT"/clavis-near-keyring.*)
      rm -rf -- "$keyring_runtime"
      keyring_runtime=""
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

run_isolated() {
  local status=0
  local keyring_control
  keyring_runtime="$(mktemp -d "$RUNTIME_PARENT/clavis-near-keyring.XXXXXX")"
  keyring_control="$keyring_runtime/control"
  mkdir -m 700 "$keyring_control"

  dbus-run-session -- env \
    CLAVIS_NEAR_ISOLATED_KEYRING=1 \
    XDG_DATA_HOME="$KEYRING_DATA_HOME" \
    XDG_RUNTIME_DIR="$keyring_runtime" \
    GNOME_KEYRING_CONTROL="$keyring_control" \
    "$@" || status=$?

  cleanup_runtime || status=1
  verify_preservation || status=1
  return "$status"
}

run_factory_mode() {
  local signer_mode="$1"
  shift
  run_isolated \
    "$SIGNER_BINARY" "$signer_mode" \
    --near-binary "$NEAR_BINARY" \
    "$@"
}

secure_remove_recovery_file() {
  local expected_identity="$1"
  if [[ "$(stat -Lc '%d:%i' "$RECOVERY_FILE")" != "$expected_identity" ]]; then
    echo "Refusing to remove a recovery file whose identity changed." >&2
    return 1
  fi
  shred --force --iterations=3 --zero --remove=unlink -- "$RECOVERY_FILE"
  sync -f "$(dirname "$RECOVERY_FILE")"
  if [[ -e "$RECOVERY_FILE" || -L "$RECOVERY_FILE" ]]; then
    echo "The temporary factory recovery file still exists after removal." >&2
    return 1
  fi
}

case "$mode" in
  factory-recovery-inspect)
    run_factory_mode factory-recovery-inspect \
      --credential-file "$RECOVERY_FILE"
    ;;
  factory-recovery)
    readonly RECOVERY_IDENTITY="$(stat -Lc '%d:%i' "$RECOVERY_FILE")"
    run_factory_mode factory-recovery-inspect \
      --credential-file "$RECOVERY_FILE"
    run_factory_mode factory-recovery-import \
      --report "$REPORT_PATH" \
      --credential-file "$RECOVERY_FILE"
    run_factory_mode verify-all-existing
    secure_remove_recovery_file "$RECOVERY_IDENTITY"
    ;;
  verify-all-existing)
    run_factory_mode verify-all-existing
    ;;
  *)
    run_factory_mode "$mode" --report "$REPORT_PATH"
    ;;
esac

if [[ "$mode" == "factory-recovery" ]]; then
  echo "Factory signer recovery and fresh-session verification finished without transaction submission."
  echo "The temporary recovery file was securely removed from its local filesystem path."
elif [[ "$mode" == "factory-recovery-inspect" || "$mode" == "verify-all-existing" ]]; then
  echo "Factory signer ${mode} finished without transaction submission."
else
  echo "Factory signer ${report_kind} finished without deployment or transaction submission."
  echo "Review: $REPORT_PATH"
fi
