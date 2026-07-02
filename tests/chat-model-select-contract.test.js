const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");

assert.match(
  content,
  /modelSelect\.addEventListener\("change",\s*switchChatModel\)/,
  "chat model select should switch models on change"
);

assert.doesNotMatch(
  content,
  /modelSelect\.addEventListener\("pointerdown"[\s\S]*?forceRefreshSettingsFromLocal/,
  "chat model select must not refresh settings on pointerdown because rebuilding options closes the native dropdown"
);

assert.doesNotMatch(
  content,
  /modelSelect\.addEventListener\("focus"[\s\S]*?forceRefreshSettingsFromLocal/,
  "chat model select must not refresh settings on focus because rebuilding options makes the dropdown flash"
);

assert.match(
  content,
  /function isNativeSelectOpenEvent\(/,
  "native select interactions should be detected before panel event guards stop propagation"
);

assert.match(
  content,
  /path\.includes\(modelSelect\)[\s\S]*?pointerdown[\s\S]*?mousedown[\s\S]*?click/,
  "chat model select pointer/mouse events should be allowed through so the browser can keep the dropdown open"
);

assert.match(
  content,
  /if \(isNativeSelectOpenEvent\(event,\s*path\)\) \{[\s\S]*?markModelSelectInteraction\(\);[\s\S]*?return;[\s\S]*?\}/,
  "panel event guard should mark and then bypass native select open events"
);

assert.match(
  content,
  /function isModelSelectInteractionActive\(\)/,
  "chat model select should expose an interaction guard while the native dropdown is opening"
);

assert.doesNotMatch(
  content,
  /modelButton|modelMenu/,
  "native select mode must not keep dead references to the removed custom model menu"
);

assert.match(
  content,
  /if \(isPanelOpen && !isPanelInteractionActive\(\)\) refreshSettings/,
  "window focus refresh should not rebuild panel UI while the user is interacting with it"
);

assert.match(
  content,
  /if \(!document\.hidden && isPanelOpen && !isPanelInteractionActive\(\)\) refreshSettings/,
  "visibility refresh should not rebuild panel UI while the user is interacting with it"
);

assert.match(
  content,
  /if \(isPanelInteractionActive\(\)\) return true;[\s\S]*?applySettingsSnapshot\(settings\)/,
  "an already-started settings refresh should not apply snapshots while the user is interacting with the panel"
);

assert.match(
  content,
  /function renderModelSelect\(\) \{[\s\S]*?modelSelect\.replaceChildren/,
  "model select rendering may rebuild options, so it must not be called from open-dropdown events"
);

console.log("chat model select contract ok");
