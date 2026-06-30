const notesNode = document.querySelector("#notes");
const searchNode = document.querySelector("#search");
const countNode = document.querySelector("#count");
const exportButton = document.querySelector("#export");

let notes = [];

applyStoredAppearance();
loadNotes();
searchNode.addEventListener("input", render);
exportButton.addEventListener("click", exportMarkdown);

async function applyStoredAppearance() {
  try {
    const { settings = {} } = await chrome.storage.sync.get("settings");
    document.body.dataset.appearance = resolveAppearance(settings.appearance);
  } catch {
    document.body.dataset.appearance = resolveAppearance("system");
  }
}

async function loadNotes() {
  const { notes: noteMap = {}, conversations = {} } = await chrome.storage.local.get(["notes", "conversations"]);
  const merged = new Map();

  for (const note of Object.values(noteMap)) {
    if (note?.id) merged.set(note.id, { ...note, hasNote: true });
  }
  for (const conversation of Object.values(conversations)) {
    if (!conversation?.id) continue;
    const previous = merged.get(conversation.id) || {};
    merged.set(conversation.id, {
      ...previous,
      ...conversation,
      conversation,
      hasConversation: true,
      updatedAt: maxDate(previous.updatedAt, conversation.updatedAt),
      title: previous.title || conversation.title,
      authors: previous.authors || conversation.authors,
      subjects: previous.subjects || conversation.subjects,
      submittedAt: previous.submittedAt || conversation.submittedAt,
      paperUpdatedAt: previous.paperUpdatedAt || conversation.paperUpdatedAt,
      abstract: previous.abstract || conversation.abstract,
      pdfUrl: previous.pdfUrl || conversation.pdfUrl
    });
  }

  notes = [...merged.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  render();
}

function render() {
  const query = searchNode.value.trim().toLowerCase();
  const filtered = notes.filter((note) => {
    const haystack = [
      note.title,
      note.id,
      note.authors,
      note.subjects,
      note.summary,
      conversationToSearchText(note.conversation)
    ].join(" ").toLowerCase();
    return !query || haystack.includes(query);
  });

  countNode.textContent = `${filtered.length} / ${notes.length} 篇`;
  if (!filtered.length) {
    notesNode.innerHTML = `<div class="empty">还没有保存的论文笔记。</div>`;
    return;
  }

  notesNode.innerHTML = filtered.map((note) => `
    <article class="note" data-id="${escapeAttr(note.id)}">
      <div class="note-header">
        <div>
          <h2>${escapeHtml(note.title || note.id)}</h2>
          <div class="meta">
            ${escapeHtml(note.id || "")}
            ${note.submittedAt ? ` · 提交 ${escapeHtml(note.submittedAt)}` : ""}
            ${note.paperUpdatedAt ? ` · 论文更新 ${escapeHtml(note.paperUpdatedAt)}` : ""}
            ${note.subjects ? ` · ${escapeHtml(note.subjects)}` : ""}
            ${note.updatedAt ? ` · ${escapeHtml(formatDate(note.updatedAt))}` : ""}
            ${note.conversation?.turnCount ? ` · ${escapeHtml(String(note.conversation.turnCount))} 轮对话` : ""}
            ${note.pdfUrl ? ` · <a href="${escapeAttr(note.pdfUrl)}" target="_blank" rel="noreferrer">PDF</a>` : ""}
          </div>
          <div class="meta">${escapeHtml(note.authors || "")}</div>
        </div>
        <div class="note-actions">
          <button class="secondary" data-action="copy">复制</button>
          <button class="secondary" data-action="toggle">对话</button>
          <button class="danger" data-action="delete">删除</button>
        </div>
      </div>
      <div class="summary">${escapeHtml(note.summary || "")}</div>
      <div class="conversation" hidden>${renderConversation(note.conversation)}</div>
    </article>
  `).join("");

  notesNode.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", handleNoteAction);
  });
}

async function handleNoteAction(event) {
  const article = event.target.closest(".note");
  const id = article?.dataset.id;
  const note = notes.find((item) => item.id === id);
  if (!note) return;

  if (event.target.dataset.action === "copy") {
    await navigator.clipboard.writeText(buildMarkdown(note));
    event.target.textContent = "已复制";
    setTimeout(() => {
      event.target.textContent = "复制";
    }, 1200);
    return;
  }

  if (event.target.dataset.action === "toggle") {
    const conversation = article.querySelector(".conversation");
    if (!conversation) return;
    conversation.hidden = !conversation.hidden;
    event.target.textContent = conversation.hidden ? "对话" : "收起";
    return;
  }

  if (event.target.dataset.action === "delete") {
    if (!confirm(`删除 ${note.id} 的本地笔记和对话历史？`)) return;
    const { notes: noteMap = {}, conversations = {} } = await chrome.storage.local.get(["notes", "conversations"]);
    delete noteMap[id];
    delete conversations[id];
    await chrome.storage.local.set({ notes: noteMap, conversations });
    notes = notes.filter((item) => item.id !== id);
    render();
  }
}

async function exportMarkdown() {
  if (!notes.length) return;
  const text = notes.map(buildMarkdown).join("\n\n---\n\n");
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `arxiv-notes-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildMarkdown(note) {
  return [
    `# ${note.title || note.id || "arXiv paper"}`,
    "",
    `- arXiv: ${note.id || ""}`,
    `- Authors: ${note.authors || ""}`,
    `- Submitted: ${note.submittedAt || ""}`,
    `- Paper updated: ${note.paperUpdatedAt || ""}`,
    `- Subjects: ${note.subjects || ""}`,
    `- Updated: ${note.updatedAt || ""}`,
    `- PDF: ${note.pdfUrl || ""}`,
    "",
    "## Abstract",
    note.abstract || "",
    "",
    "## LLM Note",
    note.summary || "",
    "",
    "## Conversation",
    conversationToMarkdown(note.conversation)
  ].join("\n");
}

function renderConversation(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  if (!messages.length) return `<div class="empty-inline">暂无对话历史。</div>`;
  return messages.map((message) => `
      <div class="message ${escapeAttr(message.role)}">
      <div class="message-meta">${message.role === "user" ? "你" : "AI"} · ${escapeHtml(formatDate(message.createdAt))}${message.mode ? ` · ${escapeHtml(modeLabel(message.mode))}` : ""}${message.role === "assistant" ? formatMessageUsageMeta(message) : ""}</div>
      <div class="message-body">${escapeHtml(message.text || "")}</div>
    </div>
  `).join("");
}

function conversationToMarkdown(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  if (!messages.length) return "";
  return messages.map((message) => [
    `### ${message.role === "user" ? "User" : "Assistant"} ${message.createdAt || ""}`,
    "",
    message.text || ""
  ].join("\n")).join("\n\n");
}

function conversationToSearchText(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  return messages.map((message) => message.text || "").join(" ");
}

function modeLabel(mode) {
  if (mode === "deep") return "深读";
  if (mode === "study") return "学习卡";
  if (mode === "ask") return "追问";
  return "速览";
}

function maxDate(left, right) {
  if (!left) return right;
  if (!right) return left;
  return String(left).localeCompare(String(right)) >= 0 ? left : right;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatMessageUsageMeta(message) {
  const tokens = Number(message?.contextTokens);
  const windowTokens = Number(message?.contextWindow);
  if (!Number.isFinite(tokens) || tokens <= 0 || !Number.isFinite(windowTokens) || windowTokens <= 0) return "";
  const percent = Math.max(0, Math.min(100, Math.round((tokens / windowTokens) * 100)));
  const capped = message.contextCapped ? "，已裁剪" : "";
  return ` · ${escapeHtml(`上下文 ${formatTokenCount(tokens)} / ${formatTokenCount(windowTokens)} (${percent}%${capped})`)}`;
}

function formatTokenCount(value) {
  const tokens = Math.max(0, Math.floor(Number(value) || 0));
  if (tokens < 1000) return String(tokens);
  if (tokens < 1000000) {
    return tokens < 10000
      ? `${(tokens / 1000).toFixed(1).replace(/\.0$/, "")}k`
      : `${Math.round(tokens / 1000)}k`;
  }
  return `${(tokens / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
}

function normalizeAppearance(value) {
  if (value === "system" || value === "跟随系统") return "system";
  if (value === "light" || value === "浅色") return "light";
  if (value === "dark" || value === "深色") return "dark";
  if (value === "sepia" || value === "护眼") return "sepia";
  return "system";
}

function resolveAppearance(value) {
  const normalized = normalizeAppearance(value);
  if (normalized !== "system") return normalized;
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
