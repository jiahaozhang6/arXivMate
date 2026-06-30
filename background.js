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
  useAr5iv: true
};
const CHARS_PER_TOKEN_ESTIMATE = 4;
const INPUT_CAP_SAFETY_RATIO = 0.9;

const MAX_CONVERSATIONS = 300;
const MAX_MESSAGES_PER_CONVERSATION = 200;
const MAX_CONTEXT_CACHE_ENTRIES = 80;
const PDF_TEXT_MIN_CHARS = 1600;
const PDF_EXTRACT_MAX_PAGES = 80;
const PDF_TEXT_CONTEXT_SOURCE = "PDF 文本抽取（未上传 PDF 文件）+ arXiv 页面元数据";
const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/jiahaozhang6/arXivMate/releases";
const GITHUB_RELEASES_PAGE_URL = "https://github.com/jiahaozhang6/arXivMate/releases";
const UPDATE_CHECK_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let pdfjsReady = null;

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
  custom: {
    baseUrl: "",
    model: ""
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.sync.get("settings");
  if (!settings) {
    await chrome.storage.sync.set({ settings: createDefaultSettings() });
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
    if (message?.type !== "summarizePaperStream") return;
    streamSummarizePaper(message, port, controller.signal)
      .then((data) => postPort(port, { type: "done", data }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error(error);
        postPort(port, { type: "error", error: error.message || String(error) });
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

async function handleMessage(message) {
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
    case "summarizePaper":
      return summarizePaper({
        paper: message.paper,
        mode: message.mode,
        question: message.question,
        persist: message.persist !== false,
        contextMode: message.contextMode,
        profileId: message.profileId
      });
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
  const { settings } = await chrome.storage.sync.get("settings");
  return normalizeSettings(settings);
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
  await testAllModelProfiles(modelProfiles);

  await chrome.storage.sync.set({ settings: next });
  return next;
}

async function testAllModelProfiles(modelProfiles) {
  if (!modelProfiles.length) return [];
  const results = await Promise.allSettled(modelProfiles.map((profile) => testModelProfile(profile)));
  const failures = results
    .map((result, index) => ({ result, profile: modelProfiles[index] }))
    .filter(({ result }) => result.status === "rejected")
    .map(({ result, profile }) => {
      const label = profile.name || profile.model || profile.id || "Model";
      return `${label}: ${result.reason?.message || String(result.reason)}`;
    });
  if (failures.length) {
    throw new Error(`以下模型测试失败，设置未保存：${failures.join("；")}`);
  }
  return results.map((result) => result.value);
}

async function testModelProfile(profile) {
  const normalized = normalizeModelProfile(profile);
  validateModelProfile(normalized);
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

async function summarizePaper({ paper, mode = "quick", question = "", persist = true, contextMode = "auto", profileId = "" }) {
  const prepared = await prepareSummarizePaper({ paper, mode, question, persist, contextMode, profileId });
  const result = await callChatCompletions(prepared.settings, prepared.messages);
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
    source: prepared.paperContext.contextSource,
    model: prepared.settings.model,
    contextTokens: prepared.inputBudget.estimatedAfterTokens,
    contextWindow: prepared.inputBudget.limitTokens,
    contextCapped: prepared.inputBudget.capped
  });

  let streamed = "";
  const result = await callChatCompletionsStream(
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
    messages,
    inputBudget,
    mode,
    question,
    persist
  };
}

async function finishSummarizePaper(prepared, result) {
  const answer = cleanModelOutput(result);
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

async function callChatCompletions(settings, messages) {
  const endpoint = buildChatEndpoint(settings.baseUrl);
  const body = buildChatRequestBody(settings, messages, false);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(settings),
    body: JSON.stringify(body)
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
    throw new Error(`LLM 请求失败：${detail}`);
  }

  const content = extractAssistantContent(payload);
  if (!content) {
    throw new Error("LLM 返回为空，可能是模型名、接口格式或 API key 不匹配。");
  }
  return cleanModelOutput(content);
}

async function callChatCompletionsStream(settings, messages, onDelta, signal) {
  const endpoint = buildChatEndpoint(settings.baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildRequestHeaders(settings),
    body: JSON.stringify(buildChatRequestBody(settings, messages, true)),
    signal
  });

  if (!response.ok) {
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    const detail = payload?.error?.message || payload?.message || raw || `${response.status} ${response.statusText}`;
    if (isStreamUnsupportedError(response.status, detail)) {
      const fallback = await callChatCompletions(settings, messages);
      if (fallback) onDelta(fallback);
      return fallback;
    }
    throw new Error(`LLM 请求失败：${detail}`);
  }

  if (!response.body) {
    const raw = await response.text();
    let payload;
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }
    const content = extractAssistantContent(payload);
    if (!content) throw new Error("LLM 返回为空，可能是模型名、接口格式或 API key 不匹配。");
    const cleaned = cleanModelOutput(content);
    if (cleaned) onDelta(cleaned);
    return cleaned;
  }

  return parseChatCompletionsStream(response.body, onDelta);
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
  return {
    model: settings.model,
    messages,
    temperature: settings.temperature,
    ...buildOutputTokenParam(settings.model, settings.maxOutputTokens),
    stream,
    ...getProviderRequestExtras(settings.provider)
  };
}

function isStreamUnsupportedError(status, detail) {
  if (![400, 404, 405, 422].includes(Number(status))) return false;
  const text = normalizeString(detail).toLowerCase();
  return /stream|streaming/.test(text) && /unsupported|not support|does not support|invalid|unknown|unrecognized/.test(text);
}

async function parseChatCompletionsStream(body, onDelta) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
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
        const delta = parseStreamLineDelta(line);
        if (!delta) continue;
        const cleanDelta = stripThinkingChunk(delta, state);
        if (!cleanDelta) continue;
        answer += cleanDelta;
        onDelta(cleanDelta);
      }
    }

    if (buffer.trim()) {
      const delta = parseStreamLineDelta(buffer);
      const cleanDelta = stripThinkingChunk(delta, state);
      if (cleanDelta) {
        answer += cleanDelta;
        onDelta(cleanDelta);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const tail = cleanModelOutput(state.buffer);
  if (tail && !state.inThinking) {
    answer += tail;
    onDelta(tail);
  }
  return cleanModelOutput(answer);
}

function parseStreamLineDelta(line) {
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
  return normalizeModelContent(
    choice?.delta?.content ??
    choice?.message?.content ??
    payload?.delta ??
    payload?.text ??
    ""
  );
}

function extractAssistantContent(payload) {
  return normalizeModelContent(
    payload?.choices?.[0]?.message?.content ??
    payload?.choices?.[0]?.text ??
    payload?.message?.content ??
    payload?.text ??
    payload?.raw ??
    ""
  );
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

function cleanModelOutput(text) {
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

function getProviderRequestExtras(provider) {
  if (provider === "deepseek" || provider === "minimax") {
    return {
      thinking: { type: "disabled" }
    };
  }
  return {};
}

function buildChatEndpoint(baseUrl) {
  const trimmed = normalizeString(baseUrl).replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
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
    `arXiv ID: ${paper.id || "Unknown"}`,
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
        "You are a rigorous research-reading assistant for arXiv papers.",
        `Answer in ${outputLanguage}.`,
        "Be precise and evidence-aware. Separate what the paper claims from what can be inferred.",
        "If the available context is only metadata or abstract, state that limitation clearly.",
        "Prefer structured Markdown with concise bullets and concrete learning actions."
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

async function fetchPdfText(pdfUrl, maxChars) {
  const url = normalizeString(pdfUrl);
  if (!url) return "";
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`PDF returned ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  return extractPdfText(bytes, maxChars);
}

async function extractPdfText(bytes, maxChars) {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    disableWorker: true,
    useSystemFonts: true
  });
  const pdf = await task.promise;
  const parts = [];
  const pageLimit = Math.min(pdf.numPages, PDF_EXTRACT_MAX_PAGES);
  const charLimit = Math.max(4000, Number(maxChars) || DEFAULT_PROFILE_SETTINGS.maxContextChars);

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
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
    await pdf.destroy();
  } catch {}

  return normalizeTextBlock(parts.join("\n\n")).slice(0, charLimit);
}

async function loadPdfJs() {
  if (!pdfjsReady) {
    pdfjsReady = importScriptsPromise("vendor/pdfjs/pdf.js").then(() => {
      const pdfjs = globalThis.pdfjsLib;
      if (!pdfjs?.getDocument) throw new Error("PDF.js 未正确加载。");
      if (pdfjs.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdfjs/pdf.worker.js");
      }
      return pdfjs;
    });
  }
  return pdfjsReady;
}

function importScriptsPromise(path) {
  return new Promise((resolve, reject) => {
    try {
      importScripts(chrome.runtime.getURL(path));
      resolve();
    } catch (error) {
      try {
        importScripts(path);
        resolve();
      } catch {
        reject(error);
      }
    }
  });
}

async function getPaperContext(settings, paper, contextMode = "auto") {
  let fullText = "";
  let contextSource = "arXiv 摘要和页面元数据";

  const { paperContextCache = {} } = await chrome.storage.local.get("paperContextCache");
  const cacheKey = paper.id || paper.pdfUrl;
  const cached = cacheKey ? paperContextCache[cacheKey] : null;
  const shouldFetchFullText = contextMode === "full" || (contextMode === "auto" && shouldUseFullTextByDefault(settings));
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

  if (paper.pdfUrl) {
    try {
      const pdfText = await fetchPdfText(paper.pdfUrl, settings.maxContextChars);
      if (pdfText && pdfText.length > PDF_TEXT_MIN_CHARS) {
        fullText = pdfText;
        contextSource = PDF_TEXT_CONTEXT_SOURCE;
        if (cacheKey) {
          await savePaperContextCache(cacheKey, {
            fullText,
            contextSource,
            maxContextChars: settings.maxContextChars,
            updatedAt: new Date().toISOString()
          });
        }
        return { fullText, contextSource };
      }
    } catch (error) {
      console.info("PDF text unavailable:", error.message);
    }
  }

  if (!settings.useAr5iv || !paper.id) {
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

async function appendConversationTurn({ paper, mode, question, answer, source, settings, inputBudget, createdAt }) {
  const id = paper.id;
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
      createdAt: now
    }
  ].slice(-MAX_MESSAGES_PER_CONVERSATION);

  conversations[id] = {
    ...previous,
    ...paper,
    id,
    title,
    kind: "paper",
    createdAt: previous.createdAt || now,
    updatedAt: now,
    lastMode: mode,
    lastQuestion: userText,
    lastAnswer: normalizeTextBlock(answer),
    lastSource: source,
    provider: settings.provider,
    model: settings.model,
    maxOutputTokens: settings.maxOutputTokens,
    inputTokenCap: settings.inputTokenCap,
    contextTokens: inputBudget?.estimatedAfterTokens,
    contextWindow: inputBudget?.limitTokens,
    contextCapped: inputBudget?.capped,
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
  if (requested === "full" || requested === "fast") return requested;
  if (mode === "deep" || mode === "study") return "full";
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
  if (!normalizedPaper.id) throw new Error("没有识别到 arXiv ID，无法保存。");
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
  return {
    id: normalizeString(paper.id),
    title: normalizeString(paper.title),
    authors: normalizeString(paper.authors),
    abstract: normalizeString(paper.abstract),
    subjects: normalizeString(paper.subjects),
    comments: normalizeString(paper.comments),
    submittedAt: normalizeString(paper.submittedAt),
    paperUpdatedAt: normalizeString(paper.paperUpdatedAt),
    pdfUrl: normalizeString(paper.pdfUrl)
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
  return Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, provider) ? provider : "custom";
}

function inferProviderFromBaseUrl(baseUrl) {
  const normalized = normalizeString(baseUrl).replace(/\/+$/, "").toLowerCase();
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
