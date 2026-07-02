const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");
const css = fs.readFileSync(path.join(root, "content.css"), "utf8");

assert.match(
  content,
  /if \(!isEmbeddedPanel && isPdfPage\(\)\) \{[\s\S]*?installIframePanel\(paper\);[\s\S]*?return;[\s\S]*?\}/,
  "top-level PDF pages should use the iframe panel used by the stable release"
);

assert.doesNotMatch(
  content,
  /const isPdfReadingPanel|is-pdf-panel/,
  "content should not keep the direct PDF panel mode that regressed input focus"
);

assert.match(
  content,
  /<label class="alc-model-picker">[\s\S]*?<select class="alc-model-select"/,
  "model picker should use the stable native select markup"
);

assert.doesNotMatch(
  content,
  /alc-model-combobox|alc-model-button|alc-model-menu|renderModelMenu|toggleModelMenu/,
  "content should not keep the later custom model combobox"
);

assert.doesNotMatch(
  css,
  /alc-model-combobox|alc-model-button|alc-model-menu|is-pdf-panel/,
  "CSS should not hide the native model select or style the removed custom combobox"
);

console.log("pdf iframe panel contract ok");
