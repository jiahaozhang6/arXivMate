# Changelog

## 0.1.14 - 2026-06-30

IEEE and dynamic PDF reading release.

- Add IEEE Xplore REST full-text extraction for `stamp.jsp?arnumber=...` papers, avoiding invalid PDF parsing on dynamic IEEE PDF pages.
- Improve detection for non-`.pdf` PDF entry URLs across IEEE, ACM, Springer, Wiley, ScienceDirect, ResearchGate, and repository download paths.
- Add lightweight background probing for likely PDF download URLs using response headers and PDF magic bytes.
- Preserve already streamed assistant text when the user stops generation, and save stopped turns into local paper chat history.
- Keep stopped assistant turns visibly marked in Chinese and English chat UIs.

## 0.1.13 - 2026-06-30

Model loading dropdown fix.

- Add an explicit model picker next to the model-name input in settings.
- Refresh the picker immediately after loading models from the provider `/models` endpoint.
- Keep manual model input available while making loaded models selectable without relying on browser datalist behavior.

## 0.1.12 - 2026-06-30

PDF, Markdown, and reading-layout release.

- Support arXiv and general PDF pages with full-text-first reading for quick, deep, study, and follow-up chats.
- Move PDF text extraction to the page context so Chrome service-worker PDF.js loading failures no longer block summaries.
- Add KaTeX-backed math rendering and broader Markdown rendering for tables, task lists, code, blockquotes, images, and loose formulas.
- Add local panel layout controls: docked split view, floating window, draggable floating header, resizable edges, and restore layout.
- Clamp model numeric settings to supported bounds so oversized user input is automatically corrected.
- Improve model thinking/reasoning compatibility for DeepSeek, MiniMax, OpenAI-compatible, and custom providers.

## 0.1.11 - 2026-06-30

Hard fix for paper-chat model selector hydration.

- Persist model profiles both inside `settings` and as a separate local `modelProfiles` snapshot.
- Let the paper panel read the separate local model snapshot when the full settings object is empty or stale.
- Broadcast full settings to open arXiv tabs after saving, and reload stale tabs that cannot receive the message.
- Add the `tabs` permission so arXiv tabs can be reliably refreshed after settings changes.

## 0.1.10 - 2026-06-30

Root fix for missing model profiles.

- Add a stable extension key so unpacked installs keep the same Chrome extension ID across release folders.
- Make `chrome.storage.local.settings` the authoritative settings store; sync storage is only a backup copy.
- Route settings reads and writes through the background service worker, and refresh already-open paper panels from local settings changes.
- Remove the fragile multi-source content-script storage fallback that could leave the chat panel reading an empty model list.
- Save model profiles after field validation; connection testing stays available per profile but no longer blocks profiles from appearing in the paper chat.

## 0.1.9 - 2026-06-30

Model profile storage fallback.

- Save a local `settingsMirror` copy whenever settings are saved.
- Load model profiles from background settings, sync storage, or the local mirror, whichever has profiles.
- Show a diagnostic status in the paper assistant with profile counts from background, sync, and local mirror when no model is found.

## 0.1.8 - 2026-06-30

Settings refresh fix.

- Refresh model profiles from storage when the paper assistant opens, gains focus, the model selector is opened, or a request starts.
- Move model testing into each model editor card and remove the global settings-page test button.
- Rename the test action to "Test this model" / "测试此模型".
- Test every configured model before saving settings; if any model fails, settings are not saved.
- Clarify the storage-safe ZIP update path: overwrite the same extension folder and reload the existing extension card so local notes and chat history remain attached to the same extension ID.

## 0.1.7 - 2026-06-30

Model selection and cancellation polish.

- Start new installations with an empty model profile list so users create their own profiles.
- Remove the global active-model setting; saved profiles can be selected per paper chat request.
- Add a Stop action during streaming generation to interrupt the current conversation turn.
- Update the MiniMax preset and documentation to `https://api.minimaxi.com/v1`.

## 0.1.6 - 2026-06-30

Release-based updates.

- Use GitHub Releases, not Tags, as the source for user-facing update checks.
- Point update buttons and documentation to the latest stable Release download flow.
- Keep tag names only as the version identifier behind a Release.

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
