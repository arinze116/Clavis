# Clavis Keygate brand system

Status: implemented design decision. This document is not a trademark or legal-clearance claim.

## Selected direction

Keygate combines a `C`-shaped key bow with a restricted key stem. The single acid-green silhouette connects the Clavis name to bounded authority and remains legible at favicon scale.

## Comparative decision

| Direction | Evidence | Reason not selected |
| --- | --- | --- |
| Keygate | Strong product/name connection; clean silhouette at 16 px; recognizable in light and dark headers | May also read as a plug or geometric `G`; independent recognition testing remains open |
| Policy gate | Most literal representation of one approved action passing through a hard policy boundary | Reads more like interface controls than a proprietary brand symbol |
| Verified C | Clearest immediate success/verification cue | Check-in-circle structures are common and therefore less ownable |

## Core assets

| Use | Asset |
| --- | --- |
| Web symbol | `frontend/public/clavis-mark.svg` |
| Browser favicon | `frontend/public/favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-128.png` |
| Apple touch icon | `frontend/public/apple-touch-icon.png` |
| Social avatar | `frontend/public/clavis-avatar.png` |
| Social preview | `frontend/public/og-banner.png` |
| Light/dark lockups | `docs/brand/final/clavis-lockup-light.svg`, `clavis-lockup-dark.svg` |
| Wordmarks | `docs/brand/final/clavis-wordmark-ink.svg`, `clavis-wordmark-white.svg` |
| Monochrome symbols | `docs/brand/final/clavis-symbol-mono-ink.svg`, `clavis-symbol-mono-white.svg` |

## Usage

- Preserve the symbol proportions and 64×64 viewBox.
- Use the primary dark tile in product UI, favicons, avatars, and social surfaces.
- Use the transparent monochrome symbols for one-color printing or engraving.
- Keep clear space around the symbol equal to at least one key-stem height.
- Do not add orbit rings, gradients, glow, drop shadows, or extra key details.
- Do not typeset the wordmark with an arbitrary serif. Use the bundled `ClavisWordmark` subset or the self-contained SVG wordmarks.

## Reproduction

```bash
npm run brand:generate
```

The command renders exact-size rasters with the installed Playwright Chromium and then regenerates the social banner.

## Rights and sources

- The Keygate geometry was created for this repository from the product brief; it was not traced from a reference asset.
- Newsreader is designed by Production Type and distributed through Google Fonts under the SIL Open Font License 1.1.
- Stored font subset SHA-256: `aac97e06cde11f4c560293f83733d83be387bf09d3b60b769b98b29e6770fe8c`.
- Font source: `https://fonts.google.com/specimen/Newsreader`.
- Licence copy: `docs/brand/licenses/NEWSREADER-OFL.txt`.

## Claim ledger

- Verified: the mark is structurally simpler than the previous orbit/arrow asset and was inspected at 16, 32, 64, 96, 128, 180, and 512 px.
- Verified: the production lockup uses the same symbol and wordmark treatment in light and dark interface headers.
- Strongly supported: Keygate is more directly connected to Clavis's bounded-authority product story than the previous mark.
- Unverified: global originality, trademark availability, and user recognition outside the project team.
- Unknown: whether the key/`C` interpretation is immediate without the wordmark; independent testing is still required.
