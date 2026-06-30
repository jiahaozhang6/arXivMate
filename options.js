const form = document.querySelector("#settings-form");
const statusNode = document.querySelector("#status");
const testButton = document.querySelector("#test-button");
const addProfileButton = document.querySelector("#add-profile");
const addProfileProviderSelect = document.querySelector("#add-profile-provider");
const profilesNode = document.querySelector("#profiles");
const updateBox = document.querySelector(".update-box");
const updateStatusNode = document.querySelector("#update-status");
const updateCheckedAtNode = document.querySelector("#update-checked-at");
const checkUpdateButton = document.querySelector("#check-update");
const updateActionsNode = document.querySelector("#update-actions");
const updateStepsNode = document.querySelector("#update-steps");
const downloadUpdateLink = document.querySelector("#download-update");
const openReleaseLink = document.querySelector("#open-release");
const globalUpdateBannerNode = document.querySelector("#global-update-banner");
const projectVersionNode = document.querySelector("#project-version");
const I18N = window.ArxivMateI18n;

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
    label: "Ollama local",
    labelZh: "Ollama 本地",
    labelEn: "Ollama local",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1"
  },
  custom: {
    label: "Custom OpenAI-compatible",
    labelZh: "自定义 OpenAI-compatible",
    labelEn: "Custom OpenAI-compatible",
    baseUrl: "",
    model: ""
  }
};

let settings = null;
let profiles = [];
let activeProfileId = "";
let selectedProfileId = "";
let revealApiKey = false;
let currentLanguage = "system";

syncProjectVersion();
renderAddProfileProviderOptions();
loadSettings();

addProfileButton.addEventListener("click", () => {
  const profile = createProfile(addProfileProviderSelect.value || "custom");
  profiles.push(profile);
  selectedProfileId = profile.id;
  activeProfileId = profile.id;
  revealApiKey = false;
  renderProfiles();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(t("saving"));
  try {
    await saveCurrentSettings();
    setStatus(t("settingsSaved"));
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

form.language.addEventListener("change", () => {
  currentLanguage = normalizeLanguage(form.language.value);
  applyLanguage(currentLanguage);
  renderProfiles();
});

form.appearance.addEventListener("change", () => {
  applyAppearance(form.appearance.value);
});

checkUpdateButton.addEventListener("click", () => {
  checkForUpdate(true);
});

testButton.addEventListener("click", async () => {
  setStatus(t("testing"));
  try {
    await saveCurrentSettings();
    const response = await sendMessage({
      type: "summarizePaper",
      mode: "ask",
      question: t("testQuestion"),
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
    setStatus(t("testSuccess", { text: response.text.slice(0, 100) }));
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

async function loadSettings() {
  try {
    settings = await sendMessage({ type: "getSettings" });
    profiles = normalizeProfiles(settings.modelProfiles, settings);
    activeProfileId = settings.activeProfileId || profiles[0]?.id || "";
    selectedProfileId = activeProfileId || profiles[0]?.id || "";
    form.language.value = normalizeLanguage(settings.language);
    currentLanguage = form.language.value;
    form.appearance.value = normalizeAppearance(settings.appearance);
    applyAppearance(form.appearance.value);
    applyLanguage(currentLanguage);
    renderProfiles();
    checkForUpdate(false);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
}

async function saveCurrentSettings() {
  readSelectedProfileFromDom();
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
  if (!profiles.some((profile) => profile.id === selectedProfileId)) {
    selectedProfileId = activeProfileId || profiles[0].id;
  }

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || profiles[0];
  profilesNode.innerHTML = `
    <div class="profile-manager">
      <aside class="profile-list" aria-label="${escapeAttr(t("profileList"))}">
        ${profiles.map((profile) => renderProfileListItem(profile)).join("")}
      </aside>
      <article class="profile-editor profile-card" data-id="${escapeAttr(selectedProfile.id)}">
        ${renderProfileEditor(selectedProfile)}
      </article>
    </div>
  `;

  profilesNode.querySelectorAll("[data-action]").forEach((node) => {
    node.addEventListener("click", handleProfileAction);
  });
  profilesNode.querySelectorAll(".profile-editor input, .profile-editor select").forEach((node) => {
    node.addEventListener("input", handleProfileInput);
    node.addEventListener("change", handleProfileInput);
  });
}

function renderProfileListItem(profile) {
  const isSelected = profile.id === selectedProfileId;
  const isActive = profile.id === activeProfileId;
  return `
    <button class="profile-list-item ${isSelected ? "is-selected" : ""}" type="button" data-action="select" data-id="${escapeAttr(profile.id)}">
      <span class="profile-list-title">${escapeHtml(profile.name || profile.model || t("untitledProfile"))}</span>
      <span class="profile-list-meta">${escapeHtml(profile.model || t("modelName"))}</span>
      <span class="profile-list-tags">
        <span>${escapeHtml(providerDisplayName(profile.provider))}</span>
        ${isActive ? `<span>${escapeHtml(t("currentEnabled"))}</span>` : ""}
      </span>
    </button>
  `;
}

function renderProfileEditor(profile) {
  return `
    <header class="profile-editor-header">
      <div>
        <span>${escapeHtml(t("editingProfile"))}</span>
        <strong>${escapeHtml(profile.name || profile.model || t("untitledProfile"))}</strong>
      </div>
      <div class="profile-editor-actions">
        <button type="button" data-action="set-active" ${profile.id === activeProfileId ? "disabled" : ""}>${escapeHtml(t("setActiveProfile"))}</button>
        <button type="button" data-action="duplicate">${escapeHtml(t("duplicateProfile"))}</button>
        <button type="button" class="danger" data-action="remove" ${profiles.length <= 1 ? "disabled" : ""}>${escapeHtml(t("remove"))}</button>
      </div>
    </header>

    <section class="profile-section">
      <h3>${escapeHtml(t("connectionSettings"))}</h3>
      <div class="profile-grid">
        <label>
          <span>${escapeHtml(t("name"))}</span>
          <input data-field="name" value="${escapeAttr(profile.name)}" placeholder="DeepSeek fast">
        </label>
        <label>
          <span>${escapeHtml(t("provider"))}</span>
          <select data-field="provider">
            ${Object.entries(PROVIDER_PRESETS).map(([key, preset]) => `
              <option value="${key}" ${profile.provider === key ? "selected" : ""}>${escapeHtml(providerDisplayName(key))}</option>
            `).join("")}
          </select>
        </label>
        <label>
          <span>API Base URL</span>
          <input data-field="baseUrl" value="${escapeAttr(profile.baseUrl)}" placeholder="https://api.openai.com/v1">
        </label>
        <label>
          <span>API Key</span>
          <div class="secret-row">
            <input data-field="apiKey" type="${revealApiKey ? "text" : "password"}" autocomplete="off" value="${escapeAttr(profile.apiKey)}" placeholder="sk-...">
            <button type="button" data-action="toggle-secret">${escapeHtml(revealApiKey ? t("hideApiKey") : t("showApiKey"))}</button>
          </div>
        </label>
        <label>
          <span>${escapeHtml(t("modelName"))}</span>
          <input data-field="model" list="model-presets" value="${escapeAttr(profile.model)}" placeholder="gpt-4o-mini">
        </label>
      </div>
    </section>

    <section class="profile-section">
      <h3>${escapeHtml(t("generationSettings"))}</h3>
      <div class="profile-grid">
        <label>
          <span>Temperature</span>
          <input data-field="temperature" type="number" min="0" max="2" step="0.1" value="${escapeAttr(profile.temperature)}">
        </label>
        <label>
          <span>${escapeHtml(t("outputTokens"))}</span>
          <input data-field="maxOutputTokens" type="number" min="128" max="64000" step="1" value="${escapeAttr(profile.maxOutputTokens)}">
        </label>
      </div>
    </section>

    <details class="profile-advanced" open>
      <summary>${escapeHtml(t("advanced"))}</summary>
      <div class="profile-grid">
        <label>
          <span>${escapeHtml(t("contextWindowTokens"))}</span>
          <input data-field="inputTokenCap" type="number" min="1000" max="1000000" step="1000" value="${escapeAttr(profile.inputTokenCap)}">
          <small>${escapeHtml(t("contextWindowHelp"))}</small>
        </label>
        <label>
          <span>${escapeHtml(t("bodyChars"))}</span>
          <input data-field="maxContextChars" type="number" min="4000" max="60000" step="1000" value="${escapeAttr(profile.maxContextChars)}">
        </label>
        <label>
          <span>${escapeHtml(t("historyTurns"))}</span>
          <input data-field="historyTurns" type="number" min="0" max="20" step="1" value="${escapeAttr(profile.historyTurns)}">
        </label>
        <label>
          <span>${escapeHtml(t("historyMessageChars"))}</span>
          <input data-field="historyMessageChars" type="number" min="400" max="8000" step="200" value="${escapeAttr(profile.historyMessageChars)}">
        </label>
        <label>
          <span>${escapeHtml(t("defaultContext"))}</span>
          <select data-field="defaultContextMode">
            <option value="fast" ${profile.defaultContextMode !== "full" ? "selected" : ""}>${escapeHtml(t("fastContext"))}</option>
            <option value="full" ${profile.defaultContextMode === "full" ? "selected" : ""}>${escapeHtml(t("fullContext"))}</option>
          </select>
        </label>
        <label class="checkbox">
          <input data-field="useAr5iv" type="checkbox" ${profile.useAr5iv ? "checked" : ""}>
          <span>${escapeHtml(t("allowAr5iv"))}</span>
        </label>
      </div>
    </details>
  `;
}

function handleProfileInput(event) {
  const card = event.target.closest(".profile-editor");
  if (!card) return;
  const profile = profiles.find((item) => item.id === card.dataset.id);
  if (!profile) return;

  const field = event.target.dataset.field;
  if (!field) return;

  if (field === "provider") {
    const nextProvider = event.target.value;
    const preset = PROVIDER_PRESETS[nextProvider] || PROVIDER_PRESETS.custom;
    const oldPresetNames = providerDisplayNames(profile.provider);
    profile.provider = nextProvider;
    profile.baseUrl = preset.baseUrl;
    profile.model = preset.model;
    if (nextProvider === "ollama") profile.apiKey = "";
    if (!profile.name || oldPresetNames.includes(profile.name) || Object.keys(PROVIDER_PRESETS).some((provider) => providerDisplayNames(provider).includes(profile.name))) {
      profile.name = providerDisplayName(nextProvider);
    }
    revealApiKey = false;
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

function handleProfileAction(event) {
  const action = event.currentTarget.dataset.action;
  const id = event.currentTarget.dataset.id || event.currentTarget.closest(".profile-editor")?.dataset.id;
  if (action === "select") {
    readSelectedProfileFromDom();
    selectedProfileId = id;
    revealApiKey = false;
    renderProfiles();
    return;
  }
  const profile = profiles.find((item) => item.id === id);
  if (!profile) return;

  if (action === "set-active") {
    readSelectedProfileFromDom();
    activeProfileId = id;
    renderProfiles();
    return;
  }

  if (action === "duplicate") {
    readSelectedProfileFromDom();
    const duplicate = {
      ...profile,
      id: createId(),
      name: t("profileCopyName", { name: profile.name || profile.model || t("untitledProfile") })
    };
    profiles.push(duplicate);
    selectedProfileId = duplicate.id;
    activeProfileId = duplicate.id;
    revealApiKey = false;
    renderProfiles();
    return;
  }

  if (action === "toggle-secret") {
    readSelectedProfileFromDom();
    revealApiKey = !revealApiKey;
    renderProfiles();
    return;
  }

  if (action === "remove") {
    if (profiles.length <= 1) return;
    if (!confirm(t("confirmRemoveProfile", { name: profile.name || profile.model || t("untitledProfile") }))) return;
    profiles = profiles.filter((item) => item.id !== id);
    if (activeProfileId === id) activeProfileId = profiles[0]?.id || "";
    if (selectedProfileId === id) selectedProfileId = activeProfileId || profiles[0]?.id || "";
    revealApiKey = false;
    renderProfiles();
  }
}

function readSelectedProfileFromDom() {
  const card = profilesNode.querySelector(".profile-editor");
  if (!card) return;
  const profile = profiles.find((item) => item.id === card.dataset.id);
  if (!profile) return;
  const get = (field) => card.querySelector(`[data-field="${field}"]`);
  const baseUrl = get("baseUrl")?.value || "";
  const selectedProvider = get("provider")?.value || profile.provider;
  const inferredProvider = inferProvider(baseUrl);
  Object.assign(profile, {
    name: get("name")?.value || "",
    provider: inferredProvider !== "custom" ? inferredProvider : selectedProvider,
    baseUrl,
    apiKey: get("apiKey")?.value || "",
    model: get("model")?.value || "",
    temperature: Number(get("temperature")?.value),
    maxOutputTokens: Number(get("maxOutputTokens")?.value),
    inputTokenCap: Number(get("inputTokenCap")?.value),
    maxContextChars: Number(get("maxContextChars")?.value),
    historyTurns: Number(get("historyTurns")?.value),
    historyMessageChars: Number(get("historyMessageChars")?.value),
    defaultContextMode: get("defaultContextMode")?.value || "fast",
    useAr5iv: Boolean(get("useAr5iv")?.checked)
  });
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
    name: providerDisplayName(provider),
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

function renderAddProfileProviderOptions() {
  if (!addProfileProviderSelect) return;
  addProfileProviderSelect.innerHTML = Object.entries(PROVIDER_PRESETS).map(([key, preset]) => `
    <option value="${key}">${escapeHtml(providerDisplayName(key))}</option>
  `).join("");
  addProfileProviderSelect.value = "custom";
}

function providerDisplayName(provider) {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
  return I18N.resolveLanguage(currentLanguage) === "zh-CN"
    ? preset.labelZh || preset.label
    : preset.labelEn || preset.label;
}

function providerDisplayNames(provider) {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;
  return [...new Set([preset.label, preset.labelZh, preset.labelEn].filter(Boolean))];
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
  return I18N.normalizeLanguage(value);
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

function applyLanguage(value) {
  currentLanguage = normalizeLanguage(value);
  const resolved = I18N.resolveLanguage(currentLanguage);
  document.documentElement.lang = resolved;
  document.title = t("optionsTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelector(".hero h1").textContent = t("modelConfig");
  document.querySelector(".section-head h2").textContent = t("modelProfiles");
  document.querySelector(".section-head p").textContent = t("profilesHelp");
  addProfileButton.textContent = t("addProfile");
  renderAddProfileProviderOptions();
  checkUpdateButton.textContent = t("checkUpdate");
}

function renderGlobalUpdateBanner(result) {
  if (result) {
    window.ArxivMateUpdateBanner?.renderResult({
      container: globalUpdateBannerNode,
      result,
      language: currentLanguage
    });
    return;
  }
  window.ArxivMateUpdateBanner?.checkAndRender({
    container: globalUpdateBannerNode,
    language: currentLanguage
  });
}

function t(key, vars = {}) {
  return I18N.t(currentLanguage, key, vars);
}

function syncProjectVersion() {
  if (!projectVersionNode) return;
  projectVersionNode.textContent = chrome.runtime.getManifest().version;
}

async function checkForUpdate(force) {
  updateBox.classList.remove("is-update", "is-error");
  updateStatusNode.textContent = t("checkingUpdate");
  updateCheckedAtNode.textContent = "";
  renderUpdateActions(null);
  checkUpdateButton.disabled = true;
  try {
    const result = await sendMessage({ type: "checkForUpdate", force });
    renderUpdateStatus(result);
  } catch (error) {
    renderUpdateStatus({ error: error.message || String(error) });
  } finally {
    checkUpdateButton.disabled = false;
  }
}

function renderUpdateStatus(result) {
  updateBox.classList.toggle("is-update", Boolean(result?.updateAvailable));
  updateBox.classList.toggle("is-error", Boolean(result?.error));
  if (result?.error) {
    updateStatusNode.textContent = t("updateCheckFailed", { error: result.error });
  } else if (result?.updateAvailable) {
    updateStatusNode.textContent = t("updateAvailable", {
      local: result.localVersion,
      latest: result.latestVersion
    });
  } else {
    updateStatusNode.textContent = t("upToDate", { version: result?.localVersion || chrome.runtime.getManifest().version });
  }
  const checkedAt = formatUpdateTime(result?.checkedAt);
  updateCheckedAtNode.textContent = [
    checkedAt ? t("updateCheckedAt", { time: checkedAt }) : "",
    result?.updateAvailable ? t("updateMethodsHint") : ""
  ].filter(Boolean).join(" ");
  renderGlobalUpdateBanner(result);
  renderUpdateActions(result);
}

function renderUpdateActions(result) {
  const show = Boolean(result?.updateAvailable && result.latestTag && result.latestZipUrl);
  updateActionsNode.hidden = !show;
  updateStepsNode.hidden = !show;
  if (!show) {
    downloadUpdateLink.removeAttribute("href");
    openReleaseLink.removeAttribute("href");
    updateStepsNode.innerHTML = "";
    return;
  }

  downloadUpdateLink.href = result.latestZipUrl;
  openReleaseLink.href = result.releaseUrl || result.sourceUrl || "https://github.com/jiahaozhang6/arXivMate/releases";
  updateStepsNode.innerHTML = `
    <strong>${escapeHtml(t("gitUpgradeTitle"))}</strong>
    <ol>
      <li>${escapeHtml(t("gitUpgradeStep1"))}</li>
      <li>${escapeHtml(t("gitUpgradeStep2"))}</li>
      <li>${escapeHtml(t("gitUpgradeStep3"))}</li>
    </ol>
    <pre><code>cd arXivMate
git pull</code></pre>
    <strong>${escapeHtml(t("zipUpgradeTitle"))}</strong>
    <ol>
      <li>${escapeHtml(t("zipUpgradeStep1", { version: result.latestVersion, release: result.latestTag }))}</li>
      <li>${escapeHtml(t("zipUpgradeStep2"))}</li>
      <li>${escapeHtml(t("zipUpgradeStep3"))}</li>
      <li>${escapeHtml(t("zipUpgradeStep4"))}</li>
    </ol>
  `;
}

function formatUpdateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(I18N.resolveLanguage(currentLanguage), {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
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
