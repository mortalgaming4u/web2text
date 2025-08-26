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

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            // Main elements
            urlInput: document.getElementById('urlInput'),
            extractBtn: document.getElementById('extractBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            copyBtn: document.getElementById('copyBtn'),
            themeToggle: document.getElementById('themeToggle'),

            // Content elements
            contentBox: document.getElementById('contentBox'),
            extractedText: document.getElementById('extractedText'),
            chapterDisplay: document.getElementById('chapterDisplay'),
            statusIndicator: document.getElementById('statusIndicator'),

            // Status bar elements
            extractStatus: document.getElementById('extractStatus'),
            copyStatus: document.getElementById('copyStatus'),
            wordCount: document.getElementById('wordCount'),
            wordCountText: document.getElementById('wordCountText'),

            // Legacy compatibility elements
            statusMsg: document.getElementById('statusMsg'),
            resultBox: document.getElementById('resultBox'),
            resultCount: document.getElementById('resultCount'),
            lockInput: document.getElementById('lockInput'),
            patternStatus: document.getElementById('patternStatus'),

            // History elements
            historySection: document.getElementById('historySection'),
            urlHistoryList: document.getElementById('urlHistoryList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),

            // New: Force Extract
            forceExtract: document.getElementById('forceExtract')
        };
    }

    // Bind event listeners
    bindEvents() {
        this.elements.urlInput.addEventListener('input', () => this.validateInput());

        this.elements.extractBtn.addEventListener('click', () => this.extractContent());

        this.elements.prevBtn.addEventListener('click', () => this.navigateChapter('previous'));
        this.elements.nextBtn.addEventListener('click', () => this.navigateChapter('next'));

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
                this.extractContent(true); // silent extraction
            }
        });

        this.elements.clearHistoryBtn.addEventListener('click', () => this.clearUrlHistory());
    }

    // Validate input fields
    validateInput() {
        const url = this.elements.urlInput.value.trim();
        const isValidUrl = url.length > 0;
        const shouldEnable = isValidUrl && !this.isLoading;
        this.elements.extractBtn.disabled = !shouldEnable;
    }

    // Initialize from current URL (for browser history support)
    initializeFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const url = urlParams.get('url');
        if (url && this.elements.urlInput.value === '') {
            this.elements.urlInput.value = decodeURIComponent(url);
            this.validateInput();
        }
    }

    // Extract content from URL
    async extractContent(silent = false) {
        const url = this.elements.urlInput.value.trim();
        if (!url) {
            this.updateStatus('Please enter a URL', 'error');
            return;
        }

        this.setLoading(true);

        try {
            // Save URL and update browser history
            this.saveLastURL(url);
            if (!silent) {
                const urlParams = new URLSearchParams();
                urlParams.set('url', url);
                const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
                window.history.pushState({ url }, '', newUrl);
            }

            // First check pattern
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

            const statusText = lockResult.auto_detected ?
                'Auto-detected pattern, extracting...' :
                'Pattern validated, extracting...';
            this.updateStatus(statusText, 'loading');

            // Extract content (with forceExtract support)
            const response = await this.makeRequest('/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    force: this.elements.forceExtract?.checked || false
                })
            });
            const result = await response.json();

            // Handle special statuses
            if (result.status === 'no_pattern') {
                this.updateStatus("No chapter pattern detected. Try enabling Force Extract.", 'error');
                this.setLoading(false);
                return;
            } else if (result.status === 'no_content') {
                this.updateStatus("No extractable content found.", 'error');
                this.setLoading(false);
                return;
            }

            if (result.status === 'success') {
                this.displayContent(result.content);
                this.updateStatus('Content extracted successfully!', 'success');

                const contentEntry = {
                    url,
                    content: result.content,
                    title: `Chapter ${this.currentChapterInfo.current_chapter}`,
                    timestamp: new Date().toLocaleString(),
                    chapter: this.currentChapterInfo.current_chapter
                };
                this.scrapedContent.unshift(contentEntry);
                this.saveToStorage('scrapedContent', this.scrapedContent);
            } else {
                this.updateStatus(result.message || 'Failed to extract content', 'error');
            }
        } catch (error) {
            console.error('Extraction error:', error);
            this.updateStatus('Network error. Please try again.', 'error');
        }

        this.setLoading(false);
    }

    // Navigate chapters
    async navigateChapter(direction) {
        if (!this.currentChapterInfo) return;
        const newUrl = direction === 'next'
            ? this.currentChapterInfo.next_url
            : this.currentChapterInfo.prev_url;

        if (!newUrl) {
            this.updateStatus(`No ${direction} chapter available.`, 'error');
            return;
        }

        this.elements.urlInput.value = newUrl;
        this.extractContent();
    }

    // Update chapter display
    updateChapterDisplay() {
        if (!this.currentChapterInfo) return;
        this.elements.chapterDisplay.textContent =
            `Chapter ${this.currentChapterInfo.current_chapter}`;
    }

    // Enable/disable navigation buttons
    enableNavigation(enable) {
        this.elements.prevBtn.disabled = !enable;
        this.elements.nextBtn.disabled = !enable;
    }

    // Display extracted content
    displayContent(content) {
        this.elements.extractedText.value = content;
        this.elements.wordCount.textContent = content.split(/\s+/).length;
        this.elements.wordCountText.textContent = "Words";
    }

    // Copy content
    async copyContent() {
        try {
            await navigator.clipboard.writeText(this.elements.extractedText.value);
            this.updateStatus('Copied to clipboard!', 'success');
        } catch (err) {
            this.updateStatus('Copy failed', 'error');
        }
    }

    // Set loading state
    setLoading(isLoading) {
        this.isLoading = isLoading;
        this.elements.extractBtn.disabled = isLoading;
        if (isLoading) {
            this.elements.statusIndicator.classList.add('loading');
        } else {
            this.elements.statusIndicator.classList.remove('loading');
        }
    }

    // Update status message
    updateStatus(message, type) {
        this.elements.extractStatus.textContent = message;
        this.elements.extractStatus.className = `status ${type}`;
    }

    // Theme handling
    initializeTheme() {
        document.body.classList.toggle('dark', this.theme === 'dark');
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.saveToStorage('theme', this.theme);
        this.initializeTheme();
    }

    // History handling
    addUrlToHistory(url) {
        if (!this.urlHistory.includes(url)) {
            this.urlHistory.unshift(url);
            this.saveToStorage('urlHistory', this.urlHistory);
            this.updateHistoryUI();
        }
    }

    clearUrlHistory() {
        this.urlHistory = [];
        this.saveToStorage('urlHistory', this.urlHistory);
        this.updateHistoryUI();
    }

    updateHistoryUI() {
        this.elements.urlHistoryList.innerHTML = '';
        this.urlHistory.forEach(url => {
            const li = document.createElement('li');
            li.textContent = url;
            li.addEventListener('click', () => {
                this.elements.urlInput.value = url;
                this.extractContent();
            });
            this.elements.urlHistoryList.appendChild(li);
        });
    }

    // Storage
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

    saveLastURL(url) {
        sessionStorage.setItem('lastURL', url);
    }

    loadLastURL() {
        const url = sessionStorage.getItem('lastURL');
        if (url) {
            this.elements.urlInput.value = url;
            this.validateInput();
        }
    }

    // UI update
    updateUI() {
        this.updateHistoryUI();
        this.validateInput();
    }

    // Generic fetch wrapper
    async makeRequest(endpoint, options) {
        return fetch(endpoint, options);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WebTextExtractApp();
});