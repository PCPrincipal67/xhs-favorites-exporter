# Spec Delta

## Purpose

Preserve useful note metadata across collection sources and produce export URLs and context that consistently describe the collected records.

## ADDED Requirements

### Requirement: Canonical token-consistent URLs
The exporter SHALL derive each record's URL from its merged note ID and token. A nonempty retained token MUST be encoded into the canonical Xiaohongshu explore URL. Incoming tokenless URLs MUST NOT remove a retained token from the exported URL.

#### Scenario: Tokenless DOM observation follows API observation
- **WHEN** an API record with a token is merged with a DOM record for the same ID whose URL has no token
- **THEN** the merged record retains the token and its URL includes that token

#### Scenario: Token becomes available later
- **WHEN** a tokenless note is subsequently observed with a nonempty token
- **THEN** the merged record's token and URL both reflect the newly available token

### Requirement: Stable metadata merging
The exporter SHALL deduplicate by note ID, preserve first-seen time, refresh last-seen time, and union source attribution without duplicates. Missing or blank incoming values MUST NOT erase existing metadata. Repeated observations with no meaningful metadata change SHALL NOT be counted as content growth solely because observation timestamps change.

#### Scenario: Incomplete observation
- **WHEN** a complete record is followed by an observation with blank title and missing author or cover
- **THEN** existing nonempty metadata is retained

#### Scenario: Repeated observation
- **WHEN** the same record is observed again with identical metadata and sources
- **THEN** the record remains deduplicated, first-seen time is preserved, and timestamp refresh alone is not reported as new content

### Requirement: Consistent export context
The exporter SHALL retain the existing JSON keys, including feed, total_items, missing_token_count, page_info, and items. The exported feed and page_url SHALL describe the collection whose records are included, and counts SHALL be calculated from those records.

#### Scenario: Export after navigation
- **WHEN** records have been collected in a new context after navigation cleared the previous results
- **THEN** the export contains only the new context's records and identifies that context

#### Scenario: Export with missing tokens
- **WHEN** some collected records have no token
- **THEN** missing_token_count equals the number of tokenless records and their URLs remain canonical tokenless explore URLs
