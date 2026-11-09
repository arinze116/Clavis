#[derive(Clone, Debug)]
pub struct AccountTarget {
    pub account_id: String,
    pub identity_evidence: String,
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

impl Verdict {
    pub fn text(self) -> &'static str {
        match self {
            Self::Ready => "READY — ALL THREE EXISTING FULL ACCESS SIGNERS VERIFIED",
            Self::Partial => "PARTIAL — SOME SIGNERS VERIFIED",
            Self::Blocked => "BLOCKED — ACCOUNT IDENTITY OR SECURE KEYCHAIN UNAVAILABLE",
            Self::Fail => "FAIL — SECURITY OR IDENTITY VERIFICATION FAILED",
        }
    }
}

pub fn select_verdict(results: &[AccountResult], blocked: bool) -> Verdict {
    let passed = results.iter().filter(|result| result.succeeded()).count();
    if passed == 3 {
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
            select_verdict(&[complete.clone(), complete.clone(), complete], false),
            Verdict::Ready
        );
    }

    #[test]
    fn selects_partial_when_only_one_signer_completed() {
        assert_eq!(
            select_verdict(&[complete_result(), AccountResult::default()], false),
            Verdict::Partial
        );
    }

    #[test]
    fn selects_blocked_when_preflight_cannot_verify_signers() {
        assert_eq!(
            select_verdict(&[AccountResult::default()], true),
            Verdict::Blocked
        );
    }

    #[test]
    fn selects_fail_for_an_attempted_identity_failure() {
        assert_eq!(
            select_verdict(&[AccountResult::default()], false),
            Verdict::Fail
        );
    }
}
