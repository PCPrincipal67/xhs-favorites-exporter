# Proposal

## Why

The exporter can mix unrelated notes into a collection, retain stale mode labels after navigation, replace token-bearing URLs with tokenless links, and treat failed pagination requests as successful pages. Fixing these accuracy issues alongside duplicated processing logic will make exports trustworthy and future site changes easier to maintain.

## What Changes

- Identify the active collection by route, tab, and profile identity; stop and clear the previous collection when that context changes.
- Accept SSR, API, and DOM records only from the active supported collection, excluding detail overlays and recommendations.
- Select favorites SSR data using explicit collection metadata rather than a positional or first-list fallback.
- Validate HTTP and business responses before updating items or pagination; show actionable failures and distinguish unknown pagination from exhaustion.
- Derive canonical note URLs from merged IDs and tokens, preserving useful fields when later sources are incomplete.
- Consolidate response and message processing, remove unused state and redundant branches, use textContent for status, and simplify panel markup.
- Add focused regression coverage and update documentation to match supported modes and limitations.

## Capabilities

### New Capabilities

- `collection-isolation`: Active collection detection, navigation lifecycle, source scoping, and safe SSR selection.
- `export-record-integrity`: Deterministic record merging, canonical URLs, and consistent export context.
- `pagination-observation`: Validated passive network observation, pagination semantics, and user-visible failures.

### Modified Capabilities

None; this repository has no existing capability specifications.

## Impact

- Runtime changes center on `page-bridge.js` and `content-script.js`, with small supporting files permitted for pure helpers and regression checks.
- Preserve passive observation of page-generated requests and the two-context extension architecture. No API replay, new permissions, content downloader, or build framework is required.
- Preserve existing export keys and supported homepage/following/favorites modes. Unknown or unsupported contexts are disabled rather than guessed; navigating between collections clears the previous in-memory results.
- Update `README.md` and `docs/potential-fixes.md` to replace stale behavior and unsafe fallback advice. Manifest changes are limited to helper loading if needed and the release version.
- Verify with synthetic regression fixtures and separate manual Chrome smoke checks; current audit reproductions do not establish live site schemas.
