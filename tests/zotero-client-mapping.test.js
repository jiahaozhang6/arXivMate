const assert = require("node:assert/strict");

const zotero = require("../zotero-client.js");

const arxivPaper = {
  id: "2501.01234",
  sourceType: "arxiv",
  title: "A Careful Paper",
  authors: "Ada Lovelace, Alan Turing",
  abstract: "This paper studies careful software.",
  subjects: "Computer Science - Software Engineering",
  submittedAt: "Submitted on 1 Jan 2025",
  pdfUrl: "https://arxiv.org/pdf/2501.01234",
  pageUrl: "https://arxiv.org/abs/2501.01234"
};

const arxivItem = zotero.buildZoteroItem(arxivPaper, { includeAttachment: true });
assert.equal(arxivItem.itemType, "preprint");
assert.equal(arxivItem.title, "A Careful Paper");
assert.equal(arxivItem.repository, "arXiv");
assert.equal(arxivItem.archiveID, "2501.01234");
assert.equal(arxivItem.url, "https://arxiv.org/abs/2501.01234");
assert.equal(arxivItem.creators.length, 2);
assert.deepEqual(arxivItem.creators[0], { creatorType: "author", firstName: "Ada", lastName: "Lovelace" });
assert.equal(arxivItem.attachments[0].mimeType, "application/pdf");
assert.equal(arxivItem.attachments[0].isPrimary, true);

const acmItem = zotero.buildZoteroItem({
  sourceType: "acm",
  id: "acm:10.1145/1234567",
  title: "Conference Work",
  authors: "Grace Hopper",
  abstract: "Conference abstract",
  pdfUrl: "https://dl.acm.org/doi/pdf/10.1145/1234567",
  pageUrl: "https://dl.acm.org/doi/10.1145/1234567"
});
assert.equal(acmItem.itemType, "conferencePaper");
assert.equal(acmItem.DOI, "10.1145/1234567");

const path = zotero.formatZoteroTargetPath(
  [
    { id: "L1", name: "我的文库", level: 0 },
    { id: "C1", name: "Video Generation", level: 1 },
    { id: "C2", name: "Long Video", level: 2 }
  ],
  "C2"
);
assert.equal(path, "我的文库 / Video Generation / Long Video");

const treeTargets = [
  { id: "L1", name: "我的文库", level: 0 },
  { id: "C1", name: "World Model", level: 1 },
  { id: "C2", name: "Embodied AI", level: 2 },
  { id: "C3", name: "Diffusion", level: 1 }
];
const collapsedRows = zotero.buildZoteroTargetTreeRows(treeTargets);
assert.deepEqual(collapsedRows.map((row) => row.id), ["L1", "C1", "C3"]);
assert.equal(collapsedRows.find((row) => row.id === "C1").hasChildren, true);
assert.equal(collapsedRows.find((row) => row.id === "C1").isExpanded, false);

const expandedRows = zotero.buildZoteroTargetTreeRows(treeTargets, { expandedIds: ["C1"] });
assert.deepEqual(expandedRows.map((row) => row.id), ["L1", "C1", "C2", "C3"]);
assert.equal(expandedRows.find((row) => row.id === "C1").isExpanded, true);

const filteredRows = zotero.buildZoteroTargetTreeRows(treeTargets, { filter: "Embodied" });
assert.deepEqual(filteredRows.map((row) => row.id), ["L1", "C1", "C2"]);

const treeTargetsWithoutLibraryRoot = [
  { id: "C1", name: "World Model", level: 1 },
  { id: "C2", name: "Embodied AI", level: 2 },
  { id: "C3", name: "Diffusion", level: 1 }
];
const noLibraryRows = zotero.buildZoteroTargetTreeRows(treeTargetsWithoutLibraryRoot);
assert.deepEqual(noLibraryRows.map((row) => row.id), ["C1", "C3"]);
assert.equal(noLibraryRows.find((row) => row.id === "C1").isExpanded, false);

assert.equal(zotero.isZoteroTargetInBranch(treeTargets, "C1", "C2"), true);
assert.equal(zotero.isZoteroTargetInBranch(treeTargets, "C1", "C3"), false);
assert.equal(zotero.isZoteroTargetInBranch(treeTargets, "C1", "C1"), true);
assert.deepEqual(zotero.pruneZoteroHoverExpandedTargetIds(treeTargets, ["C1"], "C2"), ["C1"]);
assert.deepEqual(zotero.pruneZoteroHoverExpandedTargetIds(treeTargets, ["C1"], "C3"), []);
assert.deepEqual(zotero.pruneZoteroHoverExpandedTargetIds(treeTargets, ["C1"], ""), []);

console.log("zotero client mapping ok");
