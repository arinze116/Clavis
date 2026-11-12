# Clavis privacy boundary

Clavis provides privacy minimization, not confidential blockchain execution.

## Public on-chain data

NEAR observers can see:

- account IDs and transaction signers;
- function names and arguments, including native payment destination and amount;
- configured recipient policy stored by the contract;
- timestamps, block metadata, receipts, and outcomes;
- contract events and deployment activity;
- completed milestone references queried by recipient/reference pair.

The dedicated Clavis audit entry omits amount, recipient commitment, wallet address, display name, and destination route. This reduces repeated disclosure in the application ledger; it does not erase public transaction data.

## Application-side data

Permission-restricted agent files may contain:

- scheduled amounts;
- worker NEAR accounts and destination configuration;
- notification email or Telegram chat ID;
- staged private-plan operations;
- delivery, reconciliation, and deduplication state.

Files are ignored by Git, created with owner-only permissions where supported, and updated through atomic replacement. Plan-management responses do not return stored salary or destination details. This boundary depends on host and operator security and is not cryptographic confidentiality.

## AI boundary

Policy extraction receives owner-provided payroll text. Evidence tasks are enriched server-side from public contract or repository evidence. Inputs are validated and bounded, prompts instruct the model to treat supplied data as untrusted, and deterministic normalization removes unsupported claims. The AI has no wallet key and cannot sign or submit a payment.

## Worker limitation

The contract audit event intentionally omits recipient identity. The worker portal can prove that a connected wallet is registered, but the employer-wide audit list cannot independently prove which worker received each entry. Exact payment attribution requires the finalized transaction evidence.

## Not implemented

- Confidential transactions.
- Anonymous payroll.
- Zero-knowledge recipient or amount proofs.
- Encrypted on-chain recipient policy.
- A confidential executor or dry-run relay.

## Hardening path

Potential future work includes salted commitments, encrypted policy state, authenticated worker-specific delivery records, and a verifiable confidential execution environment. None is represented as current functionality.
