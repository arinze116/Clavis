mod keychain;
mod model;
mod near;
mod report;
mod system;

use std::io::IsTerminal;
use std::path::Path;
use std::process::Command;
use std::str::FromStr;

use model::{AccountResult, AccountTarget, Verdict, select_verdict};
use near_crypto::SecretKey;
use report::{ReportContext, write_report};
use zeroize::Zeroizing;

const OWNER_ACCOUNT: &str = "clavis.testnet";
const WORKER_ONE_ACCOUNT: &str = "arinze-worker1.testnet";
const LIVE_ENV: &str = "/opt/clavis/agent/.env";
const AGENT_CREDENTIALS: &str = "/opt/clavis/agent/config/agent-credentials.local.json";
const NEAR_CONFIG: &str = "/home/ubuntu/.config/near-cli/config.toml";

fn main() {
    if let Err(error) = run() {
        eprintln!("Signer setup stopped safely: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let arguments = std::env::args().skip(1).collect::<Vec<_>>();
    let mode = arguments.first().map(String::as_str).unwrap_or("preflight");
    system::prepare_secret_service_environment()?;
    match mode {
        "keychain-smoke" => {
            require_terminal()?;
            let _keyring_daemon = system::start_keyring_daemon(true)?;
            keychain_smoke()
        }
        "preflight" => {
            let near_binary = system::argument_value(&arguments, "--near-binary")?;
            let report_path = system::argument_value(&arguments, "--report")?;
            let _keyring_daemon = system::start_keyring_daemon(false)?;
            preflight(&near_binary, Path::new(&report_path))
        }
        "interactive" => {
            require_terminal()?;
            let near_binary = system::argument_value(&arguments, "--near-binary")?;
            let report_path = system::argument_value(&arguments, "--report")?;
            let _keyring_daemon = system::start_keyring_daemon(true)?;
            interactive(&near_binary, Path::new(&report_path))
        }
        "verify-existing" => {
            require_terminal()?;
            require_active_keyring()?;
            let near_binary = system::argument_value(&arguments, "--near-binary")?;
            let report_path = system::argument_value(&arguments, "--report")?;
            verify_existing(&near_binary, Path::new(&report_path))
        }
        "run" => {
            require_terminal()?;
            let separator = arguments
                .iter()
                .position(|argument| argument == "--")
                .ok_or_else(|| "The run mode requires `-- COMMAND [ARG ...]`".to_string())?;
            let command = arguments
                .get(separator + 1..)
                .filter(|command| !command.is_empty())
                .ok_or_else(|| "The run mode requires a command after `--`".to_string())?;
            let _keyring_daemon = system::start_keyring_daemon(true)?;
            run_with_keychain(command)
        }
        _ => Err(
            "Usage: clavis-near-signer <preflight|interactive|verify-existing|keychain-smoke|run> [OPTIONS] [-- COMMAND ...]".into(),
        ),
    }
}

fn require_active_keyring() -> Result<(), String> {
    if std::env::var("CLAVIS_NEAR_KEYRING_ACTIVE").as_deref() == Ok("1") {
        Ok(())
    } else {
        Err("Existing signer verification must run through the reviewed keyring launcher".into())
    }
}

fn run_with_keychain(command: &[String]) -> Result<(), String> {
    system::ensure_persistent_keychain()?;
    keychain::smoke_test()?;
    let status = Command::new(&command[0])
        .args(&command[1..])
        .env("CLAVIS_NEAR_KEYRING_ACTIVE", "1")
        .status()
        .map_err(|error| format!("Unable to start the reviewed keyring command: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "The reviewed keyring command exited unsuccessfully ({status})"
        ))
    }
}

fn keychain_smoke() -> Result<(), String> {
    let state = system::ensure_persistent_keychain()?;
    keychain::smoke_test()?;
    println!(
        "Persistent keychain smoke test passed: {}",
        state.login_path
    );
    Ok(())
}

fn preflight(near_binary: &str, report_path: &Path) -> Result<(), String> {
    let targets = account_targets()?;
    let results = targets.iter().map(preflight_account).collect::<Vec<_>>();
    let state = system::inspect_keychain()?;
    let summary = if state.is_persistent() && state.is_unlocked {
        "Dedicated GNOME Secret Service login collection is persistent and unlocked"
    } else if state.is_persistent() {
        "Dedicated GNOME Secret Service login collection exists but is locked"
    } else {
        "Dedicated GNOME Secret Service storage is not yet initialized"
    };
    write_status_report(
        report_path,
        near_binary,
        &results,
        Verdict::Blocked,
        summary,
        Some("Private keys have not yet been entered in a direct SSH terminal."),
    )?;
    print_preflight(&results, summary);
    Ok(())
}

fn interactive(near_binary: &str, report_path: &Path) -> Result<(), String> {
    require_terminal()?;
    let targets = account_targets()?;
    system::ensure_persistent_keychain()?;
    keychain::smoke_test()?;
    let mut results = Vec::new();
    for target in &targets {
        let result = import_account(target, near_binary);
        let succeeded = result.succeeded();
        results.push(result);
        if !succeeded {
            break;
        }
    }
    for target in targets.iter().skip(results.len()) {
        let mut result = empty_result(target);
        result.error = Some("Not attempted because the preceding signer failed".to_string());
        results.push(result);
    }
    let verdict = select_verdict(&results, false);
    let summary = "Dedicated GNOME Secret Service login collection, encrypted at rest and manually unlocked; NEAR CLI keychain format";
    let incomplete = (verdict != Verdict::Ready)
        .then_some("One or more requested signer verifications did not complete.");
    write_status_report(
        report_path,
        near_binary,
        &results,
        verdict,
        summary,
        incomplete,
    )?;
    println!("{}", verdict.text());
    println!("Report: {}", report_path.display());
    if verdict == Verdict::Ready {
        Ok(())
    } else {
        Err("Not all signer identities completed verification".to_string())
    }
}

fn verify_existing(near_binary: &str, report_path: &Path) -> Result<(), String> {
    let targets = account_targets()?;
    system::ensure_persistent_keychain()?;
    keychain::smoke_test()?;
    let results = targets
        .iter()
        .map(|target| verify_existing_account(target, near_binary))
        .collect::<Vec<_>>();
    let verdict = select_verdict(&results, false);
    let summary = "Dedicated GNOME Secret Service login collection, encrypted at rest and manually unlocked; NEAR CLI keychain format";
    let incomplete = (verdict != Verdict::Ready)
        .then_some("One or more stored signer verifications did not complete.");
    write_status_report(
        report_path,
        near_binary,
        &results,
        verdict,
        summary,
        incomplete,
    )?;
    println!("{}", verdict.text());
    println!("Report: {}", report_path.display());
    if verdict == Verdict::Ready {
        Ok(())
    } else {
        Err("Not all stored signer identities completed verification".to_string())
    }
}

fn verify_existing_account(target: &AccountTarget, near_binary: &str) -> AccountResult {
    let mut result = empty_result(target);
    let access_keys = match near::fetch_access_keys(&target.account_id) {
        Ok(keys) => keys,
        Err(error) => return failed(result, error),
    };
    let Some(secret) = keychain::find_existing(&target.account_id, &access_keys) else {
        return failed(
            result,
            "No matching stored FullAccess signer was found".to_string(),
        );
    };
    let public_key = secret.public_key().to_string();
    result.fingerprint = Some(near::fingerprint(&public_key));
    if !has_full_access(&access_keys, &public_key) {
        return failed(
            result,
            "Stored public key is not an authorised FullAccess key".to_string(),
        );
    }
    result.full_access_verified = true;
    result.keychain_imported = true;
    result.keychain_retrieved = true;
    if let Err(error) =
        near::verify_near_cli_retrieval(near_binary, &target.account_id, &public_key)
    {
        return failed(result, error);
    }
    if let Err(error) = near::run_nep413_challenge(near_binary, &target.account_id, &public_key) {
        return failed(result, error);
    }
    result.signing_challenge_verified = true;
    println!(
        "Verified stored signer {} ({})",
        target.account_id,
        result.fingerprint.as_deref().unwrap_or("")
    );
    result
}

fn import_account(target: &AccountTarget, near_binary: &str) -> AccountResult {
    let mut result = empty_result(target);
    let access_keys = match near::fetch_access_keys(&target.account_id) {
        Ok(keys) => keys,
        Err(error) => return failed(result, error),
    };
    let secret = match existing_or_prompt(target, &access_keys) {
        Ok(secret) => secret,
        Err(error) => return failed(result, error),
    };
    let public_key = secret.public_key().to_string();
    result.fingerprint = Some(near::fingerprint(&public_key));
    if !has_full_access(&access_keys, &public_key) {
        return failed(
            result,
            "Derived public key is not an authorised FullAccess key".into(),
        );
    }
    result.full_access_verified = true;
    if let Err(error) = keychain::store_and_verify(&target.account_id, &secret) {
        return failed(result, error);
    }
    result.keychain_imported = true;
    result.keychain_retrieved = true;
    if let Err(error) =
        near::verify_near_cli_retrieval(near_binary, &target.account_id, &public_key)
    {
        return failed(result, error);
    }
    if let Err(error) = near::run_nep413_challenge(near_binary, &target.account_id, &public_key) {
        return failed(result, error);
    }
    result.signing_challenge_verified = true;
    println!(
        "Verified {} ({})",
        target.account_id,
        result.fingerprint.as_deref().unwrap_or("")
    );
    result
}

fn existing_or_prompt(
    target: &AccountTarget,
    access_keys: &[near::AccessKeyRecord],
) -> Result<SecretKey, String> {
    if let Some(secret) = keychain::find_existing(&target.account_id, access_keys) {
        return Ok(secret);
    }
    let prompt = format!("Enter the existing private key for {}: ", target.account_id);
    let input = Zeroizing::new(
        rpassword::prompt_password(prompt)
            .map_err(|error| format!("Hidden private-key prompt failed: {error}"))?,
    );
    if input.is_empty() {
        return Err("Private key input was empty".to_string());
    }
    SecretKey::from_str(&input).map_err(|_| "Private key format was invalid".to_string())
}

fn preflight_account(target: &AccountTarget) -> AccountResult {
    let mut result = empty_result(target);
    match near::fetch_access_keys(&target.account_id) {
        Ok(keys) => {
            let full = keys
                .iter()
                .filter(|key| key.is_full_access)
                .collect::<Vec<_>>();
            if !full.is_empty() {
                result.fingerprint = Some(
                    full.iter()
                        .map(|key| near::fingerprint(&key.public_key))
                        .collect::<Vec<_>>()
                        .join(", "),
                );
                result.error = Some("Awaiting hidden private-key input".to_string());
            } else {
                result.error = Some("No FullAccess key exists for this account".to_string());
            }
        }
        Err(error) => result.error = Some(error),
    }
    result
}

fn account_targets() -> Result<Vec<AccountTarget>, String> {
    let worker_two = discover_worker_two()?;
    Ok(vec![
        AccountTarget {
            account_id: OWNER_ACCOUNT.to_string(),
            identity_evidence: "Task-specified owner account and live Clavis root".to_string(),
        },
        AccountTarget {
            account_id: WORKER_ONE_ACCOUNT.to_string(),
            identity_evidence: "Task-specified Worker 1 account".to_string(),
        },
        AccountTarget {
            account_id: worker_two,
            identity_evidence: format!(
                "{LIVE_ENV} WORKER_TWO_ID identifies the exact existing account; association is accepted only after an on-chain FullAccess match"
            ),
        },
    ])
}

fn discover_worker_two() -> Result<String, String> {
    let content = std::fs::read_to_string(LIVE_ENV)
        .map_err(|error| format!("Unable to read live Clavis identity configuration: {error}"))?;
    let matches = content
        .lines()
        .filter_map(|line| line.strip_prefix("WORKER_TWO_ID="))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if matches.len() != 1
        || !matches[0].ends_with(".testnet")
        || matches[0].parse::<near_account_id::AccountId>().is_err()
    {
        return Err("Worker 2 identity is missing or ambiguous in live configuration".to_string());
    }
    Ok(matches[0].to_string())
}

fn write_status_report(
    path: &Path,
    near_binary: &str,
    results: &[AccountResult],
    verdict: Verdict,
    keychain_summary: &str,
    incomplete: Option<&str>,
) -> Result<(), String> {
    let version = system::command_stdout(near_binary, &["--version"])?;
    let worker_two = results
        .iter()
        .find(|result| {
            result.account_id != OWNER_ACCOUNT && result.account_id != WORKER_ONE_ACCOUNT
        })
        .map(|result| result.account_id.as_str())
        .unwrap_or("not identified");
    let worker_two_result = results
        .iter()
        .find(|result| result.account_id == worker_two);
    let worker_two_evidence = if worker_two_result.is_some_and(AccountResult::succeeded) {
        format!(
            "Live `{LIVE_ENV}` sets `WORKER_TWO_ID={worker_two}`; the stored signer derived to a Testnet-authorised FullAccess key for that exact account and passed the non-mutating signing challenge."
        )
    } else if worker_two_result.is_some_and(|result| {
        result
            .fingerprint
            .as_deref()
            .is_some_and(|value| !value.is_empty())
    }) {
        format!(
            "Live `{LIVE_ENV}` sets `WORKER_TWO_ID={worker_two}`; Testnet RPC confirms that exact account currently has at least one FullAccess key. The supplied third key must still match one of those keys before import."
        )
    } else {
        format!(
            "Live `{LIVE_ENV}` sets `WORKER_TWO_ID={worker_two}`; see the account-specific result for RPC verification status."
        )
    };
    let backend = backend_summary()?;
    let execution_date = system::command_stdout("date", &["+%Y-%m-%d"])?;
    let keyring_version_output = system::command_stdout("gnome-keyring-daemon", &["--version"])?;
    let keyring_version = keyring_version_output
        .lines()
        .next()
        .unwrap_or("GNOME Keyring version unavailable");
    let near_connection = near_connection_summary()?;
    write_report(
        path,
        &ReportContext {
            results,
            verdict,
            near_version: version.trim(),
            keychain_summary,
            worker_two_evidence: &worker_two_evidence,
            backend_summary: &backend,
            incomplete_reason: incomplete,
            execution_date: execution_date.trim(),
            keyring_version,
            near_connection: &near_connection,
        },
    )
}

fn backend_summary() -> Result<String, String> {
    let metadata = std::fs::metadata(AGENT_CREDENTIALS)
        .map_err(|error| format!("Unable to inspect backend agent credential metadata: {error}"))?;
    use std::os::unix::fs::PermissionsExt;
    let mode = metadata.permissions().mode() & 0o777;
    Ok(format!(
        "`clavis-agent.testnet` remains in the existing backend-only credential file, mode {mode:03o}; it is preservation-hashed but never displayed, imported, or modified"
    ))
}

fn near_connection_summary() -> Result<String, String> {
    let content = std::fs::read_to_string(NEAR_CONFIG)
        .map_err(|error| format!("Unable to inspect NEAR CLI configuration: {error}"))?;
    let mut is_testnet_connection = false;
    for line in content.lines().map(str::trim) {
        if line.starts_with('[') {
            is_testnet_connection = line == "[network_connection.testnet]";
        } else if is_testnet_connection && let Some(value) = line.strip_prefix("rpc_url = ") {
            let rpc_url = value.trim_matches('"');
            if rpc_url.starts_with("https://") {
                return Ok(format!(
                    "`testnet` uses `{rpc_url}`; the existing configuration was not modified"
                ));
            }
        }
    }
    Err("The NEAR CLI testnet connection is missing or invalid".into())
}

fn print_preflight(results: &[AccountResult], keychain_summary: &str) {
    println!("Preflight only; no private key was requested.");
    println!("Keychain: {keychain_summary}");
    for result in results {
        println!(
            "{} FullAccess fingerprint {}",
            result.account_id,
            result.fingerprint.as_deref().unwrap_or("not verified")
        );
    }
}

fn require_terminal() -> Result<(), String> {
    if std::io::stdin().is_terminal() && std::io::stdout().is_terminal() {
        Ok(())
    } else {
        Err("Interactive keyring use requires a genuine local SSH terminal".to_string())
    }
}

fn has_full_access(keys: &[near::AccessKeyRecord], public_key: &str) -> bool {
    keys.iter()
        .any(|key| key.is_full_access && key.public_key == public_key)
}

fn empty_result(target: &AccountTarget) -> AccountResult {
    AccountResult {
        account_id: target.account_id.clone(),
        identity_evidence: target.identity_evidence.clone(),
        ..AccountResult::default()
    }
}

fn failed(mut result: AccountResult, error: String) -> AccountResult {
    result.error = Some(error);
    result
}
