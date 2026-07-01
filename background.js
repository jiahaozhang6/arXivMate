const DEFAULT_SETTINGS = {
  language: "system",
  appearance: "system"
};

const DEFAULT_PROFILE_SETTINGS = {
  temperature: 0.2,
  maxContextChars: 14000,
  maxOutputTokens: 1600,
  inputTokenCap: 32000,
  historyTurns: 4,
  historyMessageChars: 1800,
  defaultContextMode: "fast",
  thinkingMode: "hide",
  reasoningLevel: "default",
  useAr5iv: true
};
const CHARS_PER_TOKEN_ESTIMATE = 4;
const INPUT_CAP_SAFETY_RATIO = 0.9;

const MAX_CONVERSATIONS = 300;
const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_CONTEXT_CACHE_ENTRIES = 80;
const PDF_TEXT_MIN_CHARS = 1600;
const PDF_TEXT_CONTEXT_SOURCE = "PDF 文本抽取（未上传 PDF 文件）+ 页面元数据";
const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/jiahaozhang6/arXivMate/releases";
const GITHUB_RELEASES_PAGE_URL = "https://github.com/jiahaozhang6/arXivMate/releases";
const UPDATE_CHECK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SETTINGS_LOCAL_KEY = "settings";
const SETTINGS_MIRROR_KEY = "settingsMirror";
const MODEL_PROFILES_LOCAL_KEY = "modelProfiles";
const BACKUP_FORMAT = "arXivMate.localData";
const BACKUP_VERSION = 1;
const WEBCHAT_PDF_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;
const WEBCHAT_BRIDGE_VERSION = 12;

const PROVIDER_PRESETS = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash"
  },
  minimax: {
    baseUrl: "https://api.minimaxi.com/v1",
    model: "MiniMax-M3"
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1"
  },
  webchatChatGPT: {
    baseUrl: "webchat://chatgpt",
    model: "ChatGPT Web"
  },
  webchatDeepSeek: {
    baseUrl: "webchat://deepseek",
    model: "DeepSeek Web"
  },
  custom: {
    baseUrl: "",
    model: ""
  }
};

const WEBCHAT_PROVIDERS = {
  webchatChatGPT: {
    id: "chatgpt",
    label: "ChatGPT Web",
    homeUrl: "https://chatgpt.com/",
    urlPattern: "https://chatgpt.com/*"
  },
  webchatDeepSeek: {
    id: "deepseek",
    label: "DeepSeek Web",
    homeUrl: "https://chat.deepseek.com/",
    urlPattern: "https://chat.deepseek.com/*"
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const [{ settings }, local] = await Promise.all([
    chrome.storage.sync.get("settings"),
    chrome.storage.local.get([SETTINGS_LOCAL_KEY, SETTINGS_MIRROR_KEY, MODEL_PROFILES_LOCAL_KEY])
  ]);
  const localSettings = local[SETTINGS_LOCAL_KEY];
  const mirror = local[SETTINGS_MIRROR_KEY];
  const recovered = recoverSettings(
    localSettings,
    createProfilesSnapshotSettings(local[MODEL_PROFILES_LOCAL_KEY]),
    settings,
    mirror
  );
  const persisted = withSettingsMetadata(recovered);
  await chrome.storage.local.set({
    [SETTINGS_LOCAL_KEY]: persisted,
    [SETTINGS_MIRROR_KEY]: persisted,
    [MODEL_PROFILES_LOCAL_KEY]: persisted.modelProfiles
  });
  try {
    await chrome.storage.sync.set({ settings: persisted });
  } catch (error) {
    console.warn("arXivMate settings sync copy failed:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      console.error(error);
      sendResponse({ ok: false, error: error.message || String(error) });
    });
  return true;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "alc-stream") return;
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort());
  port.onMessage.addListener((message) => {
    if (message?.type === "cancelStream") {
      controller.abort();
      return;
    }
    if (message?.type !== "summarizePaperStream") return;
    streamSummarizePaper(message, port, controller.signal)
      .then((data) => postPort(port, { type: "done", data }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        postPort(port, {
          type: "error",
          error: error.message || String(error),
          partialText: error.partialText || ""
        });
      });
  });
});

function postPort(port, payload) {
  try {
    port.postMessage(payload);
  } catch (error) {
    console.debug("stream port closed:", error);
  }
}

async function handleMessage(message, sender = {}) {
  switch (message?.type) {
    case undefined:
    case null:
    case "":
      return createIgnoredMessageResult(message);
    case "ping":
      return {
        pong: true,
        version: chrome.runtime.getManifest().version
      };
    case "getVersion":
      return {
        version: chrome.runtime.getManifest().version
      };
    case "getSettings":
      return getSettings();
    case "saveSettings":
      return saveSettings(message.settings);
    case "testModelProfile":
      return testModelProfile(message.profile);
    case "listModelsForProfile":
      return listModelsForProfile(message.profile);
    case "exportLocalData":
      return exportLocalData();
    case "importLocalData":
      return importLocalData(message.backup);
    case "summarizePaper":
      return summarizePaper({
        paper: message.paper,
        mode: message.mode,
        question: message.question,
        persist: message.persist !== false,
        contextMode: message.contextMode,
        profileId: message.profileId
      });
    case "appendPartialConversationTurn":
      return appendPartialConversationTurn(message);
    case "saveNote":
      return saveNote(message.paper, message.summary, message.mode);
    case "getNote":
      return getNote(message.id);
    case "getConversation":
      return getConversation(message.id);
    case "clearConversation":
      return clearConversation(message.id);
    case "deleteNote":
      return deleteNote(message.id);
    case "openReview":
      return openExtensionPage("review.html");
    case "openOptions":
      return openOptionsPage();
    case "checkForUpdate":
      return checkForUpdate({ force: message.force === true });
    case "probePdfUrl":
      return probePdfUrl(message.url);
    case "fetchPdfAsBase64":
      return fetchPdfAsBase64(message.url, message.filename);
    default:
      return createIgnoredMessageResult(message);
  }
}

function createIgnoredMessageResult(message) {
  const type = normalizeString(message?.type);
  if (type) {
    console.debug("Ignored unknown runtime message:", type);
  }
  return {
    ignored: true,
    reason: type ? "unknown-message-type" : "missing-message-type",
    type
  };
}

async function probePdfUrl(url) {
  const target = normalizeString(url);
  if (!isHttpUrl(target)) return { isPdf: false, reason: "unsupported-url" };
  const head = await requestPdfProbe(target, "HEAD");
  if (head.isPdf) return head;
  return requestPdfProbe(target, "GET");
}

async function requestPdfProbe(url, method) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
      headers: method === "GET"
        ? {
            Accept: "application/pdf,*/*;q=0.8",
            Range: "bytes=0-2047"
          }
        : {
            Accept: "application/pdf,*/*;q=0.8"
          }
    });
    const contentType = response.headers.get("content-type") || "";
    const disposition = response.headers.get("content-disposition") || "";
    const finalUrl = response.url || url;
    let hasPdfMagic = false;
    if (method === "GET" && response.ok) {
      const buffer = await response.arrayBuffer();
      const prefix = new TextDecoder("latin1").decode(buffer.slice(0, 16));
      hasPdfMagic = prefix.startsWith("%PDF");
    }
    const isPdf = isPdfResponse(contentType, disposition, finalUrl, hasPdfMagic);
    return {
      isPdf,
      url: finalUrl,
      contentType,
      contentDisposition: disposition,
      status: response.status,
      reason: isPdf ? "pdf-response" : "not-pdf"
    };
  } catch (error) {
    return {
      isPdf: false,
      blocked: method === "HEAD",
      reason: error.name === "AbortError" ? "timeout" : (error.message || String(error))
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isPdfResponse(contentType, disposition, url, hasPdfMagic) {
  return /^application\/pdf\b/i.test(normalizeString(contentType)) ||
    /\.pdf(?:[?#]|$)/i.test(normalizeString(disposition)) ||
    /\.pdf(?:[?#]|$)/i.test(normalizeString(url)) ||
    Boolean(hasPdfMagic);
}

async function fetchPdfAsBase64(url, requestedFilename = "") {
  const target = normalizeString(url);
  if (!isHttpUrl(target)) throw new Error("当前链接不是可下载的 HTTP(S) PDF 地址。");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(target, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/pdf,*/*;q=0.8"
      }
    });
    if (!response.ok) throw new Error(`PDF 下载失败：HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    const disposition = response.headers.get("content-disposition") || "";
    const finalUrl = response.url || target;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > WEBCHAT_PDF_UPLOAD_MAX_BYTES) {
      throw new Error(`PDF 文件过大（${formatBytes(length)}），超过 ${formatBytes(WEBCHAT_PDF_UPLOAD_MAX_BYTES)} 的网页上传保护上限。`);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > WEBCHAT_PDF_UPLOAD_MAX_BYTES) {
      throw new Error(`PDF 文件过大（${formatBytes(buffer.byteLength)}），超过 ${formatBytes(WEBCHAT_PDF_UPLOAD_MAX_BYTES)} 的网页上传保护上限。`);
    }
    const prefix = new TextDecoder("latin1").decode(buffer.slice(0, 16));
    if (!isPdfResponse(contentType, disposition, finalUrl, prefix.startsWith("%PDF"))) {
      throw new Error("当前链接返回的不是原始 PDF 字节，无法直接上传到 WebChat。");
    }
    return {
      base64: arrayBufferToBase64(buffer),
      filename: sanitizePdfFilename(requestedFilename) || filenameFromDisposition(disposition) || filenameFromUrl(finalUrl) || "paper.pdf",
      url: finalUrl,
      size: buffer.byteLength,
      contentType
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("PDF 下载超时，无法上传到 WebChat。");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function filenameFromDisposition(disposition) {
  const value = normalizeString(disposition);
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return sanitizePdfFilename(decodeURIComponent(encoded[1].replace(/["']/g, "")));
    } catch {}
  }
  const plain = value.match(/filename="?([^";]+)"?/i);
  return sanitizePdfFilename(plain?.[1] || "");
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const part = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "");
    return sanitizePdfFilename(part);
  } catch {
    return sanitizePdfFilename(String(url || "").split(/[\\/]/).pop() || "");
  }
}

function sanitizePdfFilename(value) {
  const cleaned = normalizeString(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .trim();
  if (!cleaned) return "";
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function checkForUpdate({ force = false } = {}) {
  const localVersion = chrome.runtime.getManifest().version;
  const now = Date.now();
  const { updateCheck } = await chrome.storage.local.get("updateCheck");
  if (!force && updateCheck?.checkedAt && now - updateCheck.checkedAt < UPDATE_CHECK_CACHE_TTL_MS) {
    const latestTag = updateCheck.latestTag || versionToTag(updateCheck.latestVersion || localVersion);
    return {
      ...updateCheck,
      latestTag,
      latestZipUrl: updateCheck.latestZipUrl || buildReleaseZipUrl(latestTag),
      releaseUrl: updateCheck.releaseUrl || updateCheck.sourceUrl || GITHUB_RELEASES_PAGE_URL,
      localVersion,
      updateAvailable: compareVersions(updateCheck.latestVersion, localVersion) > 0
    };
  }

  try {
    const response = await fetch(`${GITHUB_RELEASES_API_URL}?t=${now}`, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json"
      }
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    const releases = await response.json();
    const release = findLatestStableRelease(releases);
    if (!release) throw new Error("GitHub has no stable release.");
    const latestTag = release.tag_name || versionToTag(release.name);
    const latestVersion = tagToVersion(latestTag);
    const result = {
      localVersion,
      latestVersion,
      latestTag,
      latestZipUrl: release.zipball_url || buildReleaseZipUrl(latestTag),
      updateAvailable: compareVersions(latestVersion, localVersion) > 0,
      checkedAt: new Date(now).toISOString(),
      sourceUrl: release.html_url || GITHUB_RELEASES_PAGE_URL,
      releaseUrl: release.html_url || GITHUB_RELEASES_PAGE_URL,
      repositoryUrl: "https://github.com/jiahaozhang6/arXivMate",
      error: ""
    };
    await chrome.storage.local.set({ updateCheck: result });
    return result;
  } catch (error) {
    const fallback = {
      localVersion,
      latestVersion: updateCheck?.latestVersion || localVersion,
      latestTag: updateCheck?.latestTag || versionToTag(updateCheck?.latestVersion || localVersion),
      latestZipUrl: updateCheck?.latestZipUrl || buildReleaseZipUrl(updateCheck?.latestTag || versionToTag(updateCheck?.latestVersion || localVersion)),
      updateAvailable: updateCheck?.latestVersion ? compareVersions(updateCheck.latestVersion, localVersion) > 0 : false,
      checkedAt: updateCheck?.checkedAt || "",
      sourceUrl: updateCheck?.sourceUrl || GITHUB_RELEASES_PAGE_URL,
      releaseUrl: updateCheck?.releaseUrl || updateCheck?.sourceUrl || GITHUB_RELEASES_PAGE_URL,
      repositoryUrl: "https://github.com/jiahaozhang6/arXivMate",
      error: error.message || String(error)
    };
    return fallback;
  }
}

async function getSettings() {
  const [{ settings }, local] = await Promise.all([
    chrome.storage.sync.get("settings"),
    chrome.storage.local.get([SETTINGS_LOCAL_KEY, SETTINGS_MIRROR_KEY, MODEL_PROFILES_LOCAL_KEY])
  ]);
  const localSettings = local[SETTINGS_LOCAL_KEY];
  const mirror = local[SETTINGS_MIRROR_KEY];
  const recovered = recoverSettings(
    localSettings,
    createProfilesSnapshotSettings(local[MODEL_PROFILES_LOCAL_KEY]),
    settings,
    mirror
  );
  if (shouldPersistRecoveredSettings(localSettings, recovered)) {
    const persisted = withSettingsMetadata(recovered);
    await chrome.storage.local.set({
      [SETTINGS_LOCAL_KEY]: persisted,
      [SETTINGS_MIRROR_KEY]: persisted,
      [MODEL_PROFILES_LOCAL_KEY]: persisted.modelProfiles
    });
  }
  return recovered;
}

async function saveSettings(settings) {
  const modelProfiles = normalizeModelProfiles(settings?.modelProfiles, settings);
  const next = {
    ...DEFAULT_SETTINGS,
    language: normalizeLanguage(settings?.language),
    appearance: normalizeAppearance(settings?.appearance),
    modelProfiles
  };

  for (const profile of modelProfiles) {
    validateModelProfile(profile);
  }

  const persisted = withSettingsMetadata(next);
  await chrome.storage.local.set({
    [SETTINGS_LOCAL_KEY]: persisted,
    [SETTINGS_MIRROR_KEY]: persisted,
    [MODEL_PROFILES_LOCAL_KEY]: persisted.modelProfiles
  });
  notifyPaperTabsSettingsChanged(next);

  const syncWarning = await mirrorSettingsToSync(persisted);
  if (syncWarning) {
    return {
      ...next,
      storageWarning: syncWarning
    };
  }
  return next;
}

async function mirrorSettingsToSync(persisted) {
  try {
    await promiseWithTimeout(
      chrome.storage.sync.set({ settings: persisted }),
      3000,
      "Chrome sync copy timed out"
    );
    return "";
  } catch (error) {
    console.warn("arXivMate settings sync copy failed:", error);
    return error.message || String(error);
  }
}

function promiseWithTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    }, timeoutMs);
    Promise.resolve(promise).then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function exportLocalData() {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get([
      SETTINGS_LOCAL_KEY,
      SETTINGS_MIRROR_KEY,
      MODEL_PROFILES_LOCAL_KEY,
      "conversations",
      "notes",
      "reviewState",
      "paperContextCache"
    ]),
    chrome.storage.sync.get("settings")
  ]);
  const settings = recoverSettings(
    local[SETTINGS_LOCAL_KEY],
    createProfilesSnapshotSettings(local[MODEL_PROFILES_LOCAL_KEY]),
    sync.settings,
    local[SETTINGS_MIRROR_KEY]
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version,
    settings,
    modelProfiles: settings.modelProfiles,
    conversations: local.conversations || {},
    notes: local.notes || {},
    reviewState: local.reviewState || {},
    paperContextCache: local.paperContextCache || {}
  };
}

async function importLocalData(backup) {
  const data = parseBackupPayload(backup);
  if (data.format && data.format !== BACKUP_FORMAT) {
    throw new Error("备份文件格式不匹配。");
  }

  const importedSettings = normalizeSettings({
    ...(data.settings || {}),
    modelProfiles: data.modelProfiles || data.settings?.modelProfiles || []
  });
  const current = await exportLocalData();
  const nextSettings = importedSettings.modelProfiles.length
    ? importedSettings
    : current.settings;
  const persistedSettings = withSettingsMetadata(nextSettings);

  const nextLocal = {
    [SETTINGS_LOCAL_KEY]: persistedSettings,
    [SETTINGS_MIRROR_KEY]: persistedSettings,
    [MODEL_PROFILES_LOCAL_KEY]: persistedSettings.modelProfiles,
    conversations: mergeRecordMaps(current.conversations, data.conversations),
    notes: mergeRecordMaps(current.notes, data.notes),
    reviewState: mergeRecordMaps(current.reviewState, data.reviewState),
    paperContextCache: mergeRecordMaps(current.paperContextCache, data.paperContextCache)
  };

  await chrome.storage.local.set(nextLocal);
  try {
    await chrome.storage.sync.set({ settings: persistedSettings });
  } catch (error) {
    console.warn("arXivMate backup settings sync copy failed:", error);
  }
  notifyPaperTabsSettingsChanged(persistedSettings);
  return {
    settings: persistedSettings,
    modelProfiles: persistedSettings.modelProfiles,
    conversations: Object.keys(nextLocal.conversations).length,
    notes: Object.keys(nextLocal.notes).length,
    reviewState: Object.keys(nextLocal.reviewState).length,
    paperContextCache: Object.keys(nextLocal.paperContextCache).length
  };
}

function parseBackupPayload(backup) {
  if (typeof backup === "string") {
    try {
      return JSON.parse(backup);
    } catch {
      throw new Error("备份文件不是有效 JSON。");
    }
  }
  if (backup && typeof backup === "object") return backup;
  throw new Error("备份内容为空。");
}

function mergeRecordMaps(current, incoming) {
  const left = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  const right = incoming && typeof incoming === "object" && !Array.isArray(incoming) ? incoming : {};
  return {
    ...left,
    ...right
  };
}

async function notifyPaperTabsSettingsChanged(settings) {
  const urls = [
    "http://*/*",
    "https://*/*",
    "file:///*"
  ];
  try {
    const tabGroups = await Promise.all(urls.map((url) => chrome.tabs.query({ url })));
    const tabs = tabGroups.flat();
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: "settingsChanged",
          settings
        });
      } catch {
        chrome.tabs.reload(tab.id).catch(() => {});
      }
    }
  } catch (error) {
    console.debug("arXivMate settings refresh notification failed:", error);
  }
}

async function testModelProfile(profile) {
  const normalized = normalizeModelProfile(profile);
  validateModelProfile(normalized);
  if (isWebChatProvider(normalized.provider)) {
    return testWebChatProfile(normalized);
  }
  const settings = {
    ...DEFAULT_SETTINGS,
    ...flattenProfile(normalized),
    maxOutputTokens: Math.min(normalized.maxOutputTokens || 64, 64),
    temperature: 0
  };
  const text = await callChatCompletions(settings, [
    {
      role: "system",
      content: "You are testing an OpenAI-compatible chat completion connection. Reply with OK only."
    },
    {
      role: "user",
      content: "Reply with OK only."
    }
  ]);
  return {
    profileId: normalized.id,
    profileName: normalized.name,
    model: normalized.model,
    text
  };
}

async function listModelsForProfile(profile) {
  const normalized = normalizeModelProfile(profile);
  if (isWebChatProvider(normalized.provider)) {
    return {
      profileId: normalized.id,
      baseUrl: normalized.baseUrl,
      models: [normalized.model || getWebChatConfig(normalized.provider).label]
    };
  }
  if (!normalized?.baseUrl) throw new Error("请先填写 API Base URL。");
  const endpoint = buildModelsEndpoint(normalized.baseUrl);
  const response = await fetch(endpoint, {
    method: "GET",
    headers: buildRequestHeaders(normalized),
    cache: "no-store"
  });
  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { raw };
  }
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || raw || `${response.status} ${response.statusText}`;
    throw new Error(`模型列表加载失败：${detail}`);
  }
  const models = extractModelIds(payload);
  if (!models.length) {
    throw new Error("接口没有返回可识别的模型列表，请手动填写模型名称。");
  }
  return {
    profileId: normalized.id,
    baseUrl: normalized.baseUrl,
    models
  };
}

async function summarizePaper({ paper, mode = "quick", question = "", persist = true, contextMode = "auto", profileId = "" }) {
  const prepared = await prepareSummarizePaper({ paper, mode, question, persist, contextMode, profileId });
  const result = isWebChatProvider(prepared.settings.provider)
    ? await callWebChat(prepared.settings, prepared.messages, prepared.webchatPdf, prepared.normalizedPaper, prepared.webchatSession)
    : await callChatCompletions(prepared.settings, prepared.messages);
  return finishSummarizePaper(prepared, result);
}

async function streamSummarizePaper(message, port, signal) {
  const prepared = await prepareSummarizePaper({
    paper: message.paper,
    mode: message.mode,
    question: message.question,
    persist: message.persist !== false,
    contextMode: message.contextMode,
    profileId: message.profileId
  });
  postPort(port, {
    type: "meta",
    source: prepared.webchatSession?.chatUrl
      ? `${prepared.paperContext.contextSource}；复用 WebChat 会话`
      : prepared.paperContext.contextSource,
    model: prepared.settings.model,
    contextTokens: prepared.inputBudget.estimatedAfterTokens,
    contextWindow: prepared.inputBudget.limitTokens,
    contextCapped: prepared.inputBudget.capped
  });

  let streamed = "";
  const result = isWebChatProvider(prepared.settings.provider)
    ? await callWebChatStream(
      prepared.settings,
      prepared.messages,
      prepared.webchatPdf,
      prepared.normalizedPaper,
      prepared.webchatSession,
      (fullText) => {
        streamed = fullText;
        postPort(port, { type: "delta", text: fullText, fullText: streamed });
      },
      signal,
      (status) => postPort(port, {
        type: "webchatStatus",
        ...status
      })
    )
    : await callChatCompletionsStream(
      prepared.settings,
      prepared.messages,
      (delta) => {
        streamed += delta;
        postPort(port, { type: "delta", text: delta, fullText: streamed });
      },
      signal
    );

  return finishSummarizePaper(prepared, result);
}

async function prepareSummarizePaper({ paper, mode = "quick", question = "", persist = true, contextMode = "auto", profileId = "" }) {
  const baseSettings = await getSettings();
  const settings = resolveRequestSettings(baseSettings, profileId);

  const normalizedPaper = normalizePaper(paper);
  const paperContext = await getPaperContext(settings, normalizedPaper, resolveContextMode(mode, contextMode));
  const existingConversation = persist && normalizedPaper.id
    ? await getConversation(normalizedPaper.id)
    : null;
  const webchatSession = isWebChatProvider(settings.provider)
    ? getReusableWebChatSession(existingConversation, settings)
    : null;
  const webchatPdf = webchatSession?.pdfAttached ? null : normalizedPaper.webchatPdf;
  const conversationMessages = mode === "ask"
    ? getRecentConversationMessages(existingConversation?.messages || [], settings)
    : [];

  let messages = buildPrompt({
    paper: normalizedPaper,
    mode,
    question: normalizeString(question),
    fullText: paperContext.fullText,
    contextSource: paperContext.contextSource,
    language: settings.language,
    conversationMessages
  });
  const inputBudget = applyInputBudget(messages, settings);
  messages = inputBudget.messages;

  return {
    settings,
    normalizedPaper,
    paperContext,
    existingConversation,
    webchatSession,
    webchatPdf,
    messages,
    inputBudget,
    mode,
    question,
    persist
  };
}

async function finishSummarizePaper(prepared, result) {
  const resultText = typeof result === "object" && result !== null ? result.text : result;
  const answer = cleanModelOutput(resultText, prepared.settings);
  const webchatSession = typeof result === "object" && result !== null ? result.webchatSession : null;
  const generatedAt = new Date().toISOString();
  let conversation = prepared.existingConversation;
  if (prepared.persist && prepared.normalizedPaper.id) {
    conversation = await appendConversationTurn({
      paper: prepared.normalizedPaper,
      mode: prepared.mode,
      question: prepared.question,
      answer,
      source: prepared.paperContext.contextSource,
      settings: prepared.settings,
      inputBudget: prepared.inputBudget,
      webchatSession,
      createdAt: generatedAt
    });
  }

  return {
    text: answer,
    source: prepared.paperContext.contextSource,
    contextTokens: prepared.inputBudget.estimatedAfterTokens,
    contextWindow: prepared.inputBudget.limitTokens,
    contextCapped: prepared.inputBudget.capped,
    generatedAt,
    conversation
  };
}

async function testWebChatProfile(profile) {
  const config = getWebChatConfig(profile.provider);
  const tab = await ensureWebChatStatusTab(config);
  const status = await ensureWebChatBridge(tab.id);
  if (!status?.composerFound) {
    throw new Error(`${config.label} 页面已打开，但没有找到输入框。请确认已经登录后重试。`);
  }
  const diagnostic = await sendTabMessage(tab.id, { type: "ARXIVMATE_WEBCHAT_DIAGNOSE" }).catch((error) => ({
    ok: false,
    error: error.message || String(error)
  }));
  if (!diagnostic?.ok) {
    throw new Error(`${config.label} 桥接检查失败：${diagnostic?.error || JSON.stringify(diagnostic)}`);
  }
  return {
    profileId: profile.id,
    profileName: profile.name,
    model: profile.model,
    text: `${config.label} OK（${diagnostic.site || config.id}，网络桥接 ${diagnostic.networkHookActive ? "已就绪" : "未确认"}）`
  };
}

async function ensureWebChatStatusTab(config) {
  const tabs = await chrome.tabs.query({ url: config.urlPattern });
  let tab = tabs.find((item) => item.id) || null;
  if (!tab) {
    tab = await chrome.tabs.create({ url: config.homeUrl, active: true });
  }
  if (!tab.id) throw new Error(`无法打开 ${config.label} 网页。`);
  await waitForTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

async function appendPartialConversationTurn(message) {
  const baseSettings = await getSettings();
  const settings = resolveRequestSettings(baseSettings, message.profileId);
  const normalizedPaper = normalizePaper(message.paper);
  const answer = normalizeTextBlock(message.answer);
  if (!normalizedPaper.id) throw new Error("没有识别到文档 ID，无法保存已停止的对话。");
  if (!answer) throw new Error("没有可保存的已生成内容。");
  const generatedAt = new Date().toISOString();
  const conversation = await appendConversationTurn({
    paper: normalizedPaper,
    mode: message.mode || "ask",
    question: message.question || "",
    answer,
    source: normalizeString(message.source) || "partial-generation",
    settings,
    inputBudget: normalizePartialInputBudget(message),
    createdAt: generatedAt,
    stopped: true
  });
  return {
    text: answer,
    source: normalizeString(message.source) || "partial-generation",
    generatedAt,
    conversation,
    stopped: true
  };
}

function normalizePartialInputBudget(message) {
  return {
    estimatedAfterTokens: Number(message.contextTokens) || undefined,
    limitTokens: Number(message.contextWindow) || undefined,
    capped: Boolean(message.contextCapped)
  };
}

async function callChatCompletions(settings, messages) {
  const body = buildChatRequestBody(settings, messages, false);
  const payload = await fetchChatCompletionsPayload(settings, body);
  const content = extractAssistantContent(payload, settings);
  if (!content) {
    throw new Error("LLM 返回为空，可能是模型名、接口格式或 API key 不匹配。");
  }
  return cleanModelOutput(content, settings);
}

async function callChatCompletionsStream(settings, messages, onDelta, signal) {
  const body = buildChatRequestBody(settings, messages, true);
  const response = await fetchChatCompletionsStreamResponse(settings, body, signal);
  if (response.body) return parseChatCompletionsStream(response.body, onDelta, settings);
  const content = extractAssistantContent(response.payload, settings);
  if (!content) throw new Error("LLM 返回为空，可能是模型名、接口格式或 API key 不匹配。");
  const cleaned = cleanModelOutput(content, settings);
  if (cleaned) onDelta(cleaned);
  return cleaned;
}

async function callWebChat(settings, messages, webchatPdf = null, paper = null, webchatSession = null) {
  let latest = "";
  const result = await callWebChatStream(settings, messages, webchatPdf, paper, webchatSession, (text) => {
    latest = text || latest;
  });
  return result || latest;
}

async function callWebChatStream(settings, messages, webchatPdf, paper, webchatSession, onDelta, signal, onStatus) {
  const webchat = getWebChatConfig(settings.provider);
  if (!webchatSession?.pdfAttached && !webchatPdf?.base64) {
    throw new Error(`${webchat.label} 首次分析当前论文必须先准备可上传的 PDF 文件；未检测到已验证的网页附件会话，也没有可上传 PDF。`);
  }
  const prompt = buildWebChatPrompt(messages, settings, { webchatPdf, paper, webchatSession });
  const tab = await ensureWebChatTab(webchat, webchatSession?.chatUrl || "");
  await ensureWebChatBridge(tab.id);

  return new Promise((resolve, reject) => {
    let settled = false;
    let latestText = "";
    let latestThinking = "";
    let latestFormattedText = "";
    let port = null;

    const cleanup = ({ disconnect = false } = {}) => {
      if (signal) signal.removeEventListener("abort", abort);
      if (disconnect) {
        try {
          port?.disconnect();
        } catch {}
      }
    };

    const finish = (callback, value, options = {}) => {
      if (settled) return;
      settled = true;
      cleanup(options);
      callback(value);
    };

    const abort = () => {
      try {
        port?.postMessage({ type: "STOP" });
      } catch {}
      const partialText = formatWebChatFinalText(latestText, latestThinking, settings);
      finish(reject, Object.assign(new Error("generation-aborted"), {
        name: "AbortError",
        partialText
      }));
      setTimeout(() => {
        try {
          port?.disconnect();
        } catch {}
      }, 800);
    };

    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });

    try {
      port = chrome.tabs.connect(tab.id, { name: `arxivmate-webchat-v${WEBCHAT_BRIDGE_VERSION}` });
    } catch (error) {
      finish(reject, error);
      return;
    }

    port.onMessage.addListener((message) => {
      if (settled) return;
      if (message?.type === "phase" || message?.type === "heartbeat") {
        onStatus?.({
          phase: message.phase || "",
          site: message.site || webchat.id,
          label: webchat.label,
          elapsedMs: Number(message.elapsedMs) || 0,
          lastTextLength: Number(message.lastTextLength) || latestText.length || 0,
          diagnostic: message.diagnostic || null
        });
        return;
      }
      if (message?.type === "delta") {
        latestText = normalizeTextBlock(message.fullText || message.text || latestText);
        latestThinking = normalizeTextBlock(message.thinking || latestThinking);
        if (latestText) {
          latestFormattedText = formatWebChatFinalText(latestText, latestThinking, settings);
          onDelta(latestFormattedText);
        }
        return;
      }
      if (message?.type === "terminal") {
        const text = normalizeTextBlock(message.text || latestText);
        latestThinking = normalizeTextBlock(message.thinking || latestThinking);
        if (!text && !latestThinking) {
          finish(reject, new Error(`${webchat.label} 没有返回可读取的内容。`), { disconnect: true });
          return;
        }
        const finalText = formatWebChatFinalText(text, latestThinking, settings);
        if (finalText !== latestFormattedText) onDelta(finalText);
        const nextSession = normalizeWebChatSession({
          provider: settings.provider,
          profileId: settings.requestProfileId,
          profileName: settings.requestProfileName,
          model: settings.model,
          chatUrl: message.chatUrl || message.remoteChatUrl || "",
          chatId: message.chatId || message.remoteChatId || "",
          label: webchat.label,
          pdfAttached: message.pdfAttached === true || webchatSession?.pdfAttached === true,
          pdfFilename: message.pdfFilename || webchatSession?.pdfFilename || "",
          pdfSize: message.pdfSize || webchatSession?.pdfSize || 0,
          pdfAttachedAt: message.pdfAttached === true ? new Date().toISOString() : webchatSession?.pdfAttachedAt || ""
        }) || null;
        finish(resolve, {
          text: finalText,
          webchatSession: nextSession
        });
        setTimeout(() => {
          try {
            port?.disconnect();
          } catch {}
        }, 5000);
        return;
      }
      if (message?.type === "error") {
        finish(reject, new Error(message.error || `${webchat.label} 网页调用失败。`), { disconnect: true });
      }
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const runtimeMessage = chrome.runtime.lastError?.message || "";
      const partialText = formatWebChatFinalText(latestText, latestThinking, settings);
      const errorMessage = latestText
        ? `${webchat.label} 网页连接已断开，已保留已生成内容。`
        : `${webchat.label} 网页连接已断开。请确认网页已登录、没有被验证码/权限页拦截，并刷新 WebChat 页面后重试。${runtimeMessage ? `（${runtimeMessage}）` : ""}`;
      finish(reject, Object.assign(new Error(errorMessage), {
        partialText
      }));
    });

    try {
      port.postMessage({
        type: "START",
        bridgeVersion: WEBCHAT_BRIDGE_VERSION,
        prompt,
        expectedChatUrl: webchatSession?.chatUrl || "",
        reuseExistingChat: Boolean(webchatSession?.chatUrl),
        pdfAlreadyAttached: webchatSession?.pdfAttached === true,
        pdfAttachmentFilename: webchatSession?.pdfFilename || "",
        pdfAttachmentSize: webchatSession?.pdfSize || 0,
        pdfBase64: webchatPdf?.base64 || "",
        pdfFilename: webchatPdf?.filename || "",
        pdfSize: webchatPdf?.size || 0,
        timeoutMs: 120 * 60 * 1000
      });
    } catch (error) {
      finish(reject, error);
    }
  });
}

function formatWebChatFinalText(answer, thinking, settings) {
  const split = splitWebChatThinkingFromAnswer(answer, thinking);
  const cleanAnswer = normalizeTextBlock(split.answer);
  const cleanThinking = normalizeTextBlock(split.thinking);
  if (/:::arxivmate-thinking\b/.test(cleanAnswer)) return cleanAnswer;
  if (!cleanThinking || normalizeThinkingMode(settings?.thinkingMode) === "disabled") {
    return cleanAnswer;
  }
  return [
    `:::arxivmate-thinking ${webChatThinkingSummary(settings)}`,
    cleanThinking,
    ":::",
    "",
    cleanAnswer
  ].join("\n");
}

function splitWebChatThinkingFromAnswer(answer, thinking = "") {
  const cleanAnswer = normalizeTextBlock(answer);
  const cleanThinking = normalizeTextBlock(thinking);
  if (!cleanAnswer) return { answer: "", thinking: cleanThinking };
  if (/:::arxivmate-thinking\b/.test(cleanAnswer)) {
    return {
      answer: cleanAnswer,
      thinking: ""
    };
  }

  const fenced = cleanAnswer.match(/^\s*```(?:thinking|reasoning|thought|cot)?\s*\n([\s\S]{80,}?)\n```\s*\n+([\s\S]{40,})$/i);
  if (fenced && looksLikeWebChatThinkingText(fenced[1])) {
    return {
      answer: normalizeTextBlock(fenced[2]),
      thinking: mergeThinkingBlocks(cleanThinking, fenced[1])
    };
  }

  const headingSplit = cleanAnswer.match(/^\s*(?:#{1,6}\s*)?(?:思考过程|推理过程|Thinking|Reasoning|Thought process)\s*:?\s*\n+([\s\S]{80,}?)\n+(?:#{1,6}\s*)?(?:最终回答|回答|Answer|Final answer)\s*:?\s*\n+([\s\S]{40,})$/i);
  if (headingSplit) {
    return {
      answer: normalizeTextBlock(headingSplit[2]),
      thinking: mergeThinkingBlocks(cleanThinking, headingSplit[1])
    };
  }

  const statusSplit = cleanAnswer.match(/^\s*((?:Thought for|Reasoned for|Thinking for|已思考|思考了|深度思考)[^\n]{0,120})\n+([\s\S]{80,}?)\n{2,}([\s\S]{40,})$/i);
  if (statusSplit && looksLikeWebChatThinkingText(statusSplit[2])) {
    return {
      answer: normalizeTextBlock(statusSplit[3]),
      thinking: mergeThinkingBlocks(cleanThinking, `${statusSplit[1]}\n\n${statusSplit[2]}`)
    };
  }

  return {
    answer: cleanAnswer,
    thinking: cleanThinking
  };
}

function mergeThinkingBlocks(primary, fallback) {
  const first = normalizeTextBlock(primary);
  const second = normalizeTextBlock(fallback);
  if (!first) return second;
  if (!second || first.includes(second) || second.includes(first)) return first.length >= second.length ? first : second;
  return `${first}\n\n${second}`;
}

function looksLikeWebChatThinkingText(value) {
  const text = normalizeTextBlock(value);
  if (text.length < 80) return false;
  const first = text.slice(0, 800);
  if (/^(Thought for|Reasoned for|Thinking for|已思考|思考了|深度思考)/i.test(first)) return true;
  const hits = [
    /我需要|我们需要|需要分析|先看|首先/i,
    /\bneed to\b|\bwe need\b|\bI need\b|\blet me\b|\bfirst\b/i,
    /思路|推理|假设|检查|定位|分析/i
  ].filter((pattern) => pattern.test(first)).length;
  return hits >= 2;
}

function webChatThinkingSummary(settings) {
  const language = normalizeString(settings?.language || settings?.uiLanguage || "");
  return /^en/i.test(language) ? "Thinking" : "思考过程";
}

async function ensureWebChatTab(config, preferredUrl = "") {
  const targetUrl = normalizeString(preferredUrl);
  if (targetUrl && isSupportedWebChatUrl(targetUrl, config)) {
    const matchingTabs = await chrome.tabs.query({ url: config.urlPattern });
    let tab = matchingTabs.find((item) => item.id && normalizeWebChatChatUrl(item.url) === normalizeWebChatChatUrl(targetUrl)) || null;
    if (!tab) {
      tab = matchingTabs.find((item) => item.id) || null;
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url: targetUrl, active: true });
      } else {
        tab = await chrome.tabs.create({ url: targetUrl, active: true });
      }
    }
    if (!tab.id) throw new Error(`无法打开 ${config.label} 网页。`);
    await waitForTabComplete(tab.id);
    await waitForWebChatUrl(tab.id, targetUrl);
    return chrome.tabs.get(tab.id);
  }

  const tabs = await chrome.tabs.query({ url: config.urlPattern });
  let tab = tabs.find((item) => item.id && isWebChatHomeUrl(item.url, config)) || null;
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url: config.homeUrl, active: true });
  } else if (tabs[0]?.id) {
    tab = await chrome.tabs.update(tabs[0].id, { url: config.homeUrl, active: true });
  } else {
    tab = await chrome.tabs.create({ url: config.homeUrl, active: true });
  }
  if (!tab.id) throw new Error(`无法打开 ${config.label} 网页。`);
  await waitForTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

function isWebChatHomeUrl(url, config) {
  try {
    const parsed = new URL(normalizeString(url));
    const home = new URL(config.homeUrl);
    const parsedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    const homePath = home.pathname.replace(/\/+$/, "") || "/";
    return parsed.origin === home.origin && parsedPath === homePath;
  } catch {
    return false;
  }
}

async function waitForWebChatUrl(tabId, expectedUrl, timeoutMs = 30000) {
  const expected = normalizeWebChatChatUrl(expectedUrl);
  if (!expected) return;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab?.url && normalizeWebChatChatUrl(tab.url) === expected) return;
    await delay(250);
  }
}

async function waitForTabComplete(tabId, timeoutMs = 60000) {
  const initial = await chrome.tabs.get(tabId);
  if (initial.status === "complete") return;
  await new Promise((resolve) => {
    const timeout = setTimeout(done, timeoutMs);
    function done() {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(id, info) {
      if (id === tabId && info.status === "complete") done();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function ensureWebChatBridge(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["webchat-injected.js"],
    world: "MAIN"
  }).catch(() => {});
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["webchat.js"]
  }).catch(() => {});
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const next = await sendTabMessage(tabId, { type: "ARXIVMATE_WEBCHAT_PING" }).catch(() => null);
    if (next?.ok && Number(next.bridgeVersion) === WEBCHAT_BRIDGE_VERSION) return next;
    await delay(250);
  }
  throw new Error("WebChat 桥接脚本未就绪或仍是旧版本。请在 chrome://extensions 重新加载 arXivMate 后，再刷新 ChatGPT/DeepSeek 页面重试。");
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWebChatPrompt(messages, settings, options = {}) {
  if (options?.webchatSession?.chatUrl && options.webchatSession.pdfAttached === true) {
    return buildReusableWebChatPrompt(messages, settings, options.paper, options.webchatSession);
  }
  if (options?.webchatPdf?.base64) {
    return buildAttachmentAwareWebChatPrompt(messages, settings, options.paper);
  }
  const chunks = [
    "You are being used through arXivMate WebChat mode. Follow the original roles and answer the final user request.",
    `Current WebChat profile: ${settings.requestProfileName || settings.model || providerLabel(settings.provider)}`
  ];
  for (const message of messages || []) {
    const role = normalizeString(message?.role || "user").toUpperCase();
    const content = typeof message?.content === "string"
      ? message.content
      : JSON.stringify(message?.content || "");
    if (!normalizeTextBlock(content)) continue;
    chunks.push(`\n\n[${role}]\n${content}`);
  }
  chunks.push("\n\nPlease answer directly in Markdown. Preserve LaTeX math delimiters.");
  return chunks.join("\n");
}

function buildReusableWebChatPrompt(messages, settings, paper = {}, session = {}) {
  const language = normalizeString(settings?.language || "");
  const zh = language !== "en";
  const finalUser = [...(messages || [])].reverse().find((message) => normalizeString(message?.role) === "user");
  const finalContent = typeof finalUser?.content === "string"
    ? finalUser.content
    : JSON.stringify(finalUser?.content || "");
  const cleanedQuestion = stripWebChatFullTextBlocks(finalContent);
  return [
    zh
      ? "你正在 arXivMate WebChat 模式中继续同一篇论文的网页会话。"
      : "You are continuing the same paper conversation through arXivMate WebChat mode.",
    zh
      ? "前面这个网页会话已经上传过该论文 PDF；除非我明确要求重新上传，请基于本会话已有 PDF 和历史回答继续。"
      : "The PDF was already uploaded earlier in this web chat. Unless I explicitly request a re-upload, continue using the existing attached PDF and prior chat context.",
    "",
    "[PAPER]",
    `Title: ${paper?.title || "Unknown"}`,
    `Document ID: ${paper?.id || "Unknown"}`,
    `PDF: ${paper?.pdfUrl || "Previously attached"}`,
    session?.chatUrl ? `WebChat URL: ${session.chatUrl}` : "",
    "",
    "[CURRENT REQUEST]",
    cleanedQuestion || (zh ? "请基于这篇论文继续回答我的问题。" : "Please continue answering based on this paper."),
    "",
    zh
      ? "请直接用 Markdown 回答，并保留 LaTeX 数学公式分隔符。"
      : "Answer directly in Markdown and preserve LaTeX math delimiters."
  ].filter(Boolean).join("\n");
}

function buildAttachmentAwareWebChatPrompt(messages, settings, paper = {}) {
  const chunks = [
    "You are being used through arXivMate WebChat mode.",
    "A PDF file is attached in this chat. Read the attached PDF directly as the primary source.",
    "Use the metadata below only to identify the document and guide the task; do not treat it as a replacement for the PDF.",
    `Current WebChat profile: ${settings.requestProfileName || settings.model || providerLabel(settings.provider)}`,
    "",
    "[PAPER METADATA]",
    `Title: ${paper?.title || "Unknown"}`,
    `${paper?.sourceType === "arxiv" ? "arXiv ID" : "Document ID"}: ${paper?.id || "Unknown"}`,
    `Authors: ${paper?.authors || "Unknown"}`,
    `Submitted: ${paper?.submittedAt || "Unknown"}`,
    `Updated: ${paper?.paperUpdatedAt || "Unknown"}`,
    `Subjects: ${paper?.subjects || "Unknown"}`,
    `PDF: ${paper?.pdfUrl || "Attached PDF"}`
  ];
  if (normalizeTextBlock(paper?.abstract)) {
    chunks.push(`Abstract: ${truncateTextBlock(paper.abstract, 1800)}`);
  }

  const usefulMessages = (messages || []).filter((message) => {
    const content = typeof message?.content === "string"
      ? message.content
      : JSON.stringify(message?.content || "");
    if (!normalizeTextBlock(content)) return false;
    if (/Full text excerpt:/i.test(content)) return false;
    if (/正文已按模型输入预算截断|Full text excerpt/i.test(content)) return false;
    return true;
  });

  for (const message of usefulMessages) {
    const role = normalizeString(message?.role || "user").toUpperCase();
    let content = typeof message?.content === "string"
      ? message.content
      : JSON.stringify(message?.content || "");
    content = stripWebChatFullTextBlocks(content);
    if (!normalizeTextBlock(content)) continue;
    chunks.push(`\n[${role}]\n${truncateTextBlock(content, role === "SYSTEM" ? 1200 : 3500)}`);
  }

  chunks.push(
    "\nPlease answer directly in Markdown.",
    "Preserve LaTeX math delimiters.",
    "When you cite details, rely on the attached PDF and mention if a detail cannot be found in the attachment."
  );
  return chunks.join("\n");
}

function stripWebChatFullTextBlocks(content) {
  return String(content || "")
    .replace(/Full text excerpt:\n[\s\S]*?(?=\n\n[A-Z][A-Za-z ]+:|$)/i, "")
    .replace(/正文节选：[\s\S]*?(?=\n\n|$)/g, "")
    .trim();
}

async function fetchChatCompletionsPayload(settings, body, retryCount = 0) {
  const endpoint = buildChatEndpoint(settings.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(settings),
    body: JSON.stringify(body)
  });
  const payload = await parseResponsePayload(response);
  if (!response.ok) {
    const detail = getResponseErrorDetail(response, payload);
    if (retryCount < 1 && shouldRetryWithAdaptiveThinking(response.status, detail, body)) {
      return fetchChatCompletionsPayload(settings, adaptThinkingType(body, "adaptive"), retryCount + 1);
    }
    throw new Error(`LLM 请求失败：${detail}`);
  }
  return payload;
}

async function fetchChatCompletionsStreamResponse(settings, body, signal, retryCount = 0) {
  const endpoint = buildChatEndpoint(settings.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(settings),
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const payload = await parseResponsePayload(response);
    const detail = getResponseErrorDetail(response, payload);
    if (retryCount < 1 && shouldRetryWithAdaptiveThinking(response.status, detail, body)) {
      return fetchChatCompletionsStreamResponse(settings, adaptThinkingType(body, "adaptive"), signal, retryCount + 1);
    }
    if (isStreamUnsupportedError(response.status, detail)) {
      return {
        body: null,
        payload: await fetchChatCompletionsPayload(settings, { ...body, stream: false })
      };
    }
    throw new Error(`LLM 请求失败：${detail}`);
  }
  if (!response.body) {
    return {
      body: null,
      payload: await parseResponsePayload(response)
    };
  }
  return {
    body: response.body,
    payload: null
  };
}

async function parseResponsePayload(response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
}

function getResponseErrorDetail(response, payload) {
  return payload?.error?.message || payload?.message || payload?.raw || `${response.status} ${response.statusText}`;
}

function shouldRetryWithAdaptiveThinking(status, detail, body) {
  if (![400, 422].includes(Number(status))) return false;
  if (body?.thinking?.type !== "enabled") return false;
  const text = normalizeString(detail).toLowerCase();
  return text.includes("thinking.type") && text.includes("adaptive");
}

function adaptThinkingType(body, type) {
  if (!body?.thinking || typeof body.thinking !== "object") return body;
  return {
    ...body,
    thinking: {
      ...body.thinking,
      type
    }
  };
}

function buildRequestHeaders(settings) {
  const headers = {
    "Content-Type": "application/json"
  };
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }
  return headers;
}

function buildChatRequestBody(settings, messages, stream) {
  const body = {
    model: settings.model,
    messages,
    ...buildOutputTokenParam(settings.model, settings.maxOutputTokens),
    stream,
    ...getProviderRequestExtras(settings)
  };
  if (!shouldOmitTemperature(settings)) {
    body.temperature = settings.temperature;
  }
  return body;
}

function shouldOmitTemperature(settings) {
  if (normalizeProvider(settings?.provider) !== "deepseek") return false;
  if (normalizeThinkingMode(settings?.thinkingMode) === "disabled") return false;
  const level = normalizeReasoningLevel(settings?.reasoningLevel);
  if (level === "minimal") return false;
  const name = normalizeString(settings?.model).toLowerCase();
  return /^deepseek-v4-(flash|pro)/.test(name);
}

function isStreamUnsupportedError(status, detail) {
  if (![400, 404, 405, 422].includes(Number(status))) return false;
  const text = normalizeString(detail).toLowerCase();
  return /stream|streaming/.test(text) && /unsupported|not support|does not support|invalid|unknown|unrecognized/.test(text);
}

async function parseChatCompletionsStream(body, onDelta, settings = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const stripThinking = shouldStripThinkingOutput(settings);
  const state = createThinkingStripState();
  let buffer = "";
  let answer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        const delta = parseStreamLineDelta(line, settings);
        if (!delta) continue;
        const cleanDelta = stripThinking ? stripThinkingChunk(delta, state) : delta;
        if (!cleanDelta) continue;
        answer += cleanDelta;
        onDelta(cleanDelta);
      }
    }

    if (buffer.trim()) {
      const delta = parseStreamLineDelta(buffer, settings);
      const cleanDelta = stripThinking ? stripThinkingChunk(delta, state) : delta;
      if (cleanDelta) {
        answer += cleanDelta;
        onDelta(cleanDelta);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const tail = stripThinking ? cleanModelOutput(state.buffer, settings) : "";
  if (tail && !state.inThinking) {
    answer += tail;
    onDelta(tail);
  }
  return cleanModelOutput(answer, settings);
}

function parseStreamLineDelta(line, settings = {}) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return "";
  const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!data || data === "[DONE]") return "";
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    return "";
  }
  const choice = payload?.choices?.[0];
  const includeThinking = normalizeThinkingMode(settings?.thinkingMode) === "show";
  return firstModelContent([
    choice?.delta?.content,
    choice?.message?.content,
    ...(includeThinking ? [
      choice?.delta?.reasoning_content,
      choice?.delta?.reasoning,
      choice?.delta?.thinking,
      choice?.delta?.thought,
      choice?.message?.reasoning_content,
      choice?.message?.reasoning,
      choice?.message?.thinking,
      choice?.message?.thought
    ] : []),
    payload?.delta,
    payload?.text
  ]);
}

function extractAssistantContent(payload, settings = {}) {
  const includeThinking = normalizeThinkingMode(settings?.thinkingMode) === "show";
  const message = payload?.choices?.[0]?.message;
  return firstModelContent([
    message?.content,
    ...(includeThinking ? [
      message?.reasoning_content,
      message?.reasoning,
      message?.thinking,
      message?.thought
    ] : []),
    payload?.choices?.[0]?.text,
    payload?.message?.content,
    payload?.text,
    payload?.raw
  ]);
}

function firstModelContent(values) {
  for (const value of values) {
    const text = normalizeModelContent(value);
    if (text) return text;
  }
  return "";
}

function extractModelIds(payload) {
  const candidates = [];
  collectModelCandidates(payload?.data, candidates);
  collectModelCandidates(payload?.models, candidates);
  if (!candidates.length) collectModelCandidates(payload, candidates);
  return [...new Set(candidates.map((model) => normalizeString(model)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

function collectModelCandidates(value, out) {
  if (!value) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectModelCandidates(entry, out);
    return;
  }
  if (typeof value !== "object") return;
  const id = value.id || value.model || value.name;
  if (typeof id === "string") out.push(id);
  if (Array.isArray(value.data)) collectModelCandidates(value.data, out);
  if (Array.isArray(value.models)) collectModelCandidates(value.models, out);
}

function normalizeModelContent(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeModelContent(entry)).filter(Boolean).join("");
  }
  if (value && typeof value === "object") {
    return normalizeModelContent(value.text) ||
      normalizeModelContent(value.content) ||
      normalizeModelContent(value.delta);
  }
  return "";
}

function createThinkingStripState() {
  return {
    inThinking: false,
    buffer: ""
  };
}

function cleanModelOutput(text, settings = {}) {
  if (!shouldStripThinkingOutput(settings)) {
    return normalizeTextBlock(text);
  }
  const state = createThinkingStripState();
  const stripped = stripThinkingChunk(String(text || ""), state);
  return normalizeTextBlock(state.inThinking ? stripped : `${stripped}${state.buffer}`)
    .replace(/[ \t]{2,}/g, " ");
}

function stripThinkingChunk(chunk, state) {
  const openTags = ["<think>", "<thought>"];
  const closeTags = ["</think>", "</thought>"];
  let input = `${state.buffer}${chunk}`;
  state.buffer = "";
  if (!input) return "";

  let output = "";
  while (input) {
    const lower = input.toLowerCase();
    if (state.inThinking) {
      const close = findFirstTag(lower, closeTags);
      if (!close) {
        state.buffer = keepPossibleTagTail(input, closeTags);
        return output;
      }
      input = input.slice(close.index + close.tag.length);
      state.inThinking = false;
      continue;
    }

    const open = findFirstTag(lower, openTags);
    if (!open) {
      const tail = keepPossibleTagTail(input, openTags);
      output += input.slice(0, input.length - tail.length);
      state.buffer = tail;
      return output;
    }
    output += input.slice(0, open.index);
    input = input.slice(open.index + open.tag.length);
    state.inThinking = true;
  }
  return output;
}

function findFirstTag(lowerText, tags) {
  let best = null;
  for (const tag of tags) {
    const index = lowerText.indexOf(tag);
    if (index >= 0 && (!best || index < best.index)) best = { index, tag };
  }
  return best;
}

function keepPossibleTagTail(text, tags) {
  const lower = text.toLowerCase();
  let best = "";
  for (const tag of tags) {
    const max = Math.min(lower.length, tag.length - 1);
    for (let length = max; length > best.length; length -= 1) {
      if (tag.startsWith(lower.slice(-length))) {
        best = text.slice(text.length - length);
        break;
      }
    }
  }
  return best;
}

function shouldStripThinkingOutput(settings) {
  return normalizeThinkingMode(settings?.thinkingMode) !== "show";
}

function getProviderRequestExtras(settings) {
  const provider = normalizeProvider(settings?.provider);
  const model = settings?.model;
  const thinkingMode = normalizeThinkingMode(settings?.thinkingMode);
  const reasoningLevel = normalizeReasoningLevel(settings?.reasoningLevel);
  if (thinkingMode === "disabled") {
    if (provider === "deepseek" || provider === "minimax") {
      return {
        thinking: { type: "disabled" }
      };
    }
    if (provider === "openai" && usesReasoningEffort(model)) {
      return {
        reasoning_effort: "minimal"
      };
    }
    return {};
  }
  if (provider === "deepseek") {
    return buildDeepSeekReasoningExtras(model, reasoningLevel);
  }
  if (reasoningLevel === "default") return {};
  if (provider === "minimax") {
    return {
      thinking: { type: "adaptive" }
    };
  }
  if (provider === "openai" && usesReasoningEffort(model)) {
    return {
      reasoning_effort: mapReasoningLevelToOpenAIEffort(reasoningLevel)
    };
  }
  return {};
}

function buildDeepSeekReasoningExtras(model, reasoningLevel) {
  const name = normalizeString(model).toLowerCase();
  if (!/^deepseek-v4-(flash|pro)/.test(name) && !/^deepseek-(reasoner|r1)/.test(name)) {
    return {};
  }
  if (reasoningLevel === "minimal") {
    return {
      thinking: { type: "disabled" }
    };
  }
  const isDeepSeekV4 = /^deepseek-v4-(flash|pro)/.test(name);
  const effort = reasoningLevel === "xhigh" ? "max" : reasoningLevel === "high" || (isDeepSeekV4 && reasoningLevel === "default") ? "high" : null;
  return {
    thinking: { type: "enabled" },
    ...(effort ? { reasoning_effort: effort } : {})
  };
}

function mapReasoningLevelToOpenAIEffort(level) {
  if (level === "minimal") return "minimal";
  if (level === "low") return "low";
  if (level === "medium") return "medium";
  if (level === "high" || level === "xhigh") return "high";
  return "medium";
}

function buildChatEndpoint(baseUrl) {
  const trimmed = normalizeOpenAICompatibleBase(baseUrl);
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

function buildModelsEndpoint(baseUrl) {
  const trimmed = normalizeOpenAICompatibleBase(baseUrl);
  if (/\/models$/i.test(trimmed)) return trimmed;
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed.replace(/\/chat\/completions$/i, "/models");
  }
  return `${trimmed}/models`;
}

function normalizeOpenAICompatibleBase(baseUrl) {
  const trimmed = normalizeString(baseUrl).replace(/\/+$/, "");
  if (!trimmed) return "";
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const origin = parsed.origin;
  if ((host === "api.deepseek.com" || host === "api.minimaxi.com" || host === "api.minimax.io") && path === "/") {
    return `${origin}/v1`;
  }
  return trimmed;
}

function buildOutputTokenParam(model, maxOutputTokens) {
  const tokens = normalizeMaxOutputTokens(maxOutputTokens, model);
  if (!tokens) return {};
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: tokens }
    : { max_tokens: tokens };
}

function usesMaxCompletionTokens(model) {
  const name = normalizeString(model).toLowerCase();
  return name.startsWith("gpt-5") || /^o\d/.test(name) || name.includes("reasoning");
}

function usesReasoningEffort(model) {
  const name = normalizeString(model).toLowerCase();
  return name.startsWith("gpt-5") || /^o\d/.test(name);
}

function applyInputBudget(messages, settings) {
  const cap = normalizeInputTokenCap(settings.inputTokenCap, settings.model);
  const outputReserve = normalizeMaxOutputTokens(settings.maxOutputTokens, settings.model);
  const softLimit = Math.max(512, Math.floor(cap * INPUT_CAP_SAFETY_RATIO) - outputReserve);
  let working = messages.map((message) => ({ ...message }));
  const estimatedBeforeTokens = estimateMessagesTokens(working);
  if (estimatedBeforeTokens <= softLimit) {
    return {
      messages: working,
      capped: false,
      limitTokens: cap,
      softLimitTokens: softLimit,
      estimatedBeforeTokens,
      estimatedAfterTokens: estimatedBeforeTokens
    };
  }

  working = dropOldHistoryMessages(working, softLimit);
  working = trimPaperContextMessage(working, softLimit);
  working = trimLastUserMessage(working, softLimit);
  return {
    messages: working,
    capped: true,
    limitTokens: cap,
    softLimitTokens: softLimit,
    estimatedBeforeTokens,
    estimatedAfterTokens: estimateMessagesTokens(working)
  };
}

function dropOldHistoryMessages(messages, softLimit) {
  const working = [...messages];
  while (estimateMessagesTokens(working) > softLimit && working.length > 3) {
    const index = working.findIndex((message, i) => i > 1 && i < working.length - 1);
    if (index < 0) break;
    working.splice(index, 1);
  }
  return working;
}

function trimPaperContextMessage(messages, softLimit) {
  const working = [...messages];
  let index = working.findIndex((message) =>
    message.role === "user" &&
    typeof message.content === "string" &&
    message.content.includes("Full text excerpt:")
  );
  if (index < 0) return working;
  let guard = 0;
  while (estimateMessagesTokens(working) > softLimit && guard < 12) {
    guard += 1;
    const content = working[index].content;
    const marker = "Full text excerpt:\n";
    const markerIndex = content.indexOf(marker);
    if (markerIndex < 0) break;
    const prefix = content.slice(0, markerIndex + marker.length);
    const body = content.slice(markerIndex + marker.length);
    const nextChars = Math.floor(body.length * 0.72);
    if (nextChars < 1200) {
      working[index] = {
        ...working[index],
        content: content.slice(0, markerIndex).trim()
      };
      break;
    }
    working[index] = {
      ...working[index],
      content: `${prefix}${body.slice(0, nextChars).trim()}\n\n[正文已按模型输入预算截断]`
    };
  }
  return working;
}

function trimLastUserMessage(messages, softLimit) {
  const working = [...messages];
  const index = findLastIndex(working, (message) => message.role === "user");
  if (index < 0) return working;
  let guard = 0;
  while (estimateMessagesTokens(working) > softLimit && guard < 10) {
    guard += 1;
    const content = normalizeString(working[index].content);
    if (content.length < 500) break;
    working[index] = {
      ...working[index],
      content: `${content.slice(0, Math.floor(content.length * 0.75)).trim()}\n\n[问题已按模型输入预算截断]`
    };
  }
  return working;
}

function estimateMessagesTokens(messages) {
  return messages.reduce((total, message) => {
    const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content || "");
    return total + 4 + estimateTextTokens(message.role || "") + estimateTextTokens(content);
  }, 0);
}

function estimateTextTokens(text) {
  return Math.ceil(String(text || "").length / CHARS_PER_TOKEN_ESTIMATE);
}

function findLastIndex(array, predicate) {
  for (let index = array.length - 1; index >= 0; index -= 1) {
    if (predicate(array[index], index)) return index;
  }
  return -1;
}

function buildPrompt({ paper, mode, question, fullText, contextSource, language, conversationMessages = [] }) {
  const outputLanguage = resolveOutputLanguageInstruction(language);
  const promptLanguage = resolveOutputLanguageCode(language);
  const paperBlock = [
    `Title: ${paper.title || "Unknown"}`,
    `${paper.sourceType === "arxiv" ? "arXiv ID" : "Document ID"}: ${paper.id || "Unknown"}`,
    `Authors: ${paper.authors || "Unknown"}`,
    `Submitted: ${paper.submittedAt || "Unknown"}`,
    `Updated: ${paper.paperUpdatedAt || "Unknown"}`,
    `Subjects: ${paper.subjects || "Unknown"}`,
    `Comments: ${paper.comments || "None"}`,
    `PDF: ${paper.pdfUrl || "Unknown"}`,
    `Abstract: ${paper.abstract || "No abstract extracted."}`,
    fullText ? `Full text excerpt:\n${fullText}` : ""
  ].filter(Boolean).join("\n\n");

  const modeInstruction = getModeInstruction(mode, question, promptLanguage);
  const messages = [
    {
      role: "system",
      content: [
        "You are a rigorous research-reading assistant for research papers and PDF documents.",
        `Answer in ${outputLanguage}.`,
        "Be precise and evidence-aware. Separate what the paper claims from what can be inferred.",
        "If the available context is only metadata or abstract, state that limitation clearly.",
        "Prefer structured Markdown with concise bullets and concrete learning actions.",
        "Write every variable, equation, loss, probability expression, and tensor notation as LaTeX math using $...$ for inline math or $$...$$ for display math. Do not leave raw identifiers such as h_v, x_t, or q(x_t|x_0) outside math delimiters."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `${promptLanguage === "zh-CN" ? "上下文来源" : "Context source"}: ${contextSource}.`,
        promptLanguage === "zh-CN" ? "论文上下文：" : "Paper context:",
        paperBlock
      ].join("\n")
    }
  ];

  for (const message of conversationMessages) {
    messages.push({
      role: message.role,
      content: message.text
    });
  }

  messages.push({
    role: "user",
    content: modeInstruction
  });

  return messages;
}

function getModeInstruction(mode, question, language = "zh-CN") {
  if (language === "en") {
    if (mode === "deep") {
      return [
        "Please provide a deep reading analysis suitable for seriously studying this paper. Include:",
        "1. The core problem this paper addresses, and why the problem matters.",
        "2. The limitations of related or prior methods, and the gap the authors claim.",
        "3. The main method: inputs, key modules, training/inference flow, objective functions, or algorithmic ideas.",
        "4. Experimental design: datasets, baselines, metrics, ablations, main results, and a distinction between factual results and author interpretation.",
        "5. Key assumptions, limitations, failure cases, and practical reproducibility risks.",
        "6. The 5 most valuable follow-up questions if I want to keep researching this direction.",
        "7. A final takeaway in no more than 5 lines."
      ].join("\n");
    }

    if (mode === "study") {
      return [
        "Please turn this paper into daily study material. Include:",
        "1. A 15-minute skim route: which figures/tables/sections to inspect first, and what to capture.",
        "2. A 45-60 minute close-reading route with step-by-step reading tasks.",
        "3. Background knowledge and keywords I should learn.",
        "4. 5 active-recall questions with short reference answers.",
        "5. 3 Anki-style cards in Q: / A: format.",
        "6. One executable mini reproduction or extension exercise.",
        "7. A Markdown note template suitable for Zotero/Obsidian."
      ].join("\n");
    }

    if (mode === "ask") {
      return [
        "Please answer my specific question based on the paper context.",
        `Question: ${question || "Which parts of this paper are most worth reading carefully?"}`,
        "If the context is insufficient for a reliable answer, explain what is missing and suggest the next reading step."
      ].join("\n");
    }

    return [
      "Please quickly summarize this paper with the following structure:",
      "1. One-sentence summary.",
      "2. Research problem: what exactly is it trying to solve?",
      "3. Method: what is the core method/model/algorithm?",
      "4. Results: what are the most important experimental findings?",
      "5. Contribution: what is new compared with prior work?",
      "6. Limitations: which conclusions should be treated cautiously?",
      "7. Today's study advice: which 2-3 parts should I focus on?",
      "8. 3 follow-up questions to help me decide whether this paper deserves a deep read."
    ].join("\n");
  }

  if (mode === "deep") {
    return [
      "请做一次适合认真读论文的深度解析，包含：",
      "1. 这篇论文要解决的核心问题，以及这个问题为什么重要。",
      "2. 相关工作或已有方法的不足，作者声称的缺口是什么。",
      "3. 方法主线：输入、关键模块、训练/推理流程、目标函数或算法思想。",
      "4. 实验设计：数据集、基线、指标、消融、主要结果，区分事实结果和作者解释。",
      "5. 关键假设、局限、失败场景和可能的复现实操风险。",
      "6. 如果我要继续研究这个方向，最值得追问的 5 个问题。",
      "7. 用 5 行以内给出最终 takeaway。"
    ].join("\n");
  }

  if (mode === "study") {
    return [
      "请把这篇论文转成每日学习材料，包含：",
      "1. 15 分钟速读路线：先看哪些图表/段落，应该抓住什么。",
      "2. 45-60 分钟精读路线：按步骤列出阅读任务。",
      "3. 需要补的背景知识和关键词。",
      "4. 5 个主动回忆问题，并在每个问题后给出简短参考答案。",
      "5. 3 张 Anki 风格卡片，格式为 Q: / A:。",
      "6. 一个可执行的小复现或扩展练习。",
      "7. 适合写进 Zotero/Obsidian 的 Markdown 笔记模板。"
    ].join("\n");
  }

  if (mode === "ask") {
    return [
      "请基于论文上下文回答我的具体问题。",
      `问题：${question || "请指出这篇论文最值得精读的部分。"}`,
      "如果上下文不足以可靠回答，请说明缺少什么信息，并给出下一步阅读建议。"
    ].join("\n");
  }

  return [
    "请快速总结这篇论文，输出结构：",
    "1. 一句话概括。",
    "2. 研究问题：它到底想解决什么？",
    "3. 方法：核心方法/模型/算法是什么？",
    "4. 结果：最重要的实验发现是什么？",
    "5. 贡献：相比已有工作新在哪里？",
    "6. 局限：哪些结论需要谨慎看？",
    "7. 今日学习建议：我应该重点读哪 2-3 个部分？",
    "8. 3 个追问问题，帮助我判断这篇论文是否值得深读。"
  ].join("\n");
}

async function fetchAr5ivText(arxivId, maxChars) {
  const cleanId = arxivId.replace(/^arXiv:/i, "").trim();
  const url = `https://ar5iv.labs.arxiv.org/html/${encodeURIComponent(cleanId)}`;
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`ar5iv returned ${response.status}`);
  }
  const html = await response.text();
  const text = htmlToReadableText(html);
  return text.slice(0, Math.max(4000, Number(maxChars) || DEFAULT_PROFILE_SETTINGS.maxContextChars));
}

async function getPaperContext(settings, paper, contextMode = "auto") {
  let fullText = "";
  let contextSource = paper.sourceType === "arxiv" ? "arXiv 摘要和页面元数据" : "页面元数据";
  let pdfFailure = "";
  const providedFullText = normalizeTextBlock(paper.fullText);
  if (providedFullText.length > PDF_TEXT_MIN_CHARS) {
    const cacheKey = paper.id || paper.pdfUrl;
    const contextSource = normalizeString(paper.contextSource) || PDF_TEXT_CONTEXT_SOURCE;
    if (cacheKey) {
      await savePaperContextCache(cacheKey, {
        fullText: providedFullText.slice(0, settings.maxContextChars),
        contextSource,
        maxContextChars: settings.maxContextChars,
        updatedAt: new Date().toISOString()
      });
    }
    return {
      fullText: providedFullText.slice(0, settings.maxContextChars),
      contextSource
    };
  }
  if (providedFullText) {
    pdfFailure = `provided PDF text too short (${providedFullText.length} chars)`;
  } else if (paper.contextSource && /失败|failed|error/i.test(paper.contextSource)) {
    pdfFailure = normalizeString(paper.contextSource);
  }

  const cacheKey = paper.id || paper.pdfUrl;
  const { paperContextCache = {} } = await chrome.storage.local.get("paperContextCache");
  const cached = cacheKey ? paperContextCache[cacheKey] : null;
  const shouldFetchFullText = contextMode === "full" ||
    (contextMode === "auto" && (paper.sourceType === "pdf" || shouldUseFullTextByDefault(settings)));
  if (
    cached &&
    cached.maxContextChars >= settings.maxContextChars &&
    typeof cached.fullText === "string" &&
    cached.fullText.length > PDF_TEXT_MIN_CHARS
  ) {
    return {
      fullText: cached.fullText.slice(0, settings.maxContextChars),
      contextSource: cached.contextSource || PDF_TEXT_CONTEXT_SOURCE
    };
  }

  if (!shouldFetchFullText) {
    return { fullText, contextSource };
  }

  if (shouldFetchFullText && paper.pdfUrl && !pdfFailure) {
    pdfFailure = "页面侧没有传入 PDF 正文，请重新加载扩展并刷新当前页面";
  }

  if (!settings.useAr5iv || paper.sourceType !== "arxiv" || !paper.id) {
    if (shouldFetchFullText && paper.sourceType === "pdf") {
      contextSource = pdfFailure
        ? `页面元数据（PDF 抽取失败：${pdfFailure}）`
        : "页面元数据（没有可读取的 PDF URL）";
    }
    return { fullText, contextSource };
  }

  try {
    const ar5ivText = await fetchAr5ivText(paper.id, settings.maxContextChars);
    if (ar5ivText && ar5ivText.length > PDF_TEXT_MIN_CHARS) {
      fullText = ar5ivText;
      contextSource = "ar5iv HTML 正文节选 + arXiv 摘要和页面元数据";
      if (cacheKey) {
        await savePaperContextCache(cacheKey, {
          fullText,
          contextSource,
          maxContextChars: settings.maxContextChars,
          updatedAt: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.info("ar5iv text unavailable:", error.message);
    if (pdfFailure) {
      contextSource = `arXiv 摘要和页面元数据（PDF 抽取失败：${pdfFailure}；ar5iv 也不可用：${error.message || String(error)}）`;
    }
  }

  return { fullText, contextSource };
}

async function savePaperContextCache(id, entry) {
  const { paperContextCache = {} } = await chrome.storage.local.get("paperContextCache");
  paperContextCache[id] = entry;
  const entries = Object.entries(paperContextCache)
    .sort((a, b) => String(b[1]?.updatedAt || "").localeCompare(String(a[1]?.updatedAt || "")))
    .slice(0, MAX_CONTEXT_CACHE_ENTRIES);
  await chrome.storage.local.set({ paperContextCache: Object.fromEntries(entries) });
}

async function getConversation(id) {
  if (!id) return null;
  const { conversations = {} } = await chrome.storage.local.get("conversations");
  return conversations[id] || null;
}

async function clearConversation(id) {
  if (!id) return true;
  const { conversations = {} } = await chrome.storage.local.get("conversations");
  delete conversations[id];
  await chrome.storage.local.set({ conversations });
  return true;
}

async function appendConversationTurn({ paper, mode, question, answer, source, settings, inputBudget, webchatSession = null, createdAt, stopped = false }) {
  const id = paper.id;
  const storedPaper = stripTransientPaperFields(paper);
  const { conversations = {} } = await chrome.storage.local.get("conversations");
  const previous = conversations[id] || {};
  const messages = Array.isArray(previous.messages) ? previous.messages : [];
  const turnId = createId();
  const title = previous.title || paper.title || id;
  const userText = buildUserConversationText(mode, question);
  const now = createdAt || new Date().toISOString();

  const nextMessages = [
    ...messages,
    {
      id: `${turnId}-u`,
      turnId,
      role: "user",
      mode,
      text: userText,
      createdAt: now
    },
    {
      id: `${turnId}-a`,
      turnId,
      role: "assistant",
      mode,
      text: normalizeTextBlock(answer),
      source,
      model: settings.model,
      provider: settings.provider,
      maxOutputTokens: settings.maxOutputTokens,
      inputTokenCap: settings.inputTokenCap,
      contextTokens: inputBudget?.estimatedAfterTokens,
      contextWindow: inputBudget?.limitTokens,
      contextCapped: inputBudget?.capped,
      stopped: Boolean(stopped),
      webchatSession: webchatSession || undefined,
      createdAt: now
    }
  ].slice(-MAX_MESSAGES_PER_CONVERSATION);

  const previousWebChatSessions = previous.webchatSessions && typeof previous.webchatSessions === "object"
    ? previous.webchatSessions
    : {};
  const normalizedSession = normalizeWebChatSession(webchatSession);
  const sessionKey = normalizedSession ? buildWebChatSessionKey(normalizedSession.provider, normalizedSession.profileId) : "";
  const webchatSessions = normalizedSession?.provider
    ? {
      ...previousWebChatSessions,
      [sessionKey]: {
        ...previousWebChatSessions[sessionKey],
        ...normalizedSession,
        updatedAt: now
      }
    }
    : previousWebChatSessions;

  conversations[id] = {
    ...previous,
    ...storedPaper,
    id,
    title,
    kind: paper.sourceType === "pdf" ? "pdf" : "paper",
    createdAt: previous.createdAt || now,
    updatedAt: now,
    lastMode: mode,
    lastQuestion: userText,
    lastAnswer: normalizeTextBlock(answer),
    lastSource: source,
    lastStopped: Boolean(stopped),
    provider: settings.provider,
    model: settings.model,
    maxOutputTokens: settings.maxOutputTokens,
    inputTokenCap: settings.inputTokenCap,
    contextTokens: inputBudget?.estimatedAfterTokens,
    contextWindow: inputBudget?.limitTokens,
    contextCapped: inputBudget?.capped,
    webchatSessions,
    messageCount: nextMessages.length,
    turnCount: countUserTurns(nextMessages),
    messages: nextMessages
  };

  const pruned = Object.fromEntries(
    Object.entries(conversations)
      .sort((a, b) => String(b[1]?.updatedAt || "").localeCompare(String(a[1]?.updatedAt || "")))
      .slice(0, MAX_CONVERSATIONS)
  );
  await chrome.storage.local.set({ conversations: pruned });
  return pruned[id];
}

function stripTransientPaperFields(paper = {}) {
  const { webchatPdf, ...storedPaper } = paper || {};
  return storedPaper;
}

function getReusableWebChatSession(conversation, settings) {
  const provider = normalizeProvider(settings?.provider);
  const profileId = normalizeString(settings?.requestProfileId);
  const sessions = conversation?.webchatSessions && typeof conversation.webchatSessions === "object"
    ? conversation.webchatSessions
    : {};
  const session = normalizeWebChatSession(sessions[buildWebChatSessionKey(provider, profileId)]);
  if (!session?.chatUrl || session.pdfAttached !== true) return null;
  return session.provider === provider && session.profileId === profileId ? session : null;
}

function normalizeWebChatSession(value) {
  if (!value || typeof value !== "object") return null;
  const provider = normalizeProvider(value.provider || value.profileProvider || "");
  if (!isWebChatProvider(provider)) return null;
  const chatUrl = normalizeWebChatChatUrl(value.chatUrl || value.remoteChatUrl || "");
  if (!chatUrl) return null;
  const profileId = normalizeString(value.profileId || value.requestProfileId);
  return {
    provider,
    profileId,
    profileName: normalizeString(value.profileName || value.requestProfileName),
    model: normalizeString(value.model),
    chatUrl,
    chatId: normalizeString(value.chatId || value.remoteChatId || extractWebChatChatId(chatUrl)),
    label: normalizeString(value.label || providerLabel(provider)),
    pdfAttached: value.pdfAttached === true,
    pdfFilename: sanitizePdfFilename(value.pdfFilename || value.attachmentFilename || ""),
    pdfSize: Number(value.pdfSize) || 0,
    pdfAttachedAt: normalizeString(value.pdfAttachedAt || value.attachmentVerifiedAt || ""),
    updatedAt: normalizeString(value.updatedAt)
  };
}

function buildWebChatSessionKey(provider, profileId) {
  return `${normalizeProvider(provider)}:${normalizeString(profileId) || "default"}`;
}

function getRecentConversationMessages(messages, settings) {
  const historyTurns = normalizeHistoryTurns(settings.historyTurns);
  const messageLimit = Math.max(2, historyTurns * 2);
  const messageChars = normalizeHistoryMessageChars(settings.historyMessageChars);
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && message.text)
    .slice(-messageLimit)
    .map((message) => ({
      role: message.role,
      text: truncateTextBlock(message.text, messageChars)
    }));
}

function resolveContextMode(mode, requested) {
  if (requested === "full") return "full";
  if (requested === "fast" && !["quick", "deep", "study", "ask"].includes(mode)) return "fast";
  if (["quick", "deep", "study", "ask"].includes(mode)) return "full";
  return "auto";
}

function shouldUseFullTextByDefault(settings) {
  return settings.defaultContextMode === "full";
}

function buildUserConversationText(mode, question) {
  if (mode === "ask") {
    return normalizeString(question) || "请指出这篇论文最值得精读的部分。";
  }
  if (mode === "deep") return "请做一次适合认真读论文的深度解析。";
  if (mode === "study") return "请把这篇论文转成每日学习材料。";
  return "请快速总结这篇论文。";
}

function countUserTurns(messages) {
  return messages.filter((message) => message.role === "user").length;
}

function createId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

function htmlToReadableText(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<math[\s\S]*?<\/math>/gi, " [math] ")
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower[0] === "#") {
      const code = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, lower) ? named[lower] : match;
  });
}

async function saveNote(paper, summary, mode = "quick") {
  const normalizedPaper = normalizePaper(paper);
  if (!normalizedPaper.id) throw new Error("没有识别到文档 ID，无法保存。");
  const now = new Date().toISOString();
  const { notes = {} } = await chrome.storage.local.get("notes");
  const previous = notes[normalizedPaper.id] || {};
  const history = Array.isArray(previous.history) ? previous.history : [];

  notes[normalizedPaper.id] = {
    ...previous,
    ...normalizedPaper,
    summary: normalizeTextBlock(summary),
    mode,
    createdAt: previous.createdAt || now,
    updatedAt: now,
    history: [
      ...history,
      {
        mode,
        summary: normalizeTextBlock(summary),
        createdAt: now
      }
    ].slice(-12)
  };

  await chrome.storage.local.set({ notes });
  return notes[normalizedPaper.id];
}

async function getNote(id) {
  const { notes = {} } = await chrome.storage.local.get("notes");
  return notes[id] || null;
}

async function deleteNote(id) {
  const { notes = {} } = await chrome.storage.local.get("notes");
  delete notes[id];
  await chrome.storage.local.set({ notes });
  return true;
}

async function openExtensionPage(page) {
  await chrome.tabs.create({ url: chrome.runtime.getURL(page) });
  return true;
}

async function openOptionsPage() {
  await chrome.runtime.openOptionsPage();
  return true;
}

function normalizePaper(paper = {}) {
  const id = normalizeString(paper.id);
  return {
    id,
    sourceType: normalizeString(paper.sourceType) || (/^pdf:/i.test(id) ? "pdf" : "arxiv"),
    title: normalizeString(paper.title),
    authors: normalizeString(paper.authors),
    abstract: normalizeString(paper.abstract),
    subjects: normalizeString(paper.subjects),
    comments: normalizeString(paper.comments),
    submittedAt: normalizeString(paper.submittedAt),
    paperUpdatedAt: normalizeString(paper.paperUpdatedAt),
    pdfUrl: normalizeString(paper.pdfUrl),
    pageUrl: normalizeString(paper.pageUrl),
    fullText: truncateTextBlock(paper.fullText, DEFAULT_PROFILE_SETTINGS.maxContextChars * 5),
    contextSource: normalizeString(paper.contextSource),
    webchatPdf: normalizeWebChatPdf(paper.webchatPdf)
  };
}

function normalizeWebChatPdf(value) {
  if (!value || typeof value !== "object") return null;
  const base64 = normalizeString(value.base64);
  if (!base64) return null;
  return {
    base64,
    filename: sanitizePdfFilename(value.filename || "paper.pdf"),
    size: Number(value.size) || 0,
    url: normalizeString(value.url)
  };
}

function createDefaultSettings() {
  return {
    ...DEFAULT_SETTINGS,
    modelProfiles: []
  };
}

function normalizeSettings(settings) {
  const modelProfiles = normalizeModelProfiles(settings?.modelProfiles, settings);
  return {
    ...DEFAULT_SETTINGS,
    language: normalizeLanguage(settings?.language),
    appearance: normalizeAppearance(settings?.appearance),
    modelProfiles
  };
}

function recoverSettings(...candidates) {
  const normalizedCandidates = candidates
    .filter((candidate) => candidate && typeof candidate === "object")
    .map((candidate) => normalizeSettings(candidate));
  const primary = normalizedCandidates[0] || createDefaultSettings();
  const profileSource = normalizedCandidates.find((candidate) => candidate.modelProfiles.length);
  if (!profileSource) return primary;
  return {
    ...primary,
    modelProfiles: profileSource.modelProfiles
  };
}

function createProfilesSnapshotSettings(modelProfiles) {
  return Array.isArray(modelProfiles) && modelProfiles.length
    ? { modelProfiles }
    : null;
}

function shouldPersistRecoveredSettings(existing, recovered) {
  if (!existing) return true;
  const normalizedExisting = normalizeSettings(existing);
  const normalizedRecovered = normalizeSettings(recovered);
  return !normalizedExisting.modelProfiles.length && normalizedRecovered.modelProfiles.length > 0;
}

function withSettingsMetadata(settings) {
  return {
    ...normalizeSettings(settings),
    savedAt: new Date().toISOString(),
    extensionVersion: chrome.runtime.getManifest().version
  };
}

function normalizeModelProfiles(value, legacySettings = {}) {
  let profiles = Array.isArray(value)
    ? value.map((profile) => normalizeModelProfile(profile)).filter(Boolean)
    : [];

  if (!profiles.length) {
    const provider = normalizeProvider(legacySettings?.provider || inferProviderFromBaseUrl(legacySettings?.baseUrl));
    const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.openai;
    const hasLegacyConfig = Boolean(
      normalizeString(legacySettings?.baseUrl) ||
      normalizeString(legacySettings?.apiKey) ||
      normalizeString(legacySettings?.model)
    );
    if (hasLegacyConfig) {
      profiles = [normalizeModelProfile({
        id: "profile-migrated",
        name: "Migrated model",
        provider,
        baseUrl: normalizeString(legacySettings?.baseUrl) || preset.baseUrl,
        apiKey: normalizeString(legacySettings?.apiKey),
        model: normalizeString(legacySettings?.model) || preset.model,
        temperature: legacySettings?.temperature,
        maxContextChars: legacySettings?.maxContextChars,
        useAr5iv: legacySettings?.useAr5iv
      })].filter(Boolean);
    }
  }

  const seen = new Set();
  return profiles.map((profile) => {
    let id = profile.id;
    while (seen.has(id)) id = createProfileId();
    seen.add(id);
    return { ...profile, id };
  });
}

function normalizeModelProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const inferredProvider = inferProviderFromBaseUrl(profile.baseUrl);
  const provider = inferredProvider !== "custom"
    ? inferredProvider
    : normalizeProvider(profile.provider);
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
  const model = normalizeString(profile.model) || preset.model;
  const baseUrl = normalizeString(profile.baseUrl) || preset.baseUrl;
  const name = normalizeString(profile.name) || `${providerLabel(provider)} ${model || "model"}`;
  const temperature = normalizeTemperature(profile.temperature);
  const maxContextChars = normalizeMaxContextChars(profile.maxContextChars);

  return {
    id: normalizeString(profile.id) || createProfileId(),
    name,
    provider,
    baseUrl,
    apiKey: normalizeString(profile.apiKey),
    model,
    temperature,
    maxContextChars,
    maxOutputTokens: normalizeMaxOutputTokens(profile.maxOutputTokens, model),
    inputTokenCap: normalizeInputTokenCap(profile.inputTokenCap, model),
    historyTurns: normalizeHistoryTurns(profile.historyTurns),
    historyMessageChars: normalizeHistoryMessageChars(profile.historyMessageChars),
    defaultContextMode: normalizeDefaultContextMode(profile.defaultContextMode),
    thinkingMode: normalizeThinkingMode(profile.thinkingMode),
    reasoningLevel: normalizeReasoningLevel(profile.reasoningLevel),
    useAr5iv: profile.useAr5iv !== false
  };
}

function resolveRequestSettings(settings, profileId) {
  const profiles = Array.isArray(settings?.modelProfiles) ? settings.modelProfiles : [];
  if (!profiles.length) {
    throw new Error("还没有模型配置。请先打开 arXivMate 设置，新建并测试一个模型。");
  }
  const id = normalizeString(profileId);
  const profile = profiles.find((item) => item.id === id) || profiles[0];
  validateModelProfile(profile);
  return {
    ...settings,
    ...flattenProfile(profile),
    requestProfileId: profile.id,
    requestProfileName: profile.name
  };
}

function validateModelProfile(profile) {
  if (isWebChatProvider(profile?.provider)) return;
  if (!profile?.baseUrl) throw new Error("请填写模型配置的 API Base URL。");
  if (!profile?.model) throw new Error("请填写模型配置的模型名称。");
}

function flattenProfile(profile) {
  return {
    provider: profile.provider,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    temperature: profile.temperature,
    maxContextChars: profile.maxContextChars,
    maxOutputTokens: profile.maxOutputTokens,
    inputTokenCap: profile.inputTokenCap,
    historyTurns: profile.historyTurns,
    historyMessageChars: profile.historyMessageChars,
    defaultContextMode: profile.defaultContextMode,
    thinkingMode: profile.thinkingMode,
    reasoningLevel: profile.reasoningLevel,
    useAr5iv: profile.useAr5iv
  };
}

function normalizeTemperature(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PROFILE_SETTINGS.temperature;
  return Math.min(2, Math.max(0, parsed));
}

function normalizeMaxContextChars(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 4000) return DEFAULT_PROFILE_SETTINGS.maxContextChars;
  return Math.min(parsed, 60000);
}

function normalizeMaxOutputTokens(value, model) {
  const parsed = Math.floor(Number(value));
  const fallback = DEFAULT_PROFILE_SETTINGS.maxOutputTokens;
  if (!Number.isFinite(parsed) || parsed < 128) return fallback;
  return Math.min(parsed, getModelOutputTokenLimit(model));
}

function normalizeInputTokenCap(value, model) {
  const parsed = Math.floor(Number(value));
  const fallback = getModelInputTokenLimit(model);
  if (!Number.isFinite(parsed) || parsed < 1000) return fallback;
  return Math.min(parsed, 1000000);
}

function normalizeHistoryTurns(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PROFILE_SETTINGS.historyTurns;
  return Math.min(parsed, 20);
}

function normalizeHistoryMessageChars(value) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 400) return DEFAULT_PROFILE_SETTINGS.historyMessageChars;
  return Math.min(parsed, 8000);
}

function normalizeDefaultContextMode(value) {
  return value === "full" ? "full" : "fast";
}

function normalizeThinkingMode(value) {
  const mode = normalizeString(value).toLowerCase();
  if (mode === "show" || mode === "visible" || mode === "显示") return "show";
  if (mode === "disabled" || mode === "disable" || mode === "off" || mode === "关闭") return "disabled";
  return "hide";
}

function normalizeReasoningLevel(value) {
  const level = normalizeString(value).toLowerCase();
  if (["minimal", "low", "medium", "high", "xhigh"].includes(level)) return level;
  if (level === "max") return "xhigh";
  return "default";
}

function normalizeLanguage(value) {
  const language = normalizeString(value);
  if (language === "system" || language === "跟随系统") return "system";
  if (language === "en" || language === "English") return "en";
  if (language === "zh-CN" || language === "中文" || language === "Chinese") return "zh-CN";
  return DEFAULT_SETTINGS.language;
}

function normalizeAppearance(value) {
  const appearance = normalizeString(value);
  if (appearance === "system" || appearance === "跟随系统") return "system";
  if (appearance === "light" || appearance === "浅色") return "light";
  if (appearance === "dark" || appearance === "深色") return "dark";
  if (appearance === "sepia" || appearance === "护眼") return "sepia";
  return DEFAULT_SETTINGS.appearance;
}

function compareVersions(left, right) {
  const leftParts = normalizeVersion(left).split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const rightParts = normalizeVersion(right).split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
}

function normalizeVersion(value) {
  return normalizeString(value)
    .replace(/^refs\/tags\//i, "")
    .replace(/^v/i, "")
    .split(/[+-]/)[0];
}

function versionToTag(version) {
  const normalized = normalizeVersion(version);
  return normalized ? `v${normalized}` : "";
}

function tagToVersion(tag) {
  return normalizeVersion(tag);
}

function buildReleaseZipUrl(tag) {
  const normalized = versionToTag(tag);
  return normalized ? `https://github.com/jiahaozhang6/arXivMate/archive/refs/tags/${encodeURIComponent(normalized)}.zip` : "";
}

function findLatestStableRelease(releases) {
  const stable = Array.isArray(releases)
    ? releases.filter((release) => {
      const tag = normalizeString(release?.tag_name || release?.name);
      return !release?.draft && !release?.prerelease && /^v?\d+\.\d+\.\d+$/i.test(tag);
    })
    : [];
  return stable.sort((left, right) => compareVersions(right.tag_name || right.name, left.tag_name || left.name))[0] || null;
}

function resolveOutputLanguageInstruction(language) {
  const normalized = normalizeLanguage(language);
  if (normalized === "zh-CN") return "Chinese";
  if (normalized === "en") return "English";
  const uiLanguage = getSystemLanguage();
  return /^zh/i.test(uiLanguage) ? "Chinese" : "English";
}

function resolveOutputLanguageCode(language) {
  const normalized = normalizeLanguage(language);
  if (normalized === "zh-CN" || normalized === "en") return normalized;
  return /^zh/i.test(getSystemLanguage()) ? "zh-CN" : "en";
}

function getSystemLanguage() {
  try {
    return chrome.i18n?.getUILanguage?.() || navigator.language || "";
  } catch {
    return "";
  }
}

function getModelInputTokenLimit(model) {
  const name = normalizeString(model).toLowerCase().split("/").pop() || "";
  if (/^deepseek-v4-(flash|pro)/.test(name) || /^deepseek-(chat|reasoner)/.test(name)) return 1000000;
  if (/^gpt-4o/.test(name)) return 128000;
  if (/^gpt-5/.test(name)) return 400000;
  if (/^o(1|3)/.test(name)) return 200000;
  if (/^gemini-(1\.5|2\.5|3)/.test(name)) return 1000000;
  if (/^claude/.test(name)) return 200000;
  if (/^qwen-long/.test(name)) return 1000000;
  if (/^qwen/.test(name)) return 128000;
  if (/llama|mistral|mixtral|ollama/.test(name)) return 16000;
  return DEFAULT_PROFILE_SETTINGS.inputTokenCap;
}

function getModelOutputTokenLimit(model) {
  const name = normalizeString(model).toLowerCase().split("/").pop() || "";
  if (/^deepseek-v4-(flash|pro)/.test(name) || /^deepseek-(chat|reasoner)/.test(name)) return 64000;
  if (/^claude/.test(name)) return 64000;
  if (/^gpt-5/.test(name)) return 32768;
  if (/^gpt-4o/.test(name)) return 16384;
  return 8192;
}

function createProfileId() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function providerLabel(provider) {
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "minimax") return "MiniMax";
  if (provider === "ollama") return "Ollama";
  if (provider === "openai") return "OpenAI";
  if (provider === "webchatChatGPT") return "ChatGPT Web";
  if (provider === "webchatDeepSeek") return "DeepSeek Web";
  return "Custom";
}

function normalizeString(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeTextBlock(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function truncateTextBlock(value, maxChars) {
  const text = normalizeTextBlock(value);
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}\n\n[历史消息已截断]`;
}

function normalizeProvider(value) {
  const provider = normalizeString(value).toLowerCase();
  const direct = Object.keys(PROVIDER_PRESETS).find((key) => key.toLowerCase() === provider);
  return direct || "custom";
}

function inferProviderFromBaseUrl(baseUrl) {
  const normalized = normalizeString(baseUrl).replace(/\/+$/, "").toLowerCase();
  if (normalized === "webchat://chatgpt") return "webchatChatGPT";
  if (normalized === "webchat://deepseek") return "webchatDeepSeek";
  const host = extractProviderHost(normalized);
  if (host.includes("minimax") || host.includes("minimaxi")) return "minimax";
  if (host.includes("deepseek")) return "deepseek";
  if (host.includes("openai")) return "openai";
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return "ollama";
  for (const [provider, preset] of Object.entries(PROVIDER_PRESETS)) {
    if (preset.baseUrl && normalized === preset.baseUrl.toLowerCase()) {
      return provider;
    }
  }
  return "custom";
}

function extractProviderHost(baseUrl) {
  const normalized = normalizeString(baseUrl).replace(/\/+$/, "").toLowerCase();
  if (!normalized) return "";
  try {
    return new URL(normalized).hostname;
  } catch {
    return normalized.replace(/^[a-z]+:\/\//i, "").split("/")[0].trim();
  }
}

function isWebChatProvider(provider) {
  return Object.prototype.hasOwnProperty.call(WEBCHAT_PROVIDERS, provider);
}

function getWebChatConfig(provider) {
  const config = WEBCHAT_PROVIDERS[provider];
  if (!config) throw new Error("未知的 WebChat 模型配置。");
  return config;
}

function isSupportedWebChatUrl(url, config) {
  try {
    const parsed = new URL(url);
    const home = new URL(config.homeUrl);
    if (parsed.origin !== home.origin) return false;
    if (config.id === "chatgpt") return /^\/c\/[^/?#]+/.test(parsed.pathname);
    if (config.id === "deepseek") return /^\/a\/chat\/s\/[^/?#]+/.test(parsed.pathname);
    return parsed.href.startsWith(config.homeUrl);
  } catch {
    return false;
  }
}

function normalizeWebChatChatUrl(url) {
  try {
    const parsed = new URL(normalizeString(url));
    const host = parsed.hostname.toLowerCase();
    if (host === "chatgpt.com") {
      const match = parsed.pathname.match(/^\/c\/([^/?#]+)/);
      return match ? `${parsed.origin}/c/${match[1]}` : "";
    }
    if (host === "chat.deepseek.com") {
      const match = parsed.pathname.match(/^\/a\/chat\/s\/([^/?#]+)/);
      return match ? `${parsed.origin}/a/chat/s/${match[1]}` : "";
    }
  } catch {}
  return "";
}

function extractWebChatChatId(url) {
  try {
    const normalized = normalizeWebChatChatUrl(url);
    if (!normalized) return "";
    return new URL(normalized).pathname.split("/").filter(Boolean).pop() || "";
  } catch {
    return "";
  }
}
