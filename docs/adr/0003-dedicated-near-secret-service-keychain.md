# ADR 0003: Dedicated Secret Service keychain for NEAR signers

- Status: Accepted
- Date: 2026-11-09

Implementation status: the owner and both worker signers are verified in this keychain. The owner signer was later used for the authorized root migration. A factory-only importer is pinned to the sole FullAccess key on `factory.clavis.testnet`, but that distinct credential has not been supplied and the factory remains unchanged.

## Context

Clavis needs three existing NEAR Testnet Full Access signers on a headless Ubuntu VPS. The installed NEAR CLI v0.31.1 supports the freedesktop Secret Service keychain and a legacy plaintext JSON credential directory. Plaintext credentials are not acceptable.

The VPS GNOME Keyring daemon exposes only a transient session collection. Its login and default aliases are unset. Reconfiguring or replacing the shared login daemon could disrupt unrelated processes.

## Decision

Run NEAR CLI signer operations inside a dedicated D-Bus session and dedicated GNOME Secret Service daemon. Persist only the encrypted keyring under `/home/ubuntu/.local/share/clavis-near-keyring`, mode `0700`. Create a fresh private runtime directory for each invocation and remove it afterward.

The Rust importer owns identity validation, zeroized hidden input, on-chain FullAccess checks, exact NEAR CLI credential encoding, keychain round-trip verification, and NEP-413 signature verification. Bash is limited to process isolation, checksum gates, and preservation checks. Rust was selected for typed NEAR key parsing and local signature verification; Bash remains appropriate for the small OS-process boundary.

The importer reads a dedicated keyring password from `/dev/tty` with echo disabled, starts the isolated daemon in its supported startup-unlock mode, verifies that the persistent login collection is the unlocked default, and zeroizes the in-process password buffer. Later uses require the same hidden unlock prompt. The shared VPS keyring, legacy NEAR credential directory, backend agent credential, contracts, and services remain untouched.

The separate factory launcher processes only `factory.clavis.testnet`, compares the derived key with the exact live FullAccess authority, and refuses every mismatch before persistence. Importing that credential remains independent from the reviewed factory deployment phase.

## Consequences

- Private keys are encrypted at rest and never passed in arguments, environment variables, source files, or plaintext credential files.
- NEAR CLI can resolve each signer by Testnet account identity inside an explicitly unlocked session.
- Deployment commands must later use the same isolated-keyring wrapper pattern and still require separate owner authorization.
- Losing the dedicated keyring password makes the stored signers unavailable; it does not alter any on-chain access key.
