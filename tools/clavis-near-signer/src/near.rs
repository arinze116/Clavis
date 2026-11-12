use std::str::FromStr;
use std::time::Duration;

use base64::Engine;
use borsh::BorshSerialize;
use near_crypto::{PublicKey, Signature};
use rand::RngCore;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

const TESTNET_RPC_URLS: [&str; 3] = [
    "https://test.rpc.fastnear.com",
    "https://near-testnet.drpc.org",
    "https://testnet-rpc.intea.rs",
];

#[derive(Clone, Debug)]
pub struct AccessKeyRecord {
    pub public_key: String,
    pub is_full_access: bool,
}

#[derive(BorshSerialize)]
struct Nep413Payload {
    message: String,
    nonce: [u8; 32],
    recipient: String,
    callback_url: Option<String>,
}

#[derive(Deserialize)]
struct SignedMessage {
    #[serde(rename = "accountId")]
    account_id: String,
    #[serde(rename = "publicKey")]
    public_key: String,
    signature: String,
}

pub fn fetch_access_keys(account_id: &str) -> Result<Vec<AccessKeyRecord>, String> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": account_id,
        "method": "query",
        "params": {
            "request_type": "view_access_key_list",
            "finality": "final",
            "account_id": account_id
        }
    });
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|error| format!("Unable to configure NEAR RPC client: {error}"))?;
    let mut failures = Vec::new();
    for rpc_url in TESTNET_RPC_URLS {
        let response = match client
            .post(rpc_url)
            .json(&body)
            .send()
            .and_then(|response| response.error_for_status())
        {
            Ok(response) => response,
            Err(error) => {
                failures.push(format!("{rpc_url}: {error}"));
                continue;
            }
        };
        let response: Value = match response.json() {
            Ok(response) => response,
            Err(error) => {
                failures.push(format!("{rpc_url}: invalid JSON ({error})"));
                continue;
            }
        };
        match parse_access_keys(account_id, &response) {
            Ok(keys) => return Ok(keys),
            Err(error) => failures.push(format!("{rpc_url}: {error}")),
        }
    }
    Err(format!(
        "All verified NEAR Testnet RPC providers failed for {account_id}: {}",
        failures.join("; ")
    ))
}

fn parse_access_keys(account_id: &str, response: &Value) -> Result<Vec<AccessKeyRecord>, String> {
    let keys = response
        .pointer("/result/keys")
        .and_then(Value::as_array)
        .ok_or_else(|| format!("Account {account_id} was not returned by NEAR Testnet RPC"))?;
    keys.iter()
        .map(|key| {
            let public_key = key
                .get("public_key")
                .and_then(Value::as_str)
                .ok_or_else(|| "RPC access key omitted public_key".to_string())?;
            let permission = key.pointer("/access_key/permission");
            Ok(AccessKeyRecord {
                public_key: public_key.to_string(),
                is_full_access: permission == Some(&Value::String("FullAccess".to_string())),
            })
        })
        .collect()
}

pub fn fingerprint(public_key: &str) -> String {
    let digest = Sha256::digest(public_key.as_bytes());
    hex_prefix(&digest, 16)
}

fn hex_prefix(bytes: &[u8], length: usize) -> String {
    bytes
        .iter()
        .flat_map(|byte| format!("{byte:02x}").chars().collect::<Vec<_>>())
        .take(length)
        .collect()
}

pub fn verify_near_cli_retrieval(
    near_binary: &str,
    account_id: &str,
    public_key: &str,
) -> Result<(), String> {
    let output = std::process::Command::new(near_binary)
        .args([
            "account",
            "get-public-key",
            "from-keychain",
            account_id,
            "network-config",
            "testnet",
        ])
        .output()
        .map_err(|error| format!("Unable to run NEAR CLI keychain lookup: {error}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    if output.status.success() && stdout.lines().any(|line| line.trim() == public_key) {
        Ok(())
    } else {
        Err(format!(
            "NEAR CLI could not retrieve the signer for {account_id}"
        ))
    }
}

pub fn run_nep413_challenge(
    near_binary: &str,
    account_id: &str,
    expected_public_key: &str,
) -> Result<(), String> {
    let message = format!("Clavis signer verification for {account_id}");
    let recipient = "clavis-signer-verification.local";
    let mut nonce = [0_u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut nonce);
    let encoded_nonce = base64::engine::general_purpose::STANDARD.encode(nonce);
    let output = std::process::Command::new(near_binary)
        .args([
            "message",
            "sign-nep413",
            "utf8",
            &message,
            "nonce",
            &encoded_nonce,
            "recipient",
            recipient,
            "sign-as",
            account_id,
            "sign-with-keychain",
            "network-config",
            "testnet",
        ])
        .output()
        .map_err(|error| format!("Unable to run NEP-413 signing challenge: {error}"))?;
    if !output.status.success() {
        return Err(format!("NEP-413 signing challenge failed for {account_id}"));
    }
    let signed: SignedMessage = serde_json::from_slice(&output.stdout)
        .map_err(|_| format!("NEP-413 output was invalid for {account_id}"))?;
    verify_nep413(
        &signed,
        &message,
        nonce,
        recipient,
        account_id,
        expected_public_key,
    )
}

fn verify_nep413(
    signed: &SignedMessage,
    message: &str,
    nonce: [u8; 32],
    recipient: &str,
    account_id: &str,
    expected_public_key: &str,
) -> Result<(), String> {
    if signed.account_id != account_id || signed.public_key != expected_public_key {
        return Err("NEP-413 signer identity did not match".to_string());
    }
    let payload = Nep413Payload {
        message: message.to_string(),
        nonce,
        recipient: recipient.to_string(),
        callback_url: None,
    };
    let mut bytes = ((1_u32 << 31) + 413).to_le_bytes().to_vec();
    borsh::to_writer(&mut bytes, &payload)
        .map_err(|error| format!("Unable to encode NEP-413 challenge: {error}"))?;
    let hash = Sha256::digest(&bytes);
    let signature = Signature::from_str(&signed.signature)
        .map_err(|_| "NEP-413 signature was malformed".to_string())?;
    let public_key = PublicKey::from_str(expected_public_key)
        .map_err(|_| "Stored public key was malformed".to_string())?;
    if signature.verify(&hash, &public_key) {
        Ok(())
    } else {
        Err("NEP-413 signature verification failed".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_crypto::{KeyType, SecretKey};

    fn signed_message(
        secret: &SecretKey,
        message: &str,
        nonce: [u8; 32],
        recipient: &str,
        account_id: &str,
    ) -> SignedMessage {
        let payload = Nep413Payload {
            message: message.to_string(),
            nonce,
            recipient: recipient.to_string(),
            callback_url: None,
        };
        let mut bytes = ((1_u32 << 31) + 413).to_le_bytes().to_vec();
        borsh::to_writer(&mut bytes, &payload).unwrap();
        let hash = Sha256::digest(&bytes);
        SignedMessage {
            account_id: account_id.to_string(),
            public_key: secret.public_key().to_string(),
            signature: secret.sign(&hash).to_string(),
        }
    }

    #[test]
    fn verifies_valid_nep413_signature() {
        let secret = SecretKey::from_random(KeyType::ED25519);
        let nonce = [7_u8; 32];
        let signed = signed_message(&secret, "verify", nonce, "clavis.local", "owner.testnet");

        assert!(
            verify_nep413(
                &signed,
                "verify",
                nonce,
                "clavis.local",
                "owner.testnet",
                &secret.public_key().to_string(),
            )
            .is_ok()
        );
    }

    #[test]
    fn rejects_nep413_identity_mismatch() {
        let secret = SecretKey::from_random(KeyType::ED25519);
        let nonce = [9_u8; 32];
        let signed = signed_message(&secret, "verify", nonce, "clavis.local", "owner.testnet");

        assert!(
            verify_nep413(
                &signed,
                "verify",
                nonce,
                "clavis.local",
                "worker.testnet",
                &secret.public_key().to_string(),
            )
            .is_err()
        );
    }

    #[test]
    fn parses_only_full_access_permissions_as_full_access() {
        let response = json!({
            "result": {
                "keys": [
                    {
                        "public_key": "ed25519:full",
                        "access_key": { "permission": "FullAccess" }
                    },
                    {
                        "public_key": "ed25519:function",
                        "access_key": {
                            "permission": {
                                "FunctionCall": {
                                    "allowance": null,
                                    "receiver_id": "contract.testnet",
                                    "method_names": ["call"]
                                }
                            }
                        }
                    }
                ]
            }
        });

        let keys = parse_access_keys("owner.testnet", &response).unwrap();
        assert!(keys[0].is_full_access);
        assert!(!keys[1].is_full_access);
    }
}
