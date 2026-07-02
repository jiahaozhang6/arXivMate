const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const optionsJs = read("options.js");
const optionsCss = read("options.css");
const i18n = read("i18n.js");
const content = read("content.js");

function localized(key) {
  const matches = i18n.match(new RegExp(`${key}:`, "g")) || [];
  assert.ok(matches.length >= 2, `${key} should be localized in zh-CN and en`);
}

assert.match(optionsJs, /function renderSetupGuide\(/, "settings page should render a first-run setup guide");
assert.match(optionsJs, /function renderProfileChecklist\(/, "settings page should render a profile readiness checklist");
assert.match(optionsJs, /function renderProviderNotice\(/, "settings page should render provider-specific guidance");
assert.match(optionsJs, /function renderWebChatLoginNotice\(/, "WebChat profiles should show a login warning");
assert.match(optionsJs, /data-action="open-webchat"/, "WebChat profiles should provide an open-webchat action");
assert.match(optionsJs, /openWebChatPage\(/, "open-webchat action should open the provider web page");
assert.match(optionsJs, /isWebChatProvider\(profile\.provider\)/, "WebChat guidance should apply to every WebChat provider");

assert.match(optionsCss, /\.setup-guide\b/, "setup guide should be styled");
assert.match(optionsCss, /\.profile-checklist\b/, "profile checklist should be styled");
assert.match(optionsCss, /\.provider-notice\b/, "provider notice should be styled");
assert.match(optionsCss, /\.webchat-login-notice\b/, "WebChat login warning should be styled");

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
  "webchatLoginTitle",
  "webchatLoginBody",
  "webchatNoApiKey",
  "openWebChatPage",
  "webchatLoginReminder"
].forEach(localized);

assert.match(content, /webchatLoginReminder/, "paper chat should warn when a WebChat model is selected");

console.log("model config ux contract ok");
