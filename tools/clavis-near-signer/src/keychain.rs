use std::str::FromStr;

use near_crypto::{PublicKey, SecretKey};
use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

use crate::near::AccessKeyRecord;

#[derive(Serialize)]
struct Credential<'a> {
    private_key: &'a SecretKey,
    public_key: &'a PublicKey,
}

#[derive(Deserialize, Zeroize, ZeroizeOnDrop)]
struct StoredCredential {
    private_key: String,
    public_key: String,
}

pub fn find_existing(
    account_id: &str,
    access_keys: &[AccessKeyRecord],
    expected_public_key: Option<&str>,
) -> Option<SecretKey> {
    access_keys
        .iter()
        .filter(|key| key.is_full_access)
        .filter(|key| expected_public_key.is_none_or(|expected| key.public_key == expected))
        .find_map(|key| load(account_id, &key.public_key).ok())
}

pub fn store_and_verify(account_id: &str, secret_key: &SecretKey) -> Result<(), String> {
    let public_key = secret_key.public_key();
    let public_key_text = public_key.to_string();
    let entry = entry(account_id, &public_key_text)?;
    let encoded = Zeroizing::new(
        serde_json::to_string(&Credential {
            private_key: secret_key,
            public_key: &public_key,
        })
        .map_err(|error| format!("Unable to encode signer for keychain: {error}"))?,
    );
    entry
        .set_password(&encoded)
        .map_err(|error| format!("Unable to store signer in secure keychain: {error}"))?;
    if let Err(error) = load(account_id, &public_key_text) {
        let _ = entry.delete_credential();
        return Err(error);
    }
    Ok(())
}

pub fn smoke_test() -> Result<(), String> {
    let entry = keyring::Entry::new("clavis-near-keychain-smoke", "temporary")
        .map_err(|error| format!("Unable to open Secret Service keychain: {error}"))?;
    entry
        .set_password("non-secret-smoke-test")
        .map_err(|error| format!("Unable to write Secret Service smoke test: {error}"))?;
    let value = match entry.get_password() {
        Ok(value) => value,
        Err(error) => {
            let _ = entry.delete_credential();
            return Err(format!("Unable to read Secret Service smoke test: {error}"));
        }
    };
    entry
        .delete_credential()
        .map_err(|error| format!("Unable to remove Secret Service smoke test: {error}"))?;
    if value == "non-secret-smoke-test" {
        Ok(())
    } else {
        Err("Secret Service smoke-test value did not round-trip".to_string())
    }
}

fn load(account_id: &str, public_key: &str) -> Result<SecretKey, String> {
    let value = Zeroizing::new(
        entry(account_id, public_key)?
            .get_password()
            .map_err(|error| format!("Unable to retrieve signer from secure keychain: {error}"))?,
    );
    let stored: StoredCredential = serde_json::from_str(&value)
        .map_err(|_| "Stored signer has an invalid credential shape".to_string())?;
    if stored.public_key != public_key {
        return Err("Stored signer public key did not match its keychain identity".to_string());
    }
    let secret = SecretKey::from_str(&stored.private_key)
        .map_err(|_| "Stored signer private key was invalid".to_string())?;
    if secret.public_key().to_string() != public_key {
        return Err("Stored signer private key did not derive the expected public key".to_string());
    }
    Ok(secret)
}

fn entry(account_id: &str, public_key: &str) -> Result<keyring::Entry, String> {
    let service = format!("near-testnet-{account_id}");
    let user = format!("{account_id}:{public_key}");
    keyring::Entry::new(&service, &user)
        .map_err(|error| format!("Unable to open secure keychain entry: {error}"))
}
