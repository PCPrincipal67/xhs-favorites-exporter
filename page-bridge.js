(function bootstrapFavoritesExporterBridge() {
  if (window.__XHS_FAVORITES_EXPORTER_BRIDGE__) {
    return;
  }

  window.__XHS_FAVORITES_EXPORTER_BRIDGE__ = true;

  var Core = window.XhsFavoritesExporterCore;
  var BRIDGE_SOURCE = "xhs-favorites-exporter";
  var COLLECT_PATH = "/api/sns/web/v2/note/collect/page";
  var HOMEFEED_PATH = "/api/sns/web/v1/homefeed";
  var currentContext = null;
  var generation = 0;
  var initialSnapshotSent = false;
  var pollAttempts = 0;
  var pollTimer = null;
  var maxPollAttempts = 60;

  if (!Core) {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: "COLLECTION_ERROR",
      payload: { message: "导出器核心适配器未加载" }
    }, window.location.origin);
    return;
  }

  function emit(type, payload) {
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: type,
      payload: payload || {}
    }, window.location.origin);
  }

  function contextInput() {
    var state = Core.unwrap(window.__INITIAL_STATE__) || {};
    return {
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      activeTab: Core.activeTabFromState(state, document),
      profileId: Core.profileIdFromState(state)
    };
  }

  function contextPayload() {
    return { context: currentContext, generation: generation };
  }

  function sameContext(left, right) {
    return Boolean(left && right && left.key === right.key);
  }

  function refreshContext() {
    var next = Core.resolveContext(contextInput());
    if (!currentContext || !sameContext(currentContext, next)) {
      generation += 1;
      currentContext = next;
      initialSnapshotSent = false;
      pollAttempts = 0;
      emit("CONTEXT_CHANGED", contextPayload());
      startInitialStatePolling();
    } else {
      currentContext = next;
    }
    return currentContext;
  }

  function pick(values) {
    for (var index = 0; index < values.length; index += 1) {
      if (values[index] != null && String(values[index]).trim() !== "") {
        return values[index];
      }
    }
    return null;
  }

  function resolveCover(noteCard) {
    var cover = noteCard && noteCard.cover ? Core.unwrap(noteCard.cover) : null;
    var infoList = cover && (cover.info_list || cover.infoList);
    if (Array.isArray(infoList)) {
      for (var index = 0; index < infoList.length; index += 1) {
        var item = Core.unwrap(infoList[index]);
        var itemUrl = pick([item && item.url, item && item.urlDefault]);
        if (itemUrl) {
          return itemUrl;
        }
      }
    }
    return pick([
      cover && cover.url,
      cover && cover.url_default,
      cover && cover.urlDefault,
      cover && cover.default,
      cover && cover.src
    ]);
  }

  function normalizeNoteItem(rawItem, source) {
    var item = Core.unwrap(rawItem) || {};
    var noteCard = Core.unwrap(item.noteCard) || Core.unwrap(item.note_card) || item;
    var user = Core.unwrap(noteCard.user) || Core.unwrap(item.user) || {};
    var interactInfo = Core.unwrap(noteCard.interactInfo) ||
      Core.unwrap(noteCard.interact_info) || Core.unwrap(item.interactInfo) ||
      Core.unwrap(item.interact_info) || {};
    var noteId = pick([item.id, item.noteId, item.note_id, noteCard.noteId, noteCard.note_id]);
    if (!noteId) {
      return null;
    }
    var token = pick([item.xsecToken, item.xsec_token, noteCard.xsecToken, noteCard.xsec_token]);
    return {
      note_id: String(noteId),
      xsec_token: token == null ? null : String(token),
      title: pick([noteCard.displayTitle, noteCard.display_title, item.displayTitle, item.display_title, item.title]),
      author: pick([user.nickName, user.nick_name, user.nickname, user.name]),
      cover: resolveCover(noteCard),
      liked_count: pick([interactInfo.likedCount, interactInfo.liked_count]),
      note_type: pick([noteCard.type, item.type]),
      source: source,
      captured_at: new Date().toISOString()
    };
  }

  function normalizeItems(items, source) {
    return (items || []).map(function mapItem(item) {
      return normalizeNoteItem(item, source);
    }).filter(Boolean);
  }

  function readInitialSnapshot() {
    var context = refreshContext();
    if (!context.supported) {
      return null;
    }
    var state = Core.unwrap(window.__INITIAL_STATE__) || {};
    if (context.mode === "homepage" || context.mode === "following") {
      var feedState = Core.unwrap(state.feed) || {};
      var feeds = Core.unwrap(feedState.feeds);
      if (!Array.isArray(feeds)) {
        return null;
      }
      return {
        items: normalizeItems(feeds, context.mode === "following" ? "feed-following" : "feed-home"),
        page: { cursor: null, has_more: null, num: null, page: null }
      };
    }
    var userState = Core.unwrap(state.user) || {};
    var selected = Core.selectSsrCollection(userState.notes, userState.noteQueries);
    if (!selected) {
      return null;
    }
    return {
      items: normalizeItems(selected.items, "ssr"),
      page: Core.normalizePageInfo(selected.query)
    };
  }

  function emitInitialSnapshot(force) {
    var snapshot = readInitialSnapshot();
    if (!snapshot || !currentContext || !currentContext.supported || (!force && initialSnapshotSent)) {
      return false;
    }
    if (snapshot.items.length === 0 && snapshot.page.cursor == null && snapshot.page.has_more == null) {
      return false;
    }
    emit("INITIAL_SNAPSHOT", Object.assign({}, contextPayload(), snapshot));
    initialSnapshotSent = true;
    return true;
  }

  function startInitialStatePolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
    }
    pollTimer = window.setInterval(function pollInitialState() {
      pollAttempts += 1;
      if (emitInitialSnapshot(false) || pollAttempts >= maxPollAttempts) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 500);
  }

  function parsePayload(xhr) {
    if (xhr.responseType === "json") {
      return xhr.response;
    }
    if (xhr.response && typeof xhr.response === "object") {
      return xhr.response;
    }
    return JSON.parse(xhr.responseText || "");
  }

  function isCurrentRequest(meta) {
    refreshContext();
    return Boolean(currentContext && currentContext.supported && meta.contextKey === currentContext.key &&
      meta.generation === generation && Core.requestBelongsToContext(meta, currentContext));
  }

  function emitError(meta, details) {
    if (!isCurrentRequest(meta)) {
      return;
    }
    emit("COLLECTION_ERROR", Object.assign({}, contextPayload(), {
      status: details.status == null ? null : details.status,
      url: meta.url,
      reason: details.reason || "network",
      code: details.code,
      message: details.message || "分页请求失败"
    }));
  }

  function handleResponse(xhr, meta, startedAt) {
    if (!isCurrentRequest(meta)) {
      return;
    }
    var payload;
    try {
      payload = parsePayload(xhr);
    } catch (error) {
      emitError(meta, { reason: "parse", status: xhr.status, message: "分页响应不是有效 JSON" });
      return;
    }
    var result = Core.validateResponse({ status: xhr.status, payload: payload, kind: meta.kind });
    if (!result.ok) {
      emitError(meta, result);
      return;
    }
    var source = meta.kind === "homefeed"
      ? (currentContext.mode === "following" ? "feed-following" : "feed-home")
      : "xhr";
    var items = result.items;
    if (meta.kind === "homefeed") {
      items = items.filter(function keepNotes(item) {
        return !item.model_type || item.model_type === "note";
      });
    }
    emit(meta.kind === "homefeed" ? "FEED_PAGE" : "COLLECT_PAGE", Object.assign({}, contextPayload(), {
      status: xhr.status,
      url: xhr.responseURL || meta.url,
      duration_ms: Date.now() - startedAt,
      page: result.page,
      items: normalizeItems(items, source)
    }));
  }

  function reportTransportFailure(xhr, meta, reason) {
    if (meta.reported) {
      return;
    }
    meta.reported = true;
    emitError(meta, {
      reason: reason,
      status: xhr.status,
      message: reason === "abort" ? "分页请求被中止" : "分页请求发生网络错误"
    });
  }

  function installXmlHttpRequestHook() {
    var originalOpen = XMLHttpRequest.prototype.open;
    var originalSend = XMLHttpRequest.prototype.send;
    if (originalOpen.__xhsFavoritesExporterHooked) {
      return;
    }
    function patchedOpen(method, url) {
      this.__xhsFavoritesExporterMeta = { method: method ? String(method) : "GET", url: url ? String(url) : "" };
      return originalOpen.apply(this, arguments);
    }
    patchedOpen.__xhsFavoritesExporterHooked = true;
    XMLHttpRequest.prototype.open = patchedOpen;
    XMLHttpRequest.prototype.send = function patchedSend(body) {
      var meta = this.__xhsFavoritesExporterMeta;
      var kind = Core.endpointKind(meta && meta.url);
      var startedAt = Date.now();
      if (meta && kind) {
        meta.kind = kind;
        meta.body = body;
        meta.contextKey = refreshContext().key;
        meta.generation = generation;
        var xhr = this;
        this.addEventListener("load", function onLoaded() {
          handleResponse(xhr, meta, startedAt);
        }, { once: true });
        ["error", "timeout", "abort"].forEach(function addFailureListener(eventName) {
          xhr.addEventListener(eventName, function onFailure() {
            reportTransportFailure(xhr, meta, eventName);
          }, { once: true });
        });
      }
      return originalSend.apply(this, arguments);
    };
  }

  function installNavigationHooks() {
    ["pushState", "replaceState"].forEach(function patchHistory(name) {
      var original = window.history[name];
      window.history[name] = function patchedHistoryMethod() {
        var result = original.apply(this, arguments);
        window.setTimeout(refreshContext, 0);
        return result;
      };
    });
    window.addEventListener("popstate", refreshContext);
    window.addEventListener("hashchange", refreshContext);
    if (typeof MutationObserver === "function") {
      new MutationObserver(function observeTabChanges(records) {
        for (var index = 0; index < records.length; index += 1) {
          if (records[index].type === "attributes") {
            refreshContext();
            return;
          }
        }
      }).observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-selected", "data-xhs-active-tab", "data-tab-key", "data-tab"]
      });
    }
  }

  window.addEventListener("xhs-favorites-exporter:scan-now", function forceScan() {
    refreshContext();
    emitInitialSnapshot(true);
  });
  refreshContext();
  installXmlHttpRequestHook();
  installNavigationHooks();
  emit("BRIDGE_READY", Object.assign({}, contextPayload(), {
    collect_path: COLLECT_PATH,
    homefeed_path: HOMEFEED_PATH,
    transport: "xhr"
  }));
})();
