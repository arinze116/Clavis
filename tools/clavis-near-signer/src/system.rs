use std::io::Write;
use std::os::unix::fs::{MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use zeroize::Zeroizing;

const ISOLATED_KEYRING_MARKER: &str = "CLAVIS_NEAR_ISOLATED_KEYRING";
const MINIMUM_KEYRING_PASSWORD_LENGTH: usize = 16;

#[derive(Clone, Debug)]
pub struct KeychainState {
    pub login_path: String,
    pub default_path: String,
    pub is_unlocked: bool,
}

impl KeychainState {
    pub fn is_persistent(&self) -> bool {
        self.login_path != "/" && self.default_path == self.login_path
    }
}

pub struct KeyringDaemon {
    child: Child,
}

impl Drop for KeyringDaemon {
    fn drop(&mut self) {
        if self.child.try_wait().ok().flatten().is_some() {
            return;
        }
        let process_id = self.child.id().to_string();
        let _ = Command::new("kill")
            .args(["-TERM", &process_id])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        for _ in 0..20 {
            if self.child.try_wait().ok().flatten().is_some() {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub fn prepare_secret_service_environment() -> Result<(), String> {
    if std::env::var(ISOLATED_KEYRING_MARKER).as_deref() != Ok("1") {
        return Err("Refusing to use the shared login keyring; run the Clavis launcher".into());
    }

    let uid = command_stdout("id", &["-u"])?;
    let uid = uid.trim();
    let bus = required_environment("DBUS_SESSION_BUS_ADDRESS")?;
    let control = required_environment("GNOME_KEYRING_CONTROL")?;
    let runtime = required_environment("XDG_RUNTIME_DIR")?;
    let data_home = required_environment("XDG_DATA_HOME")?;

    if bus == format!("unix:path=/run/user/{uid}/bus") {
        return Err("Refusing to use the shared user D-Bus session".into());
    }
    if control == format!("/run/user/{uid}/keyring") {
        return Err("Refusing to use the shared GNOME keyring daemon".into());
    }
    if !Path::new(&control).starts_with(&runtime) {
        return Err("The isolated keyring control path is outside its runtime directory".into());
    }
    for (label, directory) in [
        ("runtime", runtime.as_str()),
        ("control", control.as_str()),
        ("data", data_home.as_str()),
    ] {
        validate_private_directory(label, Path::new(directory), uid)?;
    }
    Ok(())
}

pub fn start_keyring_daemon(interactive: bool) -> Result<KeyringDaemon, String> {
    let control = required_environment("GNOME_KEYRING_CONTROL")?;
    let password = interactive.then(keyring_password).transpose()?;
    let mut command = Command::new("gnome-keyring-daemon");
    command
        .args([
            "--foreground",
            "--components=secrets",
            "--control-directory",
            &control,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if password.is_some() {
        command.arg("--unlock").stdin(Stdio::piped());
    } else {
        command.stdin(Stdio::null());
    }

    let child = command
        .spawn()
        .map_err(|error| format!("Unable to start the isolated keyring daemon: {error}"))?;
    let mut daemon = KeyringDaemon { child };
    if let Some(password) = password {
        daemon
            .child
            .stdin
            .take()
            .ok_or_else(|| "Unable to open isolated keyring password input".to_string())?
            .write_all(password.as_bytes())
            .map_err(|error| format!("Unable to send isolated keyring password: {error}"))?;
    }
    wait_for_secret_service(&mut daemon.child)?;

    if interactive {
        let state = inspect_keychain()?;
        if !state.is_persistent() || !state.is_unlocked {
            return Err(
                "The dedicated keyring password was incorrect or the collection is unavailable"
                    .into(),
            );
        }
    }
    Ok(daemon)
}

pub fn inspect_keychain() -> Result<KeychainState, String> {
    let login_path = read_alias("login")?;
    let default_path = read_alias("default")?;
    let is_unlocked = login_path != "/" && !collection_is_locked(&login_path)?;
    Ok(KeychainState {
        login_path,
        default_path,
        is_unlocked,
    })
}

pub fn ensure_persistent_keychain() -> Result<KeychainState, String> {
    let state = inspect_keychain()?;
    ensure_default_alias(&state)?;
    let final_state = inspect_keychain()?;
    if !final_state.is_persistent() || !final_state.is_unlocked {
        return Err("Persistent GNOME login keyring is not the unlocked default collection".into());
    }
    Ok(final_state)
}

fn keyring_password() -> Result<Zeroizing<String>, String> {
    let data_home = required_environment("XDG_DATA_HOME")?;
    let login_keyring = PathBuf::from(data_home).join("keyrings/login.keyring");
    if login_keyring.is_file() {
        let password = Zeroizing::new(prompt_hidden(
            "Unlock the dedicated Clavis NEAR keyring password: ",
        )?);
        if password.is_empty() {
            return Err("Keyring password cannot be empty".into());
        }
        return Ok(password);
    }

    let first = Zeroizing::new(prompt_hidden(
        "Create a dedicated Clavis NEAR keyring password (16+ characters): ",
    )?);
    let second = Zeroizing::new(prompt_hidden(
        "Confirm the dedicated Clavis NEAR keyring password: ",
    )?);
    if first.chars().count() < MINIMUM_KEYRING_PASSWORD_LENGTH || *first != *second {
        return Err("Keyring passwords were too short or did not match".into());
    }
    Ok(first)
}

fn wait_for_secret_service(child: &mut Child) -> Result<(), String> {
    for _ in 0..50 {
        if let Some(status) = child
            .try_wait()
            .map_err(|error| format!("Unable to inspect the isolated keyring daemon: {error}"))?
        {
            return Err(format!(
                "The isolated keyring daemon exited before startup ({status})"
            ));
        }
        let owner = command_stdout(
            "gdbus",
            &[
                "call",
                "--session",
                "--dest",
                "org.freedesktop.DBus",
                "--object-path",
                "/org/freedesktop/DBus",
                "--method",
                "org.freedesktop.DBus.NameHasOwner",
                "org.freedesktop.secrets",
            ],
        );
        if owner.is_ok_and(|value| value.contains("true")) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Err("The isolated Secret Service did not start".into())
}

fn ensure_default_alias(state: &KeychainState) -> Result<(), String> {
    if state.default_path == state.login_path {
        return Ok(());
    }
    if state.default_path != "/" || state.login_path == "/" {
        return Err("The dedicated Secret Service aliases are unavailable or inconsistent".into());
    }
    command_stdout(
        "gdbus",
        &[
            "call",
            "--session",
            "--dest",
            "org.freedesktop.secrets",
            "--object-path",
            "/org/freedesktop/secrets",
            "--method",
            "org.freedesktop.Secret.Service.SetAlias",
            "default",
            &state.login_path,
        ],
    )
    .map_err(|error| format!("Unable to set the default Secret Service alias: {error}"))?;
    Ok(())
}

fn read_alias(alias: &str) -> Result<String, String> {
    let output = command_stdout(
        "gdbus",
        &[
            "call",
            "--session",
            "--dest",
            "org.freedesktop.secrets",
            "--object-path",
            "/org/freedesktop/secrets",
            "--method",
            "org.freedesktop.Secret.Service.ReadAlias",
            alias,
        ],
    )
    .map_err(|error| format!("Unable to read Secret Service alias {alias}: {error}"))?;
    quoted_value(&output).ok_or_else(|| format!("Unable to parse Secret Service alias {alias}"))
}

fn collection_is_locked(path: &str) -> Result<bool, String> {
    let output = command_stdout(
        "gdbus",
        &[
            "call",
            "--session",
            "--dest",
            "org.freedesktop.secrets",
            "--object-path",
            path,
            "--method",
            "org.freedesktop.DBus.Properties.Get",
            "org.freedesktop.Secret.Collection",
            "Locked",
        ],
    )
    .map_err(|error| format!("Unable to inspect Secret Service collection lock: {error}"))?;
    Ok(output.contains("true"))
}

fn quoted_value(output: &str) -> Option<String> {
    let start = output.find('\'')? + 1;
    let end = output[start..].find('\'')? + start;
    Some(output[start..end].to_string())
}

fn prompt_hidden(prompt: &str) -> Result<String, String> {
    rpassword::prompt_password(prompt)
        .map_err(|error| format!("Hidden terminal prompt failed: {error}"))
}

fn required_environment(name: &str) -> Result<String, String> {
    std::env::var(name)
        .ok()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("Missing isolated keyring environment variable {name}"))
}

fn validate_private_directory(label: &str, path: &Path, expected_uid: &str) -> Result<(), String> {
    let metadata = std::fs::metadata(path).map_err(|error| {
        format!("Unable to inspect isolated keyring {label} directory: {error}")
    })?;
    if !metadata.is_dir() {
        return Err(format!(
            "The isolated keyring {label} path is not a directory"
        ));
    }
    let expected_uid = expected_uid
        .parse::<u32>()
        .map_err(|_| "Unable to parse the current user ID".to_string())?;
    if metadata.uid() != expected_uid || metadata.permissions().mode() & 0o077 != 0 {
        return Err(format!(
            "The isolated keyring {label} directory must be owned by the current user with mode 0700"
        ));
    }
    Ok(())
}

pub fn command_stdout(program: &str, arguments: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(arguments)
        .output()
        .map_err(|error| format!("Unable to run {program}: {error}"))?;
    if !output.status.success() {
        return Err(format!("{program} exited unsuccessfully"));
    }
    String::from_utf8(output.stdout).map_err(|_| format!("{program} returned non-UTF-8 output"))
}

pub fn argument_value(arguments: &[String], name: &str) -> Result<String, String> {
    arguments
        .windows(2)
        .find(|pair| pair[0] == name)
        .map(|pair| pair[1].clone())
        .ok_or_else(|| format!("Missing required argument {name}"))
}
