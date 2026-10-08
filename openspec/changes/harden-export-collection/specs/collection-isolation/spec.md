# Spec Delta

## Purpose

Ensure that each export contains only notes belonging to the active supported collection, including when the user navigates within the site.

## ADDED Requirements

### Requirement: Supported collection identification
The exporter SHALL identify homepage, following, or favorites using the active route and collection state. Favorites identification MUST include the selected profile tab and profile identity. An ambiguous or unsupported context SHALL disable collection and explain that a supported collection must be opened.

#### Scenario: Posted or liked profile tab
- **WHEN** a profile displays posted or liked notes rather than favorites
- **THEN** the exporter does not classify or collect those notes as favorites

#### Scenario: Unsupported route
- **WHEN** the user opens a standalone detail page or an unrecognized collection route
- **THEN** collection is disabled rather than defaulting to homepage mode

#### Scenario: Recognized supported collection
- **WHEN** the active route and tab identify homepage, following, or favorites
- **THEN** the panel displays that mode and allows collection from its identified list

### Requirement: Collection lifecycle isolation
The exporter SHALL stop automatic collection, clear records and pagination, and invalidate pending work when the collection identity changes. The new collection SHALL require an explicit start action before automatic scrolling resumes. Opening a detail overlay within the same collection SHALL preserve its records while suspending list scanning and automatic scrolling until the overlay closes.

#### Scenario: Navigation between collections
- **WHEN** a user changes from homepage to following, switches profile identity, or changes the selected profile tab
- **THEN** prior results and pagination are cleared, the displayed context is refreshed, and automatic scrolling stops

#### Scenario: Late response after navigation
- **WHEN** a response or queued snapshot belonging to the previous collection arrives after the context changes
- **THEN** it does not alter the new collection's records, pagination, or status

#### Scenario: Detail overlay opened
- **WHEN** a detail overlay opens over a collection
- **THEN** existing records remain intact and scanning and scrolling pause without including overlay recommendations

### Requirement: Source membership validation
SSR, API, and DOM sources SHALL contribute only records identified as belonging to the active collection. API admission MUST validate endpoint family and available request context, including feed category and profile identity. DOM admission MUST be scoped to the active list and exclude detail overlays, recommendations, and unrelated links. Data with ambiguous membership SHALL be skipped.

#### Scenario: Homefeed response during favorites collection
- **WHEN** homefeed traffic occurs while favorites is active
- **THEN** neither its notes nor pagination are merged into the favorites collection

#### Scenario: Related feed request
- **WHEN** a response shares a feed endpoint but its request category identifies detail recommendations
- **THEN** the exporter ignores it even if homepage or following is active

#### Scenario: Links outside the collection list
- **WHEN** an unrelated region contains a matching note link
- **THEN** a DOM scan excludes that link

### Requirement: Explicit favorites SSR selection
The exporter SHALL select favorites SSR notes and their matching pagination using explicit collection identity. It MUST NOT select the first available list or a fixed positional list without verified identity. Unidentified SSR data SHALL be skipped while valid API and DOM sources remain usable.

#### Scenario: Reordered profile collections
- **WHEN** SSR stores posted, favorites, and liked collections in a different order with identifiable metadata
- **THEN** only the favorites collection and its matching query are selected

#### Scenario: Missing collection metadata
- **WHEN** multiple SSR lists exist without sufficient metadata to identify favorites
- **THEN** none of those lists is guessed to be favorites
