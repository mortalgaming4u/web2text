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
  const chapterDisplay = document.getElementById("chapterDisplay");

  // ✅ Full book button + status
  const scrapeBookBtn = document.getElementById("scrapeBookBtn");
  const scrapeStatus = document.getElementById("scrapeStatus");

  let chapterPattern = null;
  let chapterIndex = null;
  let history = JSON.parse(localStorage.getItem("urlHistory") || "[]");

  // Load theme
  const savedTheme = localStorage.getItem("theme") || "light";
  document.body.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "dark" ? "🌙" : "🌓";

  // ========== Pattern detection ==========
  function detectPattern(url) {
    const patterns = [
      /(.+\/chapter-)(\d+)([^\/]*)$/i,
      /(.+\/P)(\d+)([^\/]*)$/i,
      /(.+\/)(\d+)\.html?$/i
    ];
    for (const regex of patterns) {
      const match = url.match(regex);
      if (match) return {
        prefix: match[1],
        number: parseInt(match[2]),
        suffix: match[3] || ""
      };
    }
    return null;
  }

  function buildChapterUrl(pattern, number) {
    return `${pattern.prefix}${number}${pattern.suffix}`;
  }

  function updateChapterInfo(url) {
    chapterPattern = detectPattern(url);
    chapterIndex = chapterPattern ? chapterPattern.number : null;
    chapterDisplay.textContent = chapterIndex ? `Chapter ${chapterIndex}` : "";
  }

  function updateNavButtons() {
    prevBtn.disabled = !chapterPattern || chapterIndex <= 1;
    nextBtn.disabled = !chapterPattern;
  }

  // ========== Single Chapter Extraction ==========
  function extractContent(force = false) {
    const url = urlInput.value.trim();
    if (!url) return;

    updateChapterInfo(url);
    updateNavButtons();
    updateStatus("⏳ Extracting...", "");

    fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, force })
    })
      .then(res => res.json())
      .then(data => {
        if (data.status !== "success" || !data.text) {
          updateStatus(`❌ ${data.message || "Extraction failed"}`, "error");
          extractedText.textContent = "No content found.";
          wordCountText.textContent = "0 words";
          return;
        }

        extractedText.textContent = data.text;
        const wc = data.text.split(/\s+/).filter(Boolean).length;
        wordCountText.textContent = `${wc} word${wc === 1 ? "" : "s"}`;
        updateStatus("✅ Extraction successful", "success");

        addToHistory(url);
        updateNavButtons();
      })
      .catch(err => {
        updateStatus(`❌ Request failed: ${err.message}`, "error");
        extractedText.textContent = "";
        wordCountText.textContent = "0 words";
      });
  }

  // ========== Full Book Extraction ==========
  function scrapeFullBook() {
    const url = urlInput.value.trim();
    if (!url) {
      scrapeStatus.innerText = "❌ Please enter a starting chapter URL.";
      return;
    }

    scrapeStatus.innerText = "⏳ Scraping full book... This may take a while.";

    fetch("/api/scrape-book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, maxChapters: 4000 }) // ✅ Cap set here
    })
      .then(res => res.json())
      .then(data => {
        if (data.status !== "success" || !Array.isArray(data.chapters)) {
          scrapeStatus.innerText = `❌ ${data.message || "Scrape failed"}`;
          return;
        }

        const allText = data.chapters.join("\n\n");
        extractedText.textContent = allText;
        const wc = allText.split(/\s+/).filter(Boolean).length;
        wordCountText.textContent = `${wc} word${wc === 1 ? "" : "s"}`;
        scrapeStatus.innerText = `✅ Scraped ${data.chapters.length} chapters successfully.`;
      })
      .catch(err => {
        scrapeStatus.innerText = `❌ Request failed: ${err.message}`;
      });
  }

  // ========== Chapter navigation ==========
  function navigateChapter(offset) {
    if (!chapterPattern) return;
    const newNum = chapterIndex + offset;
    if (newNum < 1) return;

    const newUrl = buildChapterUrl(chapterPattern, newNum);
    urlInput.value = newUrl;
    updateChapterInfo(newUrl);
    extractContent(forceExtract.checked);
  }

  // ========== Status ==========
  function updateStatus(text, type) {
    statusIndicator.textContent = text;
    statusIndicator.className = type ? `status ${type}` : "";
  }

  // ========== History ==========
  function addToHistory(url) {
    if (!history.includes(url)) {
      history.unshift(url);
      if (history.length > 10) history.pop();
      localStorage.setItem("urlHistory", JSON.stringify(history));
    }
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    history.forEach(url => {
      const li = document.createElement("li");
      li.textContent = url;
      li.addEventListener("click", () => {
        urlInput.value = url;
        updateChapterInfo(url);
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

  // ========== Theme ==========
  themeToggle.addEventListener("click", () => {
    const current = document.body.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle.textContent = next === "dark" ? "🌙" : "🌓";
  });

  // ========== Copy ==========
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(extractedText.textContent);
    updateStatus("✅ Copied to clipboard", "success");
  });

  // ========== Button listeners ==========
  urlInput.addEventListener("input", () => {
    extractBtn.disabled = !urlInput.value.trim();
    updateChapterInfo(urlInput.value.trim());
    updateNavButtons();
  });

  extractBtn.addEventListener("click", () => extractContent(forceExtract.checked));
  prevBtn.addEventListener("click", () => navigateChapter(-1));
  nextBtn.addEventListener("click", () => navigateChapter(1));
  scrapeBookBtn.addEventListener("click", scrapeFullBook);

  // Keyboard navigation
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "ArrowLeft") navigateChapter(-1);
    if (e.key === "ArrowRight") navigateChapter(1);
  });

  // ========== Init ==========
  renderHistory();
  updateChapterInfo(urlInput.value.trim());
  updateNavButtons();
});
