(function () {
  if (!isRuntimeAvailable()) return;
  const I18N = window.ArxivMateI18n;
  const PANEL_LAYOUT_STORAGE_KEY = "panelLayout";
  const embeddedPanelPaper = readEmbeddedPanelPaper();
  const isEmbeddedPanel = Boolean(embeddedPanelPaper);
  let paper = embeddedPanelPaper || extractPaper();
  if (!isEmbeddedPanel && !isSupportedReadingPage(paper)) return;
  if (!paper.id) paper = ensureDocumentIdentity(paper);
  if (!paper.id && !paper.title) return;

  removeExistingArxivMateRoots();

  if (!isEmbeddedPanel && isPdfPage()) {
    installIframePanel(paper);
    return;
  }

  let currentConversation = null;
  let currentResult = "";
  let currentMode = "quick";
  let isPanelOpen = false;
  let currentSettings = null;
  let lastKnownModelProfiles = [];
  let selectedProfileId = "";
  let selectedModelLabel = "";
  let renderTimer = 0;
  let activeStreamCancel = null;
  let isGenerating = false;
  let settingsRefreshPromise = null;
  let activeAppearance = "system";
  let currentLanguage = "system";
  let systemAppearanceQuery = null;
  let systemAppearanceListenerInstalled = false;
  let panelLayout = getDefaultPanelLayout();
  let panelLayoutSaveTimer = 0;
  let embeddedLayoutMode = "dock";

  const host = document.createElement("div");
  host.id = "arxiv-llm-companion-root";
  host.dataset.extensionId = chrome.runtime.id || "";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);
  if (!isEmbeddedPanel) {
    installPageSplitStyles();
  }

  const mathStyle = document.createElement("link");
  mathStyle.rel = "stylesheet";
  mathStyle.href = runtimeUrl("vendor/katex/katex.min.css");
  shadow.appendChild(mathStyle);

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = runtimeUrl("content.css");
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = `
    <button class="alc-fab" type="button" title="arXivMate">AI</button>
    <section class="alc-panel" aria-label="arXivMate">
      <header class="alc-header">
        <div class="alc-title-block">
          <div class="alc-kicker">arXivMate</div>
          <h2></h2>
          <div class="alc-meta"></div>
        </div>
        <div class="alc-header-actions">
          <button class="alc-icon-button alc-layout-toggle" type="button" title="浮动窗口" data-i18n-title="floatPanel">⇱</button>
          <button class="alc-icon-button alc-restore-layout" type="button" title="还原尺寸" data-i18n-title="restorePanel">↺</button>
          <button class="alc-icon-button alc-close" type="button" title="折叠分屏" data-i18n-title="closeSplit">×</button>
        </div>
      </header>

      <div class="alc-toolbar">
        <div class="alc-shortcuts">
          <button data-mode="quick" type="button" data-i18n="quick">速览</button>
          <button data-mode="deep" type="button" data-i18n="deep">深读</button>
          <button data-mode="study" type="button" data-i18n="study">学习卡</button>
        </div>
        <div class="alc-tools">
          <label class="alc-model-picker">
            <span data-i18n="chatModel">模型</span>
            <select class="alc-model-select" title="切换当前聊天模型" data-i18n-title="switchChatModel"></select>
          </label>
          <label class="alc-toggle" title="聊天会优先抽取 PDF/正文全文；arXiv 页面失败时可再尝试 ar5iv，速度会慢一些" data-i18n-title="fullTextTitle">
            <input class="alc-fulltext" type="checkbox" checked disabled>
            <span data-i18n="fullText">全文</span>
          </label>
          <button class="alc-copy" type="button" title="复制 Markdown" data-i18n="copy" data-i18n-title="copyMarkdown">复制</button>
          <button class="alc-save" type="button" title="保存最后一条回答" data-i18n="save" data-i18n-title="saveLastAnswer">保存</button>
          <button class="alc-review" type="button" title="打开复盘库" data-i18n="history" data-i18n-title="openReview">历史</button>
          <button class="alc-clear-chat" type="button" title="清空本篇对话" data-i18n="clear" data-i18n-title="clearChat">清空</button>
          <button class="alc-options" type="button" title="设置" data-i18n="settings" data-i18n-title="settings">设置</button>
        </div>
      </div>

      <div class="alc-chat-shell">
        <div class="alc-update-banner" hidden></div>
        <div class="alc-chat" role="log" aria-live="polite"></div>
      </div>

      <footer class="alc-composer">
        <textarea rows="1" placeholder="问这篇论文：方法假设、实验设计、局限、和你的方向有什么关系..." data-i18n-placeholder="askPlaceholder"></textarea>
        <button class="alc-send" data-mode="ask" type="button" data-i18n="send">发送</button>
      </footer>
      <div class="alc-status" role="status"></div>
      <div class="alc-resize-edge" title="拖拽调整面板宽度" data-i18n-title="resizePanel" aria-hidden="true"></div>
      <div class="alc-resize-corner" title="拖拽调整浮动窗口大小" data-i18n-title="resizeFloatingPanel" aria-hidden="true"></div>
    </section>
  `;
  shadow.appendChild(wrapper);

  const $ = (selector) => shadow.querySelector(selector);
  const fab = $(".alc-fab");
  const panel = $(".alc-panel");
  const panelHeader = $(".alc-header");
  const title = $("h2");
  const meta = $(".alc-meta");
  const input = $(".alc-composer textarea");
  const status = $(".alc-status");
  const chat = $(".alc-chat");
  const updateBanner = $(".alc-update-banner");
  const fullTextToggle = $(".alc-fulltext");
  const modelSelect = $(".alc-model-select");
  const sendButton = $(".alc-send");
  const layoutToggleButton = $(".alc-layout-toggle");
  const restoreLayoutButton = $(".alc-restore-layout");
  const resizeEdge = $(".alc-resize-edge");
  const resizeCorner = $(".alc-resize-corner");
  fullTextToggle.checked = true;
  fullTextToggle.disabled = true;

  applyLanguage(currentLanguage);
  installPanelEventGuards();
  installPanelLayoutControls();
  installSettingsChangeListener();

  renderPaperHeader();

  if (isEmbeddedPanel) {
    isPanelOpen = true;
    panel.classList.add("is-open", "is-embedded");
    fab.remove();
  } else {
    fab.addEventListener("click", () => togglePanel(true));
  }
  onClick(".alc-close", () => {
    if (isEmbeddedPanel) {
      parent.postMessage({ type: "alc-close-panel" }, "*");
      return;
    }
    togglePanel(false);
  });
  onClick(".alc-options", () => safeSendRuntimeMessage({ type: "openOptions" }));
  onClick(".alc-review", () => safeSendRuntimeMessage({ type: "openReview" }));
  onClick(".alc-copy", copyCurrentMarkdown);
  onClick(".alc-save", saveCurrentNote);
  onClick(".alc-clear-chat", clearCurrentConversation);
  onClick(".alc-layout-toggle", togglePanelLayoutMode);
  onClick(".alc-restore-layout", restorePanelLayout);
  modelSelect.addEventListener("change", switchChatModel);
  modelSelect.addEventListener("pointerdown", () => {
    forceRefreshSettingsFromLocal().catch(() => {});
  });
  modelSelect.addEventListener("focus", () => {
    forceRefreshSettingsFromLocal().catch(() => {});
  });

  shadow.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.classList.contains("alc-send") && isGenerating) {
        stopCurrentGeneration();
        return;
      }
      runTurn(button.dataset.mode);
    });
  });
  if (!isEmbeddedPanel) {
    window.addEventListener("resize", () => {
      panelLayout = normalizePanelLayout(panelLayout);
      applyPanelLayout(false);
    });
  }
  window.addEventListener("focus", () => {
    if (isPanelOpen) refreshSettings({ silent: true }).catch(() => {});
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && isPanelOpen) refreshSettings({ silent: true }).catch(() => {});
  });

  input.addEventListener("input", autoResizeInput);
  input.addEventListener("pointerdown", () => {
    setTimeout(() => input.focus(), 0);
  });
  input.addEventListener("click", () => {
    setTimeout(() => input.focus(), 0);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (isGenerating) {
        stopCurrentGeneration();
        return;
      }
      runTurn("ask");
      return;
    }
    scheduleKeyboardFallback(event);
  });

  loadInitialState();
  hydratePaperMetadata();

  function togglePanel(force) {
    isPanelOpen = typeof force === "boolean" ? force : !isPanelOpen;
    panel.classList.toggle("is-open", isPanelOpen);
    fab.classList.toggle("is-hidden", isPanelOpen);
    applyPanelLayout(false);
    if (isPanelOpen) {
      refreshSettings({ silent: true }).catch(() => {});
      renderConversation(currentConversation);
      setTimeout(() => input.focus(), 40);
    }
  }

  function onClick(selector, handler) {
    const node = $(selector);
    if (!node) return;
    node.addEventListener("click", (event) => {
      try {
        const result = handler(event);
        if (result && typeof result.catch === "function") {
          result.catch(showExtensionReloadNotice);
        }
      } catch (error) {
        showExtensionReloadNotice(error);
      }
    });
  }

  function applyPageSplit(open) {
    if (isEmbeddedPanel) return;
    panelLayout = normalizePanelLayout(panelLayout);
    const width = panelLayout.dockWidth;
    document.documentElement.style.setProperty("--alc-split-width", `${width}px`);
    document.documentElement.classList.toggle("alc-page-split-active", Boolean(open && panelLayout.mode !== "float"));
  }

  async function loadPanelLayout() {
    panelLayout = getDefaultPanelLayout();
    if (isEmbeddedPanel) {
      parent.postMessage({ type: "alc-request-layout" }, "*");
      applyEmbeddedPanelLayout();
      return;
    }
    try {
      const stored = await readStorageArea("local", PANEL_LAYOUT_STORAGE_KEY);
      panelLayout = normalizePanelLayout(stored?.[PANEL_LAYOUT_STORAGE_KEY]);
    } catch {
      panelLayout = getDefaultPanelLayout();
    }
    applyPanelLayout(false);
  }

  function installPanelLayoutControls() {
    resizeEdge?.addEventListener("pointerdown", startPanelResize);
    resizeCorner?.addEventListener("pointerdown", startPanelResize);
    panelHeader?.addEventListener("pointerdown", startPanelDrag);
    if (!isEmbeddedPanel) return;
    window.addEventListener("message", (event) => {
      if (event.source !== parent) return;
      if (event.data?.type !== "alc-panel-layout") return;
      embeddedLayoutMode = event.data.layout?.mode === "float" ? "float" : "dock";
      applyEmbeddedPanelLayout();
    });
  }

  function togglePanelLayoutMode() {
    if (isEmbeddedPanel) {
      parent.postMessage({ type: "alc-toggle-layout" }, "*");
      return;
    }
    panelLayout = normalizePanelLayout({
      ...panelLayout,
      mode: panelLayout.mode === "float" ? "dock" : "float"
    });
    applyPanelLayout(true);
  }

  function restorePanelLayout() {
    if (isEmbeddedPanel) {
      parent.postMessage({ type: "alc-restore-layout" }, "*");
      return;
    }
    panelLayout = getDefaultPanelLayout();
    applyPanelLayout(true);
  }

  function applyPanelLayout(shouldSave) {
    if (isEmbeddedPanel) {
      applyEmbeddedPanelLayout();
      return;
    }
    panelLayout = normalizePanelLayout(panelLayout);
    const floating = panelLayout.mode === "float";
    panel.classList.toggle("is-floating", floating);
    panel.style.setProperty("--alc-split-width", `${panelLayout.dockWidth}px`);
    panel.style.setProperty("--alc-float-width", `${panelLayout.floatWidth}px`);
    panel.style.setProperty("--alc-float-height", `${panelLayout.floatHeight}px`);
    panel.style.setProperty("--alc-float-top", `${panelLayout.floatTop}px`);
    panel.style.setProperty("--alc-float-right", `${panelLayout.floatRight}px`);
    applyPageSplit(isPanelOpen);
    updateLayoutButtons(floating);
    if (shouldSave) savePanelLayout();
  }

  function applyEmbeddedPanelLayout() {
    const floating = embeddedLayoutMode === "float";
    panel.classList.toggle("is-floating", floating);
    updateLayoutButtons(floating);
  }

  function updateLayoutButtons(floating) {
    if (layoutToggleButton) {
      layoutToggleButton.textContent = floating ? "▣" : "⇱";
      layoutToggleButton.dataset.i18nTitle = floating ? "dockPanel" : "floatPanel";
      layoutToggleButton.title = t(floating ? "dockPanel" : "floatPanel");
      layoutToggleButton.setAttribute("aria-pressed", floating ? "true" : "false");
    }
    if (restoreLayoutButton) {
      restoreLayoutButton.title = t("restorePanel");
    }
  }

  function savePanelLayout() {
    if (isEmbeddedPanel) return;
    clearTimeout(panelLayoutSaveTimer);
    panelLayoutSaveTimer = setTimeout(() => {
      try {
        chrome.storage?.local?.set({ [PANEL_LAYOUT_STORAGE_KEY]: panelLayout });
      } catch {
        // Layout persistence is best-effort; the panel still works for the current page.
      }
    }, 120);
  }

  function startPanelResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    if (isEmbeddedPanel) {
      const kind = panel.classList.contains("is-floating") || event.currentTarget?.classList.contains("alc-resize-corner")
        ? "corner"
        : "edge";
      postEmbeddedPointerGesture(event, "alc-resize", { kind });
      return;
    }
    const floating = panelLayout.mode === "float" || event.currentTarget?.classList.contains("alc-resize-corner");
    const start = {
      x: event.clientX,
      y: event.clientY,
      layout: { ...panelLayout },
      floating
    };
    panel.classList.add("is-resizing");
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    const onMove = (moveEvent) => {
      if (floating) {
        panelLayout = normalizePanelLayout({
          ...start.layout,
          mode: "float",
          floatWidth: start.layout.floatWidth + (start.x - moveEvent.clientX),
          floatHeight: start.layout.floatHeight + (moveEvent.clientY - start.y)
        });
      } else {
        panelLayout = normalizePanelLayout({
          ...start.layout,
          dockWidth: start.layout.dockWidth + (start.x - moveEvent.clientX)
        });
      }
      applyPanelLayout(false);
    };
    const onUp = () => {
      panel.classList.remove("is-resizing");
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      savePanelLayout();
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  }

  function startPanelDrag(event) {
    if (event.button !== 0) return;
    if (event.target?.closest?.("button, select, textarea, input, a")) return;
    if (!panel.classList.contains("is-floating")) return;
    event.preventDefault();
    if (isEmbeddedPanel) {
      postEmbeddedPointerGesture(event, "alc-drag");
      return;
    }
    const start = {
      x: event.clientX,
      y: event.clientY,
      layout: { ...panelLayout }
    };
    panel.classList.add("is-dragging");
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    const onMove = (moveEvent) => {
      panelLayout = normalizePanelLayout({
        ...start.layout,
        floatTop: start.layout.floatTop + (moveEvent.clientY - start.y),
        floatRight: start.layout.floatRight - (moveEvent.clientX - start.x)
      });
      applyPanelLayout(false);
    };
    const onUp = () => {
      panel.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      savePanelLayout();
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  }

  function postEmbeddedPointerGesture(event, action, extra = {}) {
    const pointerId = event.pointerId;
    const post = (type, pointerEvent) => {
      parent.postMessage({
        type,
        pointerId,
        screenX: pointerEvent.screenX,
        screenY: pointerEvent.screenY,
        ...extra
      }, "*");
    };
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      post(`${action}-move`, moveEvent);
    };
    const onUp = (upEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      post(`${action}-end`, upEvent);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
    event.currentTarget?.setPointerCapture?.(pointerId);
    post(`${action}-start`, event);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  }

  function installPageSplitStyles() {
    if (document.getElementById("arxiv-llm-companion-page-style")) return;
    const node = document.createElement("style");
    node.id = "arxiv-llm-companion-page-style";
    node.textContent = `
      html.alc-page-split-active {
        margin-right: var(--alc-split-width, 460px) !important;
        transition: margin-right 160ms ease;
      }
      html.alc-page-split-active body {
        width: calc(100vw - var(--alc-split-width, 460px)) !important;
        max-width: 100% !important;
        overflow-x: auto !important;
      }
      html.alc-page-split-active embed[type="application/pdf"],
      html.alc-page-split-active pdf-viewer {
        width: calc(100vw - var(--alc-split-width, 460px)) !important;
        max-width: calc(100vw - var(--alc-split-width, 460px)) !important;
      }
      @media (max-width: 900px) {
        html.alc-page-split-active {
          margin-right: 0 !important;
        }
        html.alc-page-split-active body,
        html.alc-page-split-active embed[type="application/pdf"],
        html.alc-page-split-active pdf-viewer {
          width: 100vw !important;
          max-width: 100vw !important;
        }
      }
    `;
    document.documentElement.appendChild(node);
  }

  function removeExistingArxivMateRoots() {
    document.getElementById("arxiv-llm-companion-root")?.remove();
    document.getElementById("arxiv-llm-companion-frame-root")?.remove();
    document.documentElement.classList.remove("alc-page-split-active");
  }

  function renderPaperHeader() {
    title.textContent = displayPaperTitle(paper);
    meta.textContent = buildPaperMeta(paper);
  }

  async function hydratePaperMetadata() {
    if (!paper.id || hasUsefulPaperMetadata(paper)) return;
    try {
      const enriched = await fetchAbsPaperMetadata(paper.id);
      if (!enriched) return;
      paper = {
        ...paper,
        ...Object.fromEntries(
          Object.entries(enriched).filter(([, value]) => clean(value))
        ),
        pdfUrl: paper.pdfUrl || enriched.pdfUrl
      };
      renderPaperHeader();
    } catch {
      // Metadata enrichment is best-effort; the PDF text path still works with the arXiv ID.
    }
  }

  function installPanelEventGuards() {
    const guardedEvents = [
      "keydown",
      "keyup",
      "keypress",
      "beforeinput",
      "input",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "paste",
      "copy",
      "cut",
      "pointerdown",
      "pointerup",
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
      "wheel",
      "touchstart",
      "touchmove"
    ];

    for (const type of guardedEvents) {
      shadow.addEventListener(type, guardPanelEvent, false);
      host.addEventListener(type, guardPanelEvent, false);
    }
  }

  function guardPanelEvent(event) {
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (!path.includes(host)) return;

    if (isTextInputEvent(event) && path.includes(input)) {
      if (event.type === "keydown" && event.key === "Enter" && !event.shiftKey && !event.isComposing && !event.defaultPrevented) {
        event.preventDefault();
        runTurn("ask");
      }
      setTimeout(autoResizeInput, 0);
    }

    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function scheduleKeyboardFallback(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!isManualEditableKey(event)) return;

    const before = {
      value: input.value,
      start: input.selectionStart,
      end: input.selectionEnd
    };

    setTimeout(() => {
      if (document.activeElement !== input && shadow.activeElement !== input) return;
      const unchanged = input.value === before.value &&
        input.selectionStart === before.start &&
        input.selectionEnd === before.end;
      if (!unchanged) return;
      applyManualKey(event, before);
    }, 0);
  }

  function isManualEditableKey(event) {
    return event.key.length === 1 ||
      event.key === "Backspace" ||
      event.key === "Delete" ||
      event.key === "Enter" ||
      event.key === "Tab";
  }

  function applyManualKey(event, before) {
    let text = "";
    let start = before.start;
    let end = before.end;

    if (event.key.length === 1) {
      text = event.key;
    } else if (event.key === "Enter") {
      text = "\n";
    } else if (event.key === "Tab") {
      text = "  ";
    } else if (event.key === "Backspace") {
      if (start === end && start > 0) start -= 1;
    } else if (event.key === "Delete") {
      if (start === end && end < before.value.length) end += 1;
    } else {
      return;
    }

    input.setSelectionRange(start, end);
    input.setRangeText(text, start, end, "end");
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      composed: true,
      inputType: text ? "insertText" : "deleteContentBackward",
      data: text || null
    }));
    autoResizeInput();
  }

  function isTextInputEvent(event) {
    return [
      "keydown",
      "keyup",
      "keypress",
      "beforeinput",
      "input",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "paste",
      "cut"
    ].includes(event.type);
  }

  async function runTurn(mode) {
    if (isGenerating) return;
    await refreshSettings({ silent: true });
    if (!getSelectedProfile()) {
      setStatus(t("noModelSelected"), true);
      renderModelSelect();
      return;
    }
    const userText = mode === "ask" ? input.value.trim() : modeToUserText(mode, currentLanguage);
    if (mode === "ask" && !userText) {
      setStatus(t("emptyQuestion"), true);
      return;
    }

    currentMode = mode;
    const contextMode = resolveTurnContextMode(mode);
    setBusy(true);
    setStatus(contextMode === "full" ? t("preparingFull") : t("preparingFast"));
    const preview = appendPreviewTurn(userText);
    if (mode === "ask") {
      input.value = "";
      autoResizeInput();
    }

    try {
      const paperPayload = await buildPaperPayloadForTurn(contextMode);
      if (paperPayload.fullText) {
        setStatus(`${t("preparingFull")} · ${t("pdfTextReady", { chars: formatTokenCount(paperPayload.fullText.length) })}`);
      } else if (paperPayload.contextSource) {
        setStatus(`${t("preparingFull")} · ${paperPayload.contextSource}`);
      }
      const response = await sendStreamMessage({
        type: "summarizePaper",
        paper: paperPayload,
        mode,
        question: userText,
        contextMode,
        profileId: selectedProfileId
      }, {
        onMeta(meta) {
          const source = meta?.source ? ` · ${meta.source}` : "";
          const usage = formatContextUsage(meta, currentLanguage);
          setStatus(`${t("generating")}${source}${usage ? ` · ${usage}` : ""}`);
        },
        onDelta(text) {
          updatePreviewAssistant(preview, text || t("generatedFallback"));
        }
      });
      currentResult = response.text;
      currentConversation = response.conversation || currentConversation;
      flushScheduledRender();
      renderConversation(currentConversation);
      const usage = formatContextUsage(response, currentLanguage);
      setStatus(`${t("done")} · ${response.source}${usage ? ` · ${usage}` : ""}`);
    } catch (error) {
      renderConversation(currentConversation);
      if (mode === "ask") input.value = userText;
      if (error?.name === "AbortError" || error?.message === "generation-aborted") {
        setStatus(t("generationStopped"));
      } else if (isExtensionContextInvalidated(error)) {
        showExtensionReloadNotice(error);
      } else {
        setStatus(error.message || String(error), true);
      }
    } finally {
      fullTextToggle.checked = true;
      setBusy(false);
      autoResizeInput();
    }
  }

  function flushScheduledRender() {
    if (!renderTimer) return;
    clearTimeout(renderTimer);
    renderTimer = 0;
  }

  async function loadInitialState() {
    await loadPanelLayout();
    const loaded = await refreshSettings({ silent: true });
    if (!loaded && !lastKnownModelProfiles.length) {
      currentSettings = null;
      selectedProfileId = "";
      selectedModelLabel = "";
      applyLanguage("system");
      applyAppearance("system");
      renderModelSelect();
      renderUpdateBanner();
    } else if (!loaded) {
      renderModelSelect();
      renderUpdateBanner();
    }
    await loadConversation();
  }

  function resolveTurnContextMode(mode) {
    if (["quick", "deep", "study", "ask"].includes(mode)) return "full";
    return "auto";
  }

  async function buildPaperPayloadForTurn(contextMode) {
    const payload = { ...paper };
    if (contextMode !== "full" || payload.fullText) return payload;
    const maxChars = Number(getSelectedProfile()?.maxContextChars || currentSettings?.maxContextChars || 14000);
    try {
      const text = await extractPdfTextInPage(payload.pdfUrl || payload.pageUrl || location.href, maxChars);
      if (text && text.length > 400) {
        payload.fullText = text;
        payload.contextSource = "浏览器页面 PDF.js 正文抽取 + 页面元数据";
      }
    } catch (error) {
      payload.contextSource = `浏览器页面 PDF 抽取失败：${error.message || String(error)}`;
    }
    return payload;
  }

  async function extractPdfTextInPage(pdfUrl, maxChars) {
    const pdfjs = window.pdfjsLib;
    if (!pdfjs?.getDocument) {
      throw new Error("前端 PDF.js 未加载，请重新加载扩展。");
    }
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = runtimeUrl("vendor/pdfjs/pdf.worker.js");
    }
    const url = clean(pdfUrl || location.href);
    if (!url) throw new Error("没有可读取的 PDF URL。");
    const charLimit = Math.max(4000, Number(maxChars) || 14000);
    const task = pdfjs.getDocument({
      url,
      httpHeaders: {
        Accept: "application/pdf,*/*;q=0.8"
      },
      withCredentials: true,
      rangeChunkSize: 262144,
      disableAutoFetch: true,
      disableStream: false,
      disableFontFace: true,
      disableWorker: true,
      useSystemFonts: true
    });
    const pdfDoc = await task.promise;
    const parts = [];
    const pageLimit = Math.min(pdfDoc.numPages, 80);
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => typeof item.str === "string" ? item.str : "")
        .filter(Boolean)
        .join(" ");
      if (pageText.trim()) {
        parts.push(`Page ${pageNumber}\n${pageText}`);
      }
      if (parts.join("\n\n").length >= charLimit) break;
    }
    try {
      await pdfDoc.destroy();
    } catch {}
    return normalizeTextBlock(parts.join("\n\n")).slice(0, charLimit);
  }

  function installSettingsChangeListener() {
    try {
      chrome.storage?.onChanged?.addListener((changes, areaName) => {
        handleStorageSettingsChange(changes, areaName);
      });
    } catch {
      // Storage listeners are optional; initial settings still cover normal page loads.
    }
    try {
      chrome.runtime?.onMessage?.addListener((message) => {
        if (message?.type !== "settingsChanged") return false;
        applySettingsSnapshot(message.settings, {
          allowEmptyProfiles: Array.isArray(message.settings?.modelProfiles)
        });
        showModelLoadStatus({ onlyWhenEmpty: false });
        return false;
      });
    } catch {
      // Runtime notifications are best-effort; focus/open refresh still covers normal use.
    }
  }

  function handleStorageSettingsChange(changes, areaName) {
    if (areaName !== "local" || (!changes.settings && !changes.modelProfiles)) return;
    const snapshot = buildSettingsSnapshotFromStorageChanges(changes);
    const allowEmptyProfiles = Boolean(changes.modelProfiles);
    if (getSettingsProfiles(snapshot).length) {
      applySettingsSnapshot(snapshot, { allowEmptyProfiles });
      showModelLoadStatus({ onlyWhenEmpty: false });
      return;
    }
    refreshSettings({ silent: true }).catch(() => {
      if (snapshot) applySettingsSnapshot(snapshot, { allowEmptyProfiles });
    });
  }

  function applyAppearance(value) {
    activeAppearance = normalizeAppearance(value);
    installSystemAppearanceListener();
    host.dataset.appearance = resolveAppearance(activeAppearance);
  }

  function installSystemAppearanceListener() {
    if (activeAppearance !== "system" || systemAppearanceListenerInstalled || !window.matchMedia) return;
    systemAppearanceQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (activeAppearance === "system") host.dataset.appearance = resolveAppearance(activeAppearance);
    };
    if (systemAppearanceQuery.addEventListener) {
      systemAppearanceQuery.addEventListener("change", update);
    } else if (systemAppearanceQuery.addListener) {
      systemAppearanceQuery.addListener(update);
    }
    systemAppearanceListenerInstalled = true;
  }

  function resolveAppearance(value) {
    const normalized = normalizeAppearance(value);
    if (normalized !== "system") return normalized;
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
  }

  function applyLanguage(value) {
    currentLanguage = normalizeLanguage(value);
    const resolved = I18N.resolveLanguage(currentLanguage);
    host.dataset.language = resolved;
    shadow.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    shadow.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.title = t(node.dataset.i18nTitle);
    });
    shadow.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
    renderPaperHeader();
    renderConversation(currentConversation);
    renderModelSelect();
  }

  function t(key, vars = {}) {
    return I18N.t(currentLanguage, key, vars);
  }

  function renderUpdateBanner() {
    window.ArxivMateUpdateBanner?.checkAndRender({
      container: updateBanner,
      language: currentLanguage,
      compact: true
    });
  }

  async function refreshSettings({ silent = true } = {}) {
    if (isGenerating) return true;
    if (settingsRefreshPromise) return settingsRefreshPromise;
    settingsRefreshPromise = readLatestSettings()
      .then((settings) => {
        if (!settings) throw new Error("No settings snapshot.");
        applySettingsSnapshot(settings);
        showModelLoadStatus({ onlyWhenEmpty: false });
        return true;
      })
      .catch((error) => {
        if (!silent) setStatus(error.message || String(error), true);
        return false;
      })
      .finally(() => {
        settingsRefreshPromise = null;
      });
    return settingsRefreshPromise;
  }

  async function forceRefreshSettingsFromLocal() {
    const localSettings = await readLocalSettings();
    if (getSettingsProfiles(localSettings).length) {
      applySettingsSnapshot(localSettings);
      showModelLoadStatus({ onlyWhenEmpty: false });
      return true;
    }
    return refreshSettings({ silent: true });
  }

  function applySettingsSnapshot(settings, options = {}) {
    currentSettings = mergeSettingsWithKnownProfiles(settings, options);
    reconcileSelectedProfile();
    selectedModelLabel = buildSelectedModelLabel();
    applyLanguage(currentSettings.language);
    applyAppearance(currentSettings.appearance);
    renderModelSelect();
    renderUpdateBanner();
  }

  async function readLatestSettings() {
    const [storedResult, runtimeResult] = await Promise.allSettled([
      readStoredSettingsSnapshot(),
      sendMessage({ type: "getSettings" })
    ]);
    const storedSettings = storedResult.status === "fulfilled" ? storedResult.value : null;
    if (getSettingsProfiles(storedSettings).length) return storedSettings;
    const runtimeSettings = runtimeResult.status === "fulfilled" ? runtimeResult.value : null;
    if (getSettingsProfiles(runtimeSettings).length) return runtimeSettings;
    return storedSettings || runtimeSettings;
  }

  function readLocalSettings() {
    return readStoredSettingsSnapshot();
  }

  async function readStoredSettingsSnapshot() {
    const [localItems, syncItems] = await Promise.all([
      readStorageArea("local", ["settings", "settingsMirror", "modelProfiles"]),
      readStorageArea("sync", "settings")
    ]);
    return mergeStoredSettingsCandidates(
      localItems?.settings,
      createProfilesSnapshotSettings(localItems?.modelProfiles, localItems?.settings),
      localItems?.settingsMirror,
      syncItems?.settings
    );
  }

  function readStorageArea(area, keys) {
    return new Promise((resolve) => {
      try {
        const storageArea = area === "sync" ? chrome.storage?.sync : chrome.storage?.local;
        if (!storageArea) {
          resolve(null);
          return;
        }
        storageArea.get(keys, (items) => {
          if (chrome.runtime?.lastError) {
            resolve(null);
            return;
          }
          resolve(items || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function mergeStoredSettingsCandidates(...candidates) {
    const snapshots = candidates.filter((candidate) => candidate && typeof candidate === "object");
    const primary = snapshots[0] || null;
    const profileSource = snapshots.find((candidate) => getSettingsProfiles(candidate).length);
    if (!profileSource) return primary;
    return {
      ...(primary || {}),
      ...profileSource,
      language: primary?.language || profileSource.language || "system",
      appearance: primary?.appearance || profileSource.appearance || "system",
      modelProfiles: getSettingsProfiles(profileSource)
    };
  }

  function createProfilesSnapshotSettings(modelProfiles, base = {}) {
    return Array.isArray(modelProfiles) && modelProfiles.length
      ? {
        ...(base || {}),
        modelProfiles
      }
      : null;
  }

  function getSettingsProfiles(settings) {
    return Array.isArray(settings?.modelProfiles)
      ? settings.modelProfiles.filter((profile) => profile && typeof profile === "object")
      : [];
  }

  function mergeSettingsWithKnownProfiles(settings, { allowEmptyProfiles = false } = {}) {
    const next = settings && typeof settings === "object" ? { ...settings } : {};
    const profiles = getSettingsProfiles(next);
    if (profiles.length) {
      lastKnownModelProfiles = profiles;
      next.modelProfiles = profiles;
      return next;
    }
    if (allowEmptyProfiles && Array.isArray(next.modelProfiles)) {
      lastKnownModelProfiles = [];
      next.modelProfiles = [];
      return next;
    }
    if (lastKnownModelProfiles.length) {
      next.modelProfiles = lastKnownModelProfiles;
    }
    return next;
  }

  function buildSettingsSnapshotFromStorageChanges(changes) {
    const settings = changes.settings?.newValue && typeof changes.settings.newValue === "object"
      ? changes.settings.newValue
      : currentSettings;
    const changedProfiles = Array.isArray(changes.modelProfiles?.newValue)
      ? changes.modelProfiles.newValue
      : [];
    if (changedProfiles.length) {
      return {
        ...(settings || {}),
        modelProfiles: changedProfiles
      };
    }
    return settings || null;
  }

  function renderModelSelect() {
    if (!modelSelect) return;
    const profiles = getRenderableProfiles();
    reconcileSelectedProfile();
    modelSelect.replaceChildren(...createModelOptions(profiles));
    modelSelect.disabled = isGenerating || profiles.length === 0;
    selectedModelLabel = buildSelectedModelLabel();
  }

  function createModelOptions(profiles) {
    if (!profiles.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = t("noModelProfilesShort");
      return [option];
    }
    return profiles.map((profile) => {
      const option = document.createElement("option");
      option.value = profile.id || "";
      option.selected = profile.id === selectedProfileId;
      option.textContent = formatProfileOption(profile);
      return option;
    });
  }

  function showModelLoadStatus({ onlyWhenEmpty = true } = {}) {
    const profiles = getRenderableProfiles();
    if (profiles.length) {
      if (!onlyWhenEmpty) {
        setStatus(t("modelProfilesLoaded", {
          count: profiles.length
        }));
      }
      return;
    }
    setStatus(t("modelProfilesMissing", {
      count: profiles.length
    }), true);
  }

  function switchChatModel(event) {
    const nextProfileId = event.target.value;
    if (!nextProfileId || nextProfileId === selectedProfileId) return;
    selectedProfileId = nextProfileId;
    selectedModelLabel = buildSelectedModelLabel();
    renderModelSelect();
    setStatus(t("modelSelected", { model: selectedProfileDisplayName() }));
  }

  function reconcileSelectedProfile() {
    const profiles = getRenderableProfiles();
    if (!profiles.length) {
      selectedProfileId = "";
      return;
    }
    if (!profiles.some((profile) => profile.id === selectedProfileId)) {
      selectedProfileId = profiles[0].id;
    }
  }

  function getSelectedProfile() {
    const profiles = getRenderableProfiles();
    return profiles.find((profile) => profile.id === selectedProfileId) || null;
  }

  function getRenderableProfiles() {
    const profiles = getSettingsProfiles(currentSettings);
    return profiles.length ? profiles : lastKnownModelProfiles;
  }

  function buildSelectedModelLabel() {
    const display = selectedProfileDisplayName();
    return display ? ` · ${display}` : "";
  }

  function selectedProfileDisplayName() {
    const profile = getSelectedProfile();
    return profile?.name || profile?.model || "";
  }

  function formatProfileOption(profile) {
    const name = profile.name || profile.model || t("untitledProfile");
    const model = profile.model && profile.model !== name ? ` · ${profile.model}` : "";
    return `${name}${model}`;
  }

  async function loadConversation() {
    try {
      currentConversation = await sendMessage({ type: "getConversation", id: paper.id });
      renderConversation(currentConversation);
      if (currentConversation?.messageCount) {
        currentResult = findLastAssistantText(currentConversation);
        setStatus(t("loadedHistory", { count: currentConversation.turnCount || 0, model: selectedModelLabel }));
      } else {
        setStatus(t("defaultModeHint", { model: selectedModelLabel }));
      }
    } catch (error) {
      setStatus(error.message || String(error), true);
    }
  }

  async function saveCurrentNote() {
    const latest = currentResult || findLastAssistantText(currentConversation);
    if (!latest) {
      setStatus(t("noAnswerToSave"), true);
      return;
    }
    setBusy(true);
    try {
      await sendMessage({
        type: "saveNote",
        paper,
        summary: latest,
        mode: currentMode
      });
      setStatus(t("savedToReview"));
    } catch (error) {
      setStatus(error.message || String(error), true);
    } finally {
      setBusy(false);
    }
  }

  async function copyCurrentMarkdown() {
    const markdown = buildMarkdownNote(paper, currentResult || findLastAssistantText(currentConversation), currentConversation);
    try {
      await navigator.clipboard.writeText(markdown);
      setStatus(t("copiedMarkdown"));
    } catch {
      setStatus(t("copyFailed"), true);
    }
  }

  async function clearCurrentConversation() {
    if (!currentConversation?.messageCount) {
      setStatus(t("noHistory"));
      return;
    }
    if (!confirm(t("confirmClear", { id: paper.id }))) return;
    setBusy(true);
    try {
      await sendMessage({ type: "clearConversation", id: paper.id });
      currentConversation = null;
      currentResult = "";
      renderConversation(null);
      setStatus(t("clearedHistory"));
    } catch (error) {
      setStatus(error.message || String(error), true);
    } finally {
      setBusy(false);
    }
  }

  function appendPreviewTurn(text) {
    const preview = {
      ...(currentConversation || {}),
      messages: [
        ...((currentConversation && currentConversation.messages) || []),
        {
          id: "preview-user",
          role: "user",
          text,
          createdAt: new Date().toISOString()
        },
        {
          id: "preview-assistant",
          role: "assistant",
          text: t("generatedFallback"),
          streaming: true,
          createdAt: new Date().toISOString()
        }
      ]
    };
    renderConversation(preview);
    return preview;
  }

  function updatePreviewAssistant(preview, text) {
    const messages = Array.isArray(preview?.messages) ? preview.messages : [];
    const assistant = messages.find((message) => message.id === "preview-assistant");
    if (!assistant) return;
    assistant.text = text;
    currentResult = text;
    scheduleConversationRender(preview);
  }

  function scheduleConversationRender(conversation) {
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = 0;
      renderConversation(conversation);
    }, 80);
  }

  function renderConversation(conversation) {
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    if (!messages.length) {
      chat.innerHTML = `
        <div class="alc-welcome">
          <strong>${escapeHtml(t("welcomeTitle"))}</strong>
          <p>${escapeHtml(t("welcomeBody"))}</p>
        </div>
      `;
      return;
    }

    chat.innerHTML = messages.map((message) => `
      <article class="alc-message alc-message-${message.role}${message.streaming ? " is-streaming" : ""}">
        <div class="alc-bubble">
          <div class="alc-message-meta">${message.role === "user" ? escapeHtml(t("you")) : "AI"} · ${formatTime(message.createdAt, currentLanguage)}${message.mode ? ` · ${escapeHtml(modeLabel(message.mode, currentLanguage))}` : ""}${message.role === "assistant" ? formatMessageUsageMeta(message, currentLanguage) : ""}</div>
          <div class="alc-message-body">${message.role === "assistant" ? markdownToHtml(message.text || "") : escapeHtml(message.text || "")}</div>
        </div>
      </article>
    `).join("");
    chat.scrollTop = chat.scrollHeight;
  }

  function setBusy(isBusy) {
    isGenerating = Boolean(isBusy);
    shadow.querySelectorAll("button, textarea, input, select").forEach((node) => {
      if (node.classList.contains("alc-close") || node.classList.contains("alc-fab")) return;
      if (node.classList.contains("alc-layout-toggle") || node.classList.contains("alc-restore-layout")) return;
      if (node.classList.contains("alc-fulltext")) {
        node.disabled = true;
        node.checked = true;
        return;
      }
      if (node.classList.contains("alc-review") || node.classList.contains("alc-copy")) return;
      if (node.classList.contains("alc-send")) {
        node.disabled = false;
        node.textContent = isBusy ? t("stop") : t("send");
        node.classList.toggle("is-stop", isBusy);
        return;
      }
      node.disabled = isBusy;
    });
    if (!isBusy) {
      activeStreamCancel = null;
      renderModelSelect();
      if (sendButton) {
        sendButton.textContent = t("send");
        sendButton.classList.remove("is-stop");
      }
    }
    panel.classList.toggle("is-busy", isBusy);
  }

  function setStatus(text, isError = false) {
    status.textContent = text || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function showExtensionReloadNotice(error) {
    const text = normalizeErrorMessage(error);
    if (isExtensionContextInvalidated(error)) {
      setBusy(false);
      setStatus(t("extensionReloaded"), true);
      return;
    }
    setStatus(text || t("extensionFailed"), true);
  }

  function safeSendRuntimeMessage(payload) {
    try {
      sendMessage(payload).catch(showExtensionReloadNotice);
    } catch (error) {
      showExtensionReloadNotice(error);
    }
  }

  function autoResizeInput() {
    input.style.height = "auto";
    input.style.height = `${Math.min(120, Math.max(38, input.scrollHeight))}px`;
  }

  function sendMessage(payload) {
    return new Promise((resolve, reject) => {
      if (!isRuntimeAvailable()) {
        reject(createExtensionContextError());
        return;
      }
      try {
        chrome.runtime.sendMessage(payload, (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error || "插件后台没有返回有效结果。"));
            return;
          }
          resolve(response.data);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function sendStreamMessage(payload, callbacks = {}) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let cancelled = false;
      let latestText = "";
      let port;
      const abort = () => {
        cancelled = true;
        if (!settled) {
          settled = true;
          reject(Object.assign(new Error("generation-aborted"), { name: "AbortError" }));
        }
        try {
          port?.disconnect();
        } catch {}
      };
      try {
        if (!isRuntimeAvailable()) throw createExtensionContextError();
        port = chrome.runtime.connect({ name: "alc-stream" });
        activeStreamCancel = abort;
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          reject(error);
          return;
        }
        let fallbackCancelled = false;
        activeStreamCancel = () => {
          fallbackCancelled = true;
          if (!settled) {
            settled = true;
            reject(Object.assign(new Error("generation-aborted"), { name: "AbortError" }));
          }
        };
        sendMessage(payload).then((data) => {
          if (fallbackCancelled) return;
          settled = true;
          activeStreamCancel = null;
          resolve(data);
        }, (sendError) => {
          if (fallbackCancelled) return;
          settled = true;
          activeStreamCancel = null;
          reject(sendError);
        });
        return;
      }

      port.onMessage.addListener((message) => {
        if (cancelled) return;
        if (message?.type === "meta") {
          callbacks.onMeta?.(message);
          return;
        }
        if (message?.type === "delta") {
          latestText = message.fullText || `${latestText}${message.text || ""}`;
          callbacks.onDelta?.(latestText);
          return;
        }
        if (message?.type === "done") {
          settled = true;
          activeStreamCancel = null;
          resolve(message.data);
          try {
            port.disconnect();
          } catch {}
          return;
        }
        if (message?.type === "error") {
          settled = true;
          activeStreamCancel = null;
          reject(new Error(message.error || "流式请求失败。"));
          try {
            port.disconnect();
          } catch {}
        }
      });

      port.onDisconnect.addListener(() => {
        if (cancelled) return;
        if (!settled) {
          reject(new Error(getRuntimeLastErrorMessage() || "流式连接已断开，请重试。"));
        }
      });

      try {
        port.postMessage({
          ...payload,
          type: "summarizePaperStream"
        });
      } catch (error) {
        activeStreamCancel = null;
        reject(error);
      }
    });
  }

  function stopCurrentGeneration() {
    if (!activeStreamCancel) return;
    activeStreamCancel();
    activeStreamCancel = null;
    flushScheduledRender();
    renderConversation(currentConversation);
    setBusy(false);
    setStatus(t("generationStopped"));
    input.focus();
  }

  function isPdfPage() {
    return isPdfLikeUrl(location.href) || Boolean(document.querySelector("embed[type='application/pdf'], pdf-viewer"));
  }

  function isSupportedReadingPage(value) {
    return Boolean(value?.id || isPdfPage());
  }

  function installIframePanel(paperData) {
    if (!isRuntimeAvailable()) return;
    removeExistingArxivMateRoots();
    installStandaloneSplitStyles();

    const root = document.createElement("div");
    root.id = "arxiv-llm-companion-frame-root";
    root.dataset.extensionId = chrome.runtime.id || "";
    const shadowRoot = root.attachShadow({ mode: "open" });
    document.documentElement.appendChild(root);

    const styleNode = document.createElement("style");
    styleNode.textContent = `
      .alc-frame-fab {
        position: fixed;
        right: 22px;
        bottom: 24px;
        z-index: 2147483647;
        width: 52px;
        height: 52px;
        border: 0;
        border-radius: 50%;
        background: #156f8f;
        color: #fff;
        font: 800 15px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 12px 28px rgba(15, 83, 107, 0.26);
        cursor: pointer;
      }
      .alc-frame {
        --alc-frame-panel: #fff;
        --alc-frame-line: #d9e0e6;
        --alc-frame-shadow: -8px 0 24px rgba(31, 35, 40, 0.16);
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483647;
        width: var(--alc-split-width, 460px);
        display: none;
        overflow: hidden;
        border-left: 1px solid var(--alc-frame-line);
        border-radius: 0;
        background: var(--alc-frame-panel);
        box-shadow: var(--alc-frame-shadow);
      }
      .alc-frame.is-floating {
        top: var(--alc-float-top, 72px);
        right: var(--alc-float-right, 24px);
        bottom: auto;
        width: var(--alc-float-width, 560px);
        height: var(--alc-float-height, 720px);
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 24px);
        border: 1px solid var(--alc-frame-line);
        border-radius: 8px;
        box-shadow: 0 16px 42px rgba(31, 35, 40, 0.22);
      }
      :host([data-appearance="dark"]) .alc-frame {
        --alc-frame-panel: #161a1f;
        --alc-frame-line: #303942;
        --alc-frame-shadow: -8px 0 24px rgba(0, 0, 0, 0.32);
      }
      :host([data-appearance="sepia"]) .alc-frame {
        --alc-frame-panel: #fffaf0;
        --alc-frame-line: #ded0b8;
        --alc-frame-shadow: -8px 0 24px rgba(70, 58, 42, 0.15);
      }
      .alc-frame.is-open {
        display: block;
      }
      .alc-frame iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: transparent;
      }
      .alc-frame-resize-edge,
      .alc-frame-resize-corner {
        position: absolute;
        z-index: 3;
        display: none;
        pointer-events: auto;
        touch-action: none;
      }
      .alc-frame.is-open .alc-frame-resize-edge,
      .alc-frame.is-open.is-floating .alc-frame-resize-corner {
        display: block;
      }
      .alc-frame-resize-edge {
        top: 0;
        bottom: 0;
        left: -5px;
        width: 10px;
        cursor: ew-resize;
      }
      .alc-frame-resize-corner {
        left: -7px;
        bottom: -7px;
        width: 18px;
        height: 18px;
        cursor: nesw-resize;
      }
      .alc-frame-resize-corner::after {
        content: "";
        position: absolute;
        left: 5px;
        bottom: 5px;
        width: 7px;
        height: 7px;
        border-left: 2px solid #66707a;
        border-bottom: 2px solid #66707a;
        opacity: 0.72;
      }
      .alc-frame.is-resizing,
      .alc-frame.is-dragging {
        transition: none;
        user-select: none;
      }
      .alc-frame-fab.is-hidden {
        display: none;
      }
      @media (max-width: 640px) {
        .alc-frame {
          width: min(100vw, var(--alc-split-width, 460px));
        }
      }
    `;

    const fabButton = document.createElement("button");
    fabButton.className = "alc-frame-fab";
    fabButton.type = "button";
    fabButton.textContent = "AI";
    fabButton.title = "arXivMate";

    const frameShell = document.createElement("section");
    frameShell.className = "alc-frame";
    frameShell.setAttribute("aria-label", "arXivMate");

    const frame = document.createElement("iframe");
    frame.allow = "clipboard-read; clipboard-write";
    frame.src = `${runtimeUrl("panel.html")}?paper=${encodeURIComponent(JSON.stringify(paperData))}`;
    frameShell.appendChild(frame);
    const frameResizeEdge = document.createElement("div");
    frameResizeEdge.className = "alc-frame-resize-edge";
    const frameResizeCorner = document.createElement("div");
    frameResizeCorner.className = "alc-frame-resize-corner";
    frameShell.append(frameResizeEdge, frameResizeCorner);

    shadowRoot.append(styleNode, fabButton, frameShell);
    let frameLayout = getDefaultPanelLayout();
    let activeFrameGesture = null;

    const loadFrameLayout = async () => {
      try {
        const stored = await readStorageArea("local", PANEL_LAYOUT_STORAGE_KEY);
        frameLayout = normalizePanelLayout(stored?.[PANEL_LAYOUT_STORAGE_KEY]);
      } catch {
        frameLayout = getDefaultPanelLayout();
      }
      applyFrameLayout(false);
    };
    loadFrameLayout();

    const applyFrameAppearance = (value) => {
      root.dataset.appearance = resolveFrameAppearance(value);
    };
    const loadFrameAppearance = async () => {
      try {
        const settings = await sendMessage({ type: "getSettings" });
        applyFrameAppearance(settings.appearance);
      } catch {
        applyFrameAppearance("system");
      }
    };
    applyFrameAppearance("system");
    loadFrameAppearance();
    try {
      chrome.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes.settings) return;
        applyFrameAppearance(changes.settings.newValue?.appearance);
      });
    } catch {
      // The iframe panel applies the saved appearance independently.
    }

    const openPanel = () => {
      frameLayout = normalizePanelLayout(frameLayout);
      frameShell.classList.add("is-open");
      fabButton.classList.add("is-hidden");
      applyFrameLayout(false);
      frame.focus();
      frame.contentWindow?.focus();
    };
    const closePanel = () => {
      document.documentElement.classList.remove("alc-page-split-active");
      frameShell.classList.remove("is-open");
      fabButton.classList.remove("is-hidden");
    };

    fabButton.addEventListener("click", openPanel);
    frameResizeEdge.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startFramePointerGesture(event, "resize", {
        kind: "edge",
        startX: event.screenX,
        startY: event.screenY
      });
    });
    frameResizeCorner.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startFramePointerGesture(event, "resize", {
        kind: "corner",
        startX: event.screenX,
        startY: event.screenY
      });
    });
    window.addEventListener("resize", () => {
      if (!frameShell.classList.contains("is-open")) return;
      frameLayout = normalizePanelLayout(frameLayout);
      applyFrameLayout(false);
    });
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === "alc-close-panel") closePanel();
      if (event.data?.type === "alc-request-layout") postFrameLayout();
      if (event.data?.type === "alc-toggle-layout") {
        frameLayout = normalizePanelLayout({
          ...frameLayout,
          mode: frameLayout.mode === "float" ? "dock" : "float"
        });
        applyFrameLayout(true);
      }
      if (event.data?.type === "alc-restore-layout") {
        frameLayout = getDefaultPanelLayout();
        applyFrameLayout(true);
      }
      if (event.data?.type === "alc-resize-start") {
        startFrameGesture("resize", {
          kind: event.data.kind === "corner" ? "corner" : "edge",
          startX: event.data.screenX,
          startY: event.data.screenY
        });
      }
      if (event.data?.type === "alc-drag-start") {
        startFrameGesture("drag", {
          startX: event.data.screenX,
          startY: event.data.screenY
        });
      }
      if (event.data?.type === "alc-resize-move" || event.data?.type === "alc-drag-move") {
        updateFrameGesture(event.data.screenX, event.data.screenY);
      }
      if (event.data?.type === "alc-resize-end" || event.data?.type === "alc-drag-end") {
        endFrameGesture(event.data.screenX, event.data.screenY);
      }
    });

    function applyFrameLayout(shouldSave) {
      frameLayout = normalizePanelLayout(frameLayout);
      const floating = frameLayout.mode === "float";
      document.documentElement.style.setProperty("--alc-split-width", `${frameLayout.dockWidth}px`);
      document.documentElement.classList.toggle("alc-page-split-active", frameShell.classList.contains("is-open") && !floating);
      frameShell.classList.toggle("is-floating", floating);
      frameShell.style.setProperty("--alc-split-width", `${frameLayout.dockWidth}px`);
      frameShell.style.setProperty("--alc-float-width", `${frameLayout.floatWidth}px`);
      frameShell.style.setProperty("--alc-float-height", `${frameLayout.floatHeight}px`);
      frameShell.style.setProperty("--alc-float-top", `${frameLayout.floatTop}px`);
      frameShell.style.setProperty("--alc-float-right", `${frameLayout.floatRight}px`);
      postFrameLayout();
      if (shouldSave) {
        try {
          chrome.storage?.local?.set({ [PANEL_LAYOUT_STORAGE_KEY]: frameLayout });
        } catch {
          // Layout persistence is best-effort.
        }
      }
    }

    function postFrameLayout() {
      try {
        frame.contentWindow?.postMessage({
          type: "alc-panel-layout",
          layout: {
            mode: frameLayout.mode
          }
        }, "*");
      } catch {
        // The iframe may still be loading.
      }
    }

    function startFrameGesture(kind, data) {
      frameLayout = normalizePanelLayout(frameLayout);
      activeFrameGesture = {
        kind,
        resizeKind: data.kind || "edge",
        startX: Number(data.startX) || 0,
        startY: Number(data.startY) || 0,
        layout: { ...frameLayout }
      };
      frameShell.classList.toggle("is-resizing", kind === "resize");
      frameShell.classList.toggle("is-dragging", kind === "drag");
    }

    function startFramePointerGesture(event, kind, data) {
      startFrameGesture(kind, data);
      const pointerId = event.pointerId;
      event.currentTarget?.setPointerCapture?.(pointerId);
      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        updateFrameGesture(moveEvent.screenX, moveEvent.screenY);
      };
      const onUp = (upEvent) => {
        if (upEvent.pointerId === pointerId) {
          endFrameGesture(upEvent.screenX, upEvent.screenY);
        }
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        document.removeEventListener("pointercancel", onUp, true);
      };
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("pointercancel", onUp, true);
    }

    function updateFrameGesture(screenX, screenY) {
      if (!activeFrameGesture) return;
      const x = Number(screenX) || activeFrameGesture.startX;
      const y = Number(screenY) || activeFrameGesture.startY;
      const dx = x - activeFrameGesture.startX;
      const dy = y - activeFrameGesture.startY;
      const base = activeFrameGesture.layout;
      if (activeFrameGesture.kind === "drag") {
        frameLayout = normalizePanelLayout({
          ...base,
          mode: "float",
          floatTop: base.floatTop + dy,
          floatRight: base.floatRight - dx
        });
      } else if (activeFrameGesture.resizeKind === "corner" || base.mode === "float") {
        frameLayout = normalizePanelLayout({
          ...base,
          mode: "float",
          floatWidth: base.floatWidth - dx,
          floatHeight: base.floatHeight + dy
        });
      } else {
        frameLayout = normalizePanelLayout({
          ...base,
          dockWidth: base.dockWidth - dx
        });
      }
      applyFrameLayout(false);
    }

    function endFrameGesture(screenX, screenY) {
      if (activeFrameGesture) updateFrameGesture(screenX, screenY);
      activeFrameGesture = null;
      frameShell.classList.remove("is-resizing", "is-dragging");
      applyFrameLayout(true);
    }
  }
})();

function installStandaloneSplitStyles() {
  if (document.getElementById("arxiv-llm-companion-page-style")) return;
  const node = document.createElement("style");
  node.id = "arxiv-llm-companion-page-style";
  node.textContent = `
    html.alc-page-split-active {
      margin-right: var(--alc-split-width, 460px) !important;
      transition: margin-right 160ms ease;
    }
    html.alc-page-split-active body {
      width: calc(100vw - var(--alc-split-width, 460px)) !important;
      max-width: 100% !important;
      overflow-x: auto !important;
    }
    html.alc-page-split-active embed[type="application/pdf"],
    html.alc-page-split-active pdf-viewer {
      width: calc(100vw - var(--alc-split-width, 460px)) !important;
      max-width: calc(100vw - var(--alc-split-width, 460px)) !important;
    }
    @media (max-width: 900px) {
      html.alc-page-split-active {
        margin-right: 0 !important;
      }
      html.alc-page-split-active body,
      html.alc-page-split-active embed[type="application/pdf"],
      html.alc-page-split-active pdf-viewer {
        width: 100vw !important;
        max-width: 100vw !important;
      }
    }
  `;
  document.documentElement.appendChild(node);
}

function getSplitPanelWidth() {
  const width = Math.round(Math.min(500, Math.max(420, window.innerWidth * 0.34)));
  return window.innerWidth <= 900 ? Math.min(window.innerWidth, 460) : width;
}

function getDefaultPanelLayout() {
  return normalizePanelLayout({
    mode: "dock",
    dockWidth: getSplitPanelWidth(),
    floatWidth: Math.round(Math.min(680, Math.max(520, window.innerWidth * 0.42))),
    floatHeight: Math.round(Math.min(760, Math.max(520, window.innerHeight * 0.78))),
    floatTop: 64,
    floatRight: 24
  });
}

function normalizePanelLayout(value = {}) {
  const viewportWidth = Math.max(320, window.innerWidth || 1280);
  const viewportHeight = Math.max(320, window.innerHeight || 900);
  const maxDockWidth = Math.max(360, Math.min(860, viewportWidth - 260));
  const dockWidth = clampNumber(value.dockWidth, 360, maxDockWidth, getSplitPanelWidth());
  const maxFloatWidth = Math.max(360, viewportWidth - 24);
  const maxFloatHeight = Math.max(360, viewportHeight - 24);
  const floatWidth = clampNumber(value.floatWidth, 420, maxFloatWidth, Math.min(620, maxFloatWidth));
  const floatHeight = clampNumber(value.floatHeight, 420, maxFloatHeight, Math.min(720, maxFloatHeight));
  const floatRight = clampNumber(value.floatRight, 8, Math.max(8, viewportWidth - floatWidth - 8), 24);
  const floatTop = clampNumber(value.floatTop, 8, Math.max(8, viewportHeight - floatHeight - 8), 64);
  return {
    mode: value.mode === "float" ? "float" : "dock",
    dockWidth,
    floatWidth,
    floatHeight,
    floatTop,
    floatRight
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  const safeFallback = Number.isFinite(Number(fallback)) ? Number(fallback) : min;
  const normalized = Number.isFinite(number) ? number : safeFallback;
  const lower = Math.min(min, max);
  const upper = Math.max(min, max);
  return Math.round(Math.min(upper, Math.max(lower, normalized)));
}

function normalizeAppearance(value) {
  if (value === "system" || value === "跟随系统") return "system";
  if (value === "light" || value === "浅色") return "light";
  if (value === "dark" || value === "深色") return "dark";
  if (value === "sepia" || value === "护眼") return "sepia";
  return "system";
}

function normalizeLanguage(value) {
  return window.ArxivMateI18n.normalizeLanguage(value);
}

function resolveFrameAppearance(value) {
  const normalized = normalizeAppearance(value);
  if (normalized !== "system") return normalized;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function readEmbeddedPanelPaper() {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return null;
  const panelUrl = runtimeUrl("panel.html");
  if (!panelUrl || !location.href.startsWith(panelUrl)) return null;
  const raw = new URLSearchParams(location.search).get("paper");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isRuntimeAvailable() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

function runtimeUrl(path) {
  try {
    if (!isRuntimeAvailable()) return "";
    return chrome.runtime.getURL(path);
  } catch {
    return "";
  }
}

function getRuntimeLastErrorMessage() {
  try {
    return chrome?.runtime?.lastError?.message || "";
  } catch {
    return "";
  }
}

function createExtensionContextError() {
  return new Error("Extension context invalidated. Refresh the current page.");
}

function normalizeErrorMessage(error) {
  return error?.message || String(error || "");
}

function isExtensionContextInvalidated(error) {
  return /extension context invalidated|context invalidated|extension context/i.test(normalizeErrorMessage(error));
}

function modeToUserText(mode, language = "system") {
  const i18n = window.ArxivMateI18n;
  if (mode === "deep") return i18n.t(language, "modeDeepPrompt");
  if (mode === "study") return i18n.t(language, "modeStudyPrompt");
  return i18n.t(language, "modeQuickPrompt");
}

function modeLabel(mode, language = "system") {
  const i18n = window.ArxivMateI18n;
  if (mode === "deep") return i18n.t(language, "deep");
  if (mode === "study") return i18n.t(language, "study");
  if (mode === "ask") return i18n.t(language, "ask");
  return i18n.t(language, "quick");
}

function findLastAssistantText(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant" && messages[index]?.text) {
      return messages[index].text;
    }
  }
  return "";
}

function extractPaper() {
  const arxivId = extractArxivId(location.href);
  const isPdf = isCurrentPdfPage();
  const title = getField(".title.mathjax", "Title:") ||
    document.querySelector("meta[name='citation_title']")?.content ||
    extractPdfTitle() ||
    extractTitleFromPdfUrl(location.href) ||
    document.title.replace(/\s*\|\s*arXiv.*$/i, "");
  const authors = getAuthors();
  const abstract = getField("blockquote.abstract", "Abstract:");
  const subjects = getField(".subheader + .subjects", "") ||
    getText(".tablecell.subjects") ||
    getText(".subjects");
  const comments = getField(".comments", "Comments:") || getMeta("citation_comments");
  const submittedAt = extractSubmittedDate(document);
  const paperUpdatedAt = extractUpdatedDate(document);
  const pdfUrl = document.querySelector("meta[name='citation_pdf_url']")?.content ||
    document.querySelector("a[title='Download PDF']")?.href ||
    extractPdfUrl(location.href, arxivId);
  const id = arxivId || (isPdf ? createPdfDocumentId(pdfUrl || location.href) : "");

  return {
    id,
    sourceType: arxivId ? "arxiv" : isPdf ? "pdf" : "web",
    title: clean(title),
    authors: clean(authors),
    abstract: clean(abstract),
    subjects: clean(subjects),
    comments: clean(comments),
    submittedAt: clean(submittedAt),
    paperUpdatedAt: clean(paperUpdatedAt),
    pdfUrl: clean(pdfUrl || (isPdf ? location.href : "")),
    pageUrl: clean(location.href)
  };
}

async function fetchAbsPaperMetadata(id) {
  const cleanId = clean(String(id).replace(/^arXiv:/i, ""));
  if (!cleanId) return null;
  const response = await fetch(`https://arxiv.org/abs/${encodeURIComponent(cleanId)}`, {
    credentials: "omit"
  });
  if (!response.ok) return null;
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return extractPaperFromDocument(doc, `https://arxiv.org/abs/${cleanId}`);
}

function extractPaperFromDocument(doc, url) {
  const id = extractArxivId(url);
  const title = getFieldFromDocument(doc, ".title.mathjax", "Title:") ||
    doc.querySelector("meta[name='citation_title']")?.content ||
    doc.title.replace(/\s*\|\s*arXiv.*$/i, "");
  const authors = getAuthorsFromDocument(doc);
  const abstract = getFieldFromDocument(doc, "blockquote.abstract", "Abstract:");
  const subjects = getFieldFromDocument(doc, ".subheader + .subjects", "") ||
    getTextFromDocument(doc, ".tablecell.subjects") ||
    getTextFromDocument(doc, ".subjects");
  const comments = getFieldFromDocument(doc, ".comments", "Comments:") ||
    doc.querySelector("meta[name='citation_comments']")?.content ||
    "";
  const pdfUrl = doc.querySelector("meta[name='citation_pdf_url']")?.content ||
    doc.querySelector("a[title='Download PDF']")?.href ||
    extractPdfUrl(url, id);
  return {
    id,
    title: clean(title),
    authors: clean(authors),
    abstract: clean(abstract),
    subjects: clean(subjects),
    comments: clean(comments),
    submittedAt: clean(extractSubmittedDate(doc)),
    paperUpdatedAt: clean(extractUpdatedDate(doc)),
    pdfUrl: clean(pdfUrl)
  };
}

function extractArxivId(url) {
  const match = String(url).match(/arxiv\.org\/(?:abs|pdf)\/([^?#/]+)(?:\.pdf)?/i);
  return match ? decodeURIComponent(match[1]).replace(/\.pdf$/i, "") : "";
}

function extractPdfUrl(url, id) {
  if (/arxiv\.org\/pdf\//i.test(url)) {
    return String(url).replace(/[?#].*$/, "").replace(/\.pdf$/i, "");
  }
  return id ? `https://arxiv.org/pdf/${id}` : "";
}

function extractPdfTitle() {
  const title = document.querySelector("pdf-viewer")?.getAttribute("document-title") ||
    document.querySelector("embed[type='application/pdf']")?.getAttribute("title") ||
    "";
  return String(title).replace(/\.pdf$/i, "").replace(/_/g, " ").trim();
}

function extractTitleFromPdfUrl(url) {
  try {
    const parsed = new URL(url);
    const lastPart = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    const fileName = lastPart.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
    return fileName || parsed.hostname;
  } catch {
    return String(url || "")
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.pdf(?:[?#].*)?$/i, "")
      .replace(/[_-]+/g, " ")
      .trim() || "";
  }
}

function isCurrentPdfPage() {
  return isPdfLikeUrl(location.href) || Boolean(document.querySelector("embed[type='application/pdf'], pdf-viewer"));
}

function isPdfLikeUrl(url) {
  return /arxiv\.org\/pdf\//i.test(String(url || "")) || /\.pdf(?:[?#]|$)/i.test(String(url || ""));
}

function createPdfDocumentId(url) {
  const normalized = normalizeDocumentUrl(url || location.href);
  return normalized ? `pdf:${hashString(normalized)}` : "";
}

function normalizeDocumentUrl(url) {
  try {
    const parsed = new URL(url, location.href);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url || "").replace(/#.*$/, "");
  }
}

function ensureDocumentIdentity(value) {
  if (value?.id) return value;
  if (!isCurrentPdfPage()) return value;
  const pdfUrl = clean(value?.pdfUrl) || location.href;
  return {
    ...value,
    id: createPdfDocumentId(pdfUrl),
    sourceType: value?.sourceType || "pdf",
    title: clean(value?.title) || extractPdfTitle() || extractTitleFromPdfUrl(pdfUrl) || "PDF document",
    pdfUrl: clean(pdfUrl),
    pageUrl: clean(value?.pageUrl) || clean(location.href)
  };
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getField(selector, prefix) {
  return getFieldFromDocument(document, selector, prefix);
}

function getFieldFromDocument(doc, selector, prefix) {
  const node = doc.querySelector(selector);
  if (!node) return "";
  const clone = node.cloneNode(true);
  clone.querySelectorAll(".descriptor").forEach((item) => item.remove());
  let text = clone.textContent || "";
  if (prefix) text = text.replace(new RegExp(`^\\s*${escapeRegExp(prefix)}\\s*`, "i"), "");
  return text;
}

function getAuthors() {
  return getAuthorsFromDocument(document);
}

function getAuthorsFromDocument(doc) {
  const metaAuthors = [...doc.querySelectorAll("meta[name='citation_author']")]
    .map((node) => node.content)
    .filter(Boolean);
  if (metaAuthors.length) return metaAuthors.join(", ");

  const authorsNode = doc.querySelector(".authors");
  if (!authorsNode) return "";
  const clone = authorsNode.cloneNode(true);
  clone.querySelectorAll(".descriptor").forEach((item) => item.remove());
  return clone.textContent || "";
}

function getMeta(name) {
  return document.querySelector(`meta[name='${name}']`)?.content || "";
}

function getText(selector) {
  return getTextFromDocument(document, selector);
}

function getTextFromDocument(doc, selector) {
  return doc.querySelector(selector)?.textContent || "";
}

function extractSubmittedDate(doc) {
  const history = getTextFromDocument(doc, ".submission-history");
  const match = history.match(/\[v1\]\s+(.+?)(?=(?:\s+\[v\d+\])|$)/i);
  return normalizeArxivDate(match?.[1] || getMetaFromDocument(doc, "citation_date"));
}

function extractUpdatedDate(doc) {
  const history = getTextFromDocument(doc, ".submission-history");
  const matches = [...history.matchAll(/\[v\d+\]\s+(.+?)(?=(?:\s+\[v\d+\])|$)/gi)];
  if (matches.length > 1) return normalizeArxivDate(matches[matches.length - 1][1]);
  return "";
}

function getMetaFromDocument(doc, name) {
  return doc.querySelector(`meta[name='${name}']`)?.content || "";
}

function normalizeArxivDate(value) {
  return clean(String(value || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/,\s*revised\s*/i, " ")
    .replace(/Submitted\s*/i, ""));
}

function hasUsefulPaperMetadata(value) {
  return Boolean(clean(value?.title) && !isArxivIdLikeTitle(value.title) && (clean(value?.authors) || clean(value?.submittedAt) || clean(value?.paperUpdatedAt)));
}

function isArxivIdLikeTitle(value) {
  const text = clean(value).replace(/\.pdf$/i, "");
  return /^(\d{4}\.\d{4,5})(v\d+)?$/i.test(text) || /^arxiv[:\s]/i.test(text);
}

function displayPaperTitle(value) {
  const titleText = clean(value?.title);
  if (titleText && !isArxivIdLikeTitle(titleText)) return titleText;
  if (value?.sourceType === "pdf") return "PDF document";
  return value?.id ? `arXiv ${value.id}` : "Paper";
}

function buildPaperMeta(value) {
  const i18n = window.ArxivMateI18n;
  const language = document.getElementById("arxiv-llm-companion-root")?.dataset?.language || "system";
  return [
    value?.submittedAt ? i18n.t(language, "submitted", { date: value.submittedAt }) : "",
    value?.paperUpdatedAt ? i18n.t(language, "updated", { date: value.paperUpdatedAt }) : "",
    value?.authors ? truncate(value.authors, 88) : "",
    value?.subjects ? truncate(value.subjects, 58) : "",
    value?.sourceType === "pdf" ? "PDF" : value?.id ? `arXiv ${value.id}` : ""
  ].filter(Boolean).join(" · ");
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTextBlock(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatTime(value, language = "system") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(window.ArxivMateI18n.resolveLanguage(language), {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatContextUsage(value, language = "system") {
  const tokens = Number(value?.contextTokens);
  const windowTokens = Number(value?.contextWindow);
  if (!Number.isFinite(tokens) || tokens <= 0 || !Number.isFinite(windowTokens) || windowTokens <= 0) return "";
  const percent = Math.max(0, Math.min(100, Math.round((tokens / windowTokens) * 100)));
  const i18n = window.ArxivMateI18n;
  return i18n.t(language, "contextUsage", {
    tokens: formatTokenCount(tokens),
    window: formatTokenCount(windowTokens),
    percent,
    capped: value?.contextCapped ? i18n.t(language, "capped") : ""
  });
}

function formatMessageUsageMeta(message, language = "system") {
  const usage = formatContextUsage(message, language);
  return usage ? ` · ${escapeHtml(usage)}` : "";
}

function formatTokenCount(value) {
  const tokens = Math.max(0, Math.floor(Number(value) || 0));
  if (tokens < 1000) return String(tokens);
  if (tokens < 1000000) {
    return tokens < 10000
      ? `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : `${Math.round(tokens / 1000)}k`;
  }
  return `${(tokens / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownToHtml(markdown) {
  if (window.ArxivMateMarkdown?.toHtml) {
    return window.ArxivMateMarkdown.toHtml(markdown, { headingOffset: 2 });
  }
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = "";
  let paragraph = [];
  let codeBlock = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${formatInline(escapeHtml(paragraph.join(" ")))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = "";
  };
  const closeCodeBlock = () => {
    if (!codeBlock.length) return;
    html.push(`<pre><code>${escapeHtml(codeBlock.join("\n"))}</code></pre>`);
    codeBlock = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^```/.test(line.trim())) {
      if (codeBlock.length) {
        closeCodeBlock();
      } else {
        flushParagraph();
        closeList();
        codeBlock.push("");
      }
      continue;
    }
    if (codeBlock.length) {
      codeBlock.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      closeList();
      html.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(4, heading[1].length) + 2;
      html.push(`<h${level}>${formatInline(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (ordered || unordered) {
      flushParagraph();
      const nextType = ordered ? "ol" : "ul";
      if (listType !== nextType) {
        closeList();
        html.push(`<${nextType}>`);
        listType = nextType;
      }
      html.push(`<li>${formatInline(escapeHtml((ordered || unordered)[1]))}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${formatInline(escapeHtml(quote[1]))}</blockquote>`);
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  closeCodeBlock();
  flushParagraph();
  closeList();
  return html.join("");
}

function formatInline(value) {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildMarkdownNote(paper, summary, conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const conversationBlock = messages.length
    ? [
      "",
      "## Conversation",
      ...messages.map((message) => [
        "",
        `### ${message.role === "user" ? "User" : "Assistant"} ${message.createdAt || ""}`,
        "",
        message.text || ""
      ].join("\n"))
    ].join("\n")
    : "";

  return [
    `# ${paper.title || paper.id || "Paper"}`,
    "",
    `- Type: ${paper.sourceType === "pdf" ? "PDF" : "arXiv"}`,
    `- ID: ${paper.id || ""}`,
    `- Authors: ${paper.authors || ""}`,
    `- Subjects: ${paper.subjects || ""}`,
    `- PDF: ${paper.pdfUrl || ""}`,
    "",
    "## Abstract",
    paper.abstract || "",
    "",
    "## Latest Note",
    summary || "",
    conversationBlock
  ].join("\n");
}
