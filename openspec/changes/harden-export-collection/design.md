# Design

## Context

See `proposal.md` for motivation. The extension has two plain JavaScript entry points: the page bridge reads SSR and observes XHR, while the isolated content script merges records, scans DOM, scrolls, and exports. No build system or automated test runner exists. Current mode is a one-time path guess, messages lack collection identity, and all matching note anchors and endpoint responses enter one map.

## Goals / Non-Goals

**Goals:** Establish one collection identity across both contexts, reject stale or unrelated observations, centralize normalization and merging, and make key behavior testable with small fixtures.

**Non-Goals:** Replace the two-context architecture, add an application framework or bundler, replay API calls, download note content, implement grouped favorites, or proactively add fetch interception without evidence that supported pagination uses it.

## Decisions

### 1. Explicit context with a generation identifier

The bridge owns an explicit context containing supported mode, profile identity where relevant, collection/tab identity, stable collection URL, and a monotonically increasing generation. Resolve it from route plus verified active-tab state; conflicting or insufficient signals produce unsupported context. Observe History navigation, popstate, and narrowly scoped tab changes with debounced reevaluation. Refresh context before admitting asynchronous data as an additional guard against observer delays.

Send context changes and include context/generation on snapshot, page, and error messages. Capture generation when a request begins, then check it again on completion. The content script accepts data only for its active context. On identity changes it clears its timer, results, idle counters, pagination, and pending scan state; it does not automatically restart. A detail overlay is a temporary suspension within the same underlying collection rather than a new collection; pause DOM scans and scrolling until it closes.

Alternative: Recompute only a mode string on each scan. This would miss profile changes and allow delayed responses from previous collections. Alternative: keep separate cached collections. This adds unnecessary storage and UI complexity; explicit clearing provides a simpler first implementation.

### 2. Small adapters establish source membership

Use verified adapters for route/tab interpretation, SSR collection metadata, request endpoint/category/profile identity, and the active DOM list container. Parse request URLs with URL and inspect request bodies when feed category is carried there. Reject ambiguous membership, including same-endpoint recommendation traffic. Read SSR notes and pagination from the same identified collection; eliminate the fixed `[1]` and first-list fallbacks. Missing trustworthy SSR metadata skips SSR without preventing valid API/DOM collection.

Scope DOM queries to the identified list and exclude detail/recommendation regions. If the list cannot be identified safely, skip scanning and explain the limitation. Resolve the scroll container from that same list's scrollable ancestor or the document, and use consistent viewport metrics for scrolling and bottom detection.

Alternative: retain broad queries with an expanding exclusion list. This makes correctness depend on knowing every unrelated region and is more fragile than identifying the intended list.

### 3. One passive response pipeline

Keep the existing XHR observation mechanism initially. Endpoint adapters provide normalized items and pagination to one validation/emission pipeline. Check context, HTTP success, JSON structure, and verified business success semantics before emitting a successful page. Support JSON responseType without blindly reading responseText; parsing exceptions must not affect the site's own request handling. Handle relevant load errors, timeouts, and aborts as collection errors and ignore stale ones.

Use `has_more: null` for unknown continuation and preserve explicit booleans. Do not infer exhaustion merely from empty items. A relevant error stops automatic scrolling while keeping records exportable. Explicit exhaustion can stop after a final scoped scan; the existing bottom/idle heuristic remains a fallback with a status that indicates inactivity rather than guaranteed completion. Route all page types through a shared content-side handler while preserving source attribution.

Alternative: add fetch interception immediately. The audit provides no current transport evidence requiring it; verify transport during implementation and add an adapter only if supported pagination actually uses fetch, retaining this same validation contract.

### 4. Canonical merging with explicit meaningful changes

Merge nonempty fields and source sets by note ID, then derive URL once from the merged ID and token. Preserve first-seen time and refresh last-seen time. Compare metadata and source changes explicitly, excluding timestamps and derived redundant values from growth detection. Use one source of truth for sources; derive the legacy `source` string for compatible export serialization if needed.

Pure context, response, and record helpers can live in small plain JavaScript modules that Node can load for testing and the extension can load without a bundler. If a helper must run in both browser worlds, load the same source in both and preserve bridge-before-site timing. Keep realm-specific DOM and XHR operations in their respective entry points.

Alternative: build a generic ingestion framework or migrate to TypeScript. The small codebase does not justify the setup and abstraction costs.

### 5. Cleanup follows the correctness seams

Remove unused state and unreachable guards, use textContent for status, replace long panel concatenations with a template literal, and centralize source-label rendering. Do not retain counters solely for hypothetical diagnostics. Update the README and existing fix document to match actual modes and remove unsafe SSR fallback advice. Keep these changes subordinate to the same regression checks rather than building tests that duplicate cosmetic implementation.

## Risks / Trade-offs

- [Site schemas and selectors are unverified] → Before coding adapters, inspect a logged-in page or use supplied sanitized captures. Record fixtures for each supported mode. If a required schema cannot be verified, report the gap and keep the corresponding source disabled rather than guessing.
- [Strict membership checks reduce coverage when metadata is absent] → Explain unsupported or skipped sources in the panel and retain other verified sources; avoid promising complete exports.
- [Navigation clearing loses unexported in-memory results] → Document the lifecycle, display the change status, and require an explicit restart. Persistent collection history is outside this change.
- [XHR/History instrumentation can interfere with the site] → Preserve original arguments, return values, and binding; install once, isolate observer failures, and manually check native navigation and pagination.
- [Synthetic tests cannot validate real site integration] → Report automated results separately from manual Chrome checks and leave manual tasks incomplete until performed.

## Migration Plan

1. Establish sanitized context/request/SSR/DOM fixtures and regression checks, then implement context isolation before merging and response cleanup.
2. Preserve existing export keys; document nullable continuation and automatic clearing on collection changes.
3. Run automated checks and manual Chrome scenarios for all supported modes, overlays, navigation, and export URLs. Update the manifest patch version and record the release changes in repository documentation.
4. Deploy by reloading the unpacked extension and refreshing the site. Roll back by restoring the prior runtime files and reloading; no persisted data migration is required.

## Open Questions

- Exact active-tab metadata, SSR collection identifiers, request category fields, and list selectors must be established from current sanitized evidence in the first implementation task. The fallback behavior is already defined: skip ambiguous sources and disable unsupported contexts.
