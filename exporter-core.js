(function exposeXhsFavoritesExporterCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.XhsFavoritesExporterCore = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCore() {
  "use strict";

  var MODE_LABELS = {
    favorites: "收藏",
    homepage: "首页",
    following: "关注"
  };
  var EXPLORE_ORIGIN = "https://www.xiaohongshu.com";
  var FAVORITE_WORDS = /^(favorites?|collect(ion)?|saved|收藏)$/i;
  var DETAIL_WORDS = /(detail|recommend|related|note-detail|笔记详情|相关推荐)/i;

  function hasValue(value) {
    return value != null && String(value).trim() !== "";
  }

  function pick(values) {
    for (var index = 0; index < values.length; index += 1) {
      if (hasValue(values[index])) {
        return values[index];
      }
    }
    return null;
  }

  function asString(value) {
    return value == null ? null : String(value);
  }

  function normalizeText(value, maxLength) {
    if (!hasValue(value)) {
      return null;
    }
    var text = String(value).replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength || 120) : null;
  }

  function unwrap(value, depth) {
    var nextDepth = depth || 0;
    if (value == null || nextDepth > 8) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(function mapItem(item) {
        return unwrap(item, nextDepth + 1);
      });
    }
    if (typeof value !== "object") {
      return value;
    }
    if (Object.prototype.hasOwnProperty.call(value, "_rawValue")) {
      return unwrap(value._rawValue, nextDepth + 1);
    }
    if (Object.prototype.hasOwnProperty.call(value, "__v_raw")) {
      return unwrap(value.__v_raw, nextDepth + 1);
    }
    if (
      Object.prototype.hasOwnProperty.call(value, "value") &&
      Object.keys(value).length <= 4
    ) {
      return unwrap(value.value, nextDepth + 1);
    }
    return value;
  }

  function extractProfileId(pathname) {
    var match = String(pathname || "").match(/\/user\/profile\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function tabText(tab) {
    if (tab == null) {
      return null;
    }
    if (typeof tab === "string") {
      return tab.trim() || null;
    }
    return normalizeText(
      pick([
        tab.key,
        tab.id,
        tab.type,
        tab.name,
        tab.label,
        tab.title,
        tab.tab,
        tab.tabKey,
        tab.tab_key
      ]),
      80
    );
  }

  function isFavoritesTab(tab) {
    var text = tabText(tab);
    return Boolean(text && (FAVORITE_WORDS.test(text) || /收藏/.test(text)));
  }

  function activeTabFromState(state, documentObject) {
    var unwrapped = unwrap(state) || {};
    var user = unwrap(unwrapped.user) || {};
    var candidates = [
      unwrapped.activeTab,
      unwrapped.active_tab,
      user.activeTab,
      user.active_tab,
      user.selectedTab,
      user.selected_tab,
      user.profile && user.profile.activeTab
    ];

    for (var index = 0; index < candidates.length; index += 1) {
      if (tabText(candidates[index])) {
        return candidates[index];
      }
    }

    if (documentObject && typeof documentObject.querySelector === "function") {
      var selectors = [
        "[data-xhs-active-tab]",
        '[aria-selected="true"][data-tab-key]',
        '[aria-selected="true"][data-tab]'
      ];
      for (var selectorIndex = 0; selectorIndex < selectors.length; selectorIndex += 1) {
        var element = documentObject.querySelector(selectors[selectorIndex]);
        if (element) {
          return {
            key: element.getAttribute("data-xhs-active-tab") ||
              element.getAttribute("data-tab-key") ||
              element.getAttribute("data-tab"),
            label: element.getAttribute("aria-label") || element.textContent
          };
        }
      }
    }

    return null;
  }

  function profileIdFromState(state) {
    var unwrapped = unwrap(state) || {};
    var user = unwrap(unwrapped.user) || {};
    return asString(pick([
      user.userId,
      user.user_id,
      user.id,
      user.profileId,
      user.profile_id,
      unwrapped.profileId,
      unwrapped.profile_id
    ]));
  }

  function collectionPageUrl(input) {
    var origin = input.origin || EXPLORE_ORIGIN;
    var pathname = input.pathname || "/";
    var search = input.search || "";
    return origin + pathname + search;
  }

  function unsupportedContext(reason, input) {
    return {
      supported: false,
      mode: null,
      profile_id: null,
      collection_id: null,
      page_url: collectionPageUrl(input || {}),
      key: "unsupported",
      reason: reason
    };
  }

  function resolveContext(input) {
    var options = input || {};
    var pathname = String(options.pathname || "");
    var lowerPath = pathname.toLowerCase();
    var profileId = asString(pick([
      extractProfileId(pathname),
      options.profileId,
      options.profile_id
    ]));
    var pageUrl = collectionPageUrl(options);

    if (pathname === "" || pathname === "/") {
      return {
        supported: true,
        mode: "homepage",
        profile_id: null,
        collection_id: "home",
        page_url: pageUrl,
        key: "homepage:home"
      };
    }

    if (lowerPath === "/following" || lowerPath.indexOf("/following/") === 0) {
      return {
        supported: true,
        mode: "following",
        profile_id: null,
        collection_id: "following",
        page_url: pageUrl,
        key: "following:following"
      };
    }

    if (lowerPath.indexOf("/user/profile/") === 0 || lowerPath === "/collection") {
      var tab = options.activeTab;
      if (!isFavoritesTab(tab)) {
        return unsupportedContext("请选择个人主页的“收藏”Tab", options);
      }
      if (!profileId) {
        return unsupportedContext("缺少收藏所属的用户身份", options);
      }
      var collectionId = asString(pick([
        options.collectionId,
        options.collection_id,
        tab && tab.collectionId,
        tab && tab.collection_id,
        "favorites"
      ]));
      return {
        supported: true,
        mode: "favorites",
        profile_id: profileId,
        collection_id: collectionId,
        page_url: pageUrl,
        key: "favorites:" + profileId + ":" + collectionId
      };
    }

    return unsupportedContext("当前页面不是支持的首页、关注或收藏列表", options);
  }

  function contextStatus(context) {
    if (!context || !context.supported) {
      return (context && context.reason) || "请打开支持的首页、关注或收藏列表";
    }
    return "当前模式：" + (MODE_LABELS[context.mode] || context.mode);
  }

  function endpointKind(url) {
    var value = String(url || "");
    if (value.indexOf("/api/sns/web/v2/note/collect/page") !== -1) {
      return "collect";
    }
    if (value.indexOf("/api/sns/web/v1/homefeed") !== -1) {
      return "homefeed";
    }
    return null;
  }

  function parseBody(body) {
    if (!body) {
      return {};
    }
    if (typeof body === "object") {
      return body;
    }
    try {
      return JSON.parse(String(body));
    } catch (error) {
      return {};
    }
  }

  function requestDetails(meta) {
    var body = parseBody(meta && meta.body);
    var url;
    try {
      url = new URL(String((meta && meta.url) || ""), EXPLORE_ORIGIN);
    } catch (error) {
      url = null;
    }
    var category = pick([
      meta && meta.requestCategory,
      meta && meta.request_category,
      body.category,
      body.scene,
      body.source,
      body.page_type,
      body.pageType,
      url && url.searchParams.get("category"),
      url && url.searchParams.get("scene")
    ]);
    var profileId = pick([
      meta && meta.profileId,
      meta && meta.profile_id,
      body.profile_id,
      body.profileId,
      body.user_id,
      body.userId,
      url && url.searchParams.get("profile_id"),
      url && url.searchParams.get("user_id")
    ]);
    return {
      kind: endpointKind(meta && meta.url),
      category: category == null ? null : String(category),
      profile_id: profileId == null ? null : String(profileId)
    };
  }

  function requestBelongsToContext(meta, context) {
    if (!context || !context.supported) {
      return false;
    }
    var details = requestDetails(meta || {});
    if (details.kind === "collect") {
      if (context.mode !== "favorites") {
        return false;
      }
      return !details.profile_id || details.profile_id === context.profile_id;
    }
    if (details.kind !== "homefeed") {
      return false;
    }
    if (context.mode !== "homepage" && context.mode !== "following") {
      return false;
    }
    if (details.category && DETAIL_WORDS.test(details.category)) {
      return false;
    }
    if (
      details.category &&
      context.mode === "following" &&
      !/(follow|following|关注)/i.test(details.category)
    ) {
      return false;
    }
    if (
      details.category &&
      context.mode === "homepage" &&
      /(follow|following|关注)/i.test(details.category)
    ) {
      return false;
    }
    return true;
  }

  function collectionIdentity(value, key) {
    var candidate = unwrap(value);
    if (!candidate || typeof candidate !== "object") {
      return null;
    }
    var identity = pick([
      candidate.collection_id,
      candidate.collectionId,
      candidate.tab_key,
      candidate.tabKey,
      candidate.tab,
      candidate.type,
      candidate.key,
      candidate.id,
      candidate.name,
      candidate.label,
      candidate.title,
      key
    ]);
    return identity == null ? null : String(identity);
  }

  function collectionEntries(value) {
    var unwrapped = unwrap(value);
    if (Array.isArray(unwrapped)) {
      return unwrapped.map(function mapArrayItem(item, index) {
        return { value: item, key: String(index) };
      });
    }
    if (!unwrapped || typeof unwrapped !== "object") {
      return [];
    }
    return Object.keys(unwrapped).map(function mapObjectItem(key) {
      return { value: unwrapped[key], key: key };
    });
  }

  function isFavoriteIdentity(identity) {
    return Boolean(identity && (FAVORITE_WORDS.test(identity) || /收藏/.test(identity)));
  }

  function extractCollectionItems(value) {
    var unwrapped = unwrap(value);
    if (Array.isArray(unwrapped)) {
      return unwrapped;
    }
    if (!unwrapped || typeof unwrapped !== "object") {
      return [];
    }
    var list = pick([
      unwrapped.items,
      unwrapped.noteList,
      unwrapped.note_list,
      unwrapped.list
    ]);
    return Array.isArray(list) ? list : [];
  }

  function selectIdentifiedFavorite(value) {
    var matches = collectionEntries(value).filter(function keepFavorite(entry) {
      return isFavoriteIdentity(collectionIdentity(entry.value, entry.key));
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function selectSsrCollection(notes, queries) {
    var listEntry = selectIdentifiedFavorite(notes);
    if (!listEntry) {
      return null;
    }
    var listIdentity = collectionIdentity(listEntry.value, listEntry.key);
    var queryMatches = collectionEntries(queries).filter(function keepQuery(entry) {
      return collectionIdentity(entry.value, entry.key) === listIdentity ||
        isFavoriteIdentity(collectionIdentity(entry.value, entry.key));
    });
    var queryEntry = queryMatches.length === 1 ? queryMatches[0] : null;
    return {
      items: extractCollectionItems(listEntry.value),
      query: queryEntry ? queryEntry.value : null,
      identity: listIdentity
    };
  }

  function normalizeContinuation(value) {
    if (value === true || value === false) {
      return value;
    }
    if (value === 1 || value === "1" || value === "true") {
      return true;
    }
    if (value === 0 || value === "0" || value === "false") {
      return false;
    }
    return null;
  }

  function normalizePageInfo(value) {
    var page = unwrap(value) || {};
    var hasMore = Object.prototype.hasOwnProperty.call(page, "has_more")
      ? page.has_more
      : Object.prototype.hasOwnProperty.call(page, "hasMore")
        ? page.hasMore
        : null;
    return {
      cursor: asString(pick([page.cursor, page.cursor_score, page.cursorScore])),
      has_more: normalizeContinuation(hasMore),
      num: page.num == null ? null : Number(page.num),
      page: page.page == null ? null : Number(page.page)
    };
  }

  function mergePageInfo(previous, next) {
    if (!next) {
      return previous || null;
    }
    var normalized = normalizePageInfo(next);
    return {
      cursor: normalized.cursor == null ? (previous && previous.cursor) || null : normalized.cursor,
      has_more: normalized.has_more == null
        ? (previous && previous.has_more != null ? previous.has_more : null)
        : normalized.has_more,
      num: normalized.num == null ? (previous && previous.num) || null : normalized.num,
      page: normalized.page == null ? (previous && previous.page) || null : normalized.page
    };
  }

  function responsePage(data) {
    var payload = unwrap(data) || {};
    return {
      cursor: asString(pick([payload.cursor, payload.cursor_score, payload.cursorScore])),
      has_more: Object.prototype.hasOwnProperty.call(payload, "has_more")
        ? normalizeContinuation(payload.has_more)
        : Object.prototype.hasOwnProperty.call(payload, "hasMore")
          ? normalizeContinuation(payload.hasMore)
          : null,
      num: payload.num == null ? null : Number(payload.num),
      page: payload.page == null ? null : Number(payload.page)
    };
  }

  function validateResponse(input) {
    var options = input || {};
    var status = Number(options.status);
    if (!(status >= 200 && status < 300)) {
      return { ok: false, reason: "http", status: status, message: "HTTP 请求失败：" + status };
    }
    var payload = options.payload;
    if (!payload || typeof payload !== "object") {
      return { ok: false, reason: "malformed", status: status, message: "分页响应结构无效" };
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "code") &&
      payload.code !== 0 &&
      payload.code !== "0"
    ) {
      return {
        ok: false,
        reason: "business",
        status: status,
        code: payload.code,
        message: payload.msg || payload.message || "接口返回业务错误"
      };
    }
    if (payload.success === false || payload.successful === false) {
      return { ok: false, reason: "business", status: status, message: payload.msg || "接口返回业务错误" };
    }
    var data = unwrap(payload.data);
    if (!data || typeof data !== "object") {
      return { ok: false, reason: "malformed", status: status, message: "分页数据缺少 data" };
    }
    var key = options.kind === "homefeed" ? "items" : null;
    var items;
    if (key) {
      items = data.items;
    } else {
      items = Array.isArray(data.notes) ? data.notes : data.note_list;
    }
    if (!Array.isArray(items)) {
      return { ok: false, reason: "malformed", status: status, message: "分页数据缺少条目列表" };
    }
    return { ok: true, status: status, data: data, items: items, page: responsePage(data) };
  }

  function buildExploreUrl(noteId, token) {
    var base = EXPLORE_ORIGIN + "/explore/" + encodeURIComponent(String(noteId));
    return hasValue(token) ? base + "?xsec_token=" + encodeURIComponent(String(token)) : base;
  }

  function sourceList(input) {
    var values = Array.isArray(input && input.sources)
      ? input.sources
      : hasValue(input && input.source)
        ? [input.source]
        : [];
    return Array.from(new Set(values.filter(hasValue).map(String)));
  }

  function sanitizeRecord(input, now) {
    if (!input || !hasValue(input.note_id)) {
      return null;
    }
    var timestamp = now || new Date().toISOString();
    var noteId = String(input.note_id);
    var token = hasValue(input.xsec_token) ? String(input.xsec_token) : null;
    var firstSeen = input.first_seen_at || input.captured_at || timestamp;
    var lastSeen = input.last_seen_at || input.captured_at || timestamp;
    return {
      note_id: noteId,
      xsec_token: token,
      url: buildExploreUrl(noteId, token),
      title: normalizeText(input.title),
      author: normalizeText(input.author),
      cover: hasValue(input.cover) ? String(input.cover) : null,
      liked_count: input.liked_count == null || String(input.liked_count).trim() === ""
        ? null
        : String(input.liked_count),
      note_type: normalizeText(input.note_type, 80),
      source: sourceList(input).join(","),
      sources: sourceList(input),
      first_seen_at: firstSeen,
      last_seen_at: lastSeen
    };
  }

  function comparable(record) {
    return [
      record.xsec_token,
      record.url,
      record.title,
      record.author,
      record.cover,
      record.liked_count,
      record.note_type,
      (record.sources || []).join("\u0001")
    ].join("\u0002");
  }

  function mergeRecord(existing, incoming, now) {
    var timestamp = now || new Date().toISOString();
    var next = sanitizeRecord(incoming, timestamp);
    if (!next) {
      return { record: existing || null, meaningfulChanged: false };
    }
    var base = existing
      ? Object.assign({}, existing, { sources: sourceList(existing) })
      : {
          note_id: next.note_id,
          xsec_token: null,
          url: buildExploreUrl(next.note_id, null),
          title: null,
          author: null,
          cover: null,
          liked_count: null,
          note_type: null,
          source: "",
          sources: [],
          first_seen_at: next.first_seen_at,
          last_seen_at: next.first_seen_at
        };
    var before = comparable(base);
    ["xsec_token", "title", "author", "cover", "liked_count", "note_type"].forEach(function mergeField(field) {
      if (hasValue(next[field])) {
        base[field] = next[field];
      }
    });
    base.sources = Array.from(new Set(base.sources.concat(next.sources)));
    base.source = base.sources.join(",");
    base.url = buildExploreUrl(base.note_id, base.xsec_token);
    base.first_seen_at = existing && existing.first_seen_at ? existing.first_seen_at : next.first_seen_at;
    base.last_seen_at = next.last_seen_at || next.first_seen_at || timestamp;
    return { record: base, meaningfulChanged: before !== comparable(base) };
  }

  function mergeRecordMap(map, rawItems, now) {
    var result = { added: 0, updated: 0 };
    (rawItems || []).forEach(function mergeItem(rawItem) {
      var incoming = sanitizeRecord(rawItem, now);
      if (!incoming) {
        return;
      }
      var current = map.get(incoming.note_id);
      var merged = mergeRecord(current, incoming, now);
      if (!current) {
        result.added += 1;
      } else if (merged.meaningfulChanged) {
        result.updated += 1;
      }
      map.set(incoming.note_id, merged.record);
    });
    return result;
  }

  function countMissingTokens(records) {
    var count = 0;
    Array.from(records || []).forEach(function iterateRecord(record) {
      if (!hasValue(record.xsec_token)) {
        count += 1;
      }
    });
    return count;
  }

  function serializeExport(options) {
    var input = options || {};
    var records = Array.from(input.items || []).sort(function sortByFirstSeen(left, right) {
      return String(left.first_seen_at).localeCompare(String(right.first_seen_at));
    });
    var context = input.context || {};
    return {
      exported_at: input.exported_at || new Date().toISOString(),
      page_url: context.page_url || null,
      feed: context.mode || null,
      total_items: records.length,
      missing_token_count: countMissingTokens(records),
      page_info: input.page_info || null,
      items: records
    };
  }

  function scrollMetrics(scroller, threshold) {
    if (!scroller) {
      return { scrollTop: 0, clientHeight: 0, scrollHeight: 0, near_bottom: false };
    }
    var top = Number(scroller.scrollTop) || 0;
    var clientHeight = Number(scroller.clientHeight) || 0;
    var scrollHeight = Number(scroller.scrollHeight) || 0;
    var margin = threshold == null ? 120 : Number(threshold);
    return {
      scrollTop: top,
      clientHeight: clientHeight,
      scrollHeight: scrollHeight,
      near_bottom: top + clientHeight >= scrollHeight - margin
    };
  }

  function isExcludedNode(node) {
    if (!node) {
      return true;
    }
    if (typeof node.closest === "function") {
      return Boolean(node.closest(
        '[role="dialog"], .note-detail-mask, .note-detail-container, .related-notes, [data-recommendations="true"], [data-xhs-overlay="true"]'
      ));
    }
    return false;
  }

  function findActiveList(documentObject, context) {
    if (!documentObject || !context || !context.supported || typeof documentObject.querySelector !== "function") {
      return null;
    }
    var mode = context.mode;
    var selectors = [
      '[data-xhs-active-collection="' + mode + '"]',
      '[data-xhs-collection="' + mode + '"]',
      '[data-collection="' + mode + '"]',
      '[data-feed="' + mode + '"]',
      '[data-testid="' + mode + '-list"]'
    ];
    for (var index = 0; index < selectors.length; index += 1) {
      var list = documentObject.querySelector(selectors[index]);
      if (list && !isExcludedNode(list)) {
        return list;
      }
    }
    return null;
  }

  function parseNoteHref(href, origin) {
    if (!href) {
      return null;
    }
    try {
      var url = new URL(String(href), origin || EXPLORE_ORIGIN);
      var match = url.pathname.match(/\/explore\/([^/?#]+)/);
      if (!match) {
        return null;
      }
      return {
        note_id: decodeURIComponent(match[1]),
        xsec_token: url.searchParams.get("xsec_token")
      };
    } catch (error) {
      return null;
    }
  }

  function collectDomItems(documentObject, context, now) {
    var list = findActiveList(documentObject, context);
    if (!list || typeof list.querySelectorAll !== "function") {
      return { items: [], skipped: true, reason: "未找到可验证的活动列表容器" };
    }
    var anchors = Array.from(list.querySelectorAll('a[href*="/explore/"]'));
    var source = context.mode === "homepage"
      ? "feed-home"
      : context.mode === "following"
        ? "feed-following"
        : "dom";
    var items = [];
    anchors.forEach(function collectAnchor(anchor) {
      if (isExcludedNode(anchor)) {
        return;
      }
      var parsed = parseNoteHref(anchor.getAttribute("href") || anchor.href, EXPLORE_ORIGIN);
      if (!parsed) {
        return;
      }
      var image = anchor.querySelector && anchor.querySelector("img[alt]");
      var title = image && image.alt ? image.alt : anchor.textContent;
      items.push({
        note_id: parsed.note_id,
        xsec_token: parsed.xsec_token,
        title: title,
        source: source,
        captured_at: now || new Date().toISOString()
      });
    });
    return { items: items, skipped: false, list: list };
  }

  return {
    MODE_LABELS: MODE_LABELS,
    activeTabFromState: activeTabFromState,
    profileIdFromState: profileIdFromState,
    resolveContext: resolveContext,
    contextStatus: contextStatus,
    endpointKind: endpointKind,
    requestDetails: requestDetails,
    requestBelongsToContext: requestBelongsToContext,
    unwrap: unwrap,
    normalizeContinuation: normalizeContinuation,
    normalizePageInfo: normalizePageInfo,
    mergePageInfo: mergePageInfo,
    responsePage: responsePage,
    validateResponse: validateResponse,
    selectSsrCollection: selectSsrCollection,
    extractCollectionItems: extractCollectionItems,
    buildExploreUrl: buildExploreUrl,
    normalizeText: normalizeText,
    sanitizeRecord: sanitizeRecord,
    mergeRecord: mergeRecord,
    mergeRecordMap: mergeRecordMap,
    countMissingTokens: countMissingTokens,
    serializeExport: serializeExport,
    scrollMetrics: scrollMetrics,
    findActiveList: findActiveList,
    isExcludedNode: isExcludedNode,
    collectDomItems: collectDomItems,
    parseNoteHref: parseNoteHref
  };
});
