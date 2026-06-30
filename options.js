const form = document.querySelector("#settings-form");
const statusNode = document.querySelector("#status");
const testButton = document.querySelector("#test-button");
const addProfileButton = document.querySelector("#add-profile");
const profilesNode = document.querySelector("#profiles");

const PROVIDER_PRESETS = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini"
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash"
  },
  minimax: {
    label: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    model: "MiniMax-M3"
  },
  ollama: {
    label: "Ollama 本地",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1"
  },
  custom: {
    label: "自定义 OpenAI-compatible",
    baseUrl: "",
    model: ""
  }
};

let settings = null;
let profiles = [];
let activeProfileId = "";

loadSettings();

addProfileButton.addEventListener("click", () => {
  const profile = createProfile("custom");
  profiles.push(profile);
  activeProfileId = profile.id;
  renderProfiles();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("正在保存...");
  try {
    await saveCurrentSettings();
    setStatus("设置已保存。arXiv 页面会使用当前启用模型。");
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

form.appearance.addEventListener("change", () => {
  applyAppearance(form.appearance.value);
});

testButton.addEventListener("click", async () => {
  setStatus("正在测试当前模型...");
  try {
    await saveCurrentSettings();
    const response = await sendMessage({
      type: "summarizePaper",
      mode: "ask",
      question: "请只回复：连接正常。",
      persist: false,
      contextMode: "fast",
      paper: {
        id: "test",
        title: "Connection test",
        authors: "arXivMate",
        abstract: "This is a short connection test.",
        subjects: "cs.AI",
        pdfUrl: ""
      }
    });
    setStatus(`连接成功：${response.text.slice(0, 100)}`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

async function loadSettings() {
  try {
    settings = await sendMessage({ type: "getSettings" });
    profiles = normalizeProfiles(settings.modelProfiles, settings);
    activeProfileId = settings.activeProfileId || profiles[0]?.id || "";
    form.language.value = normalizeLanguage(settings.language);
    form.appearance.value = normalizeAppearance(settings.appearance);
    applyAppearance(form.appearance.value);
    renderProfiles();
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function saveCurrentSettings() {
  readProfilesFromDom();
  const next = {
    ...(settings || {}),
    language: normalizeLanguage(form.language.value),
    appearance: normalizeAppearance(form.appearance.value),
    activeProfileId,
    modelProfiles: profiles
  };
  settings = await sendMessage({ type: "saveSettings", settings: next });
  profiles = normalizeProfiles(settings.modelProfiles, settings);
  activeProfileId = settings.activeProfileId || profiles[0]?.id || "";
  renderProfiles();
}

function renderProfiles() {
  if (!profiles.length) profiles = [createProfile("openai")];
  if (!profiles.some((profile) => profile.id === activeProfileId)) {
    activeProfileId = profiles[0].id;
  }

  profilesNode.innerHTML = profiles.map((profile, index) => `
    <article class="profile-card" data-id="${escapeAttr(profile.id)}">
      <header class="profile-header">
        <label class="active-choice">
          <input type="radio" name="activeProfile" value="${escapeAttr(profile.id)}" ${profile.id === activeProfileId ? "checked" : ""}>
          <span>当前启用</span>
        </label>
        <strong>${escapeHtml(profile.name || `模型 ${index + 1}`)}</strong>
        <button type="button" data-action="remove" ${profiles.length <= 1 ? "disabled" : ""}>删除</button>
      </header>

      <div class="profile-grid">
        <label>
          <span>名称</span>
          <input data-field="name" value="${escapeAttr(profile.name)}" placeholder="DeepSeek fast">
        </label>
        <label>
          <span>供应商</span>
          <select data-field="provider">
            ${Object.entries(PROVIDER_PRESETS).map(([key, preset]) => `
              <option value="${key}" ${profile.provider === key ? "selected" : ""}>${escapeHtml(preset.label)}</option>
            `).join("")}
          </select>
        </label>
        <label>
          <span>API Base URL</span>
          <input data-field="baseUrl" value="${escapeAttr(profile.baseUrl)}" placeholder="https://api.openai.com/v1">
        </label>
        <label>
          <span>API Key</span>
          <input data-field="apiKey" type="password" autocomplete="off" value="${escapeAttr(profile.apiKey)}" placeholder="sk-...">
        </label>
        <label>
          <span>模型名称</span>
          <input data-field="model" list="model-presets" value="${escapeAttr(profile.model)}" placeholder="gpt-4o-mini">
        </label>
      </div>

      <details class="profile-advanced">
        <summary>高级：上下文、历史与输出预算</summary>
        <div class="profile-grid">
        <label>
          <span>Temperature</span>
          <input data-field="temperature" type="number" min="0" max="2" step="0.1" value="${escapeAttr(profile.temperature)}">
        </label>
        <label>
          <span>输出 tokens</span>
          <input data-field="maxOutputTokens" type="number" min="128" max="64000" step="1" value="${escapeAttr(profile.maxOutputTokens)}">
        </label>
        <label>
          <span>上下文窗口 tokens</span>
          <input data-field="inputTokenCap" type="number" min="1000" max="1000000" step="1000" value="${escapeAttr(profile.inputTokenCap)}">
          <small>通常保持自动值即可；只有模型窗口识别不准或自定义代理时再改。</small>
        </label>
        <label>
          <span>正文字符数</span>
          <input data-field="maxContextChars" type="number" min="4000" max="60000" step="1000" value="${escapeAttr(profile.maxContextChars)}">
        </label>
        <label>
          <span>历史轮数</span>
          <input data-field="historyTurns" type="number" min="0" max="20" step="1" value="${escapeAttr(profile.historyTurns)}">
        </label>
        <label>
          <span>单条历史字符</span>
          <input data-field="historyMessageChars" type="number" min="400" max="8000" step="200" value="${escapeAttr(profile.historyMessageChars)}">
        </label>
        <label>
          <span>默认上下文</span>
          <select data-field="defaultContextMode">
            <option value="fast" ${profile.defaultContextMode !== "full" ? "selected" : ""}>快速：摘要 + 历史</option>
            <option value="full" ${profile.defaultContextMode === "full" ? "selected" : ""}>全文：优先 PDF 文本抽取</option>
          </select>
        </label>
        <label class="checkbox">
          <input data-field="useAr5iv" type="checkbox" ${profile.useAr5iv ? "checked" : ""}>
          <span>PDF 抽取失败时允许读取 ar5iv</span>
        </label>
        </div>
      </details>
    </article>
  `).join("");

  profilesNode.querySelectorAll("input, select").forEach((node) => {
    node.addEventListener("input", handleProfileInput);
    node.addEventListener("change", handleProfileInput);
  });
  profilesNode.querySelectorAll("[data-action='remove']").forEach((button) => {
    button.addEventListener("click", handleRemoveProfile);
  });
}

function handleProfileInput(event) {
  const card = event.target.closest(".profile-card");
  if (!card) return;
  const profile = profiles.find((item) => item.id === card.dataset.id);
  if (!profile) return;

  if (event.target.name === "activeProfile") {
    activeProfileId = event.target.value;
    return;
  }

  const field = event.target.dataset.field;
  if (!field) return;

  if (field === "provider") {
    const nextProvider = event.target.value;
    const preset = PROVIDER_PRESETS[nextProvider] || PROVIDER_PRESETS.custom;
    const oldPresetLabel = PROVIDER_PRESETS[profile.provider]?.label;
    profile.provider = nextProvider;
    profile.baseUrl = preset.baseUrl;
    profile.model = preset.model;
    if (nextProvider === "ollama") profile.apiKey = "";
    if (!profile.name || profile.name === oldPresetLabel || Object.values(PROVIDER_PRESETS).some((presetItem) => profile.name === presetItem.label)) {
      profile.name = preset.label;
    }
    renderProfiles();
    return;
  }

  if (field === "useAr5iv") {
    profile.useAr5iv = event.target.checked;
  } else if (field === "temperature") {
    profile.temperature = Number(event.target.value);
  } else if (["maxContextChars", "maxOutputTokens", "inputTokenCap", "historyTurns", "historyMessageChars"].includes(field)) {
    profile[field] = Number(event.target.value);
  } else {
    profile[field] = event.target.value;
  }

  if (field === "baseUrl") {
    profile.provider = inferProvider(profile.baseUrl);
    const providerSelect = card.querySelector('[data-field="provider"]');
    if (providerSelect && providerSelect.value !== profile.provider) {
      providerSelect.value = profile.provider;
    }
  }
}

function handleRemoveProfile(event) {
  const card = event.target.closest(".profile-card");
  if (!card || profiles.length <= 1) return;
  const id = card.dataset.id;
  profiles = profiles.filter((profile) => profile.id !== id);
  if (activeProfileId === id) activeProfileId = profiles[0]?.id || "";
  renderProfiles();
}

function readProfilesFromDom() {
  const cards = [...profilesNode.querySelectorAll(".profile-card")];
  profiles = cards.map((card) => {
    const id = card.dataset.id;
    const previous = profiles.find((profile) => profile.id === id) || createProfile("custom");
    const get = (field) => card.querySelector(`[data-field="${field}"]`);
    const baseUrl = get("baseUrl").value;
    const inferredProvider = inferProvider(baseUrl);
    return {
      ...previous,
      id,
      name: get("name").value,
      provider: inferredProvider !== "custom" ? inferredProvider : get("provider").value,
      baseUrl,
      apiKey: get("apiKey").value,
      model: get("model").value,
      temperature: Number(get("temperature").value),
      maxOutputTokens: Number(get("maxOutputTokens").value),
      inputTokenCap: Number(get("inputTokenCap").value),
      maxContextChars: Number(get("maxContextChars").value),
      historyTurns: Number(get("historyTurns").value),
      historyMessageChars: Number(get("historyMessageChars").value),
      defaultContextMode: get("defaultContextMode").value,
      useAr5iv: get("useAr5iv").checked
    };
  });
  const checked = profilesNode.querySelector("input[name='activeProfile']:checked");
  if (checked) activeProfileId = checked.value;
}

function normalizeProfiles(value, fallbackSettings) {
  const list = Array.isArray(value) ? value : [];
  if (list.length) {
    return list.map((profile) => {
      const inferredProvider = inferProvider(profile.baseUrl);
      return {
        id: profile.id || createId(),
        name: profile.name || profile.model || "Model",
        provider: inferredProvider !== "custom" ? inferredProvider : (profile.provider || "custom"),
        baseUrl: profile.baseUrl || "",
        apiKey: profile.apiKey || "",
        model: profile.model || "",
        temperature: Number(profile.temperature ?? 0.2),
        maxOutputTokens: Number(profile.maxOutputTokens ?? 1600),
        inputTokenCap: Number(profile.inputTokenCap ?? inferInputTokenCap(profile.model)),
        maxContextChars: Number(profile.maxContextChars ?? 14000),
        historyTurns: Number(profile.historyTurns ?? 4),
        historyMessageChars: Number(profile.historyMessageChars ?? 1800),
        defaultContextMode: profile.defaultContextMode === "full" ? "full" : "fast",
        useAr5iv: profile.useAr5iv !== false
      };
    });
  }
  const inferredProvider = inferProvider(fallbackSettings.baseUrl);
  return [{
    id: "profile-migrated",
    name: "Migrated model",
    provider: inferredProvider !== "custom" ? inferredProvider : (fallbackSettings.provider || "custom"),
    baseUrl: fallbackSettings.baseUrl || "",
    apiKey: fallbackSettings.apiKey || "",
    model: fallbackSettings.model || "",
    temperature: Number(fallbackSettings.temperature ?? 0.2),
    maxOutputTokens: Number(fallbackSettings.maxOutputTokens ?? 1600),
    inputTokenCap: Number(fallbackSettings.inputTokenCap ?? inferInputTokenCap(fallbackSettings.model)),
    maxContextChars: Number(fallbackSettings.maxContextChars ?? 14000),
    historyTurns: Number(fallbackSettings.historyTurns ?? 4),
    historyMessageChars: Number(fallbackSettings.historyMessageChars ?? 1800),
    defaultContextMode: fallbackSettings.defaultContextMode === "full" ? "full" : "fast",
    useAr5iv: fallbackSettings.useAr5iv !== false
  }];
}

function createProfile(provider) {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
  return {
    id: createId(),
    name: preset.label,
    provider,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.model,
    temperature: 0.2,
    maxOutputTokens: provider === "ollama" ? 1200 : provider === "deepseek" || provider === "minimax" ? 1800 : 1600,
    inputTokenCap: provider === "deepseek" || provider === "minimax" ? 128000 : provider === "ollama" ? 16000 : 32000,
    maxContextChars: provider === "ollama" ? 12000 : 14000,
    historyTurns: provider === "ollama" ? 3 : 4,
    historyMessageChars: provider === "ollama" ? 1200 : 1800,
    defaultContextMode: "fast",
    useAr5iv: true
  };
}

function inferInputTokenCap(model) {
  const name = String(model || "").toLowerCase();
  if (name.startsWith("deepseek")) return 128000;
  if (name.startsWith("minimax")) return 128000;
  if (name.startsWith("gpt-4o")) return 128000;
  if (name.includes("llama")) return 16000;
  return 32000;
}

function normalizeLanguage(value) {
  if (value === "system" || value === "跟随系统") return "system";
  if (value === "zh-CN" || value === "中文" || value === "Chinese") return "zh-CN";
  if (value === "en" || value === "English") return "en";
  return "system";
}

function normalizeAppearance(value) {
  if (value === "system" || value === "跟随系统") return "system";
  if (value === "light" || value === "浅色") return "light";
  if (value === "dark" || value === "深色") return "dark";
  if (value === "sepia" || value === "护眼") return "sepia";
  return "system";
}

function applyAppearance(value) {
  document.body.dataset.appearance = resolveAppearance(value);
}

function resolveAppearance(value) {
  const normalized = normalizeAppearance(value);
  if (normalized !== "system") return normalized;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function inferProvider(baseUrl) {
  const normalized = String(baseUrl || "").replace(/\/+$/, "").toLowerCase();
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
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return String(baseUrl).replace(/^[a-z]+:\/\//i, "").split("/")[0].trim().toLowerCase();
  }
}

function createId() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function setStatus(text, isError = false) {
  statusNode.textContent = text;
  statusNode.classList.toggle("is-error", Boolean(isError));
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "插件后台没有返回有效结果。"));
        return;
      }
      resolve(response.data);
    });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
