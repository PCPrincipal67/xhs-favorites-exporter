const assert = require("assert");
const fs = require("fs");
const path = require("path");
const core = require("../exporter-core.js");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "source-contracts.json"), "utf8"));

function contextFor(name) {
  const route = fixture.routes.find((item) => item.name === name);
  return core.resolveContext(route.input);
}

function testRoutes() {
  assert.strictEqual(fixture.provenance.live_session_available, false);
  assert.strictEqual(contextFor("homepage").mode, "homepage");
  assert.strictEqual(contextFor("following").mode, "following");
  assert.strictEqual(contextFor("favorites").mode, "favorites");
  assert.strictEqual(contextFor("favorites").profile_id, "profile-42");
  assert.strictEqual(contextFor("posted-profile-tab").supported, false);
  assert.strictEqual(contextFor("liked-profile-tab").supported, false);
  assert.strictEqual(contextFor("detail-page").supported, false);
}

function testSsrSelection() {
  const selected = core.selectSsrCollection(fixture.ssr.notes, fixture.ssr.queries);
  assert.deepStrictEqual(selected.items.map((item) => item.id), ["fav-1"]);
  assert.strictEqual(selected.query.cursor, "fav-cursor");
  assert.strictEqual(selected.query.has_more, false);
  assert.strictEqual(core.selectSsrCollection(fixture.ssr.ambiguous_notes, fixture.ssr.queries), null);
}

function testRequestMembership() {
  const contexts = {
    favorites: contextFor("favorites"),
    homepage: contextFor("homepage"),
    following: contextFor("following")
  };
  fixture.requests.forEach((request) => {
    assert.strictEqual(
      core.requestBelongsToContext(request.meta, contexts[request.context]),
      request.belongs,
      request.name
    );
  });
}

function testCanonicalMerge() {
  const records = new Map();
  const first = core.mergeRecordMap(records, [{
    note_id: "note-1",
    xsec_token: "token/a?b",
    title: "Complete title",
    author: "Author",
    source: "xhr",
    captured_at: "2026-09-30T00:00:00.000Z"
  }], "2026-09-30T00:00:00.000Z");
  assert.deepStrictEqual(first, { added: 1, updated: 0 });
  const second = core.mergeRecordMap(records, [{
    note_id: "note-1",
    title: "",
    xsec_token: null,
    source: "dom",
    captured_at: "2026-09-30T00:01:00.000Z"
  }], "2026-09-30T00:01:00.000Z");
  assert.deepStrictEqual(second, { added: 0, updated: 1 });
  const record = records.get("note-1");
  assert.strictEqual(record.title, "Complete title");
  assert.strictEqual(record.xsec_token, "token/a?b");
  assert.strictEqual(record.url, core.buildExploreUrl("note-1", "token/a?b"));
  assert.deepStrictEqual(record.sources, ["xhr", "dom"]);
  assert.strictEqual(record.first_seen_at, "2026-09-30T00:00:00.000Z");
  const repeat = core.mergeRecordMap(records, [{ note_id: "note-1", source: "dom", captured_at: "2026-09-30T00:02:00.000Z" }], "2026-09-30T00:02:00.000Z");
  assert.deepStrictEqual(repeat, { added: 0, updated: 0 });
  assert.strictEqual(records.get("note-1").last_seen_at, "2026-09-30T00:02:00.000Z");
}

function testResponseValidation() {
  const success = core.validateResponse({ status: 200, kind: "collect", payload: fixture.responses.success });
  assert.strictEqual(success.ok, true);
  assert.strictEqual(success.page.has_more, false);
  const empty = core.validateResponse({ status: 200, kind: "collect", payload: fixture.responses["empty-unknown"] });
  assert.strictEqual(empty.ok, true);
  assert.strictEqual(empty.page.has_more, null);
  assert.strictEqual(core.validateResponse({ status: 429, kind: "collect", payload: fixture.responses.success }).ok, false);
  assert.strictEqual(core.validateResponse({ status: 401, kind: "collect", payload: fixture.responses.success }).ok, false);
  assert.strictEqual(core.validateResponse({ status: 200, kind: "collect", payload: fixture.responses["business-failure"] }).reason, "business");
  assert.strictEqual(core.validateResponse({ status: 200, kind: "collect", payload: fixture.responses.malformed }).reason, "malformed");
}

function testDomMembership() {
  const anchor = {
    href: "/explore/dom-1",
    textContent: "DOM note",
    getAttribute: () => "/explore/dom-1",
    querySelector: () => null,
    closest: () => null
  };
  const list = {
    closest: () => null,
    querySelectorAll: () => [anchor]
  };
  const documentObject = {
    querySelector: (selector) => selector === '[data-xhs-collection="favorites"]' ? list : null
  };
  const result = core.collectDomItems(documentObject, contextFor("favorites"), "2026-09-30T00:00:00.000Z");
  assert.strictEqual(result.skipped, false);
  assert.strictEqual(result.items[0].note_id, "dom-1");
  const missing = core.collectDomItems({ querySelector: () => null }, contextFor("favorites"));
  assert.strictEqual(missing.skipped, true);
}

function testExportContext() {
  const records = new Map();
  core.mergeRecordMap(records, [{ note_id: "tokenless", source: "dom" }], "2026-09-30T00:00:00.000Z");
  const payload = core.serializeExport({ context: contextFor("favorites"), items: records.values(), page_info: { cursor: null, has_more: null } });
  assert.strictEqual(payload.feed, "favorites");
  assert.strictEqual(payload.page_url, "https://www.xiaohongshu.com/user/profile/profile-42");
  assert.strictEqual(payload.total_items, 1);
  assert.strictEqual(payload.missing_token_count, 1);
  assert.strictEqual(payload.items[0].url, core.buildExploreUrl("tokenless", null));
}

function testNestedScrollAndVersion() {
  const metrics = core.scrollMetrics(fixture.nested_scroll.scroll_container, fixture.nested_scroll.near_bottom_threshold);
  assert.strictEqual(metrics.near_bottom, true);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")).version, "0.1.1");
  assert.ok(fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8").includes("## 0.1.1"));
}

[
  testRoutes,
  testSsrSelection,
  testRequestMembership,
  testCanonicalMerge,
  testResponseValidation,
  testDomMembership,
  testExportContext,
  testNestedScrollAndVersion
].forEach((test) => test());

console.log("regression: 8 suites passed");
