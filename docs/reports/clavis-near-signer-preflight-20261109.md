# Clavis NEAR signer connection report

> Historical evidence captured on 2026-11-09. It is retained for audit history and is not current deployment status.

Execution date: 2026-11-09

## Verdict

**BLOCKED — ACCOUNT IDENTITY OR SECURE KEYCHAIN UNAVAILABLE**

## Environment

- VPS: Ubuntu 24.04.5 LTS, aarch64, 64-bit.
- NEAR CLI: near-cli-rs 0.31.1. Initial inspection found no installed `near` executable; the official v0.31.1 aarch64 release was checksum-verified and staged under `/home/ubuntu/.local/lib/clavis-near/`.
- Installed NEAR CLI binary SHA-256: `3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a`; it matches the binary extracted from the checksum-verified official release archive.
- OS keychain provider: gnome-keyring-daemon: 46.1.
- Existing NEAR configuration: `testnet` uses `https://test.rpc.fastnear.com/`; the existing configuration was not modified.
- Secure signer storage: Dedicated GNOME Secret Service login collection exists but is locked

## Signer verification

| Account | Public-key fingerprint | FullAccess | Secure keychain | Keychain retrieval | Non-mutating signing challenge |
|---|---|---|---|---|---|
| `clavis.testnet` | `f04be2ff6ea611fc` | Not verified | Not verified | Not verified | Not verified |
| `arinze-worker1.testnet` | `e82216de9d1b57db` | Not verified | Not verified | Not verified | Not verified |
| `arinze-worker2.testnet` | `375920a41f22718d` | Not verified | Not verified | Not verified | Not verified |

Fingerprints are the first 16 hexadecimal characters of SHA-256 over the canonical textual public key.

Worker 2 identity evidence: Live `/opt/clavis/agent/.env` sets `WORKER_TWO_ID=arinze-worker2.testnet`; Testnet RPC confirms that exact account currently has at least one FullAccess key. The supplied third key must still match one of those keys before import.

## Preservation and security

- Backend agent: `clavis-agent.testnet` remains in the existing backend-only credential file, mode 600; it is preservation-hashed but never displayed, imported, or modified
- No account or key was generated, replaced, added, deleted, or modified on-chain.
- No contract deployment, upgrade, migration, transfer, payroll request, or service restart was performed.
- The `factory.clavis.testnet` Full Access signer was not part of the requested three-account import and remains a separate prerequisite for a future factory upgrade.
- The workflow accepts private keys and keyring passwords only through hidden `/dev/tty` prompts. It does not place them in arguments, environment variables, plaintext files, Git output, or this report.
- The NEAR CLI legacy plaintext credential directory was not used.

## Verification sources

- Installed `near --version` and command help for keychain lookup and NEP-413 signing.
- Official NEAR CLI v0.31.1 release: https://github.com/near/near-cli-rs/releases/tag/v0.31.1
- Official tagged source for Secret Service naming and credential shape: https://github.com/near/near-cli-rs/tree/v0.31.1
- Installed GNOME Keyring daemon version and live Secret Service behavior.

## Completion report

- **Requested:** Connect and verify three existing NEAR Testnet Full Access signers without changing chain or service state.
- **Implemented:** A fail-closed interactive workflow for FullAccess identity checks, persistent Secret Service storage, NEAR CLI retrieval, and NEP-413 signature verification.
- **Tested:** Preflight only: Testnet access-key RPC, Worker 2 discovery, CLI version/checksum, source tests, and secure-keychain availability. No private key, keychain write, or signing challenge was attempted.
- **Passed:** The non-secret preflight checks described above passed.
- **Failed:** None; interactive credential verification was not attempted.
- **Incomplete:** Private keys have not yet been entered in a direct SSH terminal.
- **Not verified:** Deployment, migration, settlement, and service restart were deliberately out of scope.
- **Next step:** From a trusted SSH terminal run `cd /home/ubuntu/Clavis1 && bash scripts/connect-near-signers.sh`; enter one credential at each hidden prompt and never paste it into chat.

## Validation commands

- `cargo fmt --check --manifest-path tools/clavis-near-signer/Cargo.toml`
- `cargo clippy --locked --manifest-path tools/clavis-near-signer/Cargo.toml -- -D warnings`
- `cargo test --locked --manifest-path tools/clavis-near-signer/Cargo.toml`
- `cargo build --locked --release --manifest-path tools/clavis-near-signer/Cargo.toml`
- `bash -n scripts/connect-near-signers.sh`
- `bash scripts/connect-near-signers.sh --preflight`
- Isolated first-use and second-session `keychain-smoke` runs with a disposable non-secret password.

## Account-specific evidence

### `clavis.testnet`

- Identity evidence: Task-specified owner account and live Clavis root
- Result: Awaiting hidden private-key input

### `arinze-worker1.testnet`

- Identity evidence: Task-specified Worker 1 account
- Result: Awaiting hidden private-key input

### `arinze-worker2.testnet`

- Identity evidence: /opt/clavis/agent/.env WORKER_TWO_ID identifies the exact existing account; association is accepted only after an on-chain FullAccess match
- Result: Awaiting hidden private-key input


## Scorecard evidence — no self-scores

- **Engineering:** Fail-closed identity checks, secure keychain verification, and cryptographic signing validation.
- **Design:** Out of scope; no interface was changed.
- **Branding:** Out of scope; no brand asset was changed.
- **Video:** Out of scope; no video artefact was changed.
- **Research:** Installed state, official NEAR CLI v0.31.1 source/help, Secret Service state, project configuration, and live RPC were cross-checked.
- **Productivity:** The workflow stops before any deployment or transaction and processes one credential at a time.
- **Memory:** Existing Clavis signer/deployment memory was retrieved; no secret material is recorded.
