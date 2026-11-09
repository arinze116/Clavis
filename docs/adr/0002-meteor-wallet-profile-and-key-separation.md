# ADR 0002: Dedicated Meteor profile and signing-key separation

- Status: Accepted
- Date: 2026-11-09

This ADR records the earlier browser-wallet setup boundary. Current headless signer storage is defined by [ADR 0003](0003-dedicated-near-secret-service-keychain.md), and the root has since been upgraded to v0.2.0. The historical statements below describe the decision context at the time.

## Context

Clavis uses three fixed NEAR Testnet identities. The owner and worker are interactive wallet identities. The agent is a backend-only signer. Reusing an existing Chromium profile, importing the agent key into a browser, or introducing another signing service would widen the credential boundary.

The VPS already provides Chromium 157, Playwright 1.64.1, Node.js 22, `near-api-js`, an X11 desktop session, and a protected agent credential file. NEAR CLI is not installed.

## Decision

1. Use one new, permission-restricted Chromium user-data directory under Chromium Snap's private user area.
2. Install Meteor from its Chrome Web Store listing and retain the Web Store extension ID.
3. Keep `clavis-agent.testnet` exclusively in the existing backend credential mechanism. Never place it in Chromium storage.
4. Use the installed TypeScript/JavaScript stack for browser automation, NEAR RPC inspection, key derivation, and signing checks. Use Bash only for a small browser launcher. Add no package dependency.
5. Bind any temporary DevTools endpoint to loopback and use an ephemeral port. The normal launcher exposes no debugging port.
6. Fail closed when an existing owner or worker key cannot be located and cryptographically matched to the intended account.

## Consequences

- The wallet profile is isolated from the existing Chromium `Default` profile and unrelated services.
- Browser restart persistence can be verified without restarting the VPS or production services.
- Owner and worker imports cannot proceed until their existing keys are available; no replacement key or account may be generated.
- The legacy deployed Clavis v0.1 contract cannot prove contract-controlled payroll settlement. This task does not upgrade or replace it.

## Rollback

Stop Chromium processes using the dedicated profile, then move the new profile and launcher aside as a unit. Do not delete or modify the existing Chromium `Default` profile, backend credential files, NEAR access keys, contracts, or PM2 services.
