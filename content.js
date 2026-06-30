(function () {
  if (!isRuntimeAvailable()) return;
  const I18N = window.ArxivMateI18n;
  const embeddedPanelPaper = readEmbeddedPanelPaper();
  const isEmbeddedPanel = Boolean(embeddedPanelPaper);
  let paper = embeddedPanelPaper || extractPaper();
  if (!paper.id && !paper.title) return;

  if (!isEmbeddedPanel && isPdfPage()) {
    installIframePanel(paper);
    return;
  }

  let currentConversation = null;
  let currentResult = "";
  let currentMode = "quick";
  let isPanelOpen = false;
  let useFullTextNext = false;
  let currentSettings = null;
  let activeModelLabel = "";
  let renderTimer = 0;
  let activeAppearance = "system";
  let currentLanguage = "system";
  let systemAppearanceQuery = null;
  let systemAppearanceListenerInstalled = false;

  const host = document.createElement("div");
  host.id = "arxiv-llm-companion-root";
  const shadow = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);
  if (!isEmbeddedPanel) {
    installPageSplitStyles();
  }

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
          <label class="alc-toggle" title="下一次请求优先抽取当前 PDF 文本，失败时再尝试 ar5iv，速度会慢一些" data-i18n-title="fullTextTitle">
            <input class="alc-fulltext" type="checkbox">
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
    </section>
  `;
  shadow.appendChild(wrapper);

  const $ = (selector) => shadow.querySelector(selector);
  const fab = $(".alc-fab");
  const panel = $(".alc-panel");
  const title = $("h2");
  const meta = $(".alc-meta");
  const input = $(".alc-composer textarea");
  const status = $(".alc-status");
  const chat = $(".alc-chat");
  const updateBanner = $(".alc-update-banner");
  const fullTextToggle = $(".alc-fulltext");
  const modelSelect = $(".alc-model-select");

  applyLanguage(currentLanguage);
  installPanelEventGuards();
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
  fullTextToggle.addEventListener("change", () => {
    useFullTextNext = fullTextToggle.checked;
    setStatus(useFullTextNext ? t("fullTextOn") : t("fullTextOff"));
  });
  modelSelect.addEventListener("change", switchActiveModel);

  shadow.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => runTurn(button.dataset.mode));
  });
  if (!isEmbeddedPanel) {
    window.addEventListener("resize", () => {
      if (isPanelOpen) applyPageSplit(true);
    });
  }

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
    applyPageSplit(isPanelOpen);
    if (isPanelOpen) {
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
    const width = getSplitPanelWidth();
    document.documentElement.style.setProperty("--alc-split-width", `${width}px`);
    document.documentElement.classList.toggle("alc-page-split-active", Boolean(open));
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
    const userText = mode === "ask" ? input.value.trim() : modeToUserText(mode, currentLanguage);
    if (mode === "ask" && !userText) {
      setStatus(t("emptyQuestion"), true);
      return;
    }

    currentMode = mode;
    const contextMode = useFullTextNext || mode === "deep" || mode === "study" ? "full" : "auto";
    setBusy(true);
    setStatus(contextMode === "full" ? t("preparingFull") : t("preparingFast"));
    const preview = appendPreviewTurn(userText);
    if (mode === "ask") {
      input.value = "";
      autoResizeInput();
    }

    try {
      const response = await sendStreamMessage({
        type: "summarizePaper",
        paper,
        mode,
        question: userText,
        contextMode
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
      if (isExtensionContextInvalidated(error)) {
        showExtensionReloadNotice(error);
      } else {
        setStatus(error.message || String(error), true);
      }
    } finally {
      if (contextMode === "full") {
        useFullTextNext = false;
        fullTextToggle.checked = false;
      }
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
    try {
      const settings = await sendMessage({ type: "getSettings" });
      currentSettings = settings;
      activeModelLabel = buildActiveModelLabel(settings);
      applyLanguage(settings.language);
      applyAppearance(settings.appearance);
      renderModelSelect();
      renderUpdateBanner();
    } catch {
      currentSettings = null;
      activeModelLabel = "";
      applyLanguage("system");
      applyAppearance("system");
      renderModelSelect();
      renderUpdateBanner();
    }
    await loadConversation();
  }

  function installSettingsChangeListener() {
    try {
      chrome.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "sync" || !changes.settings) return;
        applyLanguage(changes.settings.newValue?.language);
        applyAppearance(changes.settings.newValue?.appearance);
        currentSettings = changes.settings.newValue || currentSettings;
        activeModelLabel = buildActiveModelLabel(currentSettings);
        renderModelSelect();
        renderUpdateBanner();
      });
    } catch {
      // Storage listeners are optional; initial settings still cover normal page loads.
    }
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

  function renderModelSelect() {
    if (!modelSelect) return;
    const profiles = Array.isArray(currentSettings?.modelProfiles) ? currentSettings.modelProfiles : [];
    const activeId = currentSettings?.activeProfileId || "";
    modelSelect.innerHTML = profiles.length
      ? profiles.map((profile) => `<option value="${escapeAttr(profile.id)}" ${profile.id === activeId ? "selected" : ""}>${escapeHtml(formatProfileOption(profile))}</option>`).join("")
      : `<option value="">${escapeHtml(currentSettings?.model || t("modelName"))}</option>`;
    modelSelect.disabled = profiles.length <= 1;
  }

  async function switchActiveModel(event) {
    const nextProfileId = event.target.value;
    if (!nextProfileId || nextProfileId === currentSettings?.activeProfileId) return;
    const previousProfileId = currentSettings?.activeProfileId || "";
    modelSelect.disabled = true;
    try {
      const nextSettings = await sendMessage({
        type: "saveSettings",
        settings: {
          ...(currentSettings || {}),
          activeProfileId: nextProfileId
        }
      });
      currentSettings = nextSettings;
      activeModelLabel = buildActiveModelLabel(nextSettings);
      applyLanguage(nextSettings.language);
      applyAppearance(nextSettings.appearance);
      renderModelSelect();
      setStatus(t("modelSwitched", { model: activeModelDisplayName(nextSettings) }));
    } catch (error) {
      if (previousProfileId) modelSelect.value = previousProfileId;
      showExtensionReloadNotice(error);
    } finally {
      renderModelSelect();
    }
  }

  function buildActiveModelLabel(settings) {
    const display = activeModelDisplayName(settings);
    return display ? ` · ${display}` : "";
  }

  function activeModelDisplayName(settings) {
    const profiles = Array.isArray(settings?.modelProfiles) ? settings.modelProfiles : [];
    const active = profiles.find((profile) => profile.id === settings?.activeProfileId);
    return active?.name || active?.model || settings?.model || "";
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
        setStatus(t("loadedHistory", { count: currentConversation.turnCount || 0, model: activeModelLabel }));
      } else {
        setStatus(t("defaultModeHint", { model: activeModelLabel }));
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
    shadow.querySelectorAll("button, textarea, input").forEach((node) => {
      if (node.classList.contains("alc-close") || node.classList.contains("alc-fab")) return;
      if (node.classList.contains("alc-review") || node.classList.contains("alc-copy")) return;
      node.disabled = isBusy;
    });
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
      let latestText = "";
      let port;
      try {
        if (!isRuntimeAvailable()) throw createExtensionContextError();
        port = chrome.runtime.connect({ name: "alc-stream" });
      } catch (error) {
        if (isExtensionContextInvalidated(error)) {
          reject(error);
          return;
        }
        sendMessage(payload).then(resolve, reject);
        return;
      }

      port.onMessage.addListener((message) => {
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
          resolve(message.data);
          try {
            port.disconnect();
          } catch {}
          return;
        }
        if (message?.type === "error") {
          settled = true;
          reject(new Error(message.error || "流式请求失败。"));
          try {
            port.disconnect();
          } catch {}
        }
      });

      port.onDisconnect.addListener(() => {
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
        reject(error);
      }
    });
  }

  function isPdfPage() {
    return /arxiv\.org\/pdf\//i.test(location.href) ||
      /\.pdf(?:[?#]|$)/i.test(location.href) ||
      Boolean(document.querySelector("embed[type='application/pdf'], pdf-viewer"));
  }

  function installIframePanel(paperData) {
    if (!isRuntimeAvailable()) return;
    const existing = document.getElementById("arxiv-llm-companion-frame-root");
    if (existing) existing.remove();
    installStandaloneSplitStyles();

    const root = document.createElement("div");
    root.id = "arxiv-llm-companion-frame-root";
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

    shadowRoot.append(styleNode, fabButton, frameShell);

    const applyFrameAppearance = (value) => {
      root.dataset.appearance = resolveFrameAppearance(value);
    };
    const loadFrameAppearance = async () => {
      try {
        const { settings = {} } = await chrome.storage.sync.get("settings");
        applyFrameAppearance(settings.appearance);
      } catch {
        applyFrameAppearance("system");
      }
    };
    applyFrameAppearance("system");
    loadFrameAppearance();
    try {
      chrome.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "sync" || !changes.settings) return;
        applyFrameAppearance(changes.settings.newValue?.appearance);
      });
    } catch {
      // The iframe panel applies the saved appearance independently.
    }

    const openPanel = () => {
      document.documentElement.style.setProperty("--alc-split-width", `${getSplitPanelWidth()}px`);
      document.documentElement.classList.add("alc-page-split-active");
      frameShell.classList.add("is-open");
      fabButton.classList.add("is-hidden");
      frame.focus();
      frame.contentWindow?.focus();
    };
    const closePanel = () => {
      document.documentElement.classList.remove("alc-page-split-active");
      frameShell.classList.remove("is-open");
      fabButton.classList.remove("is-hidden");
    };

    fabButton.addEventListener("click", openPanel);
    window.addEventListener("resize", () => {
      if (!frameShell.classList.contains("is-open")) return;
      document.documentElement.style.setProperty("--alc-split-width", `${getSplitPanelWidth()}px`);
    });
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === "alc-close-panel") closePanel();
    });
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
  const id = extractArxivId(location.href);
  const title = getField(".title.mathjax", "Title:") ||
    document.querySelector("meta[name='citation_title']")?.content ||
    extractPdfTitle() ||
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
    extractPdfUrl(location.href, id);

  return {
    id,
    title: clean(title),
    authors: clean(authors),
    abstract: clean(abstract),
    subjects: clean(subjects),
    comments: clean(comments),
    submittedAt: clean(submittedAt),
    paperUpdatedAt: clean(paperUpdatedAt),
    pdfUrl: clean(pdfUrl)
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
  return value?.id ? `arXiv ${value.id}` : "arXiv paper";
}

function buildPaperMeta(value) {
  const i18n = window.ArxivMateI18n;
  const language = document.getElementById("arxiv-llm-companion-root")?.dataset?.language || "system";
  return [
    value?.submittedAt ? i18n.t(language, "submitted", { date: value.submittedAt }) : "",
    value?.paperUpdatedAt ? i18n.t(language, "updated", { date: value.paperUpdatedAt }) : "",
    value?.authors ? truncate(value.authors, 88) : "",
    value?.subjects ? truncate(value.subjects, 58) : "",
    value?.id ? `arXiv ${value.id}` : ""
  ].filter(Boolean).join(" · ");
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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
    `# ${paper.title || paper.id || "arXiv paper"}`,
    "",
    `- arXiv: ${paper.id || ""}`,
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
