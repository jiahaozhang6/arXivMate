const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const options = read("options.js");
const background = read("background.js");

assert.match(
  options,
  /maxOutputTokens:\s*{[^}]*fallback:\s*\(profile\)\s*=>\s*getModelOutputTokenLimit\(profile\?\.model\)/s,
  "settings UI maxOutputTokens fallback should use the selected model output limit"
);
assert.match(
  options,
  /maxOutputTokens:\s*getModelOutputTokenLimit\(model\)/,
  "new model profiles should default output tokens to the model limit"
);
assert.match(
  options,
  /function normalizeProfileMaxOutputTokens\(/,
  "settings UI should migrate old profile default output token values"
);
assert.match(
  options,
  /maxOutputTokens:\s*normalizeProfileMaxOutputTokens\(profile\.maxOutputTokens,\s*model,\s*provider\)/,
  "settings UI should apply profile output token migration when loading profiles"
);
assert.doesNotMatch(
  options,
  /maxOutputTokens:\s*Number\([^)]*\?\?\s*1600\)/,
  "normalizing settings profiles should not fall back to 1600 output tokens"
);
assert.match(
  background,
  /const fallback = getModelOutputTokenLimit\(model\)/,
  "background normalization should default max output tokens to the model limit"
);
assert.doesNotMatch(
  background,
  /const fallback = DEFAULT_PROFILE_SETTINGS\.maxOutputTokens/,
  "background max output token fallback should not use the old 1600 default"
);
assert.match(
  background,
  /function normalizeProfileMaxOutputTokens\(/,
  "background should migrate old profile default output token values"
);
assert.match(
  background,
  /maxOutputTokens:\s*normalizeProfileMaxOutputTokens\(profile\.maxOutputTokens,\s*model,\s*provider\)/,
  "background should apply profile output token migration when normalizing profiles"
);

console.log("default output token limit contract ok");
