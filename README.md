# arXivMate

[中文](#中文) | [English](#english)

## 中文

> 在 arXiv 页面里直接和论文对话，把每日读论文变成可追踪、可复盘的工作流。

arXivMate 是一个本地优先的 Chrome MV3 扩展。打开 arXiv 论文摘要页或 PDF 页时，它会在右侧打开一个分屏阅读助手，帮助你快速总结论文、深读方法与实验、生成学习卡片，并把每篇论文的对话历史保存在本地。

它不是简单的“摘要按钮”。arXivMate 更像一个轻量研究阅读搭子：它理解当前论文、保留每篇论文的历史对话、支持 DeepSeek/MiniMax/OpenAI-compatible 接口，并参考 [`llm-for-zotero`](https://github.com/yilewang/llm-for-zotero) 的模型配置、PDF 能力分层、上下文窗口和 paper chat 设计。

## 当前状态

- 当前版本：`0.1.2`
- 安装方式：Chrome 未打包扩展
- Chrome Web Store：暂未发布
- 主要语言：支持跟随系统、中文、英文；会同时影响扩展界面和 LLM 输出语言
- 背景主题：支持跟随系统、浅色、深色、护眼
- 适合用户：每天看 arXiv、需要快速判断论文价值、希望保留阅读对话历史的研究者和工程师

## 功能亮点

- **右侧分屏阅读**：打开助手时页面自动让出右侧空间，关闭后恢复原页面。
- **arXiv abs/PDF 双页面支持**：摘要页和 PDF 页都能使用；PDF 页通过 iframe 面板避免 Chrome PDF viewer 抢键盘焦点。
- **三种阅读模式**：
  - `速览`：用摘要和元数据快速判断是否值得读。
  - `深读`：优先读取 PDF 正文，分析问题、方法、实验、局限和后续研究点。
  - `学习卡`：生成阅读路线、主动回忆题和 Anki 风格卡片。
- **针对单篇论文连续对话**：每篇论文按 arXiv ID 保存独立对话历史。
- **本地复盘库**：按日期分组阅读历史，搜索/筛选论文，渲染 Markdown，收藏、归档、复制或导出 Markdown。
- **PDF 文本抽取**：后台下载当前 arXiv PDF，用 PDF.js 抽取正文文本作为上下文。
- **ar5iv fallback**：PDF 文本不可用时可回退到 ar5iv HTML 正文。
- **多模型 Profile**：内置 OpenAI、DeepSeek、MiniMax、Ollama 和自定义 OpenAI-compatible 配置。
- **中英文界面**：语言设置会同步影响助手面板、设置页、复盘库、popup 和 LLM prompt。
- **背景主题设置**：助手面板、设置页和复盘库支持跟随系统、浅色、深色和护眼背景。
- **GitHub 更新提示**：设置页和 popup 会检查 GitHub `main` 是否有更新版本，并提示源码安装用户更新。
- **流式输出**：优先使用 Chat Completions stream；不支持 stream 的接口会退回普通响应。
- **上下文窗口预算**：估算并显示本次请求的上下文用量，如 `上下文 12k / 128k`。
- **本地优先**：笔记、历史和正文缓存都保存在 Chrome 本地 storage。

## 截图

截图还没有提交。建议后续补充：

- arXiv 摘要页右侧分屏助手
- arXiv PDF 页输入框聚焦状态
- 模型 Profile 设置页
- 论文复盘库

## 快速安装

目前 arXivMate 通过 Chrome 的“加载已解压扩展程序”安装。

1. 克隆仓库：

   ```bash
   git clone https://github.com/jiahaozhang6/arXivMate.git
   ```

2. 打开 Chrome：`chrome://extensions`
3. 打开右上角 `开发者模式`
4. 点击 `加载已解压的扩展程序`
5. 选择刚刚克隆下来的 `arXivMate` 目录
6. 点击扩展图标，进入设置页，配置模型 Profile

更新代码后，需要在 `chrome://extensions` 里点击 arXivMate 的刷新按钮，并刷新已经打开的 arXiv 页面。

## 保持更新

如果你是通过 git clone 安装的：

```bash
cd arXivMate
git pull
```

然后：

1. 打开 `chrome://extensions`
2. 点击 arXivMate 卡片上的刷新按钮
3. 刷新已经打开的 arXiv 页面

arXivMate 也会在设置页和 popup 中检查 GitHub `main` 的最新 `manifest.json` 版本。如果发现新版本，会提示你运行 `git pull` 并重新加载扩展。

如果你 fork 了本仓库，可以这样同步上游：

```bash
git remote add upstream https://github.com/jiahaozhang6/arXivMate.git
git fetch upstream
git merge upstream/main
```

## 模型配置

arXivMate 调用 OpenAI-compatible Chat Completions 接口。你可以创建多个 Profile，用不同模型处理不同任务。

| Provider | 默认 Base URL | 示例模型 | 说明 |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | 标准 Chat Completions。 |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` | OpenAI-compatible 格式；会尽量禁用/清理 thinking 输出。 |
| MiniMax | `https://api.minimax.io/v1` | `MiniMax-M3` | 同时识别 `api.minimaxi.com`；会清理 thinking 输出。 |
| Ollama | `http://localhost:11434/v1` | `llama3.1` | 本地模型通常不需要 API key。 |
| Custom | 自定义 | 自定义 | 任意兼容 Chat Completions 的网关。 |

每个 Profile 可以配置：

- 供应商和 API Base URL
- API Key
- 模型名称
- 语言：跟随系统、中文或 English，同时控制界面文案和 LLM 输出
- 背景主题：跟随系统、浅色、深色或护眼
- Temperature
- 输出 token 上限
- 上下文窗口 tokens
- PDF/正文上下文字符数
- 最近历史轮数
- 单条历史消息字符上限
- 是否允许 ar5iv fallback

### 推荐配置

- **日常速览**：DeepSeek flash、MiniMax-M3、gpt-4o-mini 等便宜快速模型。
- **认真深读**：长上下文模型，并适当提高 `正文字符数`。
- **本地实验**：Ollama + 本地模型，API Key 留空。

## 使用方式

1. 打开任意 arXiv 论文，例如：

   ```text
   https://arxiv.org/abs/1706.03762
   ```

2. 点击页面右下角 `AI`
3. 选择阅读模式：
   - `速览`：快速看问题、方法、结果、贡献和局限。
   - `深读`：分析方法主线、实验设计、失败场景和后续问题。
   - `学习卡`：生成学习路线、主动回忆问题和卡片。
4. 在底部输入框继续追问。
5. 重新打开同一篇论文时，会自动载入该论文历史。
6. 点击 `历史` 打开本地复盘库。

默认情况下，普通追问和速览只使用摘要、元数据和最近历史；`深读`、`学习卡` 或打开 `全文` 后才会抽取 PDF/ar5iv 正文。

复盘库会按阅读/保存日期自动分组，并显示论文数、对话轮数、研究方向数和手动保存数。你可以按研究方向、收藏、归档、有笔记、有对话筛选，也可以只导出当前筛选结果。

## PDF 处理策略

arXivMate 不会把 PDF 文件盲目上传给所有 OpenAI-compatible 接口。

这部分参考了 `llm-for-zotero` 的能力分层思路：

- 一方原生接口可能支持 native PDF 输入。
- 某些供应商有单独的文件上传接口，需要专门适配。
- OpenAI-compatible chat endpoint 不等于支持 PDF 文件输入。

因此当前版本对 DeepSeek、MiniMax、Ollama 和自定义 OpenAI-compatible 接口默认使用更稳的文本路线：

1. 识别当前 arXiv ID 和 PDF URL。
2. 在 background service worker 中下载 PDF。
3. 用内置 PDF.js 抽取页面文本。
4. 将抽取文本缓存到本地。
5. 把论文元数据、正文节选和最近对话历史发送给 LLM。
6. 如果 PDF 抽取失败，并且开启了 ar5iv，则尝试读取 ar5iv HTML 正文。

状态栏中如果看到 `PDF 文本抽取（未上传 PDF 文件）`，表示当前使用的是文本上下文，不是二进制 PDF 上传。

## 上下文窗口

一般不需要手动设置上下文窗口。

arXivMate 参考 `llm-for-zotero` 的 input cap/context window 机制：

- 根据模型名推断默认上下文窗口。
- 请求前预留输出 tokens。
- 使用约 90% soft limit，降低超上下文失败概率。
- 超出预算时优先丢弃较旧历史，再裁剪正文上下文。
- 每次回答保存并显示估算用量，例如 `上下文 12k / 128k (9%)`。

如果你使用自定义代理，或者模型实际窗口和自动识别不一致，可以在高级设置中调整 `上下文窗口 tokens`。

## 本地数据

arXivMate 使用 Chrome extension storage：

- `chrome.storage.sync.settings`：模型 Profiles、当前启用模型、语言、背景主题。
- `chrome.storage.local.conversations`：按 arXiv ID 保存的论文对话。
- `chrome.storage.local.notes`：手动保存的论文笔记。
- `chrome.storage.local.paperContextCache`：PDF/ar5iv 正文节选缓存。

复盘库会合并 notes 和 conversations，所以只要和某篇论文聊过，就能在历史里找回。

## 隐私说明

arXivMate 是本地优先，但当你点击总结、深读或发送问题时，会把必要上下文发送给你配置的 LLM API。

会发送：

- 论文标题、作者、摘要、分类、arXiv ID 等元数据
- 当前问题
- 当前论文最近若干轮对话历史
- 在全文模式下抽取到的 PDF/ar5iv 正文节选

本地保存：

- 模型配置和 API Key
- 对话历史
- 保存的笔记
- 正文缓存

当前 `manifest.json` 使用 `<all_urls>` host permission，是为了支持任意自定义 LLM 网关。如果你只想支持固定供应商，可以自行收窄 `host_permissions`。

## 开发

当前没有构建步骤，直接编辑源码并重新加载扩展即可。

常用检查：

```bash
node --check background.js
node --check content.js
node --check options.js
node --check review.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```

项目结构：

```text
.
├── background.js        # 设置、LLM 请求、stream、PDF 抽取、本地存储
├── content.js           # arXiv 页面注入、分屏助手、聊天 UI
├── content.css          # 分屏助手样式
├── options.html/js/css  # 模型 Profile 设置页
├── popup.html/js/css    # 扩展 popup
├── review.html/js/css   # 本地复盘库
├── panel.html           # PDF viewer 页面 iframe 面板
├── manifest.json        # Chrome MV3 manifest
└── vendor/pdfjs/        # 内置 PDF.js
```

建议开发流程：

```bash
git checkout -b my-change
git status
git add .
git commit -m "Describe your change"
git push
```

## 常见问题

### 为什么 reload 扩展后页面报 `Extension context invalidated`？

Chrome 重新加载扩展后，已经打开的页面里可能还残留旧的 content script。刷新当前 arXiv 页面即可。arXivMate 已经对大多数 runtime 调用做了防护，但开发期刷新页面仍然是最稳的做法。

### 为什么 Chrome 扩展页里出现 `Error: Unknown message type.`？

这是旧版本 background service worker 在收到未知 runtime message 时抛出的错误。`0.1.1` 起未知消息会被安全忽略，不会再污染扩展错误页。如果你仍然看到这个报错，请先在 `chrome://extensions` 点击 arXivMate 的刷新按钮，再刷新已经打开的 arXiv 页面，确保 Chrome 没有继续运行旧 service worker。

### 为什么不直接上传 PDF 给 DeepSeek 或 MiniMax？

OpenAI-compatible chat endpoint 不一定支持二进制 PDF 输入。当前版本使用 PDF.js 抽取文本作为上下文，更稳定，也更容易控制隐私和上下文窗口。

### 普通用户能自动更新吗？

通过 Chrome Web Store 安装后可以自动更新。当前源码版通过 `git pull` 更新，然后在 `chrome://extensions` 里 reload 扩展。

## Roadmap

- 添加截图和 demo GIF。
- 发布 Chrome Web Store 版本。
- 添加设置/历史的导入导出。
- 增加快捷键打开和聚焦助手。
- 增加 provider-specific native PDF 适配。
- 改进中文/混合文本 token 估算。
- 增加 PDF 抽取和 prompt budget 的自动测试。

## 许可证

MIT. See [LICENSE](./LICENSE).

## English

> Chat with arXiv papers directly in the browser, and turn daily paper reading into a searchable, reviewable workflow.

arXivMate is a local-first Chrome MV3 extension. When you open an arXiv abstract page or PDF page, it opens a split-screen reading assistant on the right side. It helps you summarize a paper, study its method and experiments, generate study cards, and keep a local conversation history for each paper.

It is not just a “summarize this paper” button. arXivMate is designed as a lightweight research reading companion: it understands the current paper, keeps per-paper chat history, supports DeepSeek/MiniMax/OpenAI-compatible APIs, and borrows ideas from [`llm-for-zotero`](https://github.com/yilewang/llm-for-zotero), including model profiles, PDF capability tiers, context-window budgeting, and paper chat workflows.

## Status

- Version: `0.1.2`
- Installation: unpacked Chrome extension
- Chrome Web Store: not published yet
- Language: system default, Chinese, or English; controls both the extension UI and LLM output language
- Appearance themes: system, light, dark, and sepia
- Target users: researchers and engineers who read arXiv regularly, want to judge papers faster, and need a persistent reading history

## Highlights

- **Right-side split reading**: the page makes room for the assistant while it is open, then restores the original layout when closed.
- **arXiv abs/PDF support**: works on both abstract pages and PDF pages; the PDF page uses an iframe panel to avoid Chrome PDF viewer keyboard focus issues.
- **Three reading modes**:
  - `Quick`: use metadata and abstract to quickly decide whether a paper is worth reading.
  - `Deep`: extract PDF text when possible and analyze the problem, method, experiments, limitations, and follow-up ideas.
  - `Study`: generate a reading plan, active-recall questions, and Anki-style cards.
- **Per-paper conversation history**: each paper keeps an independent local chat history by arXiv ID.
- **Review library**: group reading history by date, search/filter papers, render Markdown, favorite/archive items, copy notes, or export Markdown.
- **PDF text extraction**: the background service worker downloads the current arXiv PDF and extracts text with bundled PDF.js.
- **ar5iv fallback**: when PDF text extraction fails, arXivMate can fall back to ar5iv HTML text.
- **Multiple model profiles**: built-in profiles for OpenAI, DeepSeek, MiniMax, Ollama, and custom OpenAI-compatible endpoints.
- **Chinese/English UI**: the language setting applies to the assistant panel, settings page, review library, popup, and LLM prompt.
- **Theme setting**: the assistant panel, settings page, and review library support system, light, dark, and sepia backgrounds.
- **GitHub update hint**: the settings page and popup check whether GitHub `main` has a newer version and guide source-install users to update.
- **Streaming output**: uses Chat Completions streaming when available, with a non-streaming fallback.
- **Context-window budgeting**: estimates and displays request context usage, such as `context 12k / 128k`.
- **Local-first storage**: notes, conversations, and extracted text caches are stored in Chrome extension storage.

## Screenshots

Screenshots have not been added yet. Suggested screenshots:

- Right-side split assistant on an arXiv abstract page
- Input focus state on an arXiv PDF page
- Model profile settings page
- Local review library

## Quick Install

arXivMate is currently installed through Chrome’s “Load unpacked” flow.

1. Clone the repository:

   ```bash
   git clone https://github.com/jiahaozhang6/arXivMate.git
   ```

2. Open Chrome: `chrome://extensions`
3. Enable `Developer mode`
4. Click `Load unpacked`
5. Select the cloned `arXivMate` directory
6. Click the extension icon, open the settings page, and configure a model profile

After updating the code, click the reload button on the arXivMate extension card in `chrome://extensions`, then refresh any already-open arXiv pages.

## Staying Updated

If you installed by cloning the repository:

```bash
cd arXivMate
git pull
```

Then:

1. Open `chrome://extensions`
2. Click reload on the arXivMate extension card
3. Refresh already-open arXiv pages

arXivMate also checks the latest `manifest.json` version on GitHub `main` from the settings page and popup. If a newer version is available, it prompts you to run `git pull` and reload the extension.

If you forked this repository, you can sync from upstream:

```bash
git remote add upstream https://github.com/jiahaozhang6/arXivMate.git
git fetch upstream
git merge upstream/main
```

## Model Configuration

arXivMate calls OpenAI-compatible Chat Completions APIs. You can create multiple profiles and switch models for different reading tasks.

| Provider | Default Base URL | Example model | Notes |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | Standard Chat Completions. |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` | OpenAI-compatible format; arXivMate tries to disable or clean thinking output. |
| MiniMax | `https://api.minimax.io/v1` | `MiniMax-M3` | Also recognizes `api.minimaxi.com`; thinking output is cleaned when needed. |
| Ollama | `http://localhost:11434/v1` | `llama3.1` | Local models usually do not need an API key. |
| Custom | custom | custom | Any gateway compatible with Chat Completions. |

Each profile can configure:

- Provider and API Base URL
- API key
- Model name
- Language: system, Chinese, or English; controls both UI labels and LLM output
- Appearance theme: system, light, dark, or sepia
- Temperature
- Output token limit
- Context window tokens
- PDF/body context character limit
- Recent history turns
- Per-message history character limit
- Whether to allow ar5iv fallback

### Recommended Setups

- **Daily triage**: use affordable and fast models such as DeepSeek flash, MiniMax-M3, or gpt-4o-mini.
- **Careful deep reading**: use a long-context or higher-quality model and increase `body context characters` when needed.
- **Local experiments**: use an Ollama profile with a local model and leave the API key empty.

## Usage

1. Open any arXiv paper, for example:

   ```text
   https://arxiv.org/abs/1706.03762
   ```

2. Click `AI` in the bottom-right corner.
3. Choose a reading mode:
   - `Quick`: quickly review the problem, method, results, contribution, and limitations.
   - `Deep`: analyze the method flow, experimental design, failure cases, and follow-up questions.
   - `Study`: generate a learning route, active-recall prompts, and cards.
4. Continue asking questions in the input box.
5. When you reopen the same paper, arXivMate automatically restores that paper’s local conversation history.
6. Click `History` to open the local review library.

By default, normal questions and quick summaries only use metadata, abstract, and recent history. `Deep`, `Study`, or enabling `Full text` triggers PDF/ar5iv text extraction.

The review library automatically groups papers by reading/saved date and shows paper count, chat turns, subject count, and manually saved notes. You can filter by subject, favorites, archived items, notes, or chats, and export only the currently filtered results.

## PDF Handling

arXivMate does not blindly upload PDF files to every OpenAI-compatible endpoint.

This follows the capability-tier idea from `llm-for-zotero`:

- Some first-party APIs may support native PDF input.
- Some providers have separate file upload APIs that need provider-specific integration.
- An OpenAI-compatible chat endpoint does not automatically mean binary PDF input is supported.

For DeepSeek, MiniMax, Ollama, and custom OpenAI-compatible endpoints, the current version uses a more stable text-based path:

1. Detect the current arXiv ID and PDF URL.
2. Download the PDF in the background service worker.
3. Extract page text with bundled PDF.js.
4. Cache the extracted text locally.
5. Send paper metadata, selected body text, and recent conversation history to the LLM.
6. If PDF extraction fails and ar5iv is enabled, try ar5iv HTML text.

If the status line shows `PDF text extraction (PDF file not uploaded)`, the request is using extracted text context instead of uploading the binary PDF.

## Context Window

Usually you do not need to set the context window manually.

arXivMate follows an input cap/context-window style similar to `llm-for-zotero`:

- Infer the default context window from the model name.
- Reserve output tokens before sending the request.
- Use an approximately 90% soft limit to reduce over-context failures.
- When over budget, drop older history first, then trim body context.
- Save and display estimated usage for each response, such as `context 12k / 128k (9%)`.

If you use a custom proxy, or the inferred model window is wrong, adjust `context window tokens` in the advanced profile settings.

## Local Data

arXivMate uses Chrome extension storage:

- `chrome.storage.sync.settings`: model profiles, active model, language, and appearance theme.
- `chrome.storage.local.conversations`: per-paper conversations by arXiv ID.
- `chrome.storage.local.notes`: manually saved paper notes.
- `chrome.storage.local.paperContextCache`: cached PDF/ar5iv text snippets.

The review library merges notes and conversations, so any paper you have chatted with can be found later.

## Privacy

arXivMate is local-first, but when you click summarize, deep read, or send a question, it sends the necessary context to your configured LLM API.

Sent to the LLM:

- Paper metadata such as title, authors, abstract, category, and arXiv ID
- Your current question
- Recent conversation history for the current paper
- Extracted PDF/ar5iv text snippets in full-text mode

Saved locally:

- Model configuration and API keys
- Conversation history
- Saved notes
- Text context cache

The current `manifest.json` uses `<all_urls>` host permission so custom LLM gateways can work. If you only want fixed providers, you can narrow `host_permissions`.

## Development

There is no build step. Edit the source files and reload the extension.

Useful checks:

```bash
node --check background.js
node --check content.js
node --check options.js
node --check review.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```

Project structure:

```text
.
├── background.js        # Settings, LLM requests, streaming, PDF extraction, local storage
├── content.js           # arXiv injection, split assistant, chat UI
├── content.css          # Split assistant styles
├── options.html/js/css  # Model profile settings page
├── popup.html/js/css    # Extension popup
├── review.html/js/css   # Local review library
├── panel.html           # iframe panel for Chrome PDF viewer pages
├── manifest.json        # Chrome MV3 manifest
└── vendor/pdfjs/        # Bundled PDF.js
```

Suggested development flow:

```bash
git checkout -b my-change
git status
git add .
git commit -m "Describe your change"
git push
```

## FAQ

### Why do I see `Extension context invalidated` after reloading the extension?

After Chrome reloads an extension, already-open pages may still contain the old content script. Refresh the current arXiv page. arXivMate guards most runtime calls, but refreshing the page is still the most reliable workflow during development.

### Why do I see `Error: Unknown message type.` in Chrome's extension errors?

Older background service workers threw when they received an unknown runtime message. Since `0.1.1`, unknown messages are safely ignored and no longer pollute the extension error page. If the error still appears, click reload on the arXivMate card in `chrome://extensions`, then refresh any already-open arXiv pages so Chrome stops running the old service worker.

### Why not upload PDFs directly to DeepSeek or MiniMax?

An OpenAI-compatible chat endpoint does not necessarily support binary PDF input. The current version extracts PDF text with PDF.js and sends text context instead, which is more stable and easier to control for privacy and context budget.

### Can regular users get automatic updates?

Extensions installed from the Chrome Web Store can update automatically. The current source-code version is updated through `git pull`, followed by reloading the extension in `chrome://extensions`.

## Roadmap

- Add screenshots and demo GIFs.
- Publish a Chrome Web Store version.
- Add import/export for settings and history.
- Add keyboard shortcuts for opening and focusing the assistant.
- Add provider-specific native PDF integrations.
- Improve token estimation for Chinese and mixed-language text.
- Add automated tests for PDF extraction and prompt budgeting.

## License

MIT. See [LICENSE](./LICENSE).
