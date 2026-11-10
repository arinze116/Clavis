# Clavis NEAR factory signer recovery — final completion

Initial investigation date: 2026-11-09

Recovery completion date: 2026-11-10

Scope: exact credential verification, secure keyring import, signer preservation, fresh-session verification, and temporary-file removal

## Final verdict

**READY — FACTORY SIGNER RECOVERED AND ALL FOUR SIGNERS VERIFIED**

Verified: the transferred credential was a single-link regular file owned by `ubuntu`, mode `0600`, and 409 bytes. It was parsed locally without printing any credential value. The private key derived the canonical factory public key `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD`, whose fingerprint is `11ced76408bc820a`.

Verified: finality RPC identifies that exact key as the sole `FullAccess` key on `factory.clavis.testnet`. The signer was imported into the existing dedicated Clavis GNOME Secret Service keyring, retrieved through near-cli-rs v0.31.1, and passed a non-mutating NEP-413 signing challenge.

Verified: the recovery wrapper completed a second, fresh keyring unlock and verified the factory, owner, and both worker signers before deleting the temporary recovery file. The wrapper cannot reach deletion unless all verification and preservation gates return success. A post-run filesystem check confirmed `/home/ubuntu/factory-signer-recovery.json` is absent.

## Final signer state

| Account | Fingerprint | Testnet FullAccess | Exact keyring metadata | Fresh signer verification |
| --- | --- | --- | --- | --- |
| `clavis.testnet` | `f04be2ff6ea611fc` | Verified | Present | Passed |
| `arinze-worker1.testnet` | `e82216de9d1b57db` | Verified | Present | Passed |
| `arinze-worker2.testnet` | `375920a41f22718d` | Verified | Present | Passed |
| `factory.clavis.testnet` | `11ced76408bc820a` | Verified | Present | Passed |

The three pre-existing owner/worker fingerprints exactly match the 2026-11-09 verified baseline. A locked, metadata-only post-run inspection found all four exact account/public-key items; no stored secret was requested or returned.

## Security and preservation evidence

- The recovery parser opened the fixed path with `O_NOFOLLOW`, required a regular single-link file owned by the current user with mode `0600`, bounded the file size, rejected unknown JSON fields, and zeroized the input buffer and sensitive strings.
- The declared public key, private-key derivation, and implicit account identity had to agree before RPC or keyring import could pass.
- The signer tool and all keyring launchers pin installed binary SHA-256 `c8ae8598d74f7366e4496f1ed4fd187b647531341901614bf783c3dcae14c9af`.
- The dedicated keyring remains `/home/ubuntu/.local/share/clavis-near-keyring/keyrings/login.keyring`, owned by `ubuntu`, mode `0600`.
- The backend-agent credential remains owned by `ubuntu`, mode `0600`, with its pre-existing 2026-11-06 modification time. The wrapper preservation-hashed it and the legacy credential store around every isolated run.
- The temporary recovery file was overwritten with three passes plus a zero pass and unlinked only after fresh verification. Its path is absent. This is the strongest local ext4 deletion available to the workflow; physical-media remanence, provider snapshots, and the original Windows copy are outside this VPS verification boundary.
- No private key, seed phrase, keyring password, or secret-bearing value was printed, passed in command arguments or environment variables, written to Git, or included in this report.

## Chain and service boundary

No transaction was submitted. No contract was deployed or upgraded. No access key or permission was added, deleted, or changed. No service was restarted. The live FullAccess keys remain:

- `clavis.testnet` — `ed25519:Bzk9o3X52NXSWU8GW2HXFiRWj8TdLYzVKSZQxi7vDq8c`
- `arinze-worker1.testnet` — `ed25519:Htw1X9TG7TwXcMPywYjiRkngX6dUYPxktLWf46KkBmxt`
- `arinze-worker2.testnet` — `ed25519:8zbmkNmENQfdYFqEkcb18qozH9n28YZ1bE7FuSAbyMbK`
- `factory.clavis.testnet` — `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD`

## Validation evidence

- `cargo fmt --check --manifest-path tools/clavis-near-signer/Cargo.toml`
- `cargo clippy --locked --manifest-path tools/clavis-near-signer/Cargo.toml --all-targets -- -D warnings`
- `cargo test --locked --manifest-path tools/clavis-near-signer/Cargo.toml` — 12 passed, 0 failed
- `cargo build --locked --release --manifest-path tools/clavis-near-signer/Cargo.toml`
- `bash -n scripts/connect-factory-signer.sh scripts/connect-near-signers.sh scripts/run-with-clavis-near-keyring.sh`
- `bash scripts/connect-factory-signer.sh --inspect-recovery-file` — fingerprint and FullAccess verified before import
- `bash scripts/connect-factory-signer.sh` — protected-file import, before/after owner-worker verification, fresh all-signer verification, and guarded cleanup
- Post-run finality RPC query for all four accounts
- Post-run locked Secret Service metadata query for all four exact account/public-key identities
- Post-run filesystem absence check for `/home/ubuntu/factory-signer-recovery.json`

Generated factory connection evidence: `docs/reports/clavis-near-factory-signer-connection-20261110.md`.

## Completion report

- **Requested:** Recover the original factory signer, verify exact authority, import it securely, preserve existing signers, remove the temporary file, and stop without chain or service changes.
- **Implemented:** A fail-closed protected-file recovery mode using the existing isolated Secret Service keyring, exact Testnet authority checks, before/after primary-signer verification, a second fresh unlock, and guarded overwrite/unlink cleanup.
- **Tested:** File metadata and JSON shape, local key derivation, implicit identity, fingerprint, three-provider and final RPC authority, keyring write/read, NEAR CLI retrieval, NEP-413 signing, fresh unlock, exact locked metadata, preservation gates, and file absence.
- **Passed:** Factory fingerprint `11ced76408bc820a`; factory FullAccess; secure keyring import and retrieval; local signing challenge; fresh-session verification; unchanged owner/worker fingerprints; recovery-file removal.
- **Failed:** One intermediate run stopped safely while verifying Worker 1. The file was preserved. Live RPC and locked metadata showed the expected Worker 1 identity unchanged; improved diagnostics were installed, and the final recovery run passed all gates.
- **Incomplete:** None within the requested recovery scope.
- **Not verified:** Physical storage remanence, external snapshots, and the original Windows credential copy; deployment and contract execution were deliberately not attempted.
- **Risk:** Continued signer availability depends on retaining the dedicated keyring password and protected keyring backup practices.
- **Next step:** Stop. Any future factory deployment, permission change, transaction, or service operation requires a separate owner-authorised task.

## Scorecard evidence — no self-scores

- **Engineering:** Exact cryptographic identity checks, zeroized parsing, `O_NOFOLLOW`, permission/link gates, isolated keyring sessions, preservation hashes, unit tests, lint, release checksum pinning, fresh verification, and guarded cleanup.
- **Design:** Out of scope; no user interface was changed or assessed.
- **Branding:** Out of scope; no brand asset was changed or assessed.
- **Video:** Out of scope; no video asset was changed or assessed.
- **Research:** Installed source/help, Secret Service behavior, four live account states, multiple Testnet RPC providers, prior provenance evidence, and post-run metadata were cross-checked.
- **Productivity:** Recovery remained limited to the exact missing signer, preserved the file on every failed gate, and stopped immediately after verified cleanup.
- **Memory:** Relevant organisation memory was retrieved; the final durable status is recorded without any secret material.

## Source ledger

- Live NEAR Testnet finality RPC, accessed 2026-11-10.
- `docs/reports/clavis-near-factory-signer-connection-20261110.md`.
- `docs/reports/clavis-near-signer-connection-20261109.md` baseline fingerprints.
- `docs/adr/0003-dedicated-near-secret-service-keychain.md`.
- Reviewed local signer source and successful validation commands listed above.

# Historical record — pre-recovery state on 2026-11-09 (superseded)

The sections below are retained unchanged as the audit record of the earlier blocked investigation. Their blocked status and next-step statements were superseded by the successful recovery documented above.

# Clavis NEAR factory signer recovery report

Recovery date: 2026-11-09

Scope: credential discovery and secure-import readiness only

## Verdict

**BLOCKED — ORIGINAL FACTORY CREDENTIAL NOT PRESENT ON THIS VPS**

The original `factory.clavis.testnet` private key was not located. No import was attempted. The on-chain authority remains the sole FullAccess key with fingerprint `11ced76408bc820a`.

The strongest provenance evidence points to the Windows user profile that created the project archive and ran the account-creation workflow on 2026-11-03. That external profile is not mounted or otherwise accessible from this VPS.

## Evidence labels

- **Verified:** Directly observed in source, filesystem metadata, archives, keychain metadata, or Testnet RPC.
- **Strongly supported:** Multiple independent facts agree, but the original machine or configuration is unavailable.
- **Unknown:** No surviving evidence establishes the value.

## Recovery status

| Requirement | Result |
| --- | --- |
| Original credential located | **No** |
| Required public-key fingerprint | `11ced76408bc820a` |
| Factory account identity | `factory.clavis.testnet` |
| On-chain permission | `FullAccess` |
| Secure Clavis keyring import | Not attempted; no matching source credential |
| Dedicated keyring unlock | Not attempted; no import operation |
| Existing owner/worker entries | Verified unchanged |
| On-chain or service changes | None |

## NEAR CLI and storage provenance

### CLI family

**Verified:** The factory creation script used the command grammar of `near-cli-rs`:

```text
near account create-account fund-myself factory.clavis.testnet 8 NEAR \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as clavis.testnet \
  network-config testnet \
  sign-with-legacy-keychain \
  send
```

**Verified release context:** `near-cli-rs` v0.30.1 was the newest version published through the official npm registry before the account-creation transaction on 2026-11-03. Its tagged source implements the exact command and storage behavior above. This establishes the applicable contemporary behavior, not the exact installed version.

**Unknown:** The exact historical binary version. No original binary, install record, command log, or original NEAR CLI configuration survived locally. A version older than v0.30.1 cannot be excluded.

The v0.31.1 CLI currently staged on this VPS was downloaded on 2026-11-09 and did not create the factory account.

### Current VPS configuration

The current `/home/ubuntu/.config/near-cli/config.toml` declares:

```text
credentials_home_dir = "/home/ubuntu/.near-credentials"
network profile = "testnet"
RPC = "https://test.rpc.fastnear.com/"
```

That configuration file and `/home/ubuntu/.near-credentials` were created on 2026-11-09, six days after the factory account. They are not the original account-creation store.

The current credential directory contains only:

- `/home/ubuntu/.near-credentials/accounts.json` — empty;
- `/home/ubuntu/.near-credentials/ft_contracts.json` — public token metadata.

It has no `testnet` subtree and no factory credential.

### Original legacy format and expected location

The official v0.30.1 source verifies that `save-to-legacy-keychain` writes the generated keypair as plaintext JSON beneath the configured `credentials_home_dir`. It creates two copies:

```text
<credentials_home_dir>/testnet/factory.clavis.testnet/
  ed25519_6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD.json

<credentials_home_dir>/testnet/factory.clavis.testnet.json
```

The CLI does not encrypt these files. Their protection depends on the operating system's filesystem permissions or ACLs.

The preserved `clavis1.zip` archive was created by an MS-DOS/NT FAT ZIP implementation and uses Windows path separators. Its `scripts\deploy-factory.sh` member was last modified at 03:32 on 2026-11-03. ZIP timestamps carry no timezone, so the exact interval to the 03:45 WAT factory transaction is not asserted.

**Strongly supported original default path:**

```text
%USERPROFILE%\.near-credentials\testnet\factory.clavis.testnet.json
```

and the key-specific copy under:

```text
%USERPROFILE%\.near-credentials\testnet\factory.clavis.testnet\
```

**Unknown:** Whether the original Windows NEAR CLI configuration overrode `credentials_home_dir`. The archive contains no original `near-cli\config.toml`, so the default path cannot be promoted from strongly supported to verified.

## Testnet verification

A fresh finality query at block `276975815` returned exactly one access key for `factory.clavis.testnet`:

| Public key | Fingerprint | Permission |
| --- | --- | --- |
| `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD` | `11ced76408bc820a` | `FullAccess` |

No alternate factory access key exists that could satisfy recovery.

## Locations inspected

All private-key candidate scans derived public keys in memory and emitted fingerprints only. No private-key value was printed or persisted.

### Legacy and OS credential stores

- `/home/ubuntu/.config/near-cli/config.toml` and its configured credential root.
- Every `.near-credentials` directory under `/home` and `/root`; only the new, empty 2026-11-09 store exists.
- The current shared GNOME Secret Service. It has only an empty, non-persistent session collection and no login or default collection.
- The dedicated Clavis Secret Service collection. It remains locked and contains exactly the three existing owner/worker items; the factory item is absent.
- No persistent shared-keyring file exists under the normal user or root keyring locations.

### Project, history, and local data

- `/home/ubuntu/Clavis1` and `/home/ubuntu/clavis`.
- `/opt/clavis`, including the protected backend-agent configuration.
- `/home/ubuntu/.codex/sessions` and local history records.
- The isolated Clavis Chromium wallet profile.
- `/home/ubuntu/backups`, `Documents`, `Downloads`, and `Desktop`.
- `/root`, `/var/backups`, `/srv`, and scoped `/tmp` data.
- Available shell histories and NEAR CLI final-command logs.
- `/mnt`, `/media`, `/home/ubuntu/thinclient_drives`, and the active GVFS directory. No external or redirected drive is mounted.

The scoped regular-file scan found several valid NEAR private-key candidates belonging to the existing backend agent, test fixtures, or third-party wallet code. None derived to `11ced76408bc820a`.

### Archives and backups

- `clavis1.zip`: 5,747 entries inspected. Its only credential candidates derive to backend-agent fingerprint `3cd936add69d9567`.
- `clavis2.zip`: the central directory is truncated; 3,131 recoverable local entries were parsed directly. Its only credential candidates also derive to `3cd936add69d9567`.
- 39 other readable local ZIP/TAR archives: 12,994 members inspected with no factory fingerprint match.
- Two small, unrelated Pactra archives were not valid readable TAR files. Their names and scope contain no Clavis or NEAR relationship.
- `/home/ubuntu/migration.tar.gz` predates the factory account by more than two months and cannot contain a key generated on 2026-11-03; it was not expanded.

No local snapshot, Restic repository, Borg repository, mounted backup, or Clavis-specific backup service is available.

## Dedicated keyring preservation

A locked metadata-only inspection confirmed the three existing entries still map to:

- `clavis.testnet`;
- `arinze-worker1.testnet`;
- `arinze-worker2.testnet`.

The dedicated keyring file SHA-256 was identical before and after inspection:

```text
7b8a2e06f9418d031e84e16204e4dc2a30224f720be6ce849265d09850aadf3a
```

No keyring password or stored secret was requested. The owner, workers, and backend agent remain unchanged.

## Exact external recovery action

Recovery must continue on the Windows machine or protected backup belonging to the user who ran the factory creation workflow on 2026-11-03.

1. Search the original Windows user's `%USERPROFILE%\.near-credentials` tree for `factory.clavis.testnet.json` and the key-specific filename shown above.
2. Also inspect that user's encrypted backups, File History, OneDrive backup if it covered the profile, Recycle Bin, and any machine image from 2026-11-03 or later.
3. Do not display, paste, upload, email, or send the private-key field through chat. Use a trusted local parser that emits only the `public_key` field, or derives the public key in memory.
4. Accept a candidate only if its complete public key equals `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD`.
5. Once the matching original file is recovered, preserve it until the dedicated Clavis keyring import and non-mutating signing challenge both succeed.
6. Then use `scripts/connect-factory-signer.sh` from a trusted interactive SSH terminal and enter the credential only through its hidden prompt.

Do not send the credential to Codex chat. If the original Windows profile or backup is unavailable, the factory signer remains unrecoverable under the current no-key-replacement and no-permission-change boundary.

## Actions not performed

- No credential was imported.
- No dedicated keyring was unlocked.
- No private key was displayed, logged, copied to an argument, placed in an environment variable, or written to a temporary file.
- No replacement credential was generated.
- No access key or permission was changed.
- No transaction, factory upgrade, contract migration, transfer, or service restart occurred.

## Completion report

- **Requested:** Locate the original factory credential and securely import an exact match.
- **Implemented:** Read-only provenance, legacy-store, archive, fingerprint, OS-keychain, backup, and Testnet investigation; this report.
- **Tested:** Current and historical CLI configuration/source; final Testnet access-key state; two Clavis archives; 39 additional readable archives; scoped VPS private-key candidate fingerprints; shared and dedicated Secret Service metadata; mounted-storage and backup availability.
- **Passed:** The required on-chain identity and permission were reconfirmed. Existing Clavis signers remained unchanged. No secret was exposed.
- **Failed:** No local candidate derived to fingerprint `11ced76408bc820a`.
- **Incomplete:** Factory signer import, keychain retrieval, unlock verification, and NEP-413 challenge.
- **Not verified:** The original Windows credential store and any off-VPS backup.
- **Risk:** The factory remains legacy and cannot be upgraded through the currently available signers.
- **Next step:** Recover the exact legacy JSON file from the original Windows profile or its protected backup, then return for hidden-terminal import verification.
- **Proposed memory update:** Record that local recovery was exhausted and the remaining dependency is the original Windows legacy-keychain file. No organisation-memory write was made because the signer remains unrecovered.

## Source ledger

- NEAR Testnet RPC, `https://rpc.testnet.near.org`, accessed 2026-11-09: current access-key identity and FullAccess permission.
- Official npm registry, `https://registry.npmjs.org/near-cli-rs`, accessed 2026-11-09: v0.30.1 was the latest published version before factory creation.
- Official near-cli-rs v0.30.1 source, `https://github.com/near/near-cli-rs/tree/v0.30.1`, accessed 2026-11-09: default credential root and plaintext legacy-file layout.
- Archival Testnet transaction `7vttxt9G1RhaKtYqkbwnLMrLSCyQXX4XXo8UWVc6ozJ3`: factory creation and installed FullAccess public key.
- Local `clavis1.zip`: Windows archive provenance and contemporaneous deployment-script timestamp.

## Scorecard evidence — no self-scores

- **Engineering:** Candidate secrets were handled in memory, reduced to public fingerprints, and never printed; persistent keyring state was preservation-hashed.
- **Design:** Out of scope; no interface was changed.
- **Branding:** Out of scope; no brand asset was changed.
- **Video:** Out of scope; no video asset was changed.
- **Research:** Current RPC, official registry/source, filesystem metadata, archive provenance, credential stores, and backups were cross-checked.
- **Productivity:** The search stopped at the exact external boundary instead of attempting replacement or unauthorized state changes.
- **Memory:** Relevant organisation memory was retrieved; no secret was stored in memory.
