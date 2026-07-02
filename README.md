<p align="center">
  <img src="./icons/icon-128.png" width="88" height="88" alt="arXivMate icon">
</p>

# arXivMate

arXivMate is a local-first browser extension for reading papers with your own LLMs.

中文说明在前，English below.

## 支持范围

### 浏览器

arXivMate 是 Manifest V3 扩展，可在 Chromium 系浏览器中以“加载已解压的扩展程序”方式使用。

| 浏览器 | 状态 | 入口 |
| --- | --- | --- |
| Google Chrome | 支持 | `chrome://extensions` |
| Microsoft Edge | 支持 | `edge://extensions` |
| Brave / Arc / 其他 Chromium 浏览器 | 通常可用 | 对应浏览器的扩展管理页 |
| Firefox | 暂不支持 | 需要单独适配 |

### 论文网站和 PDF

| 类型 | 支持页面 |
| --- | --- |
| arXiv | 摘要页、PDF 页 |
| ACM Digital Library | `/doi/`、`/doi/abs/`、`/doi/pdf/`、`/doi/epdf/`、`/doi/fullHtml/` |
| IEEE Xplore | 论文页、`stamp.jsp?arnumber=...` |
| 常见 PDF 链接 | 普通网页 PDF、动态 PDF、非 `.pdf` 结尾的下载页 |
| 常见出版社 PDF | Springer、Wiley、ScienceDirect、ResearchGate、机构仓储等可识别 PDF 入口 |
| 本地 PDF | 需要在扩展详情页打开“允许访问文件网址” |

WebChat 目前支持：

- ChatGPT 网页版：`chatgpt.com`
- DeepSeek 网页版：`chat.deepseek.com`

## 它能做什么

- 速览、深读、学习卡。
- 围绕当前论文连续追问。
- 手动保存到本地论文复盘库。
- 支持 Markdown、表格、代码块、公式渲染。
- 支持 OpenAI-compatible API、DeepSeek、MiniMax、Ollama、自定义网关。
- 支持 ChatGPT 网页版、DeepSeek 网页版，不需要 API Key，但需要先登录网页。
- 尽量读取 PDF 全文；ACM / IEEE 等站点阻止原始 PDF 下载时，会回退到页面正文并生成上下文 PDF 给网页模型。
- 可连接本地 Zotero，读取分类，手动或由模型推荐分类，并保存论文条目和 PDF 附件。
- 本地复盘库按日期整理，支持搜索、收藏、归档、复制、导出 Markdown。
- 支持中文、英文、跟随系统；支持浅色、深色、跟随系统。

## 安装

推荐从 Releases 下载稳定版。

1. 打开 [Releases](https://github.com/jiahaozhang6/arXivMate/releases)。
2. 下载最新版本的 `arXivMate-vX.X.X.zip`。
3. 解压 ZIP。
4. 打开扩展管理页：
   - Chrome：`chrome://extensions`
   - Edge：`edge://extensions`
5. 打开“开发者模式”。
6. 点击“加载已解压的扩展程序”。
7. 选择解压后的 `arXivMate` 文件夹。

最新稳定版入口：[releases/latest](https://github.com/jiahaozhang6/arXivMate/releases/latest)

## 第一次使用

1. 点击浏览器工具栏里的 arXivMate 图标。
2. 打开设置页。
3. 新建模型配置。
4. 填写 Base URL、API Key、模型名。
5. 点击测试。
6. 打开论文页面，点击右下角 `AI`。

新安装不会内置任何模型。只有你保存的模型会出现在论文聊天框里。

## 模型配置

| Provider | Base URL 示例 | 说明 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | 标准 Chat Completions |
| DeepSeek | `https://api.deepseek.com` | OpenAI-compatible |
| MiniMax | `https://api.minimaxi.com/v1` | OpenAI-compatible |
| Ollama | `http://localhost:11434/v1` | 本地模型，通常不需要 API Key |
| Custom | 自定义 | 任意兼容 Chat Completions 的网关 |
| ChatGPT Web | `webchat://chatgpt` | 使用网页版 ChatGPT |
| DeepSeek Web | `webchat://deepseek` | 使用网页版 DeepSeek |

设置页可以新增、编辑、复制、删除、测试模型，也可以从 `/models` 接口加载模型列表。不同服务对 `/models` 支持不一致，加载失败时手动填写模型名即可。

## 网页版 ChatGPT / DeepSeek

WebChat 适合不想配置 API Key 的用户。

1. 先在浏览器里登录 ChatGPT 或 DeepSeek。
2. 在 arXivMate 设置页新增 WebChat 模型。
3. 回到论文页面，在模型下拉框中选择该 WebChat 配置。
4. 第一次分析论文时，arXivMate 会准备 PDF 或上下文 PDF，并发送到对应网页。

注意：

- WebChat 依赖目标网页结构。ChatGPT 或 DeepSeek 改版后，可能需要更新适配。
- Edge 也可以使用 WebChat，但同样需要先登录目标网页。
- 如果网页弹出验证码、权限页或登录过期，需要你先在网页里处理。

## Zotero

先打开 Zotero Desktop，再在论文面板点击 `Zotero`。

arXivMate 会读取本地 Zotero 分类。你可以手动选择分类，也可以点 `AI 推荐` 让当前 API 模型根据论文和分类树给出建议。保存时会写入 Zotero 条目，并尽量保存 PDF 附件。ACM、IEEE 等登录受限 PDF 可能需要允许 cookies 权限。

## 升级

不要卸载扩展再安装。卸载会删除浏览器保存的本地数据。

### Git 安装

```bash
cd arXivMate
git pull
```

然后在扩展管理页刷新 arXivMate 卡片，并刷新已经打开的论文页面。

### ZIP 安装

1. 下载最新稳定版 ZIP。
2. 解压。
3. 用新文件覆盖当前正在加载的 arXivMate 文件夹。
4. 在扩展管理页刷新原来的 arXivMate 卡片。
5. 刷新论文页面。

项目内置固定 extension key，正常覆盖升级时会尽量保持同一个扩展 ID，从而保留模型配置和历史数据。

## 数据和隐私

arXivMate 不提供云服务。

本地保存的数据包括：

- 模型配置和 API Key。
- 手动保存的论文笔记和对话快照。
- 复盘库收藏、归档状态。
- PDF / 页面正文缓存。

点击速览、深读或发送问题时，所选模型服务会收到必要的论文内容和问题。使用 ChatGPT / DeepSeek 网页版时，内容会发送到对应网页会话。

设置页支持完整备份导出和导入。备份包含 API Key，请自己保管。

## 开发

没有构建步骤，修改源码后重新加载扩展即可。

常用检查：

```bash
node tests/deepseek-webchat-deepthink-contract.test.js
node tests/webchat-thinking-contract.test.js
node tests/webchat-pdf-fallback-contract.test.js
node tests/model-config-ux-contract.test.js
node tests/history-jump-contract.test.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```

主要文件：

| 文件 | 说明 |
| --- | --- |
| `background.js` | 模型请求、存储、WebChat 调度 |
| `content.js` | 页面识别、阅读面板、PDF/正文处理 |
| `webchat.js` | ChatGPT / DeepSeek 网页桥接 |
| `webchat-injected.js` | 网页主世界网络和输入桥接 |
| `options.*` | 设置页 |
| `review.*` | 本地论文复盘库 |
| `vendor/` | PDF.js、KaTeX、Markdown 依赖 |

## GitHub Topics

`arxiv`, `acm-digital-library`, `ieee-xplore`, `paper-reading`, `pdf-reader`, `chrome-extension`, `edge-extension`, `chromium-extension`, `llm`, `deepseek`, `minimax`, `chatgpt`, `openai-compatible`, `local-first`

## License

MIT. See [LICENSE](./LICENSE).

---

## English

arXivMate is a local-first Chromium extension for reading research papers with your own LLM setup.

## Supported Browsers

| Browser | Status |
| --- | --- |
| Google Chrome | Supported |
| Microsoft Edge | Supported |
| Brave / Arc / other Chromium browsers | Usually works |
| Firefox | Not supported yet |

## Supported Sites

- arXiv abstract and PDF pages.
- ACM Digital Library DOI, abstract, PDF, EPDF, and Full HTML pages.
- IEEE Xplore article pages and `stamp.jsp?arnumber=...`.
- Regular web PDFs and dynamic PDF links that do not end with `.pdf`.
- Common publisher PDF entry points, including Springer, Wiley, ScienceDirect, ResearchGate, and repository downloads when they expose readable PDF responses.
- Local PDFs when file URL access is enabled for the extension.

WebChat supports ChatGPT Web and DeepSeek Web.

## Features

- Quick summary, deep reading, and study-card modes.
- Follow-up chat for the current paper.
- Manual save to a local review library.
- Markdown, tables, code blocks, and math rendering.
- OpenAI-compatible APIs, DeepSeek, MiniMax, Ollama, custom gateways.
- ChatGPT Web and DeepSeek Web without API keys.
- Full-text PDF extraction when possible, with page-text and generated context-PDF fallback for ACM / IEEE style restrictions.
- Local Zotero integration: load collections, choose or suggest a collection, and save the paper item plus PDF attachment.
- Local review library with date grouping, search, favorites, archive, copy, and Markdown export.

## Install

1. Open [Releases](https://github.com/jiahaozhang6/arXivMate/releases).
2. Download the latest `arXivMate-vX.X.X.zip`.
3. Unzip it.
4. Open `chrome://extensions` or `edge://extensions`.
5. Enable Developer mode.
6. Click Load unpacked.
7. Select the unzipped `arXivMate` folder.

Latest stable release: [releases/latest](https://github.com/jiahaozhang6/arXivMate/releases/latest)

## First Use

1. Open arXivMate settings.
2. Add a model profile.
3. Fill Base URL, API key, and model name.
4. Test the profile.
5. Open a paper page and click `AI`.

New installs do not include default models. Saved profiles appear in the paper chat model selector.

## WebChat

For ChatGPT Web or DeepSeek Web:

1. Log in to the target website first.
2. Add a WebChat profile in arXivMate settings.
3. Select it from the paper chat model dropdown.

On the first turn, arXivMate tries to upload the paper PDF. If the publisher blocks direct PDF download, arXivMate uses readable page text and uploads a generated context PDF instead.

## Zotero

Open Zotero Desktop, then click `Zotero` in the paper panel.

arXivMate loads your local Zotero collections. You can choose a collection manually or ask an API model to suggest one. Saving creates a Zotero item and tries to attach the paper PDF. Login-gated publisher PDFs may require cookies permission.

## Update

Do not uninstall before upgrading. Uninstalling removes local extension data.

For git installs:

```bash
git pull
```

For ZIP installs, download the latest release, replace the files in the existing loaded folder, reload the same extension card, and refresh open paper pages.

## Privacy

arXivMate does not run a cloud service. Your selected model provider receives the paper content needed for the request. WebChat profiles send content to the corresponding ChatGPT or DeepSeek web conversation.

## License

MIT. See [LICENSE](./LICENSE).
