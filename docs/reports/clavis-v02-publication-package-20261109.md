# Clavis v0.2 publication package

Prepared: 2026-11-09

Status: **READY FOR APPROVAL-GATED PUBLICATION — FACTORY UPGRADE EXCLUDED**

This package contains the completed frontend, documentation, security evidence, and live-v0.2 video release candidate. It does not claim or include a factory upgrade. Nothing was pushed, deployed, uploaded, or published while preparing it.

## Required public disclosure

Every publication must retain these facts:

- `clavis.testnet` is live on v0.2.0 and controls native NEAR settlement;
- both designated workers received 0.01 NEAR on Testnet;
- the backend key is Function Call restricted to `request_payment`;
- `factory.clavis.testnet` remains legacy and setup blocks new child deployment;
- worker audit history is employer-wide;
- audit minimization is not transaction confidentiality;
- cross-chain and split settlement are disabled;
- explorer enrichment is evidence-backed but remains dependent on RPC/indexer availability;
- repository tests are not an independent security audit.

## Frontend candidate

The feature branch includes:

- archival Testnet RPC fallback for historical transaction lookup;
- polling-safe transaction-link enrichment;
- event-derived payment-to-transaction mapping;
- stable mobile navigation during delayed reads;
- employer-wide worker-history wording;
- public legacy-factory disclosure on `/setup` before wallet connection;
- regenerated 159-check security evidence.

Responsive QA covered landing, dashboard, setup, and security at 390, 768, and 1440 pixels. The 12 captures are under `artifacts/publication/clavis-v02-20261109/ui/`; machine-readable results are in `ui-audit.json` and `accessibility-audit.json`.

## Video candidate

Publication asset:

`artifacts/publication/clavis-v02-20261109/video/clavis-live-v02-1080p.mp4`

Suggested public filename: `clavis-live-v02-1080p.mp4`

| Property | Value |
| --- | --- |
| SHA-256 | `eeae517ae861458aa18f938e64e6cba86941b01693b99fd7c48ec19a63f91acb` |
| Size | 11,445,808 bytes |
| Codec | H.264 High, yuv420p |
| Resolution | 1920×1080 |
| Frame rate | 30 fps |
| Duration | 93.666667 seconds |
| Frames | 2,810 |
| Audio | None by design; captions carry the walkthrough |
| Black-frame scan | Zero segments at the 0.2-second release threshold; three 0.1-second transition dips at a stricter threshold |

The contact sheet, exact first/last frames, and individual claim frames are under `artifacts/publication/clavis-v02-20261109/video-inspection/`.

Suggested release description:

> Clavis v0.2 on NEAR Testnet demonstrates contract-controlled native payroll settlement, a request-only backend key, callback-based commit/rollback, durable recipient reconciliation, employer-wide minimized audit evidence, and 159 local checks. The root is live and two workers were settled. The separate factory remains legacy because its exact existing Full Access signer is unavailable, so new child deployment stays blocked.

## Testnet evidence

| Scenario | Transaction |
| --- | --- |
| Root upgrade and migration | `7DACvFhKgtGrrGENKAoZk23uHjMmRtP6wXotRFHTKqWA` |
| Worker 1 settlement | `VjihUv5t54rEz177Eg1nYXogJw77mNxktnqyBYY2DLg` |
| Worker 2 settlement | `CxK3vuAUv5bPooeuWafnvzpU2SryJY142keyw3knYoht` |
| Failed-transfer rollback | `8V6x9ZtCnqyh8B43sn5ty5f4gdSwfV8GMA2JjZG7BedB` |
| Unauthorized caller | `GZCDKytgEsvHYYVhCpGYnj4wGcg71PfWHVnbTGXTYLiq` |
| Invalid recipient | `DGDZ5e4uwmwnGM3DpQBsMj8AwCxCuy2HMLJdntJ8odNT` |
| Duplicate request | `UjZB6tkWQV2xyYyfYDQbNTuiBKiqhdWsfStdqTsqsgA` |
| Insufficient treasury | `5vVK4vXYpAbnoa2FEN4VGkhcbf63rJJfffetry6dS7GH` |

Read-only evidence snapshots are under `artifacts/publication/clavis-v02-20261109/evidence/`.

## Approval-gated publication sequence

After repository and publication approval:

1. Push the final feature-branch commits without force-pushing.
2. Review and merge through the repository's normal protected-branch process.
3. Run the existing production frontend workflow from the approved revision.
4. Verify the public app reports the live v0.2 root, legacy factory block, six browser paths, and current explorer links.
5. Upload the exact video asset above without transcoding, or re-check its checksum and media properties after any platform transcode.
6. Replace the historical-only video wording in `README.md`, `DEMO.md`, and `SUBMISSION.md` with the approved public URL.
7. Re-run the public browser rehearsal and record the deployed revision and release URL.

These are publication operations, not further engineering tasks.

## Excluded until the factory signer is verified

- deploying `contract/res/clavis_factory.wasm`;
- claiming a factory version of v0.2.0;
- creating a new v0.2 child through the factory;
- claiming root/factory end-to-end compatibility from a live new-child deployment.

The exact existing factory credential must first pass `bash scripts/connect-factory-signer.sh` from a trusted SSH terminal. Private keys must never enter chat, command arguments, environment variables, files, or publication assets.

## Publication checklist

- [x] Frontend candidate built and browser-tested.
- [x] Responsive and accessibility evidence captured.
- [x] Security evidence regenerated for 159 checks.
- [x] Live Testnet transactions revalidated.
- [x] Video rendered and frame-inspected.
- [x] Video checksum and media properties recorded.
- [x] Legacy factory boundary disclosed.
- [x] No secrets included in the package.
- [ ] Repository publication approved and pushed.
- [ ] Frontend production deployment approved and completed.
- [ ] Video upload approved and completed.
- [ ] Public URLs updated and rehearsed.
