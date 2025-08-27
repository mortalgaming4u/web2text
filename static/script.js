class WebTextExtractApp {
    constructor() {
        this.scrapedContent = [];
        this.urlHistory = this.loadFromStorage('urlHistory') || [];
        this.lockPatterns = this.loadFromStorage('lockPatterns') || [];
        this.currentPatternIndex = 0;
        this.currentChapterInfo = null;
        this.isLoading = false;
        this.theme = this.loadFromStorage('theme') || 'light';
        this.chapterPattern = null; // For Phase 1 enhancement

        this.initializeElements();
        this.bindEvents();
        this.initializeTheme();
        this.loadLastURL();
        this.initializeFromURL();
        this.updateUI();
        this.updateHistoryList();

        console.log('WebTextExtract App initialized');
    }

    // -------------------------------
    // DOM Elements
    // -------------------------------
    initializeElements() {
        this.elements = {
            urlInput: document.getElementById('urlInput'),
            extractBtn: document.getElementById('extractBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            copyBtn: document.getElementById('copyBtn'),
            themeToggle: document.getElementById('themeToggle'),

            contentBox: document.getElementById('contentBox'),
            extractedText: document.getElementById('extractedText'),
            chapterDisplay: document.getElementById('chapterDisplay'),
            statusIndicator: document.getElementById('statusIndicator'),

            extractStatus: document.getElementById('extractStatus'),
            copyStatus: document.getElementById('copyStatus'),
            wordCount: document.getElementById('wordCount'),
            wordCountText: document.getElementById('wordCountText'),

            statusMsg: document.getElementById('statusMsg'),
            resultBox: document.getElementById('resultBox'),
            resultCount: document.getElementById('resultCount'),
            lockInput: document.getElementById('lockInput'),
            patternStatus: document.getElementById('patternStatus'),

            historySection: document.getElementById('historySection'),
            urlHistoryList: document.getElementById('urlHistoryList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),

            forceExtract: document.getElementById('forceExtract')
        };
    }

    // -------------------------------
    // Event Listeners
    // -------------------------------
    bindEvents() {
        this.elements.urlInput.addEventListener('input', () => {
            this.validateInput();
            this.updateChapterPattern();
        });

        this.elements.extractBtn.addEventListener('click', () => this.extractContent());
        this.elements.prevBtn.addEventListener('click', () => this.navigateChapter(-1));
        this.elements.nextBtn.addEventListener('click', () => this.navigateChapter(1));
        this.elements.copyBtn.addEventListener('click', () => this.copyContent());
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        this.elements.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.elements.extractBtn.disabled) {
                this.extractContent();
            }
        });

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.url) {
                this.elements.urlInput.value = e.state.url;
                this.extractContent(true);
            }
        });

        this.elements.clearHistoryBtn.addEventListener('click', () => {
            this.clearUrlHistory();
        });

        // Keyboard shortcuts for chapter navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') this.navigateChapter(-1);
            if (e.key === 'ArrowRight') this.navigateChapter(1);
        });
    }

    // -------------------------------
    // Input Validation
    // -------------------------------
    validateInput() {
        const url = this.elements.urlInput.value.trim();
        const isValidUrl = url.length > 0;
        const shouldEnable = isValidUrl && !this.isLoading;
        this.elements.extractBtn.disabled = !shouldEnable;
    }

    // -------------------------------
    // Initialize from URL
    // -------------------------------
    initializeFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const url = urlParams.get('url');
        if (url && this.elements.urlInput.value === '') {
            this.elements.urlInput.value = decodeURIComponent(url);
            this.validateInput();
            this.updateChapterPattern();
        }
    }

    // -------------------------------
    // Detect Chapter Pattern (Phase 1)
    // -------------------------------
    detectPattern(url) {
        const patterns = [
            /(.+\/chapter-)(\d+)/i,
            /(.+\/P)(\d+)/i,
            /(.+\/)(\d+)\.html/i
        ];
        for (const regex of patterns) {
            const match = url.match(regex);
            if (match) return { prefix: match[1], number: parseInt(match[2]) };
        }
        return null;
    }

    updateChapterPattern() {
        const url = this.elements.urlInput.value.trim();
        this.chapterPattern = this.detectPattern(url);
        this.updateNavButtons();
        this.updateChapterDisplayFromPattern();
    }

    updateNavButtons() {
        this.elements.prevBtn.disabled = !this.chapterPattern;
        this.elements.nextBtn.disabled = !this.chapterPattern;
    }

    updateChapterDisplayFromPattern() {
        if (this.chapterPattern) {
            this.elements.chapterDisplay.textContent = 
                `Chapter ${this.chapterPattern.number}`;
        } else if (this.currentChapterInfo) {
            this.elements.chapterDisplay.textContent =
                `Chapter ${this.currentChapterInfo.current_chapter}`;
        } else {
            this.elements.chapterDisplay.textContent = '';
        }
    }

    navigateChapter(offset) {
        if (!this.chapterPattern) return;
        const newNum = this.chapterPattern.number + offset;
        if (newNum <= 0) return;
        const newUrl = `${this.chapterPattern.prefix}${newNum}`;
        this.elements.urlInput.value = newUrl;
        this.chapterPattern.number = newNum;
        this.updateChapterDisplayFromPattern();
        this.extractContent();
    }

    // -------------------------------
    // Extract Content (with Force Mode)
    // -------------------------------
    async extractContent(silent = false) {
        const url = this.elements.urlInput.value.trim();
        if (!url) {
            this.updateStatus('Please enter a URL', 'error');
            return;
        }
        this.setLoading(true);
        this.updateChapterPattern();

        try {
            const forceMode = this.elements.forceExtract?.checked || false;

            // Save URL + history state
            this.saveLastURL(url);
            if (!silent) {
                const urlParams = new URLSearchParams();
                urlParams.set('url', url);
                const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
                window.history.pushState({ url }, '', newUrl);
            }

            let content = null;

            if (forceMode) {
                this.updateStatus("Force Extract enabled. Scraping directly...", "loading");
                const response = await this.makeRequest('/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, force: true })
                });
                const result = await response.json();
                if (result.status === 'success') {
                    content = result.content;
                    this.updateStatus('Content extracted successfully (force mode)!', 'success');
                } else {
                    this.updateStatus(result.message || 'Failed to extract content', 'error');
                }
            } else {
                const lockResponse = await this.makeRequest('/check-lock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pattern: '', url })
                });
                const lockResult = await lockResponse.json();
                if (lockResult.status !== 'success') {
                    this.updateStatus(lockResult.message || 'Unable to detect chapter pattern', 'error');
                    this.setLoading(false);
                    return;
                }
                this.currentChapterInfo = lockResult.chapter_info;
                this.addUrlToHistory(url);
                this.updateChapterDisplay();
                this.enableNavigation(true);

                this.updateStatus(
                    lockResult.auto_detected
                        ? 'Auto-detected pattern, extracting...'
                        : 'Pattern validated, extracting...',
                    'loading'
                );

                const response = await this.makeRequest('/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url, force: false })
                });
                const result = await response.json();
                if (result.status === 'success') {
                    content = result.content;
                    this.updateStatus('Content extracted successfully!', 'success');
                } else {
                    this.updateStatus(result.message || 'Failed to extract content', 'error');
                }
            }

            // Show content if extracted
            if (content) {
                this.displayContent(content);
                const contentEntry = {
                    url,
                    content,
                    title: this.currentChapterInfo
                        ? `Chapter ${this.currentChapterInfo.current_chapter}`
                        : (this.chapterPattern ? `Chapter ${this.chapterPattern.number}` : "Extracted Page"),
                    timestamp: new Date().toLocaleString(),
                    chapter: this.currentChapterInfo?.current_chapter || this.chapterPattern?.number || null
                };
                this.scrapedContent.unshift(contentEntry);
                this.saveToStorage('scrapedContent', this.scrapedContent);
            }

            this.addUrlToHistory(url);

        } catch (error) {
            console.error('Extraction error:', error);
            this.updateStatus('Network error. Please try again.', 'error');
        }

        this.setLoading(false);
    }

    // -------------------------------
    // Helpers
    // -------------------------------
    setLoading(state) {
        this.isLoading = state;
        this.validateInput();
        this.elements.extractBtn.textContent = state ? 'Loading...' : 'Extract';
    }

    updateStatus(message, type) {
        this.elements.statusIndicator.textContent = message;
        this.elements.statusIndicator.className = `status ${type}`;
    }

    displayContent(content) {
        this.elements.extractedText.textContent = content;
        this.elements.wordCountText.textContent = `${content.split(/\s+/).length} words`;
    }

    saveLastURL(url) {
        sessionStorage.setItem('lastURL', url);
    }

    loadLastURL() {
        const lastURL = sessionStorage.getItem('lastURL');
        if (lastURL) {
            this.elements.urlInput.value = lastURL;
            this.validateInput();
            this.updateChapterPattern();
        }
    }

    addUrlToHistory(url) {
        if (!this.urlHistory.includes(url)) {
            this.urlHistory.unshift(url);
            this.saveToStorage('urlHistory', this.urlHistory);
            this.updateHistoryList();
        }
    }

    clearUrlHistory() {
        this.urlHistory = [];
        this.saveToStorage('urlHistory', this.urlHistory);
        this.updateHistoryList();
    }

    updateHistoryList() {
        const list = this.elements.urlHistoryList;
        if (!list) return;
        list.innerHTML = '';
        this.urlHistory.forEach(url => {
            const li = document.createElement('li');
            li.textContent = url;
            li.onclick = () => {
                this.elements.urlInput.value = url;
                this.extractContent();
            };
            list.appendChild(li);
        });
    }

    updateChapterDisplay() {
        if (this.currentChapterInfo) {
            this.elements.chapterDisplay.textContent =
                `Chapter ${this.currentChapterInfo.current_chapter}`;
        } else {
            this.updateChapterDisplayFromPattern();
        }
    }

    enableNavigation(enabled) {
        this.elements.prevBtn.disabled = !enabled;
        this.elements.nextBtn.disabled = !enabled;
    }

    copyContent() {
        const text = this.elements.extractedText.textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.updateStatus('📋 Copied to clipboard', 'success');
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.theme);
        this.saveToStorage('theme', this.theme);
    }

    saveToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    loadFromStorage(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch {
            return null;
        }
    }

    updateUI() {
        document.body.setAttribute('data-theme', this.theme);
        this.updateChapterPattern();
    }

    async makeRequest(url, options) {
        return fetch(url, options);
    }
}

// -------------------------------
// Init
// -------------------------------
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WebTextExtractApp();
});