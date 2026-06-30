const I18N = window.ArxivMateI18n;
const statusNode = document.querySelector("#status");
const updateStatusNode = document.querySelector("#update-status");
let currentLanguage = "system";

initPopup();

document.querySelector("#options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.querySelector("#review").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("review.html") });
});

async function initPopup() {
  try {
    const { settings = {} } = await chrome.storage.sync.get("settings");
    currentLanguage = I18N.normalizeLanguage(settings.language);
    document.body.dataset.appearance = resolveAppearance(settings.appearance);
  } catch {
    currentLanguage = "system";
    document.body.dataset.appearance = resolveAppearance("system");
  }
  applyLanguage();
  updateTabStatus();
  checkForUpdate();
}

function applyLanguage() {
  document.documentElement.lang = I18N.resolveLanguage(currentLanguage);
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

function updateTabStatus() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (/https:\/\/(www\.)?arxiv\.org\/(abs|pdf)\//i.test(tab?.url || "")) {
      statusNode.textContent = t("popupStatusArxiv");
    }
  });
}

async function checkForUpdate() {
  try {
    const response = await sendMessage({ type: "checkForUpdate", force: false });
    if (!response?.updateAvailable) return;
    updateStatusNode.textContent = t("updateAvailable", {
      local: response.localVersion,
      latest: response.latestVersion
    });
    updateStatusNode.classList.add("is-visible");
  } catch {
    updateStatusNode.classList.remove("is-visible");
  }
}

function sendMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Extension background returned no valid response."));
        return;
      }
      resolve(response.data);
    });
  });
}

function resolveAppearance(value) {
  const normalized = normalizeAppearance(value);
  if (normalized !== "system") return normalized;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function normalizeAppearance(value) {
  if (value === "system" || value === "跟随系统") return "system";
  if (value === "light" || value === "浅色") return "light";
  if (value === "dark" || value === "深色") return "dark";
  if (value === "sepia" || value === "护眼") return "sepia";
  return "system";
}

function t(key, vars = {}) {
  return I18N.t(currentLanguage, key, vars);
}
