const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const backgroundJs = fs.readFileSync(path.join(root, "background.js"), "utf8");

const fetchCalls = [];
const context = {
  console,
  setTimeout,
  clearTimeout,
  TextDecoder,
  URL,
  importScripts() {},
  fetch: async (url, options = {}) => {
    fetchCalls.push({ url, options });
    if (/\/models$/i.test(url)) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        body: null,
        text: async () => ""
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      body: null,
      text: async () => JSON.stringify({
        content: [{ type: "text", text: "OK" }]
      })
    };
  },
  chrome: {
    runtime: {
      getManifest: () => ({ version: "0.0.0" }),
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
      onConnect: { addListener() {} },
      sendNativeMessage() {}
    },
    storage: {
      sync: { get: async () => ({}), set: async () => {} },
      local: { get: async () => ({}), set: async () => {} }
    },
    tabs: {
      query: async () => [],
      sendMessage: async () => {},
      reload: async () => {},
      create: async () => ({ id: 1 }),
      get: async () => ({ id: 1, status: "complete", url: "about:blank" })
    }
  }
};
context.globalThis = context;

vm.createContext(context);
vm.runInContext(backgroundJs, context, { filename: "background.js" });

(async () => {
  const normalized = vm.runInContext("normalizeModelProfile", context)({
    id: "p1",
    name: "Local Claude",
    provider: "anthropic",
    baseUrl: "https://api.minimaxi.com/anthropic",
    apiKey: "sk-test",
    model: "claude-3-5-sonnet-latest"
  });
  assert.equal(normalized.provider, "anthropic", "explicit Anthropic provider must not be overwritten by a MiniMax host");
  assert.equal(normalized.baseUrl, "https://api.minimaxi.com/anthropic", "Anthropic profile should keep the imported base URL");

  const result = await vm.runInContext("testModelProfile", context)(normalized);
  assert.equal(result.text, "OK", "Anthropic test profile should parse Messages API text content");

  assert.equal(fetchCalls.length, 1, "Anthropic profile test should make one request");
  assert.equal(fetchCalls[0].url, "https://api.minimaxi.com/anthropic/v1/messages", "Anthropic profile should call the Messages endpoint");
  assert.equal(fetchCalls[0].options.headers["x-api-key"], "sk-test", "Anthropic request should use x-api-key");
  assert.equal(fetchCalls[0].options.headers["anthropic-version"], "2023-06-01", "Anthropic request should set anthropic-version");
  assert.doesNotMatch(fetchCalls[0].url, /chat\/completions$/, "Anthropic profiles must not use OpenAI chat completions");

  const body = JSON.parse(fetchCalls[0].options.body);
  assert.equal(body.model, "claude-3-5-sonnet-latest", "Anthropic request should keep the imported model id");
  assert.equal(body.messages.at(-1).role, "user", "Anthropic request should send user messages in Messages API format");

  const listResult = await vm.runInContext("listModelsForProfile", context)(normalized);
  assert.deepEqual(
    Array.from(listResult.models),
    ["claude-3-5-sonnet-latest"],
    "Anthropic-compatible providers without /models should fall back to the configured model"
  );
  assert.match(
    listResult.warning,
    /不提供模型列表|does not expose model listing/i,
    "Anthropic-compatible /models fallback should explain why only the configured model is shown"
  );

  console.log("anthropic provider contract ok");
})();
