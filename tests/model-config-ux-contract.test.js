const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const optionsJs = read("options.js");
const optionsCss = read("options.css");
const i18n = read("i18n.js");
const content = read("content.js");
const background = read("background.js");
const optionsHtml = read("options.html");

function localized(key) {
  const matches = i18n.match(new RegExp(`${key}:`, "g")) || [];
  assert.ok(matches.length >= 2, `${key} should be localized in zh-CN and en`);
}

assert.match(optionsJs, /function renderSetupGuide\(/, "settings page should render a first-run setup guide");
assert.match(optionsJs, /function renderProfileChecklist\(/, "settings page should render a profile readiness checklist");
assert.match(optionsJs, /function renderProviderNotice\(/, "settings page should render provider-specific guidance");
assert.match(optionsJs, /function renderWebChatLoginNotice\(/, "WebChat profiles should show a login warning");
assert.match(optionsJs, /function saveModelProfile\(/, "settings page should save model profiles from the model editor");
assert.match(optionsJs, /function saveUiPreferences\(/, "settings page should save language/theme separately from model profiles");
assert.match(optionsJs, /data-action="save-profile"/, "each model editor should provide its own save action");
assert.match(optionsJs, /data-action="open-webchat"/, "WebChat profiles should provide an open-webchat action");
assert.match(optionsJs, /openWebChatPage\(/, "open-webchat action should open the provider web page");
assert.match(optionsJs, /isWebChatProvider\(profile\.provider\)/, "WebChat guidance should apply to every WebChat provider");
assert.ok(
  optionsJs.indexOf('id="profile-action-status"') > -1 &&
    optionsJs.indexOf('id="profile-action-status"') < optionsJs.indexOf('data-action="save-profile"'),
  "model action status should appear to the left of the Save this model button"
);
assert.match(optionsJs, /class="profile-list-head"/, "model list should show a compact header with profile count");
assert.match(optionsJs, /class="profile-editor-title"/, "profile editor title should have a stable layout wrapper");
assert.match(optionsHtml, /id="save-ui-preferences"/, "language and theme should have a separate save button");
assert.doesNotMatch(optionsHtml, /<button type="submit"[^>]*data-i18n="saveSettings"/, "settings page should not rely on one global save button");
assert.doesNotMatch(optionsHtml, /recommendedUsage|推荐用法|usageDaily|usageDeep|usageLocal/, "settings page should not show a recommended-usage text block");
assert.doesNotMatch(optionsHtml, /llm-for-zotero|参考 llm-for-zotero/i, "settings page should not show llm-for-zotero reference copy");
assert.doesNotMatch(optionsJs, /profilesHelp|recommendedUsage|usageDaily|usageDeep|usageLocal/, "settings script should not update removed help copy");
assert.doesNotMatch(i18n, /profilesHelp|recommendedUsage|usageDaily|usageDeep|usageLocal|llm-for-zotero/i, "removed settings copy should not remain localized");
assert.match(optionsHtml, /id="import-local-models"/, "settings page should provide a Codex/Claude import button");
assert.match(optionsHtml, /id="local-model-paths"/, "settings page should let users review and edit default local config paths");
assert.match(optionsHtml, /class="local-model-import-card"/, "local config import should be a standalone compact card");
assert.match(optionsHtml, /<details class="local-model-paths-panel"/, "local config paths should be collapsed by default");
assert.match(optionsHtml, /id="local-model-import-result"/, "local config import should show where imported models went");
assert.match(optionsHtml, /id="import-local-model-files"[^>]*type="file"/, "settings page should keep file picking as a fallback");
assert.match(optionsJs, /function parseLocalModelConfigFiles\(/, "settings page should parse selected local model config files");
assert.match(optionsJs, /function importLocalModelPaths\(/, "settings page should import model configs from default/editable local paths");
assert.match(optionsJs, /type:\s*"readLocalModelConfigPaths"/, "settings page should ask the background to read configured local paths");
assert.match(optionsJs, /function parseCodexConfigToml\(/, "settings page should parse Codex TOML config");
assert.match(optionsJs, /function parseClaudeSettingsJson\(/, "settings page should parse Claude settings JSON");
assert.match(optionsJs, /function autoAddImportedModelProfiles\(/, "settings page should automatically add imported model candidates");
assert.match(optionsJs, /function renderLocalModelImportResult\(/, "settings page should render imported model results");
assert.match(optionsJs, /function addImportedModelProfile\(/, "settings page should let users add an imported model candidate");
assert.doesNotMatch(optionsJs, /data-import-action="add-one"/, "local model import should not ask users to add parsed candidates one by one");
assert.match(optionsJs, /ANTHROPIC_AUTH_TOKEN/, "Claude import should read Anthropic-compatible auth tokens");
assert.match(optionsJs, /experimental_bearer_token/, "Codex import should read Codex custom provider bearer tokens");
assert.match(i18n, /importLocalModels:\s*"导入本地 Codex\/Claude 配置"/, "Chinese import button should name local Codex/Claude config explicitly");
assert.match(i18n, /importLocalModels:\s*"Import local Codex\/Claude config"/, "English import button should name local Codex/Claude config explicitly");

assert.match(optionsCss, /\.setup-guide\b/, "setup guide should be styled");
assert.match(optionsCss, /\.profile-checklist\b/, "profile checklist should be styled");
assert.match(optionsCss, /\.provider-notice\b/, "provider notice should be styled");
assert.match(optionsCss, /\.webchat-login-notice\b/, "WebChat login warning should be styled");
assert.match(optionsCss, /\.local-model-import-card\b/, "local model import card should be styled");
assert.match(optionsCss, /\.local-model-paths-panel\b/, "collapsed path settings should be styled");
assert.match(optionsCss, /\.local-model-import-result\b/, "import result should be styled");
assert.match(optionsCss, /\.ui-preferences\b/, "UI preference controls should be visually grouped");
assert.match(optionsCss, /\.profile-action-status\b/, "model action status should be styled beside profile actions");
assert.match(optionsCss, /--accent-soft:/, "settings UI should have a soft accent surface for grouped controls");
assert.match(optionsCss, /--soft-shadow:/, "settings UI should use restrained shadows for visual depth");
assert.match(optionsCss, /button\.primary-action/, "primary save actions should be visually distinguished");
assert.match(optionsCss, /\.profile-list-item:hover/, "model list should have a polished hover state");
assert.match(optionsCss, /\.profile-list-item\.is-selected/, "selected model list item should have a distinct selected state");
assert.match(optionsCss, /\.profile-list-head\b/, "model list header should be styled");
assert.match(optionsCss, /\.profile-editor-title\b/, "profile editor title wrapper should be styled");
assert.match(optionsCss, /:focus-visible/, "settings controls should have visible keyboard focus states");
assert.match(optionsCss, /@media \(max-width: 900px\)/, "settings page should avoid cramped two-column profile editing on medium screens");
assert.doesNotMatch(background, /chrome\.tabs\.reload/, "saving settings should hot-notify paper tabs without forcing a page reload");

[
  "setupGuideTitle",
  "setupGuideProvider",
  "setupGuideCredentials",
  "setupGuideModel",
  "setupGuideTestSave",
  "profileChecklist",
  "checkProviderReady",
  "checkCredentialReady",
  "checkModelReady",
  "checkTestReady",
  "providerNoticeApi",
  "providerNoticeAnthropic",
  "uiPreferences",
  "uiPreferencesHelp",
  "saveUiPreferences",
  "uiPreferencesSaved",
  "saveThisModel",
  "modelProfileSaved",
  "modelProfileRemoved",
  "chooseSpecificSave",
  "webchatLoginTitle",
  "webchatLoginBody",
  "webchatNoApiKey",
  "openWebChatPage",
  "webchatLoginReminder",
  "importLocalModels",
  "importLocalModelsHelp",
  "localModelPaths",
  "chooseLocalModelFiles",
  "noImportedModelsFound",
  "importedModelNeedsSave",
  "importedModelAutoAdded",
  "importedModelAlreadyAdded",
  "importedModelResultHint",
  "importedModelSkippedExisting",
  "localModelImportWarning",
  "localModelReadFallback",
  "localModelHelperMissing",
  "localModelAbsolutePathNeeded"
].forEach(localized);

assert.match(content, /webchatLoginReminder/, "paper chat should warn when a WebChat model is selected");

console.log("model config ux contract ok");
