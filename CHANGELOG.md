# Changelog

## 0.1.5 - 2026-06-30

Stable update prompts.

- Add a latest stable tag ZIP download button to the popup and settings update prompts.
- Show two update methods when a new version is available: `git pull` for cloned installs, or stable ZIP download for regular users.
- Show update reminders across the popup, settings page, review library, arXiv assistant panel, and PDF iframe panel.
- Redesign model profile management with a profile list, focused editor, provider presets, duplicate, delete, set-active, and API key visibility controls.
- Add an in-chat model switcher so paper conversations can change the active model without leaving the arXiv assistant.
- Restrict update checks to stable `vX.Y.Z` tags and ignore prerelease-style tags.
- Document the updated two-path upgrade workflow in both Chinese and English README sections.

## 0.1.4 - 2026-06-30

Stable tag installation guidance.

- Tell users to download stable release/tag ZIP archives instead of the moving `main` branch ZIP.
- Clarify that `git clone` tracks the latest source and is better for updates or development.
- Keep update checks and release instructions aligned with GitHub `vX.Y.Z` tags.

## 0.1.3 - 2026-06-30

Documentation and release metadata.

- Add the project icon to the README header.
- Rewrite download, installation, first-use, and update instructions for source-code users.
- Add recommended GitHub topics and release tag description.
- Base user update checks on GitHub `vX.Y.Z` tags instead of the `main` branch manifest.
- Keep public version metadata aligned across `manifest.json`, README, and settings.

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
