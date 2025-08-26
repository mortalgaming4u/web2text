class WebTextExtractApp {
    constructor() {
        this.scrapedContent = [];
        this.urlHistory = this.loadFromStorage('urlHistory') || [];
        this.currentChapterInfo = null;
        this.isLoading = false;
        this.theme = this.loadFromStorage('theme') || 'light';

        this.initializeElements();
        this.bindEvents();
        this.initializeTheme();
        this.loadLastURL();
        this.initializeFromURL();
        this.updateUI();
    }

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
            urlHistoryList: document.getElementById('urlHistoryList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn')
        };
    }

    bindEvents() {
        this.elements.urlInput.addEventListener('input', () => this.validateInput());
        this.elements.extractBtn.addEventListener('click', () => this.extractContent());
        this.elements.prevBtn.addEventListener('click', () => this.navigateChapter('previous'));
        this.elements.nextBtn.addEventListener('click', () => this.navigateChapter('next'));
        this.elements.copyBtn.addEventListener('click', () => this.copyContent());
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.clearHistoryBtn.addEventListener('click', () => this.clearUrlHistory());
    }

    validateInput() {
        const url = this.elements.urlInput.value.trim();
        const isValid = url.length > 0;
        this.elements.extractBtn.disabled = !isValid || this.isLoading;
    }

    initializeFromURL() {
        const params = new URLSearchParams(window.location.search);
        const url = params.get('url');
        if (url) {
            this.elements.urlInput.value = decodeURIComponent(url);
            this.validateInput();
        }
    }

    async extractContent() {
        const url = this.elements.urlInput.value.trim();
        if (!url) {
            this.updateStatus('Please enter a valid URL', 'error');
            return;
        }
        this.setLoading(true);

        try {
            const response = await this.makeRequest('/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.displayContent(result.content);
                this.currentChapterInfo = result.chapter_info;
                this.updateChapterDisplay();
                this.addUrlToHistory(url, result.chapter_info);
                this.enableNavigation(!!result.chapter_info);
                this.updateStatus('Content extracted successfully!', 'success');
            } else {
                this.updateStatus(result.message || 'Failed to extract content', 'error');
            }
        } catch (err) {
            this.updateStatus('Network error. Try again.', 'error');
        }
        this.setLoading(false);
    }

    async navigateChapter(direction) {
        if (!this.currentChapterInfo) return;
        this.setLoading(true);
        this.updateStatus(`Loading ${direction} chapter...`, 'loading');

        try {
            const response = await this.makeRequest('/navigate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    direction,
                    current_url: this.elements.urlInput.value
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.elements.urlInput.value = result.new_url;
                await this.extractContent();
            } else {
                this.updateStatus(result.message || 'Navigation failed', 'error');
            }
        } catch (error) {
            this.updateStatus('Navigation error.', 'error');
        }
        this.setLoading(false);
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.elements.extractBtn.disabled = loading;
        this.elements.prevBtn.disabled = loading || !this.currentChapterInfo;
        this.elements.nextBtn.disabled = loading || !this.currentChapterInfo;
    }

    displayContent(content) {
        const cleanText = content.trim();
        this.elements.extractedText.textContent = cleanText;
        this.elements.wordCountText.textContent = `${cleanText.split(/\s+/).length} words`;
    }

    updateStatus(message, type) {
        this.elements.statusIndicator.textContent = message;
        this.elements.statusIndicator.className = `status-indicator ${type}`;
    }

    updateChapterDisplay() {
        if (this.currentChapterInfo) {
            this.elements.chapterDisplay.textContent = `Chapter ${this.currentChapterInfo.current_chapter}`;
            this.elements.chapterDisplay.classList.remove('hidden');
        }
    }

    enableNavigation(enable) {
        this.elements.prevBtn.disabled = !enable;
        this.elements.nextBtn.disabled = !enable;
    }

    addUrlToHistory(url, info) {
        const entry = {
            url,
            chapter: info?.current_chapter || 'Unknown',
            timestamp: new Date().toLocaleString()
        };
        this.urlHistory.unshift(entry);
        this.urlHistory = this.urlHistory.slice(0, 10);
        this.saveToStorage('urlHistory', this.urlHistory);
    }

    copyContent() {
        navigator.clipboard.writeText(this.elements.extractedText.textContent)
            .then(() => this.updateStatus('Copied!', 'success'))
            .catch(() => this.updateStatus('Failed to copy', 'error'));
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        this.saveToStorage('theme', this.theme);
    }

    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadFromStorage(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }

    async makeRequest(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    }

    updateUI() {
        this.validateInput();
    }
}

document.addEventListener('DOMContentLoaded', () => new WebTextExtractApp());