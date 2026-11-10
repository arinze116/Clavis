# ADR 0004: Clavis brand asset pipeline

- Status: Accepted
- Date: 2026-11-10

## Context

Clavis needs one reproducible identity across the React interface, browser favicons, Apple touch icons, social previews, documentation, and monochrome technical contexts. The previous system mixed an orbit/arrow mark, a separate key graphic in the social banner, and platform-dependent serif fallbacks.

## Decision

- SVG is the master format for the Keygate symbol and vector lockups.
- JavaScript ESM is used for asset generation because the repository already runs Node.js ESM and Playwright, and no additional image package is required.
- Playwright rasterizes the SVG master at exact native dimensions.
- The Clavis wordmark uses a 1.5 KB Newsreader Semibold WOFF2 subset containing only the letters in `Clavis`.
- Generated PNG/JPEG assets remain committed so deployment does not require generation tooling.

## Consequences

- `npm run brand:generate` reproduces the raster assets and social banner.
- The SVG masters remain editable without a proprietary design tool.
- The wordmark renders consistently instead of depending on the visitor's installed fonts.
- The subset font cannot be reused for arbitrary interface text; it is intentionally restricted to the wordmark.
- Visual originality and legal clearance still require independent review.
