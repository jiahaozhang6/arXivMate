# arXivMate

> 在 arXiv 页面里直接和论文对话，把每日读论文变成可追踪、可复盘的工作流。

arXivMate 是一个本地优先的 Chrome MV3 扩展。打开 arXiv 论文摘要页或 PDF 页时，它会在右侧打开一个分屏阅读助手，帮助你快速总结论文、深读方法与实验、生成学习卡片，并把每篇论文的对话历史保存在本地。

它不是简单的“摘要按钮”。arXivMate 更像一个轻量研究阅读搭子：它理解当前论文、保留每篇论文的历史对话、支持 DeepSeek/MiniMax/OpenAI-compatible 接口，并参考 [`llm-for-zotero`](https://github.com/yilewang/llm-for-zotero) 的模型配置、PDF 能力分层、上下文窗口和 paper chat 设计。

## 当前状态

- 当前版本：`0.1.0`
- 安装方式：Chrome 未打包扩展
- Chrome Web Store：暂未发布
- 主要语言：中文界面，支持跟随系统、中文、英文输出
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
- **本地复盘库**：搜索读过的论文、查看历史对话、复制或导出 Markdown。
- **PDF 文本抽取**：后台下载当前 arXiv PDF，用 PDF.js 抽取正文文本作为上下文。
- **ar5iv fallback**：PDF 文本不可用时可回退到 ar5iv HTML 正文。
- **多模型 Profile**：内置 OpenAI、DeepSeek、MiniMax、Ollama 和自定义 OpenAI-compatible 配置。
- **背景主题设置**：助手面板、设置页和复盘库支持跟随系统、浅色、深色和护眼背景。
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
- 输出语言：跟随系统、中文或 English
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

- `chrome.storage.sync.settings`：模型 Profiles、当前启用模型、输出语言、背景主题。
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
