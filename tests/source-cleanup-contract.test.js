const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const content = fs.readFileSync(path.join(root, "content.js"), "utf8");

function countMatches(text, pattern) {
  return text.match(pattern)?.length || 0;
}

assert.equal(
  countMatches(content, /function installPageSplitStyles\(/g),
  1,
  "page split style injection should have one shared implementation"
);

assert.doesNotMatch(
  content,
  /installStandaloneSplitStyles/,
  "content should not keep a duplicate standalone split-style installer"
);

assert.equal(
  countMatches(content, /function buildPaperMeta\(/g),
  1,
  "content should keep one stable inline paper metadata helper"
);

assert.doesNotMatch(
  content,
  /function buildPaperMetaItems\(/,
  "content should not keep split-chip paper metadata rendering"
);

assert.equal(
  countMatches(content, /function formatMessageUsageMeta\(/g),
  1,
  "content should keep one stable inline usage meta helper"
);

assert.doesNotMatch(
  content,
  /function renderMessageMeta\(/,
  "content should not keep structured message meta chip rendering"
);

assert.doesNotMatch(
  content,
  /forceRefreshSettingsFromLocal|function readLocalSettings\(/,
  "content should not keep the removed open-dropdown settings refresh path"
);

for (const file of ["background.js", "content.js", "options.js", "popup.js", "review.js", "webchat.js", "webchat-injected.js", "panel-bootstrap.js"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert.doesNotMatch(source, /console\.debug\(/, `${file} should not keep debug logging in production code`);
}

console.log("source cleanup contract ok");
