const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const content = read("content.js");
const background = read("background.js");

assert.match(content, /function getWebChatPdfCandidateUrl\(/, "content should centralize WebChat PDF candidate URL selection");
assert.match(content, /payload\.pageUrl/, "WebChat PDF preparation should consider pageUrl, not only pdfUrl");
assert.match(content, /function canFetchPdfBytesInPage\(/, "content should gate byte fetches without skipping fallback generation");
assert.doesNotMatch(content, /if \(!pdfUrl \|\| !\/\^https\?:\\\/\\\/\//, "non-HTTP PDF candidates must not return before fallback context PDF generation");
assert.match(content, /createFallbackContextPdfPayload\(payload, pdfUrl, filename, attempts\)/, "all WebChat profiles should fall back to generated context PDFs");
assert.match(content, /PDF source was unavailable for direct upload/, "generated context PDF should clearly explain source limitations");
assert.match(content, /buildFallbackPdfText\(payload, extraction\?\.text \|\| "", extraction\?\.source \|\| "", attempts\)/, "fallback PDF should include preparation diagnostics");
assert.doesNotMatch(content, /if \(text\.length < 400\)/, "metadata-only context PDFs should not be blocked by the old 400-character threshold");
assert.match(content, /source: result\.source \|\| sourceLabel/, "WebChat PDF payload should keep source metadata");

assert.match(background, /generated: value\.generated === true/, "background should preserve generated context PDF metadata");
assert.match(background, /source: normalizeString\(value\.source\)/, "background should preserve WebChat PDF source metadata");

console.log("webchat pdf fallback contract ok");
