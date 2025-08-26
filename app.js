document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("urlInput");
  const extractBtn = document.getElementById("extractBtn");
  const forceExtract = document.getElementById("forceExtract");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const copyBtn = document.getElementById("copyBtn");
  const extractedText = document.getElementById("extractedText");
  const wordCountText = document.getElementById("wordCountText");
  const statusIndicator = document.getElementById("statusIndicator");
  const historyList = document.getElementById("urlHistoryList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const themeToggle = document.getElementById("themeToggle");

  let currentUrl = "";
  let chapterPattern = "";
  let chapterIndex = 0;
  let history = JSON.parse(localStorage.getItem("urlHistory") || "[]");

  urlInput.addEventListener("input", () => {
    extractBtn.disabled = !urlInput.value.trim();
  });

  extractBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    const force = forceExtract.checked;
    if (!url) return;

    currentUrl = url;
    chapterPattern = detectPattern(url);
    chapterIndex = extractChapterIndex(url);
    updateStatus("Extracting...", "");

    fetch("/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, force })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "no_pattern") {
          updateStatus("No pattern detected. Try Force Extract.", "error");
          extractedText.textContent = "No content yet.";
          wordCountText.textContent = "0 words";
          return;
        }

        extractedText.textContent = data.content || "No content found.";
        wordCountText.textContent = `${(data.content || "").split(/\s+/).filter(Boolean).length} words`;
        updateStatus("Extraction successful", "success");
        addToHistory(url);
        updateNavButtons();
      })
      .catch(err => {
        console.error(err);
        updateStatus("Extraction failed", "error");
        extractedText.textContent = "";
        wordCountText.textContent = "0 words";
      });
  });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(extractedText.textContent);
    updateStatus("Copied to clipboard", "success");
  });

  prevBtn.addEventListener("click", () => navigateChapter(-1));
  nextBtn.addEventListener("click", () => navigateChapter(1));

  function navigateChapter(offset) {
    if (!chapterPattern) return;
    chapterIndex += offset;
    const newUrl = currentUrl.replace(chapterPattern, chapterPattern.replace(/\d+/, chapterIndex));
    urlInput.value = newUrl;
    extractBtn.click();
  }

  function detectPattern(url) {
    const match = url.match(/(p|ch|chapter)(\\d+)\\.html/i);
    return match ? match[0] : "";
  }

  function extractChapterIndex(url) {
    const match = url.match(/(\\d+)\\.html$/);
    return match ? parseInt(match[1]) : 1;
  }

  function updateNavButtons() {
    const hasPattern = !!chapterPattern;
    prevBtn.disabled = !hasPattern || chapterIndex <= 1;
    nextBtn.disabled = !hasPattern;
  }

  function updateStatus(message, type) {
    statusIndicator.textContent = message;
    statusIndicator.className = type ? `status ${type}` : "";
  }

  function addToHistory(url) {
    if (!history.includes(url)) {
      history.unshift(url);
      if (history.length > 10) history.pop();
      localStorage.setItem("urlHistory", JSON.stringify(history));
      renderHistory();
    }
  }

  function renderHistory() {
    historyList.innerHTML = "";
    history.forEach(url => {
      const li = document.createElement("li");
      li.textContent = url;
      li.addEventListener("click", () => {
        urlInput.value = url;
        extractBtn.disabled = false;
      });
      historyList.appendChild(li);
    });
  }

  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem("urlHistory");
    history = [];
    renderHistory();
  });

  themeToggle.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    themeToggle.textContent = next === "dark" ? "🌙" : "🌞";
  });

  renderHistory();
});