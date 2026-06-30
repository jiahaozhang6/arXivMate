document.querySelector("#options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.querySelector("#review").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("review.html") });
});

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const status = document.querySelector("#status");
  if (/https:\/\/(www\.)?arxiv\.org\/(abs|pdf)\//i.test(tab?.url || "")) {
    status.textContent = "当前是 arXiv 论文页，请使用页面右下角 AI 按钮。";
  }
});
