# Changelog

## 0.1.2 - 2026-06-30

Release polish.

- Add Chrome extension icons in 16, 32, 48, and 128 pixel sizes.
- Wire extension and toolbar icons into `manifest.json`.
- Keep release metadata aligned for the public GitHub version.

## 0.1.1 - 2026-06-30

Maintenance release.

- Ignore unknown Chrome runtime messages instead of surfacing extension errors.
- Show the settings-page version directly from `manifest.json`.
- Document the `Unknown message type` troubleshooting flow.
- Keep README version metadata in sync with the extension manifest.

## 0.1.0 - 2026-06-30

Initial public source release.

- Add split-screen arXiv paper assistant.
- Add quick summary, deep reading, and study-card modes.
- Add per-paper local conversation history.
- Add local PDF text extraction with bundled PDF.js.
- Add ar5iv fallback for full-text context.
- Add OpenAI-compatible model profiles for OpenAI, DeepSeek, MiniMax, Ollama, and custom endpoints.
- Add streaming Chat Completions with fallback to non-streaming requests.
- Add context-window budgeting and estimated usage display.
- Add searchable local review library with Markdown export.
- Add Chrome PDF viewer iframe panel to avoid input focus issues.
