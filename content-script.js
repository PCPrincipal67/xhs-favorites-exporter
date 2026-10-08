(function bootstrapFavoritesExporterContentScript() {
  if (window.__XHS_FAVORITES_EXPORTER_CONTENT__) {
    return;
  }
  window.__XHS_FAVORITES_EXPORTER_CONTENT__ = true;

  var Core = window.XhsFavoritesExporterCore;
  var BRIDGE_SOURCE = "xhs-favorites-exporter";
  var SHADOW_HOST_ID = "xhs-favorites-exporter-host";
  var SCAN_EVENT = "xhs-favorites-exporter:scan-now";
  var AUTO_SCROLL_DELAY_MS = 1400;
  var MAX_IDLE_ROUNDS = 6;

  var state = {
    items: new Map(),
    context: null,
    generation: null,
    running: false,
    overlaySuspended: false,
    idleRounds: 0,
    bridgeReady: false,
    lastNetworkAt: 0,
    lastDomScanAt: 0,
    pageInfo: null,
    statusText: "等待页面就绪",
    timerId: null
  };

  var ui = {
    host: null,
    shadow: null,
    countValue: null,
    tokenValue: null,
    sourceValue: null,
    statusValue: null,
    modeValue: null,
    startButton: null,
    stopButton: null,
    exportButton: null,
    resetButton: null,
    scanButton: null
  };

  function modeLabel() {
    return state.context && state.context.mode
      ? Core.MODE_LABELS[state.context.mode] || state.context.mode
      : "未识别页面";
  }

  function setStatus(text) {
    state.statusText = String(text || "");
    render();
  }

  function injectScript(fileName, callback) {
    var script = document.createElement("script");
    script.src = chrome.runtime.getURL(fileName);
    script.async = false;
    script.addEventListener("load", function handleLoad() {
      script.remove();
      callback();
    }, { once: true });
    script.addEventListener("error", function handleError() {
      script.remove();
      setStatus("无法加载页面适配器：" + fileName);
    }, { once: true });
    (document.head || document.documentElement).appendChild(script);
  }

  function injectPageBridge() {
    injectScript("exporter-core.js", function injectBridge() {
      injectScript("page-bridge.js", function bridgeInjected() {
        if (!state.bridgeReady) {
          setStatus("页面适配器已注入，等待页面状态");
        }
      });
    });
  }

  function ensurePanel() {
    if (ui.host) {
      return;
    }
    var host = document.createElement("div");
    host.id = SHADOW_HOST_ID;
    host.style.position = "fixed";
    host.style.right = "16px";
    host.style.bottom = "16px";
    host.style.zIndex = "2147483647";
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        #panel { width: 320px; background: linear-gradient(180deg,#fffef6 0%,#fff 100%); border: 1px solid rgba(34,34,34,.14); border-radius: 14px; box-shadow: 0 18px 40px rgba(34,34,34,.12); font-family: -apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif; color: #222; padding: 14px; }
        .title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
        .mode-badge { display: inline-block; font-size: 11px; font-weight: 600; background: #fff0e8; color: #c0392b; border-radius: 6px; padding: 2px 8px; margin-bottom: 10px; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px; }
        .card { background: #fff; border: 1px solid rgba(34,34,34,.08); border-radius: 10px; padding: 8px 10px; }
        .label { font-size: 11px; color: #666; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: 600; word-break: break-word; }
        .status { font-size: 12px; line-height: 1.5; background: #fff; border: 1px solid rgba(34,34,34,.08); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
        .buttons { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
        button { appearance: none; border: none; border-radius: 10px; padding: 10px 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: transform .12s ease,opacity .12s ease; }
        button:hover { transform: translateY(-1px); }
        button:disabled { opacity: .55; cursor: not-allowed; transform: none; }
        .primary { background: #ff2442; color: #fff; } .secondary { background: #222; color: #fff; } .ghost { background: #f3f3f0; color: #222; } .warn { background: #fff0df; color: #9f4c00; }
        .hint { font-size: 11px; line-height: 1.5; color: #666; margin-top: 10px; }
      </style>
      <div id="panel">
        <div class="title">小红书导出器</div>
        <div class="mode-badge" data-role="mode"></div>
        <div class="meta">
          <div class="card"><div class="label">条目数</div><div class="value" data-role="count">0</div></div>
          <div class="card"><div class="label">缺 token</div><div class="value" data-role="token-missing">0</div></div>
          <div class="card" style="grid-column:1 / -1"><div class="label">来源</div><div class="value" data-role="sources">尚未采集</div></div>
        </div>
        <div class="status" data-role="status"></div>
        <div class="buttons">
          <button class="primary" data-action="start">开始采集</button>
          <button class="secondary" data-action="stop">停止</button>
          <button class="ghost" data-action="scan">补扫首屏</button>
          <button class="ghost" data-action="export">导出 JSON</button>
          <button class="warn" data-action="reset" style="grid-column:1 / -1">清空本次结果</button>
        </div>
        <div class="hint">只接收已识别列表产生的 SSR、XHR 和 DOM 数据。切换列表会清空结果并要求重新开始。</div>
      </div>`;
    ui.host = host;
    ui.shadow = root;
    ui.countValue = root.querySelector('[data-role="count"]');
    ui.tokenValue = root.querySelector('[data-role="token-missing"]');
    ui.sourceValue = root.querySelector('[data-role="sources"]');
    ui.statusValue = root.querySelector('[data-role="status"]');
    ui.modeValue = root.querySelector('[data-role="mode"]');
    ui.startButton = root.querySelector('[data-action="start"]');
    ui.stopButton = root.querySelector('[data-action="stop"]');
    ui.exportButton = root.querySelector('[data-action="export"]');
    ui.resetButton = root.querySelector('[data-action="reset"]');
    ui.scanButton = root.querySelector('[data-action="scan"]');
    ui.startButton.addEventListener("click", startCollection);
    ui.stopButton.addEventListener("click", function handleStopClick() { stopCollection("已停止采集"); });
    ui.exportButton.addEventListener("click", exportResults);
    ui.resetButton.addEventListener("click", resetResults);
    ui.scanButton.addEventListener("click", requestInitialSnapshot);
    (document.body || document.documentElement).appendChild(host);
    render();
  }

  function render() {
    if (!ui.host) {
      return;
    }
    ui.countValue.textContent = String(state.items.size);
    ui.tokenValue.textContent = String(Core.countMissingTokens(state.items.values()));
    ui.sourceValue.textContent = summarizeSources();
    ui.statusValue.textContent = state.statusText;
    ui.modeValue.textContent = "模式：" + modeLabel();
    var supported = Boolean(state.context && state.context.supported);
    ui.startButton.disabled = state.running || !supported;
    ui.stopButton.disabled = !state.running;
    ui.scanButton.disabled = !supported;
    ui.exportButton.disabled = state.items.size === 0;
  }

  function summarizeSources() {
    var counts = {};
    state.items.forEach(function countItem(item) {
      (item.sources || []).forEach(function countSource(source) {
        counts[source] = (counts[source] || 0) + 1;
      });
    });
    var labels = { ssr: "SSR", xhr: "XHR", dom: "DOM", "feed-home": "首页", "feed-following": "关注" };
    var parts = Object.keys(labels).filter(function hasSource(source) {
      return counts[source] > 0;
    }).map(function formatSource(source) {
      return labels[source] + " " + counts[source];
    });
    return parts.length ? parts.join(" / ") : "尚未采集";
  }

  function stopTimer() {
    if (state.timerId) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }
  }

  function stopCollection(reason) {
    state.running = false;
    stopTimer();
    if (reason) {
      setStatus(reason);
    } else {
      render();
    }
  }

  function clearForContext(context, generation, reason) {
    stopTimer();
    state.running = false;
    state.items.clear();
    state.pageInfo = null;
    state.idleRounds = 0;
    state.lastNetworkAt = 0;
    state.lastDomScanAt = 0;
    state.context = context || null;
    state.generation = generation == null ? null : generation;
    setStatus(reason || Core.contextStatus(context));
  }

  function acceptPayload(payload) {
    if (!payload || !payload.context || !state.context) {
      return false;
    }
    return payload.generation === state.generation && payload.context.key === state.context.key;
  }

  function updateContext(payload) {
    var context = payload && payload.context;
    var generation = payload && payload.generation;
    var changed = !state.context || state.context.key !== (context && context.key) || state.generation !== generation;
    if (changed) {
      clearForContext(context, generation, context && context.supported
        ? "已切换到" + (Core.MODE_LABELS[context.mode] || context.mode) + "，结果已清空，请点击开始采集"
        : Core.contextStatus(context));
    } else {
      state.context = context;
      render();
    }
  }

  function mergeItems(items) {
    var result = Core.mergeRecordMap(state.items, items, new Date().toISOString());
    if (result.added > 0 || result.updated > 0) {
      render();
    }
    return result;
  }

  function isOverlayOpen() {
    return Boolean(document.querySelector(
      '[role="dialog"], .note-detail-mask, .note-detail-container, [data-xhs-overlay="true"]'
    ));
  }

  function updateOverlayState() {
    var open = isOverlayOpen();
    if (open === state.overlaySuspended) {
      return;
    }
    state.overlaySuspended = open;
    if (open) {
      stopTimer();
      if (state.running) {
        setStatus("详情浮层已打开，已暂停扫描和滚动");
      }
    } else if (state.running) {
      setStatus("详情浮层已关闭，继续采集");
      scheduleNextTick();
    }
  }

  function scanDomCards() {
    if (!state.context || !state.context.supported || state.overlaySuspended) {
      return { added: 0, updated: 0 };
    }
    var result = Core.collectDomItems(document, state.context, new Date().toISOString());
    state.lastDomScanAt = Date.now();
    if (result.skipped) {
      if (state.running) {
        setStatus(result.reason);
      }
      return { added: 0, updated: 0 };
    }
    return mergeItems(result.items);
  }

  function getScrollContainer() {
    var list = Core.findActiveList(document, state.context);
    if (!list) {
      return null;
    }
    var node = list;
    while (node && node !== document.body && node !== document.documentElement) {
      var style = window.getComputedStyle(node);
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 10) {
        return node;
      }
      node = node.parentElement;
    }
    var documentScroller = document.scrollingElement || document.documentElement || document.body;
    return documentScroller && documentScroller.scrollHeight > documentScroller.clientHeight + 10
      ? documentScroller
      : null;
  }

  function isNearBottom() {
    var scroller = getScrollContainer();
    return Boolean(scroller && Core.scrollMetrics(scroller, 120).near_bottom);
  }

  function scrollOnce() {
    var scroller = getScrollContainer();
    if (!scroller) {
      return;
    }
    var step = Math.max(480, Math.floor((scroller.clientHeight || window.innerHeight) * 0.82));
    scroller.scrollBy({ top: step, left: 0, behavior: "smooth" });
  }

  function requestInitialSnapshot() {
    if (!state.context || !state.context.supported) {
      setStatus(Core.contextStatus(state.context));
      return;
    }
    window.dispatchEvent(new CustomEvent(SCAN_EVENT));
    setStatus("已请求补扫首屏数据");
  }

  function scheduleNextTick() {
    stopTimer();
    if (!state.running || state.overlaySuspended) {
      return;
    }
    state.timerId = window.setTimeout(function collectTick() {
      if (!state.running || state.overlaySuspended) {
        return;
      }
      var before = state.items.size;
      scanDomCards();
      scrollOnce();
      state.timerId = window.setTimeout(function inspectAfterScroll() {
        if (!state.running || state.overlaySuspended) {
          return;
        }
        var result = scanDomCards();
        var after = state.items.size;
        var grew = result.added > 0 || result.updated > 0 || Date.now() - state.lastNetworkAt < AUTO_SCROLL_DELAY_MS;
        if (grew || after > before) {
          state.idleRounds = 0;
          setStatus("采集中，已收集 " + after + " 条");
        } else {
          state.idleRounds += 1;
          setStatus("滚动中，最近没有新增数据（连续 " + state.idleRounds + " 轮）");
        }
        if (isNearBottom() && state.pageInfo && state.pageInfo.has_more === false) {
          stopCollection("已确认没有更多页面，自动停止");
          return;
        }
        if (state.idleRounds >= MAX_IDLE_ROUNDS && isNearBottom()) {
          stopCollection("已停止：滚动到底但分页状态未知，未宣称采集完成");
          return;
        }
        scheduleNextTick();
      }, AUTO_SCROLL_DELAY_MS);
    }, 120);
  }

  function startCollection() {
    if (state.running) {
      return;
    }
    if (!state.context || !state.context.supported) {
      setStatus(Core.contextStatus(state.context));
      return;
    }
    state.running = true;
    state.idleRounds = 0;
    updateOverlayState();
    scanDomCards();
    requestInitialSnapshot();
    setStatus("开始采集，准备滚动页面");
    scheduleNextTick();
  }

  function resetResults() {
    stopTimer();
    state.running = false;
    state.items.clear();
    state.pageInfo = null;
    state.idleRounds = 0;
    state.lastNetworkAt = 0;
    state.lastDomScanAt = 0;
    setStatus("已清空本次结果");
  }

  function exportResults() {
    if (state.items.size === 0) {
      setStatus("当前没有可导出的结果");
      return;
    }
    var payload = Core.serializeExport({
      context: state.context,
      items: state.items.values(),
      page_info: state.pageInfo
    });
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "xhs-" + (state.context.mode || "collection") + "-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    anchor.style.display = "none";
    document.documentElement.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("已导出 " + payload.total_items + " 条");
  }

  function handleBridgeMessage(event) {
    if (event.source !== window || !event.data || event.data.source !== BRIDGE_SOURCE) {
      return;
    }
    var type = event.data.type;
    var payload = event.data.payload || {};
    if (type === "CONTEXT_CHANGED" || type === "BRIDGE_READY") {
      updateContext(payload);
      state.bridgeReady = true;
      if (type === "BRIDGE_READY" && state.context && state.context.supported) {
        setStatus("页面适配器已就绪：" + modeLabel());
      }
      return;
    }
    if (!acceptPayload(payload)) {
      return;
    }
    if (type === "INITIAL_SNAPSHOT") {
      state.pageInfo = Core.mergePageInfo(state.pageInfo, payload.page);
      mergeItems(payload.items || []);
      setStatus("已拿到首屏数据，目前 " + state.items.size + " 条");
      return;
    }
    if (type === "COLLECT_PAGE" || type === "FEED_PAGE") {
      state.lastNetworkAt = Date.now();
      state.pageInfo = Core.mergePageInfo(state.pageInfo, payload.page);
      mergeItems(payload.items || []);
      setStatus("已捕获分页数据，目前 " + state.items.size + " 条");
      return;
    }
    if (type === "COLLECTION_ERROR") {
      var detail = payload.status ? "（" + payload.status + "）" : "";
      stopCollection("分页失败" + detail + "：" + (payload.message || "请检查页面状态后重试"));
    }
  }

  function bootstrap() {
    if (!Core) {
      state.statusText = "导出器核心适配器未加载";
      return;
    }
    window.addEventListener("message", handleBridgeMessage, false);
    ensurePanel();
    if (typeof MutationObserver === "function") {
      new MutationObserver(updateOverlayState).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    }
    injectPageBridge();
    updateOverlayState();
  }

  bootstrap();
})();
