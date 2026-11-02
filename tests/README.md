# Test layout

Tests live beside the code they exercise:

- `contract/src/tests.rs` covers all eight core rules, schedule enforcement, route enforcement, audit outcomes, daily reset, and split validation.
- `agent/src/anomaly.test.ts` covers all anomaly categories that can be evaluated deterministically.
- `agent/src/intents.test.ts` covers exact split allocation and rounding.

Run every suite with `npm test`, or use `./scripts/verify.sh` for tests, type checks, frontend/agent builds, and WASM compilation.
