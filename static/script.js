class WebTextExtractApp {
    constructor() {
        this.scrapedContent = [];
        this.urlHistory = this.loadFromStorage('urlHistory') || [];
        this.lockPatterns = this.loadFromStorage('lockPatterns') || [];
        this.currentPatternIndex = 0;
        this.currentChapterInfo = null;
        this.isLoading = false;
        this.theme = this.loadFromStorage('theme') || 'light';

        this.initializeElements();
        this.bindEvents();
        this.initializeTheme();
        this.loadLastURL();
        this.initializeFromURL();
        this.updateUI();

        console.log('WebTextExtract App initialized');
    }

    // -------------------------------
    // DOM Elements
    // -------------------------------
    initializeElements() {
        this.elements = {
            // Main elements
            urlInput: document.getElementById('urlInput'),
            extractBtn: document.getElementById('extractBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            copyBtn: document.getElementById('copyBtn'),
            themeToggle: document.getElementById('themeToggle'),

            // Content
            contentBox: document.getElementById('contentBox'),
            extractedText: document.getElementById('extractedText'),
            chapterDisplay: document.getElementById('chapterDisplay'),
            statusIndicator: document.getElementById('statusIndicator'),

            // Status bar
            extractStatus: document.getElementById('extractStatus'),
            copyStatus: document.getElementById('copyStatus'),
            wordCount: document.getElementById('wordCount'),
            wordCountText: document.getElementById('wordCountText'),

            // Legacy support
            statusMsg: document.getElementById('statusMsg'),
            resultBox: document.getElementById('resultBox'),
            resultCount: document.getElementById('resultCount'),
            lockInput: document.getElementById('lockInput'),
            patternStatus: document.getElementById('patternStatus'),

            // History
            historySection: document.getElementById('historySection'),
            urlHistoryList: document.getElementById('urlHistoryList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),

            // New: Force Extract
            forceExtract: document.getElementById('forceExtract')
        };
    }

    // -------------------------------
    // Event Listeners
    // -------------------------------
    bindEvents() {
        this.elements.urlInput.addEventListener('input', () => this.validateInput());
        this.elements.extractBtn.addEventListener('click', () => this.extractContent());
        this.elements.prevBtn.addEventListener('click', () => this.navigateChapter('previous'));
        this.elements.nextBtn.addEventListener('click', () => this.navigateChapter('next'));
        this.elements.copyBtn.addEventListener('click', () => this.copyContent());
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Enter key = extract
        this.elements.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.elements.extractBtn.disabled) {
                this.extractContent();
            }
        });

        // Browser history navigation
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.url) {
                this.elements.urlInput.value = e.state.url;
                this.extractContent(true);
            }
        });

        // Clear history
        this.elements.clearHistoryBtn.addEventListener('click', () => {
            this.clearUrlHistory();
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

        console.log('Validation:', { url: !!url, loading: this.isLoading, enabled: shouldEnable });
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
        }
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
                // 🚀 Force mode skips /check-lock
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
                // 🟢 Normal mode calls /check-lock first
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
                        : "Extracted Page",
                    timestamp: new Date().toLocaleString(),
                    chapter: this.currentChapterInfo?.current_chapter || null
                };
                this.scrapedContent.unshift(contentEntry);
                this.saveToStorage('scrapedContent', this.scrapedContent);
            }

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
        }
    }

    addUrlToHistory(url) {
        if (!this.urlHistory.includes(url)) {
            this.urlHistory.unshift(url);
            this.saveToStorage('urlHistory', this.urlHistory);
        }
    }

    clearUrlHistory() {
        this.urlHistory = [];
        this.saveToStorage('urlHistory', this.urlHistory);
        this.updateUI();
    }

    updateChapterDisplay() {
        if (this.currentChapterInfo) {
            this.elements.chapterDisplay.textContent =
                `Chapter ${this.currentChapterInfo.current_chapter}`;
        }
    }

    enableNavigation(enabled) {
        this.elements.prevBtn.disabled = !enabled;
        this.elements.nextBtn.disabled = !enabled;
    }

    copyContent() {
        const text = this.elements.extractedText.textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.updateStatus('Content copied to clipboard!', 'success');
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