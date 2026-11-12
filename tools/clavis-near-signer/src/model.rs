#[derive(Clone, Debug)]
pub struct AccountTarget {
    pub account_id: String,
    pub identity_evidence: String,
    pub expected_public_key: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct AccountResult {
    pub account_id: String,
    pub fingerprint: Option<String>,
    pub full_access_verified: bool,
    pub keychain_imported: bool,
    pub keychain_retrieved: bool,
    pub signing_challenge_verified: bool,
    pub identity_evidence: String,
    pub error: Option<String>,
}

impl AccountResult {
    pub fn succeeded(&self) -> bool {
        self.full_access_verified
            && self.keychain_imported
            && self.keychain_retrieved
            && self.signing_challenge_verified
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Verdict {
    Ready,
    Partial,
    Blocked,
    Fail,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SignerScope {
    PrimaryAccounts,
    Factory,
}

impl Verdict {
    pub fn text(self, scope: SignerScope) -> &'static str {
        match (self, scope) {
            (Self::Ready, SignerScope::PrimaryAccounts) => {
                "READY — ALL THREE EXISTING FULL ACCESS SIGNERS VERIFIED"
            }
            (Self::Ready, SignerScope::Factory) => {
                "READY — EXISTING FACTORY FULL ACCESS SIGNER VERIFIED"
            }
            (Self::Partial, SignerScope::PrimaryAccounts) => "PARTIAL — SOME SIGNERS VERIFIED",
            (Self::Partial, SignerScope::Factory) => "PARTIAL — FACTORY SIGNER NOT FULLY VERIFIED",
            (Self::Blocked, SignerScope::PrimaryAccounts) => {
                "BLOCKED — ACCOUNT IDENTITY OR SECURE KEYCHAIN UNAVAILABLE"
            }
            (Self::Blocked, SignerScope::Factory) => "BLOCKED — FACTORY SIGNER UNAVAILABLE",
            (Self::Fail, SignerScope::PrimaryAccounts) => {
                "FAIL — SECURITY OR IDENTITY VERIFICATION FAILED"
            }
            (Self::Fail, SignerScope::Factory) => {
                "FAIL — FACTORY SIGNER IDENTITY VERIFICATION FAILED"
            }
        }
    }
}

pub fn select_verdict(results: &[AccountResult], required: usize, blocked: bool) -> Verdict {
    let passed = results.iter().filter(|result| result.succeeded()).count();
    if passed == required && results.len() == required {
        Verdict::Ready
    } else if passed > 0 {
        Verdict::Partial
    } else if blocked {
        Verdict::Blocked
    } else {
        Verdict::Fail
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn complete_result() -> AccountResult {
        AccountResult {
            full_access_verified: true,
            keychain_imported: true,
            keychain_retrieved: true,
            signing_challenge_verified: true,
            ..AccountResult::default()
        }
    }

    #[test]
    fn selects_ready_only_for_three_complete_signers() {
        let complete = complete_result();
        assert_eq!(
            select_verdict(&[complete.clone(), complete.clone(), complete], 3, false),
            Verdict::Ready
        );
    }

    #[test]
    fn selects_partial_when_only_one_signer_completed() {
        assert_eq!(
            select_verdict(&[complete_result(), AccountResult::default()], 3, false),
            Verdict::Partial
        );
    }

    #[test]
    fn selects_blocked_when_preflight_cannot_verify_signers() {
        assert_eq!(
            select_verdict(&[AccountResult::default()], 3, true),
            Verdict::Blocked
        );
    }

    #[test]
    fn selects_fail_for_an_attempted_identity_failure() {
        assert_eq!(
            select_verdict(&[AccountResult::default()], 3, false),
            Verdict::Fail
        );
    }

    #[test]
    fn selects_ready_for_one_complete_factory_signer() {
        assert_eq!(
            select_verdict(&[complete_result()], 1, false),
            Verdict::Ready
        );
    }
}
