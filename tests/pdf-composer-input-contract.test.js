const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");

assert.match(
  content,
  /if \(!isEmbeddedPanel && isPdfPage\(\)\) \{[\s\S]*?installIframePanel\(paper\);[\s\S]*?return;[\s\S]*?\}/,
  "top-level PDF pages should use the stable iframe panel so the PDF viewer cannot steal composer input"
);
assert.doesNotMatch(
  content,
  /isPdfReadingPanel|is-pdf-panel/,
  "top-level PDF pages should not use the later direct-panel mode"
);
assert.doesNotMatch(
  content,
  /window\.addEventListener\("keydown",\s*handlePanelInputCaptureKeydown,\s*true\)/,
  "PDF reader panel should not globally capture keydown before the textarea can receive native input"
);
assert.doesNotMatch(
  content,
  /document\.addEventListener\("keydown",\s*handlePanelInputCaptureKeydown,\s*true\)/,
  "PDF reader panel should not install document-level keydown interception"
);
assert.match(
  content,
  /input\.addEventListener\("keydown",\s*\(event\) => \{[\s\S]*?scheduleKeyboardFallback\(event\);[\s\S]*?\}\);/,
  "composer textarea should keep the stable release keydown fallback on the input itself"
);
assert.match(
  content,
  /input\.addEventListener\("pointerdown",\s*\(\) => \{[\s\S]*?input\.focus\(\)[\s\S]*?\}\);/,
  "composer textarea should restore focus on pointerdown without intercepting global keyboard input"
);
assert.doesNotMatch(
  content,
  /function handlePanelInputCaptureKeydown\(/,
  "content should not keep the removed capture-level keyboard handler"
);
assert.doesNotMatch(
  content,
  /function installPanelInputCaptureGuard\(/,
  "content should not keep the removed capture-level input guard"
);
assert.match(
  content,
  /function isPanelEditingInteractionActive\(/,
  "settings refresh should be able to detect active text editing in the panel"
);
assert.match(
  content,
  /function isPanelEditable\(/,
  "panel editing detection should be implemented without relying on removed helpers"
);
assert.match(
  content,
  /if \(isPanelInteractionActive\(\)\) return true;/,
  "settings refresh should not repaint the panel while the user is interacting with inputs or menus"
);
assert.match(
  content,
  /const languageChanged = normalizeLanguage\(value\) !== currentLanguage;/,
  "language application should detect whether a repaint is actually needed"
);
assert.match(
  content,
  /if \(languageChanged\) \{[\s\S]*?renderConversation\(currentConversation\);[\s\S]*?renderModelSelect\(\);[\s\S]*?renderZoteroDrawer\(\);[\s\S]*?\}/,
  "conversation and controls should only rerender when the language actually changes"
);

console.log("pdf composer input contract ok");
