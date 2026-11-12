# Clavis NEAR factory signer identity investigation

> Historical evidence captured on 2026-11-09. It is retained for audit history and is not current deployment status.

Investigation date: 2026-11-09

Scope: read-only identity, configuration, source, keychain-metadata, and Testnet investigation

Outcome: **CONFIRMED — THE ENTERED CREDENTIAL DID NOT MATCH THE FACTORY AUTHORITY**

## Executive finding

The factory signer verification failed for one precise reason: the entered credential derived a public key that was not the public key pinned for `factory.clavis.testnet`. The verifier compared the complete canonical public-key strings and stopped before credential persistence.

The failed attempt recorded fingerprint `f04be2ff6ea611fc`. That is also the fingerprint of the already verified FullAccess signer for `clavis.testnet`. The factory's sole authorised key has fingerprint `11ced76408bc820a`. This is strong identity evidence that the owner credential was entered at the factory-only prompt; it is not evidence of a malformed key.

No factory credential was imported. The dedicated keyring remains limited to the three previously verified owner and worker signers.

## Verified identities

Fingerprints below are the first 16 hexadecimal characters of SHA-256 over the canonical textual public key.

| Property | Verified result |
| --- | --- |
| Actual factory account | `factory.clavis.testnet` |
| Current factory code hash | `DgajXyTxZbvwDznWM8udMDU5L3kDoAgqUHFDSzWKodsW` |
| Number of factory access keys | 1 |
| Authorised factory public key | `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD` |
| Authorised factory fingerprint | `11ced76408bc820a` |
| Authorised factory permission | `FullAccess` |
| Public key pinned by signer importer | Exact match to the on-chain key above |
| Public key pinned by deployment gate | Exact match to the on-chain key above |
| Failed credential fingerprint | `f04be2ff6ea611fc` |
| Verified owner FullAccess fingerprint | `f04be2ff6ea611fc` |
| Factory-authority match | No |

Three independent configured Testnet RPC providers returned the same sole FullAccess key on 2026-11-09: `https://test.rpc.fastnear.com`, `https://near-testnet.drpc.org`, and `https://testnet-rpc.intea.rs`. A separate finality query to `https://rpc.testnet.near.org` agreed. No FunctionCall key or additional FullAccess key exists on the factory account.

## Exact failure classification

| Candidate cause | Finding | Evidence |
| --- | --- | --- |
| Public-key mismatch | **Yes — primary cause** | The importer returned `Derived public key does not match the pinned factory authority`. That branch compares complete public-key strings. |
| Wrong account identity | **Yes — strongly supported** | The rejected fingerprint exactly matches the verified `clavis.testnet` FullAccess signer and differs from the factory fingerprint. |
| Missing or incorrect FullAccess permission | **No — not the cause** | The factory's required key is FullAccess. The rejected key is not an access key on the factory account at all; rejection occurred at identity matching before the permission check. |
| Key-format incompatibility | **No** | The hidden input parsed as a NEAR secret key and successfully derived a public key and fingerprint. Invalid input would have returned `Private key format was invalid`. |
| Incorrect account configuration | **No** | Source, environment examples, deployment scripts, live reports, and Testnet all identify `factory.clavis.testnet`. Both source pins match the sole live key. |
| Defect in identity verification | **No** | The fail-closed comparison operated correctly and prevented persistence. |
| Defect in generated failure report | **Yes — reporting only** | The report renderer labels every incomplete factory result as “Preflight only” and incorrectly says no credential was attempted. This did not affect identity verification. |

## Verification-path review

The factory launcher and signer tool follow this order:

1. `scripts/connect-factory-signer.sh` verifies the pinned NEAR CLI and signer-tool checksums, requires an interactive terminal, starts the isolated Secret Service environment, and preserves the legacy-keychain and backend-agent credential state.
2. `tools/clavis-near-signer/src/main.rs` pins the account to `factory.clavis.testnet` and the expected public key to `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD`.
3. The tool retrieves the live access-key list and requests one credential with echo-disabled terminal input.
4. It parses the private-key format locally and derives the public key.
5. It compares the complete derived public key with the pinned factory public key.
6. Only after exact identity and FullAccess checks pass can `keychain::store_and_verify` run.
7. NEAR CLI retrieval and the non-mutating NEP-413 challenge occur only after storage succeeds.

The failed attempt stopped at step 5. It did not reach the keychain write, CLI retrieval, or signing challenge.

### Reporting defect

`tools/clavis-near-signer/src/report.rs` currently chooses its test narrative from whether every result succeeded. Consequently, an attempted identity failure is rendered with the same “Preflight only” text as a genuine preflight and says that no credential was attempted. The account-specific result and verdict are correct, but that completion paragraph is not.

This investigation does not change the renderer because the requested scope is investigation only. The defect should be corrected and covered by a report-rendering test before the next importer release, without weakening the identity check.

## Keychain and temporary-material status

**Verified clean.** A locked, metadata-only Secret Service inspection was used; no secret values were requested or returned.

- The dedicated login collection was present and locked.
- It contained exactly three persistent entries.
- The entries' hashed service and username metadata matched the known identities for `clavis.testnet`, `arinze-worker1.testnet`, and `arinze-worker2.testnet`.
- The corresponding metadata hashes for `factory.clavis.testnet` and its required public key were absent.
- The import code returns on the public-key mismatch before `store_and_verify`.
- The non-secret smoke-test item is deleted by the workflow and was not present afterward.
- No `clavis-near-keyring.*` or investigation runtime directory remained under `/run/user/1001`.
- No factory credential file exists under `/home/ubuntu/.near-credentials`; its `accounts.json` contains neither the factory account ID nor required factory public key.
- Targeted searches of the project, NEAR configuration, and Clavis state directories found the public key only in non-secret deployment baselines, source pins, and reports—not in a credential file.
- The backend agent credential, owner signer, and worker signers were not read, replaced, or modified.

The keyring file's attempt-time modification is consistent with the workflow's expected write-and-delete smoke test. Persistent item enumeration, rather than modification time alone, establishes that no factory credential was left behind.

## Factory-key provenance

The original factory credential was generated during account creation, not derived from the current owner key.

The archival Testnet transaction `7vttxt9G1RhaKtYqkbwnLMrLSCyQXX4XXo8UWVc6ozJ3` shows that:

- `clavis.testnet` created `factory.clavis.testnet` on 2026-11-03 at 02:45:06 UTC;
- the transaction transferred 8 NEAR;
- its `AddKey` action installed `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD` with `FullAccess`;
- the transaction itself was signed by the owner key, but the newly installed factory key was a separate keypair.

The repository version used at that time confirms how the keypair was created. Commit `d7c7489` contained this NEAR CLI flow in `scripts/deploy-factory.sh`:

```text
near account create-account fund-myself factory.clavis.testnet 8 NEAR \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as clavis.testnet \
  network-config testnet \
  sign-with-legacy-keychain \
  send
```

Therefore the original authorised credential should be sought in the legacy NEAR CLI keychain, home directory, machine snapshot, or protected backup belonging to the operating-system user and host that executed the 2026-11-03 account-creation command. The current VPS legacy keychain no longer contains it.

## Correct recovery procedure

Do not retry the importer with the owner key. Another secure-terminal import is necessary only after the original factory credential is located.

1. Identify the exact machine and operating-system user that ran `scripts/deploy-factory.sh` for transaction `7vttxt9G1RhaKtYqkbwnLMrLSCyQXX4XXo8UWVc6ozJ3` on 2026-11-03.
2. Inspect that user's protected NEAR CLI legacy-keychain directory and any encrypted host snapshots or backups from that date. Search by account ID `factory.clavis.testnet` or public key `ed25519:6BhFt1XJrfAdFanjdxQvAbyPu8zVZjvRvZw6S85mQ9pD` without displaying secret fields.
3. If a candidate credential is found, derive its public key locally on that trusted host. It must equal the complete public key above, not merely resemble the fingerprint.
4. Keep the credential out of chat, command arguments, environment variables, source files, logs, screenshots, and temporary plaintext files.
5. After owner review of this report, run the existing factory importer once from a trusted interactive SSH terminal. Enter only the matching factory credential at the hidden prompt.
6. If no matching original credential can be recovered, leave the factory upgrade blocked. Do not substitute the owner credential, rotate permissions, generate a replacement, or alter deployment configuration as part of this recovery.

No browser wallet should be assumed to hold this key: the historical command explicitly generated it in the NEAR CLI legacy-keychain flow. A browser or password manager is relevant only if the credential was subsequently imported or backed up there by the credential holder.

## Actions not performed

- No second import attempt.
- No private-key prompt.
- No keychain unlock or secret retrieval during this investigation.
- No key generation, replacement, permission change, or account mutation.
- No transaction, factory deployment, contract call, transfer, migration, or service restart.
- No modification to owner, worker, or backend-agent signers.
- No change to factory deployment configuration.

## Completion report

- **Requested:** Establish why factory signer verification failed and define the correct recovery procedure.
- **Implemented:** This evidence report only; no signer or application code was changed.
- **Tested:** Final Testnet account/access-key queries across four providers; archival account-creation transaction lookup; source and historical deployment review; checksum-pinned verification-path review; locked Secret Service metadata enumeration; legacy-keychain filename/reference checks.
- **Passed:** Account identity, sole FullAccess authority, configuration pins, mismatch branch, pre-persistence stop, keychain cleanliness, and historical key provenance were verified.
- **Failed:** The entered credential did not match the factory authority. The generated connection report also contains a non-causal narrative defect.
- **Incomplete:** The original authorised factory credential has not been located or imported.
- **Not verified:** Possession of the original credential and a successful factory signing challenge.
- **Risk:** The factory remains non-upgradeable from the currently connected signers until the original credential is recovered.
- **Next step:** The owner should review this report, then locate the legacy-keychain credential created on 2026-11-03. Only afterward should a new hidden-terminal import be authorised.
- **Proposed memory update:** Supersede the active Clavis factory-signer blocker record with this verified mismatch, clean-keychain result, and 2026-11-03 legacy-keychain provenance. No organisation-memory write was made during this stop-at-investigation task.

## Scorecard evidence — no self-scores

- **Engineering:** Complete-key identity comparison, execution-order review, and persistent-entry enumeration establish the failure and prove the failed credential was not stored.
- **Design:** Out of scope; no interface was changed.
- **Branding:** Out of scope; no brand asset was changed.
- **Video:** Out of scope; no video asset was changed.
- **Research:** Four live Testnet RPC views, an archival creation transaction, current source, historical source, deployment configuration, and locked keychain metadata were cross-checked.
- **Productivity:** Work stopped at the requested investigation boundary; no import or upgrade was attempted.
- **Memory:** Organisation memory was retrieved for context. No secret or private-key material was recorded.
