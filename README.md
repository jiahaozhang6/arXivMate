<p align="center">
  <img src="./icons/icon-128.png" width="96" height="96" alt="arXivMate icon">
</p>

# arXivMate

<p align="center">
  <strong>和 arXiv 论文直接对话的本地优先 Chrome 阅读助手。</strong><br>
  <strong>A local-first Chrome reading assistant for chatting with arXiv papers.</strong>
</p>

<p align="center">
  <a href="#中文">中文</a> | <a href="#english">English</a>
</p>

## 中文

> 打开 arXiv、IEEE Xplore 或普通 PDF，就能总结、追问、深读论文，并把每篇文档的阅读历史留在本地。

arXivMate 是一个本地优先的 Chrome MV3 扩展。打开 arXiv 摘要页、arXiv PDF、IEEE Xplore PDF 或普通网页 PDF 时，它会在右侧打开分屏阅读助手，帮助你快速判断论文价值、深读方法与实验、生成学习卡片，并把每篇论文/文档的对话历史保存到本地。

它不是一次性的“摘要按钮”。arXivMate 更像一个轻量研究阅读搭子：它理解当前论文、保留每篇论文的历史对话、支持 DeepSeek/MiniMax/OpenAI-compatible 接口，并参考 [`llm-for-zotero`](https://github.com/yilewang/llm-for-zotero) 的模型配置、PDF 能力分层、上下文窗口和 paper chat 设计。

## 当前状态

- 当前版本：`0.1.14`
- 安装方式：Chrome 未打包扩展
- Chrome Web Store：暂未发布
- 主要语言：支持跟随系统、中文、英文；会同时影响扩展界面和 LLM 输出语言
- 背景主题：支持跟随系统、浅色、深色、护眼
- 适合用户：每天看 arXiv、需要快速判断论文价值、希望保留阅读对话历史的研究者和工程师

## 功能亮点

- **右侧分屏阅读**：打开助手时页面自动让出右侧空间，关闭后恢复原页面。
- **arXiv abs/PDF + 通用论文 PDF 支持**：arXiv 摘要页、arXiv PDF 页、IEEE Xplore PDF、常见出版社动态 PDF 入口以及网页上的普通 PDF 都能使用；PDF 页通过 iframe 面板避免 Chrome PDF viewer 抢键盘焦点。
- **IEEE Xplore 正文读取**：对 `stamp.jsp?arnumber=...` 这类动态 IEEE PDF 页面，优先读取 IEEE REST 正文接口，避免把非原始 PDF 地址交给 PDF.js。
- **三种阅读模式**：
  - `速览`：优先读取全文，快速判断问题、方法、结果和局限。
  - `深读`：基于全文分析方法、实验、局限和后续研究点。
  - `学习卡`：基于全文生成阅读路线、主动回忆题和 Anki 风格卡片。
- **聊天中选择模型**：论文助手面板内可为当前论文对话直接选择已保存的模型 Profile，不需要回设置页。
- **针对单篇论文/文档连续对话**：arXiv 按 arXiv ID 保存历史，普通 PDF 按稳定本地文档 ID 保存历史。
- **本地复盘库**：按日期分组阅读历史，搜索/筛选论文，渲染 Markdown，收藏、归档、复制或导出 Markdown。
- **PDF/动态全文抽取**：优先读取站点正文接口或浏览器页面文本层；普通 PDF 再用 PDF.js 从当前 URL/range 抽取正文文本作为上下文。
- **ar5iv fallback**：PDF 文本不可用时可回退到 ar5iv HTML 正文。
- **多模型 Profile 管理**：初始化不预置模型；用户可按供应商新增 OpenAI、DeepSeek、MiniMax、Ollama 或自定义 OpenAI-compatible 配置，设置页支持编辑、复制、删除、测试连接和显示/隐藏 API Key。
- **可中断生成**：模型回复过程中，发送按钮会变成 `停止`；停止后已生成内容会保留并写入本地对话历史。
- **中英文界面**：语言设置会同步影响助手面板、设置页、复盘库、popup 和 LLM prompt。
- **背景主题设置**：助手面板、设置页和复盘库支持跟随系统、浅色、深色和护眼背景。
- **多页面 GitHub Release 更新提示**：popup、设置页、复盘库和论文助手都会检查最新稳定 Release，提供 `git pull` 和稳定版 ZIP 两种更新方式。
- **流式输出**：优先使用 Chat Completions stream；不支持 stream 的接口会退回普通响应。
- **上下文窗口预算**：估算并显示本次请求的上下文用量，如 `上下文 12k / 128k`。
- **本地优先**：笔记、历史和正文缓存都保存在 Chrome 本地 storage。

## 推荐标签

如果你在 GitHub 上收藏、fork 或二次发布，可以使用这些 topics：

`arxiv`, `ieee-xplore`, `paper-reading`, `llm`, `chrome-extension`, `deepseek`, `minimax`, `openai-compatible`, `pdf-reader`, `research-tool`, `local-first`

一句话描述：

> arXivMate 是一个本地优先的 Chrome 扩展，让你在 arXiv 页面里用 DeepSeek、MiniMax 或 OpenAI-compatible 模型总结、追问、深读 PDF，并保存每篇论文的本地复盘历史。
>
> 虽然名字来自 arXiv，但它也支持 IEEE Xplore 和普通 PDF 阅读场景。

## 下载与安装

目前 arXivMate 通过 Chrome 的“加载已解压扩展程序”安装。

### 方法一：下载稳定 Release 版本

推荐普通用户使用这个方法。稳定版 ZIP 来自 GitHub Release，不会随着 `main` 分支变化而变化。

1. 打开 [Releases](https://github.com/jiahaozhang6/arXivMate/releases)
2. 选择最新稳定 Release，例如 `v0.1.14`
3. 下载该 Release 的 `Source code (zip)`
4. 解压 ZIP，得到 `arXivMate-0.1.14` 文件夹
5. 打开 Chrome：`chrome://extensions`
6. 打开右上角 `开发者模式`
7. 点击 `加载已解压的扩展程序`
8. 选择解压后的 `arXivMate-0.1.14` 文件夹

也可以直接打开最新稳定 Release：

```text
https://github.com/jiahaozhang6/arXivMate/releases/latest
```

### 方法二：使用 git clone

适合希望跟踪最新源码、参与开发或提交 PR 的用户。`main` 分支可能包含刚合入的新变化；如果你只想稳定使用，优先下载 Release ZIP。

```bash
git clone https://github.com/jiahaozhang6/arXivMate.git
```

然后：

1. 打开 Chrome：`chrome://extensions`
2. 打开右上角 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择刚刚克隆下来的 `arXivMate` 文件夹

### 第一次使用

1. 点击 Chrome 工具栏中的 arXivMate 图标
2. 打开 `设置`
3. 在模型配置区新增一个模型 Profile
4. 在右侧编辑 API Base URL、API Key、模型名称和上下文参数，保存后点击该模型卡片里的 `测试此模型`
5. 打开任意 arXiv 论文页面，例如 `https://arxiv.org/abs/1706.03762`
6. 点击页面右下角 `AI` 开始使用

也可以直接打开网页上的普通 PDF 使用；如果要读取本地 `file://` PDF，请在 `chrome://extensions` 的 arXivMate 详情页打开“允许访问文件网址”。

## 保持更新

源码安装的 Chrome 扩展不会像 Chrome Web Store 扩展一样自动更新。arXivMate 的更新提示基于 GitHub Release 版本号；发现新稳定版后，popup 和设置页会提示两种更新方式。

### 方式一：git pull

适合使用 `git clone` 安装、希望跟踪最新源码或参与开发的用户：

```bash
cd arXivMate
git pull
```

然后：

1. 打开 `chrome://extensions`
2. 点击 arXivMate 卡片上的刷新按钮
3. 刷新已经打开的 arXiv 页面

### 方式二：下载最新稳定版 ZIP

适合普通用户，也是插件更新提示里“下载最新稳定版”按钮对应的方式：

1. 打开 [Releases](https://github.com/jiahaozhang6/arXivMate/releases)，或点击插件里的下载按钮
2. 下载最新稳定 Release 的 `Source code (zip)`
3. 解压后把新版本文件覆盖到当前 Chrome 已加载的 arXivMate 文件夹，保持同一个文件夹路径和同一个扩展卡片
4. 在 `chrome://extensions` 点击原 arXivMate 卡片上的刷新按钮，不要把新文件夹作为另一个扩展重新加载
5. 刷新已经打开的 arXiv 页面

arXivMate 的更新提示基于 GitHub Release 版本号：插件会读取仓库最新的稳定 GitHub Release，并和本地 `manifest.json` 版本比较。如果发现新版本，会同时提供 git 更新说明和稳定版 ZIP 下载入口。

如果你 fork 了本仓库，可以这样同步上游：

```bash
git remote add upstream https://github.com/jiahaozhang6/arXivMate.git
git fetch upstream
git merge upstream/main
```

## Release 描述

当前推荐 Release 描述：

```text
arXivMate v0.1.14 - IEEE and dynamic PDF reading

This release improves IEEE Xplore and dynamic PDF reading. IEEE `stamp.jsp?arnumber=...` pages now prefer the IEEE REST full-text endpoint, non-`.pdf` PDF entry URLs are detected more broadly, and stopped generations keep the already streamed text in local chat history.
```

用户侧更新检查以 GitHub Release 为准。发布新版本时请先更新 `manifest.json` 版本号，再创建同版本 tag 和 GitHub Release，例如 `v0.1.14`。README 和插件内下载按钮给普通用户的链接都应指向稳定 Release，而不是 `main` 分支 ZIP。

## 模型配置

arXivMate 调用 OpenAI-compatible Chat Completions 接口。你可以创建多个 Profile，用不同模型处理不同任务。

| Provider | 默认 Base URL | 示例模型 | 说明 |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | 标准 Chat Completions。 |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` | OpenAI-compatible 格式；根地址会自动规范到 `/v1`，支持可配置 thinking/reasoning。 |
| MiniMax | `https://api.minimaxi.com/v1` | `MiniMax-M3` | OpenAI-compatible 格式；支持可配置 thinking 输出。 |
| Ollama | `http://localhost:11434/v1` | `llama3.1` | 本地模型通常不需要 API key。 |
| Custom | 自定义 | 自定义 | 任意兼容 Chat Completions 的网关。 |

每个 Profile 可以配置：

- 供应商和 API Base URL
- API Key
- 模型名称，可手动填写，也可以点击 `加载模型` 从当前供应商的 `/models` 接口读取候选模型
- 语言：跟随系统、中文或 English，同时控制界面文案和 LLM 输出
- 背景主题：跟随系统、浅色、深色或护眼
- Temperature
- 输出 token 上限
- 思考输出：隐藏思考、显示思考和答案、或请求兼容模型禁用思考
- 思考强度：默认、最小、低、中、高、最高；仅对支持 reasoning/thinking 的模型生效
- 上下文窗口 tokens
- PDF/正文上下文字符数
- 最近历史轮数
- 单条历史消息字符上限
- 是否允许 ar5iv fallback

新安装不会自动创建任何模型 Profile。保存后的 Profile 会出现在论文聊天面板的模型下拉框里，你可以按当前论文和任务手动选择；设置页里的测试按钮用于确认接口连接是否可用。

`加载模型` 参考 llm-for-zotero 的 provider 配置思路，会调用 OpenAI-compatible `/models` 接口并把返回的模型 ID 加入当前设置页的下拉候选。不同供应商对模型列表接口支持不完全一致；如果加载失败，不影响手动填写模型名称和保存配置。

思考输出也参考 llm-for-zotero 的 reasoning profile 设计做了轻量化适配：DeepSeek v4/Reasoner 会按 `thinking` 和 `reasoning_effort` 发送兼容参数；OpenAI reasoning 系列会映射到 `reasoning_effort`；不支持这些字段的自定义网关会自动忽略。默认模式是隐藏 `<think>` 内容，只显示最终答案。

如果设置页已经保存模型但论文页仍显示 `未配置模型`，通常是 Chrome 中同时加载了多个 arXivMate，或旧的 content script 还留在当前 arXiv 页面。请在 `chrome://extensions` 里只保留一个 arXivMate，并刷新当前 arXiv 页面。`0.1.11` 内置固定 extension key，可避免之后换 Release 文件夹导致扩展 ID 改变。

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

默认情况下，`速览`、`深读`、`学习卡` 和普通追问都会优先抽取 PDF/ar5iv 正文全文；如果抽取失败，面板状态栏会显示失败原因并退回可用的摘要或页面元数据。

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

- `chrome.storage.local.settings`：权威模型 Profiles、语言、背景主题。
- `chrome.storage.local.settingsMirror`：本地设置镜像，用于升级或 sync 异常后的恢复。
- `chrome.storage.local.modelProfiles`：独立模型 Profile 快照，避免设置对象异常时丢模型。
- `chrome.storage.sync.settings`：Chrome sync 接受时保存的设置备份。
- `chrome.storage.local.conversations`：按 arXiv ID 保存的论文对话。
- `chrome.storage.local.notes`：手动保存的论文笔记。
- `chrome.storage.local.reviewState`：复盘库收藏、归档等状态。
- `chrome.storage.local.paperContextCache`：PDF/ar5iv 正文节选缓存。

复盘库会合并 notes 和 conversations，所以只要和某篇论文聊过，就能在历史里找回。

升级后数据不丢的前提：

- 不要在 `chrome://extensions` 卸载 arXivMate。卸载扩展会删除该扩展的本地存储。
- 使用同一个扩展卡片升级：git 用户直接 `git pull` 后点击 Reload；ZIP 用户把新版本文件覆盖到当前已加载的 arXivMate 文件夹，再点击原扩展卡片的 Reload。
- 不要把新 ZIP 解压目录作为第二个 arXivMate 加载，否则 Chrome 会把它当成另一个扩展，旧数据仍在旧扩展 ID 下面。
- `manifest.json` 内置固定 `key`，用于让不同 Release 文件夹保持同一个扩展 ID。

设置页提供 `导出完整备份` / `导入备份`。备份包含模型配置、API Key、论文对话、复盘笔记、收藏/归档状态和正文缓存；升级前建议导出一次。备份文件含 API Key，请妥善保管。

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

通过 Chrome Web Store 安装后可以自动更新。当前源码版不能自动替换本地文件；可以通过 `git pull` 更新，也可以下载最新稳定版 ZIP 后在 `chrome://extensions` 里 reload 扩展。

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

> Open arXiv, IEEE Xplore, or ordinary PDFs, summarize, ask questions, deep-read papers, and keep every document's reading history local.

arXivMate is a local-first Chrome MV3 extension. When you open an arXiv abstract page, arXiv PDF, IEEE Xplore PDF, or ordinary web PDF, it opens a split-screen reading assistant on the right side. It helps you summarize a paper, study its method and experiments, generate study cards, and keep a local conversation history for each paper/document.

It is not just a “summarize this paper” button. arXivMate is designed as a lightweight research reading companion: it understands the current paper, keeps per-paper chat history, supports DeepSeek/MiniMax/OpenAI-compatible APIs, and borrows ideas from [`llm-for-zotero`](https://github.com/yilewang/llm-for-zotero), including model profiles, PDF capability tiers, context-window budgeting, and paper chat workflows.

## Status

- Version: `0.1.14`
- Installation: unpacked Chrome extension
- Chrome Web Store: not published yet
- Language: system default, Chinese, or English; controls both the extension UI and LLM output language
- Appearance themes: system, light, dark, and sepia
- Target users: researchers and engineers who read arXiv regularly, want to judge papers faster, and need a persistent reading history

## Highlights

- **Right-side split reading**: the page makes room for the assistant while it is open, then restores the original layout when closed.
- **arXiv abs/PDF + generic research PDF support**: works on arXiv abstract pages, arXiv PDF pages, IEEE Xplore PDFs, common publisher dynamic PDF entries, and ordinary PDF URLs; PDF pages use an iframe panel to avoid Chrome PDF viewer keyboard focus issues.
- **IEEE Xplore full-text reading**: for dynamic IEEE PDF pages such as `stamp.jsp?arnumber=...`, arXivMate prefers IEEE's REST full-text endpoint instead of sending a non-raw PDF URL to PDF.js.
- **Three reading modes**:
  - `Quick`: prefer full text to quickly review the problem, method, results, and limitations.
  - `Deep`: use full text to analyze the method, experiments, limitations, and follow-up ideas.
  - `Study`: use full text to generate a reading plan, active-recall questions, and Anki-style cards.
- **In-chat model selection**: choose any saved model profile directly in the paper assistant for the current paper chat without going back to settings.
- **Per-paper/document conversation history**: arXiv papers are keyed by arXiv ID; ordinary PDFs use a stable local document ID.
- **Review library**: group reading history by date, search/filter papers, render Markdown, favorite/archive items, copy notes, or export Markdown.
- **PDF/dynamic full-text extraction**: prefers site full-text endpoints or browser-page text layers; ordinary PDFs then use PDF.js range extraction from the current URL.
- **ar5iv fallback**: when PDF text extraction fails, arXivMate can fall back to ar5iv HTML text.
- **Multiple model profile management**: new installs start with no prefilled model profiles; users can add OpenAI, DeepSeek, MiniMax, Ollama, or custom OpenAI-compatible profiles, then edit, duplicate, delete, test connections, and show/hide API keys.
- **Interruptible generation**: while a model is replying, the Send button becomes `Stop`; stopped turns keep already streamed text and save it to local chat history.
- **Chinese/English UI**: the language setting applies to the assistant panel, settings page, review library, popup, and LLM prompt.
- **Theme setting**: the assistant panel, settings page, and review library support system, light, dark, and sepia backgrounds.
- **Multi-page GitHub Release update hint**: the popup, settings page, review library, and paper assistant check the latest stable Release and offer both `git pull` and stable ZIP update paths.
- **Streaming output**: uses Chat Completions streaming when available, with a non-streaming fallback.
- **Context-window budgeting**: estimates and displays request context usage, such as `context 12k / 128k`.
- **Local-first storage**: notes, conversations, and extracted text caches are stored in Chrome extension storage.

## Recommended Topics

If you star, fork, or republish this project, these GitHub topics fit well:

`arxiv`, `ieee-xplore`, `paper-reading`, `llm`, `chrome-extension`, `deepseek`, `minimax`, `openai-compatible`, `pdf-reader`, `research-tool`, `local-first`

One-line description:

> arXivMate is a local-first Chrome extension that lets you summarize, ask questions, deep-read PDF text, and save local review history for arXiv papers with DeepSeek, MiniMax, or OpenAI-compatible models.
>
> Despite the name, it also supports IEEE Xplore and ordinary PDF reading workflows.

## Download And Install

arXivMate is currently installed through Chrome’s “Load unpacked” flow.

### Option 1: Download A Stable Release

Recommended for most users. Stable ZIP archives come from GitHub Releases, so they do not move when the `main` branch changes.

1. Open [Releases](https://github.com/jiahaozhang6/arXivMate/releases)
2. Choose the latest stable Release, for example `v0.1.14`
3. Download `Source code (zip)` for that Release
4. Unzip it to get an `arXivMate-0.1.14` folder
5. Open Chrome: `chrome://extensions`
6. Enable `Developer mode`
7. Click `Load unpacked`
8. Select the unzipped `arXivMate-0.1.14` folder

Direct link for the latest stable Release:

```text
https://github.com/jiahaozhang6/arXivMate/releases/latest
```

### Option 2: Use git clone

Best for users who want to track the latest source, develop features, or open pull requests. The `main` branch may include newly merged changes; if you only want stable usage, prefer the stable Release ZIP above.

```bash
git clone https://github.com/jiahaozhang6/arXivMate.git
```

Then:

1. Open Chrome: `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the cloned `arXivMate` folder

### First Use

1. Click the arXivMate icon in the Chrome toolbar
2. Open `Settings`
3. Create a model profile in the model configuration area
4. Edit API Base URL, API key, model name, and context settings on the right, save, then click `Test this model` inside that model card
5. Open any arXiv paper, for example `https://arxiv.org/abs/1706.03762`
6. Click `AI` in the bottom-right corner of the page

Ordinary web PDF links also work. To use local `file://` PDFs, enable “Allow access to file URLs” on the arXivMate details page in `chrome://extensions`.

## Staying Updated

Source-installed Chrome extensions do not update automatically like Chrome Web Store extensions. arXivMate update hints are based on GitHub Release versions; when a new stable version is available, the popup and settings page show two update methods.

### Method 1: git pull

Best for users who installed with `git clone`, want to track the latest source, or plan to contribute:

```bash
cd arXivMate
git pull
```

Then:

1. Open `chrome://extensions`
2. Click reload on the arXivMate extension card
3. Refresh already-open arXiv pages

### Method 2: download the latest stable ZIP

Best for regular users. This is the method behind the extension's “Download latest stable” button:

1. Open [Releases](https://github.com/jiahaozhang6/arXivMate/releases), or click the download button in the extension
2. Download `Source code (zip)` for the latest stable Release
3. Unzip it and copy the new files over the currently loaded arXivMate folder, keeping the same folder path and extension card
4. Click reload on the existing arXivMate extension card in `chrome://extensions`; do not load the new folder as another extension
5. Refresh already-open arXiv pages

arXivMate update hints are based on GitHub Release versions. The extension reads the latest stable GitHub Release and compares it with the local `manifest.json` version. If a newer version is available, it shows both git update guidance and a stable ZIP download entry.

If you forked this repository, you can sync from upstream:

```bash
git remote add upstream https://github.com/jiahaozhang6/arXivMate.git
git fetch upstream
git merge upstream/main
```

## Release Description

Recommended Release description:

```text
arXivMate v0.1.14 - IEEE and dynamic PDF reading

This release improves IEEE Xplore and dynamic PDF reading. IEEE `stamp.jsp?arnumber=...` pages now prefer the IEEE REST full-text endpoint, non-`.pdf` PDF entry URLs are detected more broadly, and stopped generations keep the already streamed text in local chat history.
```

User-side update checks are based on GitHub Releases. When publishing a new version, update `manifest.json` first, then create a matching tag and GitHub Release such as `v0.1.14`. README links and in-extension download buttons for regular users should point to stable Releases, not the moving `main` branch ZIP.

## Model Configuration

arXivMate calls OpenAI-compatible Chat Completions APIs. You can create multiple profiles and switch models for different reading tasks.

| Provider | Default Base URL | Example model | Notes |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` | Standard Chat Completions. |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` | OpenAI-compatible format; root API bases are normalized to `/v1`, with configurable thinking/reasoning. |
| MiniMax | `https://api.minimaxi.com/v1` | `MiniMax-M3` | OpenAI-compatible format with configurable thinking output. |
| Ollama | `http://localhost:11434/v1` | `llama3.1` | Local models usually do not need an API key. |
| Custom | custom | custom | Any gateway compatible with Chat Completions. |

Each profile can configure:

- Provider and API Base URL
- API key
- Model name, typed manually or loaded from the provider `/models` endpoint with `Load models`
- Language: system, Chinese, or English; controls both UI labels and LLM output
- Appearance theme: system, light, dark, or sepia
- Temperature
- Output token limit
- Thinking output: hide thinking, show thinking and answer, or ask compatible models to disable thinking
- Reasoning level: default, minimal, low, medium, high, or highest; only affects models that support reasoning/thinking
- Context window tokens
- PDF/body context character limit
- Recent history turns
- Per-message history character limit
- Whether to allow ar5iv fallback

New installations do not create model profiles automatically. Saved profiles appear in the model selector inside the paper chat, where you can choose the model for the current paper and task; the settings-page test button verifies whether the API connection works.

`Load models` follows the provider-configuration idea from llm-for-zotero: it calls the OpenAI-compatible `/models` endpoint and adds returned model IDs to the settings-page dropdown. Provider support varies; if loading fails, manual model entry and saving still work.

Thinking output is a lightweight adaptation of llm-for-zotero's reasoning profile design. DeepSeek v4/Reasoner maps to compatible `thinking` and `reasoning_effort` payloads; OpenAI reasoning models map to `reasoning_effort`; unsupported custom gateways simply ignore these fields. The default is to hide `<think>` content and show the final answer only.

If settings show saved models but the paper page still says `No models`, Chrome is usually running multiple arXivMate copies or a stale content script on the current arXiv page. Keep only one arXivMate in `chrome://extensions` and refresh the current arXiv page. Starting from `0.1.11`, arXivMate includes a stable extension key to prevent future extension-ID changes when switching Release folders.

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

By default, `Quick`, `Deep`, `Study`, and normal follow-up questions all prefer PDF/ar5iv full-text extraction. If extraction fails, the assistant status shows the reason and falls back to the available abstract or page metadata.

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

- `chrome.storage.local.settings`: authoritative model profiles, language, and appearance theme.
- `chrome.storage.local.settingsMirror`: local settings mirror for recovery after upgrades or sync issues.
- `chrome.storage.local.modelProfiles`: separate model-profile snapshot so profiles can be recovered even if the main settings object is damaged.
- `chrome.storage.sync.settings`: backup copy of settings when Chrome sync accepts it.
- `chrome.storage.local.conversations`: per-paper conversations by arXiv ID.
- `chrome.storage.local.notes`: manually saved paper notes.
- `chrome.storage.local.reviewState`: review-library favorite/archive state.
- `chrome.storage.local.paperContextCache`: cached PDF/ar5iv text snippets.

The review library merges notes and conversations, so any paper you have chatted with can be found later.

Data stays after upgrades when:

- You do not uninstall arXivMate from `chrome://extensions`. Uninstalling an extension deletes its local extension storage.
- You upgrade the same extension card: git users run `git pull` and click Reload; ZIP users copy the new files over the currently loaded arXivMate folder and click Reload on the original extension card.
- You do not load an extracted ZIP as a second arXivMate extension. Chrome would treat that as a different extension, while old data remains under the old extension ID.
- `manifest.json` includes a fixed `key`, which keeps the extension ID stable across Release folders.

The settings page includes `Export full backup` / `Import backup`. The backup includes model profiles, API keys, paper chats, review notes, favorite/archive state, and text caches. Export once before upgrading. The backup file contains API keys, so keep it private.

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

Extensions installed from the Chrome Web Store can update automatically. The current source-code version cannot replace local files automatically; update with `git pull`, or download the latest stable ZIP, then reload the extension in `chrome://extensions`.

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
