# Architecture decisions

## Contract as the final authority

The agent decides *when to ask*. The contract decides *whether payment is allowed*. Schedule and route validation are onchain because leaving either check in the agent would let a compromised key bypass them.

## Authorization before settlement

`request_payment` reserves daily policy capacity and emits an approval before cross-chain submission. The agent immediately persists one intent envelope per route. Failed submissions remain queued and are retried, preserving the authorization instead of requesting a duplicate payment.

## Public-safe events

Contract events mirror the audit structs exactly. Logging helpers never receive an amount, recipient hash, or route, reducing the risk of accidental disclosure through debug output.

## Private agent state

Agent state is written atomically through a temporary file and rename. The stored queue supports restart recovery. Reports and payroll plans use restrictive file modes where the operating system supports them.

## Owner and worker interfaces

Owner access is enforced by checking the connected wallet before rendering mutation controls; contract methods independently repeat authorization. Worker lookup hashes the connected account locally. Private earnings are deliberately not reconstructed from the public audit because doing so would defeat the privacy model.
