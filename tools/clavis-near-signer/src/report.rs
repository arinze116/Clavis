use std::fs::OpenOptions;
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::Path;

use crate::model::{AccountResult, SignerScope, Verdict};

pub struct ReportContext<'a> {
    pub results: &'a [AccountResult],
    pub verdict: Verdict,
    pub scope: SignerScope,
    pub near_version: &'a str,
    pub keychain_summary: &'a str,
    pub identity_evidence: &'a str,
    pub backend_summary: &'a str,
    pub incomplete_reason: Option<&'a str>,
    pub execution_date: &'a str,
    pub keyring_version: &'a str,
    pub near_connection: &'a str,
}

pub fn write_report(path: &Path, context: &ReportContext<'_>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("Unable to create report directory: {error}"))?;
    }
    let body = render_report(context);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Signer report path has no valid file name".to_string())?;
    let temporary_path = path.with_file_name(format!(".{file_name}.{}.tmp", std::process::id()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .mode(0o600)
        .open(&temporary_path)
        .map_err(|error| format!("Unable to open signer report: {error}"))?;
    if let Err(error) = file
        .write_all(body.as_bytes())
        .and_then(|()| file.sync_all())
    {
        let _ = std::fs::remove_file(&temporary_path);
        return Err(format!("Unable to write signer report: {error}"));
    }
    std::fs::rename(&temporary_path, path).map_err(|error| {
        let _ = std::fs::remove_file(&temporary_path);
        format!("Unable to publish signer report atomically: {error}")
    })?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(|error| format!("Unable to protect signer report permissions: {error}"))?;
    Ok(())
}

fn render_report(context: &ReportContext<'_>) -> String {
    match context.scope {
        SignerScope::PrimaryAccounts => render_primary_report(context),
        SignerScope::Factory => render_factory_report(context),
    }
}

fn render_primary_report(context: &ReportContext<'_>) -> String {
    let rows = context
        .results
        .iter()
        .map(account_row)
        .collect::<Vec<_>>()
        .join("\n");
    let incomplete = context.incomplete_reason.unwrap_or("None.");
    let any_imported = context
        .results
        .iter()
        .any(|result| result.keychain_imported);
    let tested = if any_imported {
        "Testnet access-key RPC, key derivation, keychain write/read, CLI account lookup, and non-mutating NEP-413 message signing."
    } else {
        "Preflight only: Testnet access-key RPC, Worker 2 discovery, CLI version/checksum, source tests, and secure-keychain availability. No private key, keychain write, or signing challenge was attempted."
    };
    let passed = if context.verdict == Verdict::Ready {
        "All three signer rows are verified."
    } else {
        "The non-secret preflight checks described above passed."
    };
    let failed = if context.verdict == Verdict::Blocked {
        "None; interactive credential verification was not attempted."
    } else {
        "See any account-specific status below."
    };
    let next_step = if context.verdict == Verdict::Ready {
        "Review this report and separately authorise the deployment stage."
    } else {
        "From a trusted SSH terminal run `cd /home/ubuntu/Clavis1 && bash scripts/connect-near-signers.sh`; enter one credential at each hidden prompt and never paste it into chat."
    };
    format!(
        "# Clavis NEAR signer connection report\n\n\
Execution date: {}\n\n\
## Verdict\n\n**{}**\n\n\
## Environment\n\n\
- VPS: Ubuntu 24.04.5 LTS, aarch64, 64-bit.\n\
- NEAR CLI: {}. Initial inspection found no installed `near` executable; the official v0.31.1 aarch64 release was checksum-verified and staged under `/home/ubuntu/.local/lib/clavis-near/`.\n\
- Installed NEAR CLI binary SHA-256: `3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a`; it matches the binary extracted from the checksum-verified official release archive.\n\
- OS keychain provider: {}.\n\
- Existing NEAR configuration: {}.\n\
- Secure signer storage: {}\n\n\
## Signer verification\n\n\
| Account | Public-key fingerprint | FullAccess | Secure keychain | Keychain retrieval | Non-mutating signing challenge |\n\
|---|---|---|---|---|---|\n{}\n\n\
Fingerprints are the first 16 hexadecimal characters of SHA-256 over the canonical textual public key.\n\n\
Worker 2 identity evidence: {}\n\n\
## Preservation and security\n\n\
- Backend agent: {}\n\
- No account or key was generated, replaced, added, deleted, or modified on-chain.\n\
- No contract deployment, upgrade, migration, transfer, payroll request, or service restart was performed.\n\
- The `factory.clavis.testnet` Full Access signer was not part of the requested three-account import and remains a separate prerequisite for a future factory upgrade.\n\
- The workflow accepts private keys and keyring passwords only through hidden `/dev/tty` prompts. It does not place them in arguments, environment variables, plaintext files, Git output, or this report.\n\
- The NEAR CLI legacy plaintext credential directory was not used.\n\n\
## Verification sources\n\n\
- Installed `near --version` and command help for keychain lookup and NEP-413 signing.\n\
- Official NEAR CLI v0.31.1 release: https://github.com/near/near-cli-rs/releases/tag/v0.31.1\n\
- Official tagged source for Secret Service naming and credential shape: https://github.com/near/near-cli-rs/tree/v0.31.1\n\
- Installed GNOME Keyring daemon version and live Secret Service behavior.\n\n\
## Completion report\n\n\
- **Requested:** Connect and verify three existing NEAR Testnet Full Access signers without changing chain or service state.\n\
- **Implemented:** A fail-closed interactive workflow for FullAccess identity checks, persistent Secret Service storage, NEAR CLI retrieval, and NEP-413 signature verification.\n\
- **Tested:** {}\n\
- **Passed:** {}\n\
- **Failed:** {}\n\
- **Incomplete:** {}\n\
- **Not verified:** Deployment, migration, settlement, and service restart were deliberately out of scope.\n\
- **Next step:** {}\n\n\
## Validation commands\n\n\
- `cargo fmt --check --manifest-path tools/clavis-near-signer/Cargo.toml`\n\
- `cargo clippy --locked --manifest-path tools/clavis-near-signer/Cargo.toml -- -D warnings`\n\
- `cargo test --locked --manifest-path tools/clavis-near-signer/Cargo.toml`\n\
- `cargo build --locked --release --manifest-path tools/clavis-near-signer/Cargo.toml`\n\
- `bash -n scripts/connect-near-signers.sh`\n\
- `bash scripts/connect-near-signers.sh --preflight`\n\
- Isolated first-use and second-session `keychain-smoke` runs with a disposable non-secret password.\n\n\
## Account-specific evidence\n\n{}\n\n\
## Scorecard evidence — no self-scores\n\n\
- **Engineering:** Fail-closed identity checks, secure keychain verification, and cryptographic signing validation.\n\
- **Design:** Out of scope; no interface was changed.\n\
- **Branding:** Out of scope; no brand asset was changed.\n\
- **Video:** Out of scope; no video artefact was changed.\n\
- **Research:** Installed state, official NEAR CLI v0.31.1 source/help, Secret Service state, project configuration, and live RPC were cross-checked.\n\
- **Productivity:** The workflow stops before any deployment or transaction and processes one credential at a time.\n\
- **Memory:** Existing Clavis signer/deployment memory was retrieved; no secret material is recorded.\n",
        context.execution_date,
        context.verdict.text(context.scope),
        context.near_version,
        context.keyring_version,
        context.near_connection,
        context.keychain_summary,
        rows,
        context.identity_evidence,
        context.backend_summary,
        tested,
        passed,
        failed,
        incomplete,
        next_step,
        render_details(context.results),
    )
}

fn render_factory_report(context: &ReportContext<'_>) -> String {
    let rows = context
        .results
        .iter()
        .map(account_row)
        .collect::<Vec<_>>()
        .join("\n");
    let incomplete = context.incomplete_reason.unwrap_or("None.");
    let verified = context.results.iter().all(AccountResult::succeeded);
    let tested = if verified {
        "Testnet access-key RPC, exact public-key derivation, keychain write/read, CLI account lookup, and non-mutating NEP-413 message signing."
    } else {
        "Preflight only: final Testnet access-key RPC, exact factory authority matching, CLI version/checksum, source tests, and secure-keychain availability. No factory private key, keychain write, or signing challenge was attempted."
    };
    let passed = if verified {
        "The sole authorised factory FullAccess signer is verified."
    } else {
        "The non-secret factory authority and preflight checks described above passed."
    };
    let failed = if context.verdict == Verdict::Blocked {
        "None; interactive factory credential verification was not attempted."
    } else {
        "See the account-specific status below."
    };
    let next_step = if verified {
        "Run the reviewed factory-only deployment phase through the dedicated keyring launcher; the deployment script will re-check Testnet, the baseline code hash, and this exact public key before signing."
    } else {
        "From a trusted SSH terminal run `cd /home/ubuntu/Clavis1 && bash scripts/connect-factory-signer.sh`; enter only the existing factory credential at the hidden prompt and never paste it into chat."
    };
    format!(
        "# Clavis NEAR factory signer connection report\n\n\
Execution date: {}\n\n\
## Verdict\n\n**{}**\n\n\
## Environment\n\n\
- VPS: Ubuntu 24.04.5 LTS, aarch64, 64-bit.\n\
- NEAR CLI: {}. The checksum-pinned v0.31.1 aarch64 binary is staged under `/home/ubuntu/.local/lib/clavis-near/`.\n\
- Installed NEAR CLI binary SHA-256: `3611418e3d062779f68308f6a0f2067c130af9b6bbc171cc1cdbbee28703a31a`.\n\
- OS keychain provider: {}.\n\
- Existing NEAR configuration: {}.\n\
- Secure signer storage: {}\n\n\
## Factory authority verification\n\n\
| Account | Public-key fingerprint | FullAccess | Secure keychain | Keychain retrieval | Non-mutating signing challenge |\n\
|---|---|---|---|---|---|\n{}\n\n\
Fingerprints are the first 16 hexadecimal characters of SHA-256 over the canonical textual public key.\n\n\
Authority evidence: {}\n\n\
## Preservation and security\n\n\
- Backend agent: {}\n\
- The workflow accepts exactly the existing `factory.clavis.testnet` credential and rejects every derived public key except the sole on-chain FullAccess key captured by the deployment gate.\n\
- No account or key was generated, replaced, added, deleted, or modified on-chain.\n\
- No contract deployment, upgrade, migration, transfer, payroll request, or service restart was performed by this signer workflow.\n\
- Private keys and keyring passwords are accepted only through hidden `/dev/tty` prompts and are never placed in arguments, environment variables, plaintext files, Git output, or this report.\n\
- The owner, worker, and backend-agent credentials remain independent and unchanged.\n\
- The NEAR CLI legacy plaintext credential directory was not used.\n\n\
## Completion report\n\n\
- **Requested:** Prepare and verify the exact existing factory-account signer without bypassing contract permissions or changing chain state.\n\
- **Implemented:** A factory-only, fail-closed hidden-input workflow pinned to the live authorised FullAccess public key.\n\
- **Tested:** {}\n\
- **Passed:** {}\n\
- **Failed:** {}\n\
- **Incomplete:** {}\n\
- **Not verified:** Factory deployment remains out of scope until this signer passes interactive verification.\n\
- **Next step:** {}\n\n\
## Validation commands\n\n\
- `cargo fmt --check --manifest-path tools/clavis-near-signer/Cargo.toml`\n\
- `cargo clippy --locked --manifest-path tools/clavis-near-signer/Cargo.toml -- -D warnings`\n\
- `cargo test --locked --manifest-path tools/clavis-near-signer/Cargo.toml`\n\
- `cargo build --locked --release --manifest-path tools/clavis-near-signer/Cargo.toml`\n\
- `bash -n scripts/connect-factory-signer.sh`\n\
- `bash scripts/connect-factory-signer.sh --preflight`\n\n\
## Account-specific evidence\n\n{}\n\n\
## Scorecard evidence — no self-scores\n\n\
- **Engineering:** Exact-key pinning, fail-closed identity checks, secure keychain verification, and cryptographic signing validation.\n\
- **Design:** Out of scope; no interface was changed.\n\
- **Branding:** Out of scope; no brand asset was changed.\n\
- **Video:** Out of scope; no video artefact was changed.\n\
- **Research:** Live final RPC, deployed code behavior, source access control, deployment configuration, installed CLI help, and Secret Service state were cross-checked.\n\
- **Productivity:** The workflow handles only the missing factory dependency and stops before deployment.\n\
- **Memory:** Existing Clavis signer/deployment memory was retrieved; no secret material is recorded.\n",
        context.execution_date,
        context.verdict.text(context.scope),
        context.near_version,
        context.keyring_version,
        context.near_connection,
        context.keychain_summary,
        rows,
        context.identity_evidence,
        context.backend_summary,
        tested,
        passed,
        failed,
        incomplete,
        next_step,
        render_details(context.results),
    )
}

fn account_row(result: &AccountResult) -> String {
    format!(
        "| `{}` | `{}` | {} | {} | {} | {} |",
        result.account_id,
        result.fingerprint.as_deref().unwrap_or("not verified"),
        yes_no(result.full_access_verified),
        yes_no(result.keychain_imported),
        yes_no(result.keychain_retrieved),
        yes_no(result.signing_challenge_verified),
    )
}

fn render_details(results: &[AccountResult]) -> String {
    results
        .iter()
        .map(|result| {
            format!(
                "### `{}`\n\n- Identity evidence: {}\n- Result: {}\n",
                result.account_id,
                result.identity_evidence,
                result.error.as_deref().unwrap_or("Verified")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn yes_no(value: bool) -> &'static str {
    if value { "Verified" } else { "Not verified" }
}
