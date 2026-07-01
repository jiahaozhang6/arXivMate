<p align="center">
  <img src="./icons/icon-128.png" width="88" height="88" alt="arXivMate icon">
</p>

# arXivMate

## 支持网站 / Supported Sites

- arXiv：摘要页、PDF 页
- ACM Digital Library：论文页、PDF、EPDF、Full HTML
- IEEE Xplore：论文页、`stamp.jsp?arnumber=...`
- 普通网页 PDF、常见出版社动态 PDF
- 本地 PDF：需在 `chrome://extensions` 允许访问文件网址

Also works with arXiv, ACM Digital Library, IEEE Xplore, regular web PDFs, dynamic publisher PDF links, and local PDFs with file URL access enabled.

中文 | [English](#english)

本地优先的 Chrome 论文阅读助手。打开上面这些论文页面或 PDF 后，可以用自己的模型总结、追问、深读，并手动保存到本地复盘库。

Local-first Chrome extension for reading papers with your own LLM setup.

## 主要功能

- 速览、深读、学习卡三种阅读方式
- 支持连续追问；未保存的对话只保留在当前页面
- 支持 OpenAI-compatible API、DeepSeek、MiniMax、Ollama、自定义网关
- 支持 ChatGPT 网页版和 DeepSeek 网页版，不需要 API Key
- 支持聊天中切换已保存的模型
- 支持 PDF 正文抽取、ar5iv 回退、ACM/IEEE 页面正文回退
- WebChat 遇到 ACM/IEEE 原始 PDF 403 时，会尝试生成一个可上传的上下文 PDF
- 本地复盘库：手动保存后按日期查看、搜索、收藏、归档、复制、导出 Markdown
- 语言和外观可设置为跟随系统、中文、英文、浅色、深色等

## 安装

目前不是 Chrome Web Store 扩展，需要用“加载已解压的扩展程序”安装。

### 下载稳定版

推荐普通用户使用这个方式。

1. 打开 [Releases](https://github.com/jiahaozhang6/arXivMate/releases)
2. 下载最新稳定版的 `Source code (zip)`
3. 解压 ZIP
4. 打开 Chrome：`chrome://extensions`
5. 打开右上角 `开发者模式`
6. 点击 `加载已解压的扩展程序`
7. 选择解压后的 arXivMate 文件夹

最新稳定版入口：[Releases latest](https://github.com/jiahaozhang6/arXivMate/releases/latest)

### 使用 git

适合开发或想跟随源码更新的用户。

```bash
git clone https://github.com/jiahaozhang6/arXivMate.git
```

然后在 `chrome://extensions` 中加载这个文件夹。

## 第一次使用

1. 点击浏览器工具栏里的 arXivMate 图标
2. 打开设置页
3. 新建一个模型配置
4. 填写 API Base URL、API Key、模型名
5. 点击测试，确认能连通
6. 打开论文页面，点右下角 `AI`

新安装不会自动创建模型。保存并测试通过的模型会出现在论文页面的模型下拉框里。

## 模型配置

常用地址：

| Provider | Base URL 示例 | 说明 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | 标准 Chat Completions |
| DeepSeek | `https://api.deepseek.com` | OpenAI-compatible |
| MiniMax | `https://api.minimaxi.com/v1` | OpenAI-compatible |
| Ollama | `http://localhost:11434/v1` | 本地模型，通常不需要 API Key |
| Custom | 自定义 | 任意兼容 Chat Completions 的网关 |

设置页可以编辑、复制、删除、测试模型，也可以从 `/models` 接口加载模型列表。不同供应商对模型列表支持不一致，加载失败时手动填写模型名即可。

## 使用网页版 ChatGPT / DeepSeek

1. 在设置页新增模型
2. Provider 选择 `ChatGPT 网页版` 或 `DeepSeek 网页版`
3. 确认你已经登录 `chatgpt.com` 或 `chat.deepseek.com`
4. 回到论文页面，在模型下拉框里选择该 WebChat 配置

第一次对某篇论文提问时，arXivMate 会尽量把 PDF 作为网页附件上传。ACM、IEEE 等站点如果阻止原始 PDF 下载，会回退到页面正文，并生成一个 `*-context.pdf` 上传给网页模型。

WebChat 依赖目标网页结构。ChatGPT 或 DeepSeek 改版后，可能需要更新适配代码。

## 更新

源码安装的扩展不会自动更新文件。

### git 安装

```bash
cd arXivMate
git pull
```

然后在 `chrome://extensions` 中点击 arXivMate 卡片的刷新按钮，并刷新已经打开的论文页面。

### ZIP 安装

1. 下载最新稳定版 ZIP
2. 解压后覆盖当前正在加载的 arXivMate 文件夹
3. 不要作为第二个扩展重新加载
4. 在 `chrome://extensions` 中刷新原来的 arXivMate 卡片
5. 刷新论文页面

不要卸载扩展再安装。卸载会删除 Chrome 为该扩展保存的本地数据。

## 数据保存

数据默认保存在 Chrome extension storage：

- 模型配置和 API Key
- 手动保存的笔记和对话快照
- 复盘库的收藏、归档状态
- PDF / 页面正文缓存

升级时尽量保持同一个扩展卡片。项目内置固定 extension key，用于减少换文件夹导致扩展 ID 改变的问题。

设置页提供完整备份导出和导入。备份里包含 API Key，请自己保管。

## 隐私

arXivMate 本身不提供云服务。

当你点击速览、深读或发送问题时，会把必要内容发给你选择的模型服务：

- 论文标题、作者、摘要等元数据
- 当前问题
- 当前页面的临时对话或你手动保存的上下文
- 抽取到的 PDF 或网页正文片段

如果使用 ChatGPT / DeepSeek 网页版，内容会发送到对应网页会话。

## 开发

没有构建步骤，修改源码后重新加载扩展即可。

常用检查：

```bash
node --check background.js
node --check content.js
node --check options.js
node --check review.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```

目录：

```text
background.js        后台逻辑、模型请求、存储
content.js           页面识别、阅读面板、PDF/正文处理
webchat.js           ChatGPT / DeepSeek 网页桥接
options.*            设置页
popup.*              扩展弹窗
review.*             本地复盘库
panel.html           PDF 页面内嵌面板
vendor/              PDF.js、KaTeX、Markdown 依赖
```

## GitHub Topics

`arxiv`, `acm-digital-library`, `ieee-xplore`, `paper-reading`, `chrome-extension`, `llm`, `deepseek`, `minimax`, `openai-compatible`, `pdf-reader`, `local-first`

## License

MIT. See [LICENSE](./LICENSE).

---

## English

arXivMate is a local-first Chrome extension for reading papers with your own LLM setup. It works on arXiv, ACM Digital Library, IEEE Xplore, and regular PDF pages.

## Supported Pages

- arXiv abstract and PDF pages
- ACM Digital Library: `/doi/`, `/doi/abs/`, `/doi/pdf/`, `/doi/epdf/`, `/doi/fullHtml/`
- IEEE Xplore article pages and `stamp.jsp?arnumber=...`
- Regular web PDFs and common dynamic publisher PDF links
- Local PDFs if file URL access is enabled in `chrome://extensions`

## Features

- Quick summary, deep reading, and study-card modes
- Follow-up chat in the current page; saved chats are written only when you click Save
- OpenAI-compatible APIs, DeepSeek, MiniMax, Ollama, and custom gateways
- ChatGPT Web and DeepSeek Web profiles without API keys
- Model switching inside the paper chat
- PDF text extraction, ar5iv fallback, ACM/IEEE page-text fallback
- Generated context PDF fallback when ACM/IEEE block direct PDF download
- Local review library for manually saved notes, with search, favorites, archive, copy, and Markdown export
- Chinese/English UI and light/dark/system appearance settings

## Install

arXivMate is installed as an unpacked Chrome extension.

### Stable Release

1. Open [Releases](https://github.com/jiahaozhang6/arXivMate/releases)
2. Download the latest stable `Source code (zip)`
3. Unzip it
4. Open `chrome://extensions`
5. Enable `Developer mode`
6. Click `Load unpacked`
7. Select the unzipped arXivMate folder

Latest stable release: [Releases latest](https://github.com/jiahaozhang6/arXivMate/releases/latest)

### From git

```bash
git clone https://github.com/jiahaozhang6/arXivMate.git
```

Then load the cloned folder from `chrome://extensions`.

## First Use

1. Open arXivMate settings
2. Create a model profile
3. Fill in API Base URL, API key, and model name
4. Test the model
5. Open a paper page
6. Click `AI`

New installs do not create default models. Saved profiles appear in the model selector on paper pages.

## Model Profiles

| Provider | Example Base URL | Notes |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | Standard Chat Completions |
| DeepSeek | `https://api.deepseek.com` | OpenAI-compatible |
| MiniMax | `https://api.minimaxi.com/v1` | OpenAI-compatible |
| Ollama | `http://localhost:11434/v1` | Local model, usually no API key |
| Custom | custom | Any Chat Completions compatible gateway |

You can edit, duplicate, delete, and test profiles in settings. Model loading uses the provider `/models` endpoint when available; manual model names always work.

## ChatGPT / DeepSeek Web

1. Add a profile
2. Choose `ChatGPT Web` or `DeepSeek Web`
3. Make sure you are logged in on the target site
4. Select that profile from the paper chat model dropdown

For the first turn of a paper, arXivMate tries to upload the PDF as a web attachment. If ACM or IEEE blocks the original PDF download, it falls back to readable page text and uploads a generated `*-context.pdf`.

WebChat depends on the target site's DOM. If ChatGPT or DeepSeek changes its UI, the adapter may need an update.

## Update

Unpacked extensions do not replace local files automatically.

For git installs:

```bash
cd arXivMate
git pull
```

Then reload the extension in `chrome://extensions` and refresh open paper pages.

For ZIP installs, download the latest stable ZIP, copy the new files over the currently loaded folder, reload the same extension card, and refresh paper pages.

Do not uninstall the extension before upgrading. Uninstalling removes local extension data.

## Local Data

arXivMate stores data in Chrome extension storage:

- model profiles and API keys
- manually saved notes and conversation snapshots
- review-library state
- extracted text cache

The settings page can export and import a full backup. The backup includes API keys, so keep it private.

## Privacy

arXivMate does not run a cloud service.

When you ask a question, the selected model provider receives the needed paper metadata, question, current-page chat context, and extracted text snippets. WebChat profiles send content to the corresponding ChatGPT or DeepSeek web conversation.

## Development

There is no build step. Edit files and reload the extension.

```bash
node --check background.js
node --check content.js
node --check options.js
node --check review.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8')); console.log('manifest ok')"
```

## GitHub Topics

`arxiv`, `acm-digital-library`, `ieee-xplore`, `paper-reading`, `chrome-extension`, `llm`, `deepseek`, `minimax`, `openai-compatible`, `pdf-reader`, `local-first`

## License

MIT. See [LICENSE](./LICENSE).
