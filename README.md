# arXivMate

arXivMate is a local-first Chrome MV3 extension for reading arXiv papers with an LLM. It adds a split-screen paper assistant to arXiv abstract and PDF pages, supports per-paper chat history, extracts PDF text locally with PDF.js, and keeps a searchable review library for daily research reading.

The project is inspired by the model-profile, context-window, PDF-capability, and paper-chat ideas in [`llm-for-zotero`](https://github.com/yilewang/llm-for-zotero), adapted for a lightweight browser extension workflow.

## Features

- Split-screen assistant on arXiv `abs` and `pdf` pages.
- Quick summary, deep reading, and study-card modes.
- Per-paper chat with local history, keyed by arXiv ID.
- Local PDF text extraction with PDF.js for full-text context.
- Fallback to ar5iv HTML when PDF text extraction is unavailable.
- Streaming Chat Completions when the provider supports it.
- Multiple model profiles for OpenAI-compatible APIs.
- Built-in presets for OpenAI, DeepSeek, MiniMax, Ollama, and custom endpoints.
- Context-window budgeting with estimated usage display, for example `12k / 128k`.
- Searchable local review library with Markdown export.
- Local storage for notes, conversation history, and extracted text cache.

## Screenshots

Screenshots are not committed yet. Suggested captures before publishing:

- arXiv abstract page with arXivMate split screen open.
- arXiv PDF page with chat input focused.
- Model profile settings page.
- Review library with a saved paper conversation.

## Install

This extension is currently loaded as an unpacked Chrome extension.

1. Clone this repository:

   ```bash
   git clone https://github.com/<your-github-username>/arXivMate.git
   ```

2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the cloned `arXivMate` directory.
6. Open the extension popup and configure a model profile.

If you change the source code, click the extension reload button on `chrome://extensions`, then refresh the arXiv page.

## Update

If you installed arXivMate from a git clone, update it with:

```bash
cd arXivMate
git pull
```

Then open `chrome://extensions`, click the reload button on arXivMate, and refresh any open arXiv pages.

If you forked the repository and want to keep your fork synced with the upstream project:

```bash
git remote add upstream https://github.com/<upstream-owner>/arXivMate.git
git fetch upstream
git merge upstream/main
```

If your local branch is named `master`, use `upstream/master` instead of `upstream/main`.

## Usage

1. Open an arXiv paper, for example `https://arxiv.org/abs/1706.03762`.
2. Click the `AI` button in the bottom-right corner.
3. Use one of the reading modes:
   - `速览`: fast metadata and abstract summary.
   - `深读`: full-text-oriented analysis using PDF text extraction when available.
   - `学习卡`: reading plan, recall questions, and Anki-style cards.
4. Ask follow-up questions in the composer.
5. Reopen the same paper later to continue from local history.
6. Open `历史` to search saved notes and conversations.

On desktop, arXivMate uses a right-side split-screen layout. Closing the assistant restores the page to the normal single-column view.

## Model Profiles

arXivMate calls OpenAI-compatible Chat Completions endpoints.

| Provider | Default Base URL | Example model | Notes |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | Uses standard Chat Completions. |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` | Uses OpenAI-compatible chat format; thinking output is disabled/stripped where possible. |
| MiniMax | `https://api.minimax.io/v1` | `MiniMax-M3` | Also recognizes `api.minimaxi.com`; thinking output is stripped where possible. |
| Ollama | `http://localhost:11434/v1` | `llama3.1` | API key can be left empty for local setups. |
| Custom | User-defined | User-defined | Any compatible Chat Completions gateway. |

Each profile stores:

- Provider and API base URL.
- API key.
- Model name.
- Temperature and output token limit.
- Context window token cap.
- Full-text character budget.
- Number of recent chat turns to include.
- Fallback behavior for ar5iv.

## Context Window

Most users do not need to edit the context window manually.

arXivMate follows the `llm-for-zotero` style of treating `inputTokenCap` as the active model context window. The extension:

- Infers a default context window from the model name.
- Reserves output tokens before sending the prompt.
- Uses a 90% soft limit for safety.
- Drops older history first when the prompt is too large.
- Trims paper full-text context when needed.
- Displays and stores estimated context usage for each assistant turn.

For custom gateways or models with unusual limits, override `上下文窗口 tokens` in the profile's advanced settings.

## PDF Handling

arXivMate does not blindly upload PDF files to every OpenAI-compatible provider.

Following the capability separation used by `llm-for-zotero`, the extension treats native PDF input as provider-specific. DeepSeek, MiniMax, Ollama, and generic OpenAI-compatible endpoints use extracted text as context by default:

1. Resolve the current arXiv PDF URL.
2. Download the PDF in the extension background service worker.
3. Extract text with bundled PDF.js.
4. Cache the extracted text locally.
5. Send only the selected text context, metadata, and recent chat history to the configured LLM.
6. If PDF extraction fails and ar5iv is enabled, fetch ar5iv HTML text as a fallback.

This is more reliable than pretending that all compatible chat endpoints accept binary PDF input.

## Local Storage

arXivMate stores data in Chrome extension storage:

- `chrome.storage.sync.settings`: model profiles and active profile selection.
- `chrome.storage.local.conversations`: per-paper chat history.
- `chrome.storage.local.notes`: saved reading notes.
- `chrome.storage.local.paperContextCache`: cached PDF/ar5iv text snippets.

The review page merges saved notes and conversations so any paper you chatted with can be found later.

## Privacy

arXivMate is local-first, but it still sends selected paper context to your configured LLM provider when you ask it to summarize or chat.

Sent to the provider:

- Paper metadata.
- Abstract.
- Extracted PDF/ar5iv text snippets when full-text mode is used.
- Recent conversation history for the current paper.
- Your current question.

Stored locally:

- API configuration.
- Conversation history.
- Notes.
- Extracted text cache.

The extension currently requests `<all_urls>` host permission so custom LLM gateways can be used. If you only use a small set of providers, you can reduce `host_permissions` in `manifest.json`.

## Project Structure

```text
.
├── background.js        # settings, LLM requests, streaming, PDF extraction, storage
├── content.js           # arXiv page assistant and split-screen UI
├── content.css          # assistant UI styles
├── options.html/js/css  # model profile settings
├── popup.html/js/css    # extension popup
├── review.html/js/css   # local review library
├── panel.html           # iframe panel used on Chrome PDF viewer pages
├── manifest.json        # Chrome MV3 manifest
└── vendor/pdfjs/        # bundled PDF.js runtime
```

## Development

There is no build step at the moment. Edit the files directly and reload the unpacked extension.

Recommended git workflow:

```bash
git checkout -b my-change
git status
git add .
git commit -m "Describe your change"
```

Basic checks:

```bash
node --check background.js
node --check content.js
node --check options.js
node --check review.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```

## Roadmap

- Add screenshots and demo GIFs.
- Add export/import for settings and history.
- Add optional provider-specific native PDF adapters where supported.
- Add keyboard shortcuts for opening and focusing the assistant.
- Add better token estimation for non-English text and multimodal content.
- Add a test harness for PDF extraction and prompt budgeting.

## Name

`arXivMate` means a small research-reading companion for arXiv. The goal is not just to summarize papers, but to help build a daily reading habit with context, history, and review.

## License

MIT. See [LICENSE](./LICENSE).
