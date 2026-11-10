# Clavis NEAR factory signer connection report

Execution date: 2026-11-10

## Verdict

**READY — EXISTING FACTORY FULL ACCESS SIGNER VERIFIED**

## Environment

- VPS: Ubuntu 24.04.5 LTS, aarch64, 64-bit.
- NEAR CLI: near-cli-rs 0.31.1. The checksum-pinned v0.31.1 aarch64 binary is staged under `/home/ubuntu/.local/lib/clavis-near/`.
- Installed NEAR CLI binary SHA-256: `3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a`.
- OS keychain provider: gnome-keyring-daemon: 46.1.
- Existing NEAR configuration: `testnet` uses `https://test.rpc.fastnear.com/`; the existing configuration was not modified.
- Secure signer storage: Dedicated GNOME Secret Service login collection, encrypted at rest and manually unlocked; NEAR CLI keychain format

## Factory authority verification

| Account | Public-key fingerprint | FullAccess | Secure keychain | Keychain retrieval | Non-mutating signing challenge |
|---|---|---|---|---|---|
| `factory.clavis.testnet` | `11ced76408bc820a` | Verified | Verified | Verified | Verified |

Fingerprints are the first 16 hexadecimal characters of SHA-256 over the canonical textual public key.

Authority evidence: Final Testnet RPC identifies `factory.clavis.testnet` as the code-bearing account and reports one FullAccess key with fingerprint `11ced76408bc820a`. The deployed legacy contract has no owner or self-upgrade entry point; a code-deploy transaction must therefore be signed by that exact account key.

## Preservation and security

- Backend agent: `clavis-agent.testnet` remains in the existing backend-only credential file, mode 600; it is preservation-hashed but never displayed, imported, or modified
- The workflow accepts exactly the existing `factory.clavis.testnet` credential and rejects every derived public key except the sole on-chain FullAccess key captured by the deployment gate.
- No account or key was generated, replaced, added, deleted, or modified on-chain.
- No contract deployment, upgrade, migration, transfer, payroll request, or service restart was performed by this signer workflow.
- The keyring password is accepted only through a hidden `/dev/tty` prompt. Recovery mode reads the fixed owner-only mode-0600 recovery file directly, zeroizes its JSON buffer and sensitive fields, and removes the file only after fresh-session verification; no secret is placed in arguments, environment variables, Git output, or this report.
- The owner, worker, and backend-agent credentials remain independent and unchanged.
- The NEAR CLI legacy plaintext credential directory was not used.

## Completion report

- **Requested:** Prepare and verify the exact existing factory-account signer without bypassing contract permissions or changing chain state.
- **Implemented:** A factory-only, fail-closed hidden-input and protected-file recovery workflow pinned to the live authorised FullAccess public key.
- **Tested:** Protected recovery-file parsing, Testnet access-key RPC, exact public-key derivation, keychain write/read, CLI account lookup, and non-mutating NEP-413 message signing.
- **Passed:** The sole authorised factory FullAccess signer is verified.
- **Failed:** None.
- **Incomplete:** None.
- **Not verified:** Contract deployment, upgrade, migration, permission changes, transactions, and service restarts were deliberately out of scope.
- **Next step:** Stop after signer verification. Any later factory deployment remains a separate owner-authorised task.

## Validation commands

- `cargo fmt --check --manifest-path tools/clavis-near-signer/Cargo.toml`
- `cargo clippy --locked --manifest-path tools/clavis-near-signer/Cargo.toml -- -D warnings`
- `cargo test --locked --manifest-path tools/clavis-near-signer/Cargo.toml`
- `cargo build --locked --release --manifest-path tools/clavis-near-signer/Cargo.toml`
- `bash -n scripts/connect-factory-signer.sh`
- `bash scripts/connect-factory-signer.sh --preflight`
- `bash scripts/connect-factory-signer.sh --inspect-recovery-file`

## Account-specific evidence

### `factory.clavis.testnet`

- Identity evidence: Final Testnet RPC reports exactly one FullAccess key on factory.clavis.testnet; source and deployed behavior expose no contract method that can delegate code-upgrade authority
- Result: Verified


## Scorecard evidence — no self-scores

- **Engineering:** Exact-key pinning, fail-closed identity checks, secure keychain verification, and cryptographic signing validation.
- **Design:** Out of scope; no interface was changed.
- **Branding:** Out of scope; no brand asset was changed.
- **Video:** Out of scope; no video artefact was changed.
- **Research:** Live final RPC, deployed code behavior, source access control, deployment configuration, installed CLI help, and Secret Service state were cross-checked.
- **Productivity:** The workflow handles only the missing factory dependency and stops before deployment.
- **Memory:** Existing Clavis signer/deployment memory was retrieved; no secret material is recorded.
