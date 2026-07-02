const assert = require("node:assert/strict");
const zotero = require("../zotero-client.js");

const targets = [
  { id: "L1", name: "My Library", level: 0 },
  { id: "C10", name: "Machine Learning", level: 1 },
  { id: "C11", name: "Graph Neural Networks", level: 2 },
  { id: "C20", name: "Computer Vision", level: 1 },
  { id: "C30", name: "Video Generation", level: 1, recent: true },
  { id: "C31", name: "World Model", level: 1 },
  { id: "C99", name: "Archive", level: 1, disabled: true }
];

{
  const suggestions = zotero.parseSuggestionResponse(
    "```json\n{\"suggestions\":[{\"targetId\":\"Use C20 for this paper\",\"reason\":\"vision model\",\"confidence\":0.8}]}\n```",
    targets
  );
  assert.equal(suggestions[0]?.targetId, "C20", "parser should recover a collection ID embedded in model text");
}

{
  const suggestions = zotero.parseSuggestionResponse(
    JSON.stringify({
      suggestions: [
        {
          collection: "Machine Learning / Graph Neural Networks",
          reason: "the paper is about graph learning",
          confidence: 0.9
        },
        {
          name: "Archive",
          reason: "disabled target should not be suggested",
          confidence: 0.6
        }
      ]
    }),
    targets
  );
  assert.deepEqual(
    suggestions.map((row) => row.targetId),
    ["C11"],
    "parser should match returned collection paths/names to writable Zotero targets"
  );
  assert.equal(suggestions[0].path, "My Library / Machine Learning / Graph Neural Networks");
}

{
  const suggestions = zotero.createSuggestionFallback({
    title: "A Diffusion World Model for Long Video Generation",
    abstract: "We study video generation and world models for controllable long-horizon scenes."
  }, targets);
  assert.equal(suggestions[0]?.targetId, "C30", "local fallback should use paper text to choose a usable collection");
}

{
  const suggestions = zotero.createSuggestionFallback({
    title: "A Paper With No Obvious Local Category",
    abstract: "This abstract does not match any collection name."
  }, targets, {
    selectedTargetId: "C11"
  });
  assert.equal(suggestions[0]?.targetId, "C11", "fallback should preserve the current Zotero collection when local matching is weak");
}

console.log("zotero suggestion parser ok");
