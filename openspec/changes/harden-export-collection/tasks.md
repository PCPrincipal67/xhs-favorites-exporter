# Tasks

## 1. Establish verified collection adapters

- [x] 1.1 Inspect supported logged-in routes, active tabs, SSR collections, request categories/profile IDs, transport, DOM lists, overlays, and scroll containers; deliver sanitized fixtures with provenance for each mode and record any unverified source as disabled.
- [x] 1.2 Add a lightweight Node regression command and fixture helpers without a bundler; verify it reproduces the audit's cross-mode merge, stale navigation, tokenless URL overwrite, and HTTP 429 cases before applying fixes.
- [x] 1.3 Implement pure context and source-membership adapters from verified fixtures; verify tests distinguish favorites from posted/liked tabs, profiles, unsupported routes, feed categories, and ambiguous SSR metadata.
- [x] 1.4 Document verified adapter assumptions and skipped-source behavior in repository documentation; verify each claimed schema maps to a sanitized fixture.

## 2. Isolate collection lifecycle and scans

- [x] 2.1 Add bridge-owned collection identity and generation, route/tab change detection, and generation-tagged messages; verify navigation and late-response tests reject prior-context data without altering new-context status.
- [x] 2.2 Reset collection results, pagination, counters, and timers on context change and require explicit restart; verify same-mode profile changes reset state and unsupported contexts disable collection.
- [x] 2.3 Select SSR notes and queries by verified identity, refreshing context before snapshot admission; verify reordered lists, unidentified collections, and initial polling or forced scans do not leak stale data.
- [x] 2.4 Scope DOM scanning to the active list, suspend scanning/scrolling for overlays, and share scroll-container resolution for scrolling and bottom checks; verify unrelated links are excluded and nested-scroller fixtures use consistent metrics.
- [x] 2.5 Update README mode instructions and navigation/overlay behavior; verify the documented clearing and explicit restart rules match the lifecycle tests.

## 3. Preserve record and export integrity

- [x] 3.1 Simplify merging around nonempty metadata and source union, rebuilding URLs from merged IDs/tokens; verify tokenless DOM merges, later tokens, blank metadata, token encoding, and duplicate sources.
- [x] 3.2 Replace whole-record serialization comparisons with meaningful change detection; verify repeated observations refresh last-seen time without content growth and preserve first-seen time.
- [x] 3.3 Serialize existing export fields from current collection context and merged records; verify export key compatibility, counts, canonical URLs, and stable collection page_url when an overlay is open.
- [x] 3.4 Update the README export example and field descriptions; verify examples match a regression export fixture.

## 4. Validate pagination and simplify processing

- [x] 4.1 Consolidate endpoint responses into a context-checked validation pipeline; verify HTTP 429/401, business failures, malformed structures, invalid JSON, and JSON responseType never emit successful pages or overwrite valid state.
- [x] 4.2 Handle relevant network errors, timeouts, and aborts while preserving native XHR behavior; verify failure handling stops scrolling, retains exportable records, and ignores stale-context errors. If verified transport uses fetch, add equivalent observation and verify original promise behavior.
- [x] 4.3 Normalize continuation as true, false, or null and consolidate content-side page handling; verify missing flags and empty pages remain unknown unless fixture-backed endpoint semantics establish exhaustion.
- [x] 4.4 Distinguish exhaustion, inactivity, and failure status in collection stopping; verify automatic completion does not get claimed after unconfirmed inactivity or errors.
- [x] 4.5 Remove unused state and redundant guards, use textContent for status, and simplify panel markup and source labels; verify regression checks and syntax checks pass and text containing markup displays literally.
- [x] 4.6 Revise docs/potential-fixes.md to remove unsafe SSR fallback advice and update README failure/continuation limitations; verify documentation agrees with the response and stopping scenarios.

## 5. Verify integration and prepare release

- [x] 5.1 Run all automated regressions, JavaScript syntax checks, manifest/helper loading checks, and git diff --check; record commands and outcomes with no unresolved automated failures.
- [ ] 5.2 Perform manual Chrome checks for homepage, following, favorites, posted/liked tabs, profile switches, overlays, automatic scrolling, pagination, clearing, and exported token URLs; record runtime outcomes separately and leave this task incomplete if live validation is unavailable.
- [x] 5.3 Bump the manifest patch version and record user-facing release changes in repository documentation after validation; verify version consistency and explain navigation clearing and nullable continuation.
