use std::fs::{File, OpenOptions};
use std::io::Read;
use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
use std::path::Path;
use std::str::FromStr;

use near_crypto::{PublicKey, SecretKey};
use serde::Deserialize;
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

const MAXIMUM_RECOVERY_FILE_BYTES: u64 = 16 * 1024;
const REQUIRED_FILE_MODE: u32 = 0o600;

pub struct RecoveryIdentity {
    pub public_key: String,
}

pub struct ParsedRecoveryCredential {
    secret_key: SecretKey,
    public_key: String,
}

impl ParsedRecoveryCredential {
    pub fn public_key(&self) -> &str {
        &self.public_key
    }

    pub fn into_secret_key(self) -> SecretKey {
        self.secret_key
    }
}

#[derive(Deserialize, Zeroize, ZeroizeOnDrop)]
#[serde(deny_unknown_fields)]
struct RecoveryCredential {
    seed_phrase_hd_path: String,
    master_seed_phrase: String,
    implicit_account_id: String,
    public_key: String,
    private_key: String,
}

pub fn inspect(path: &Path, expected_uid: u32) -> Result<RecoveryIdentity, String> {
    let credential = load(path, expected_uid)?;
    Ok(RecoveryIdentity {
        public_key: credential.public_key,
    })
}

pub fn load(path: &Path, expected_uid: u32) -> Result<ParsedRecoveryCredential, String> {
    let file = open_recovery_file(path)?;
    let metadata = validate_metadata(&file, expected_uid)?;
    let contents = read_bounded(file, metadata.len())?;
    parse(&contents)
}

fn open_recovery_file(path: &Path) -> Result<File, String> {
    OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_CLOEXEC | libc::O_NOFOLLOW)
        .open(path)
        .map_err(|_| "Unable to open the protected factory recovery file".to_string())
}

fn validate_metadata(file: &File, expected_uid: u32) -> Result<std::fs::Metadata, String> {
    let metadata = file
        .metadata()
        .map_err(|_| "Unable to inspect the protected factory recovery file".to_string())?;
    let mode = metadata.permissions().mode() & 0o777;
    if !metadata.is_file()
        || metadata.uid() != expected_uid
        || metadata.nlink() != 1
        || mode != REQUIRED_FILE_MODE
    {
        return Err(
            "Factory recovery file must be a single-link regular file owned by the current user with mode 0600"
                .to_string(),
        );
    }
    if metadata.len() == 0 || metadata.len() > MAXIMUM_RECOVERY_FILE_BYTES {
        return Err("Factory recovery file size is outside the accepted range".to_string());
    }
    Ok(metadata)
}

fn read_bounded(file: File, expected_length: u64) -> Result<Zeroizing<Vec<u8>>, String> {
    let mut contents = Zeroizing::new(Vec::with_capacity(expected_length as usize));
    file.take(MAXIMUM_RECOVERY_FILE_BYTES + 1)
        .read_to_end(&mut contents)
        .map_err(|_| "Unable to read the protected factory recovery file".to_string())?;
    if contents.len() as u64 != expected_length {
        return Err("Factory recovery file changed while it was being read".to_string());
    }
    Ok(contents)
}

fn parse(contents: &[u8]) -> Result<ParsedRecoveryCredential, String> {
    let credential: RecoveryCredential = serde_json::from_slice(contents)
        .map_err(|_| "Factory recovery file has an invalid credential shape".to_string())?;
    validate_required_fields(&credential)?;
    let declared_public_key = PublicKey::from_str(&credential.public_key)
        .map_err(|_| "Factory recovery public key is invalid".to_string())?;
    let secret_key = SecretKey::from_str(&credential.private_key)
        .map_err(|_| "Factory recovery private key is invalid".to_string())?;
    let derived_public_key = secret_key.public_key();
    validate_key_relationships(&credential, &declared_public_key, &derived_public_key)?;
    Ok(ParsedRecoveryCredential {
        secret_key,
        public_key: derived_public_key.to_string(),
    })
}

fn validate_required_fields(credential: &RecoveryCredential) -> Result<(), String> {
    if credential.seed_phrase_hd_path.is_empty()
        || credential.master_seed_phrase.is_empty()
        || credential.implicit_account_id.is_empty()
        || credential.public_key.is_empty()
        || credential.private_key.is_empty()
    {
        return Err("Factory recovery credential contains an empty required field".to_string());
    }
    Ok(())
}

fn validate_key_relationships(
    credential: &RecoveryCredential,
    declared_public_key: &PublicKey,
    derived_public_key: &PublicKey,
) -> Result<(), String> {
    if credential.public_key != declared_public_key.to_string()
        || declared_public_key != derived_public_key
    {
        return Err("Factory recovery public and private keys do not match".to_string());
    }
    if credential.implicit_account_id != implicit_account_id(derived_public_key) {
        return Err("Factory recovery implicit account identity does not match".to_string());
    }
    Ok(())
}

fn implicit_account_id(public_key: &PublicKey) -> String {
    public_key
        .key_data()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
mod tests {
    use near_crypto::{KeyType, SecretKey};
    use serde_json::json;

    use super::*;

    fn recovery_json(secret_key: &SecretKey) -> Vec<u8> {
        let public_key = secret_key.public_key();
        serde_json::to_vec(&json!({
            "seed_phrase_hd_path": "m/44'/397'/0'",
            "master_seed_phrase": "non-secret test words only",
            "implicit_account_id": implicit_account_id(&public_key),
            "public_key": public_key.to_string(),
            "private_key": secret_key.to_string(),
        }))
        .unwrap()
    }

    #[test]
    fn parses_a_consistent_recovery_credential() {
        let secret_key = SecretKey::from_random(KeyType::ED25519);
        let credential = parse(&recovery_json(&secret_key)).unwrap();

        assert_eq!(credential.public_key(), secret_key.public_key().to_string());
    }

    #[test]
    fn rejects_mismatched_public_and_private_keys() {
        let secret_key = SecretKey::from_random(KeyType::ED25519);
        let other_key = SecretKey::from_random(KeyType::ED25519);
        let mut value: serde_json::Value =
            serde_json::from_slice(&recovery_json(&secret_key)).unwrap();
        value["public_key"] = json!(other_key.public_key().to_string());

        assert!(parse(&serde_json::to_vec(&value).unwrap()).is_err());
    }

    #[test]
    fn rejects_unknown_fields() {
        let secret_key = SecretKey::from_random(KeyType::ED25519);
        let mut value: serde_json::Value =
            serde_json::from_slice(&recovery_json(&secret_key)).unwrap();
        value["unexpected"] = json!("value");

        assert!(parse(&serde_json::to_vec(&value).unwrap()).is_err());
    }
}
