const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const content = read("content.js");
const css = read("content.css");
const i18n = read("i18n.js");

function countMatches(text, pattern) {
  return text.match(pattern)?.length || 0;
}

assert.match(content, /class="alc-history-jump"/, "composer should include a history jump control");
assert.match(content, /class="alc-history-prev"/, "composer should include a previous-message button");
assert.match(content, /class="alc-history-next"/, "composer should include a next-message button");
assert.match(content, /const historyPrevButton = \$\("\.alc-history-prev"\)/, "content should cache the previous button");
assert.match(content, /const historyNextButton = \$\("\.alc-history-next"\)/, "content should cache the next button");
assert.match(content, /function jumpConversationMessage\(/, "content should expose jumpConversationMessage");
assert.match(content, /function resumeConversationAutoScroll\(/, "content should expose a bottom-follow mode");
assert.match(content, /currentIndex >= nodes\.length - 1[\s\S]*resumeConversationAutoScroll\(/, "next from the last message should resume bottom-follow mode");
assert.match(content, /historyJumpIndex = -1[\s\S]*chat\.scrollTo\(\{[\s\S]*chat\.scrollHeight/, "bottom-follow mode should clear the jump index and scroll to the bottom");
assert.match(content, /messages\.map\(\(message,\s*index\)/, "messages should render with a stable index");
assert.match(content, /data-message-index="\$\{index\}"/, "message elements should carry their index");
assert.match(content, /is-jump-target/, "jump target should get a visible highlight class");
assert.match(content, /alc-history-prev/, "busy state should preserve history navigation buttons");

assert.match(css, /\.alc-history-jump\b/, "history jump control should be styled");
assert.match(css, /\.alc-history-jump button\b/, "history jump buttons should be styled");
assert.match(css, /\.alc-message\.is-jump-target \.alc-bubble\b/, "jump target should be highlighted");

for (const key of ["historyJump", "historyPrev", "historyNext", "historyJumpStatus", "historyJumpBottom"]) {
  assert.ok(countMatches(i18n, new RegExp(`${key}:`, "g")) >= 2, `${key} should be localized`);
}

console.log("history jump contract ok");
