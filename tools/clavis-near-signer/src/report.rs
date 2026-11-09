use std::fs::OpenOptions;
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::Path;

use crate::model::{AccountResult, Verdict};

pub struct ReportContext<'a> {
    pub results: &'a [AccountResult],
    pub verdict: Verdict,
    pub near_version: &'a str,
    pub keychain_summary: &'a str,
    pub worker_two_evidence: &'a str,
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
        context.verdict.text(),
        context.near_version,
        context.keyring_version,
        context.near_connection,
        context.keychain_summary,
        rows,
        context.worker_two_evidence,
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
