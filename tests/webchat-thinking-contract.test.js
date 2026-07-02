const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const content = read("content.js");
const i18n = read("i18n.js");

assert.match(content, /function formatWebChatElapsed\(/, "content should format WebChat elapsed waiting time");
assert.match(content, /function isThinkingWebChatSite\(/, "ChatGPT and DeepSeek should share thinking-site detection");
assert.match(content, /webchatThinking/, "WebChat should have a dedicated thinking status");
assert.match(content, /chatgpt/, "ChatGPT should be included in thinking status handling");
assert.match(content, /deepseek/, "DeepSeek should be included in thinking status handling");
assert.match(content, /status\?\.elapsedMs/, "thinking status should use heartbeat elapsedMs");
assert.match(content, /status\?\.lastThinkingLength/, "thinking status should surface received thinking text length");
assert.match(content, /waiting_for_first_token/, "first-token wait phase should remain handled");
assert.match(content, /waiting_for_completion/, "completion wait phase should remain handled");

for (const key of [
  "webchatElapsedSeconds",
  "webchatThinking",
  "webchatThinkingWithElapsed",
  "webchatThinkingWithReasoning"
]) {
  const matches = i18n.match(new RegExp(`${key}:`, "g")) || [];
  assert.ok(matches.length >= 2, `${key} should be localized in zh-CN and en`);
}

const background = read("background.js");
const webchat = read("webchat.js");
assert.match(webchat, /lastThinkingLength/, "WebChat heartbeat should include thinking text length");
assert.match(background, /lastThinkingLength/, "background should forward thinking text length");
assert.doesNotMatch(webchat, /deepSeekThinkingOnlyDone/, "DeepSeek must not finish a normal turn with thinking-only content");
assert.doesNotMatch(
  webchat,
  /site\.id === "deepseek"[^;]+lastThinking[^;]+!lastText[^;]+postTerminal/s,
  "DeepSeek thinking-only updates should keep waiting for the final answer instead of posting a terminal result"
);

console.log("webchat thinking contract ok");
