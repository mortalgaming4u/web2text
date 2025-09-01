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

            forceExtract: document.getElementById('forceExtract'),
            
            // New URL box elements
            powerIcon: document.getElementById('powerIcon'),
            addIcon: document.getElementById('addIcon'),
            modeToggle: document.getElementById('modeToggle'),
            previewSnippet: document.getElementById('previewSnippet')
        };
    }

    // -------------------------------
    // Theme Initialization
    // -------------------------------
    initializeTheme() {
        document.body.setAttribute('data-theme', this.theme);
    }

    // -------------------------------
    // Event Listeners
    // -------------------------------
    bindEvents() {
        // Original event listeners
        this.elements.urlInput.addEventListener('input', () => {
            this.validateInput();
            this.updateChapterPattern();
            this.handleAutoExtract(); // New auto-extract functionality
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

        // New URL box event listeners
        this.bindNewUrlBoxEvents();
    }

    // -------------------------------
    // New URL Box Event Listeners
    // -------------------------------
    bindNewUrlBoxEvents() {
        // Power Icon - Toggle between Auto Extract and Manual Mode
        if (this.elements.powerIcon) {
            this.elements.powerIcon.addEventListener('click', () => {
                const toggle = this.elements.modeToggle;
                toggle.checked = !toggle.checked;
                this.updateModeToggleText();
                this.updatePreviewSnippet();
                
                // Visual feedback for power icon
                this.elements.powerIcon.style.color = toggle.checked ? '#0078d4' : '#ff4444';
                this.elements.powerIcon.style.transform = 'scale(1.2)';
                setTimeout(() => {
                    this.elements.powerIcon.style.transform = 'scale(1)';
                }, 200);
            });
        }

        // Add Icon - Add URL to queue/history
        if (this.elements.addIcon) {
            this.elements.addIcon.addEventListener('click', () => {
                const url = this.elements.urlInput.value.trim();
                if (url) {
                    this.addUrlToQueue(url);
                    
                    // Visual feedback
                    this.elements.addIcon.style.transform = 'rotate(90deg) scale(1.2)';
                    setTimeout(() => {
                        this.elements.addIcon.style.transform = 'rotate(0deg) scale(1)';
                    }, 300);
                } else {
                    this.updateStatus('Please enter a URL first', 'error');
                }
            });
        }

        // Mode Toggle - Handle auto extract mode changes
        if (this.elements.modeToggle) {
            this.elements.modeToggle.addEventListener('change', () => {
                this.updateModeToggleText();
                this.updatePreviewSnippet();
                this.updateStatus(
                    this.elements.modeToggle.checked 
                        ? 'Auto Extract mode enabled' 
                        : 'Manual mode enabled', 
                    'success'
                );
            });
        }
    }

    // -------------------------------
    // New URL Box Helper Methods
    // -------------------------------
    updateModeToggleText() {
        const toggle = this.elements.modeToggle;
        const label = toggle.nextElementSibling;
        if (label) {
            label.textContent = toggle.checked ? 'Auto Extract' : 'Manual Mode';
        }
    }

    updatePreviewSnippet() {
        if (!this.elements.previewSnippet) return;
        
        const isAutoMode = this.elements.modeToggle.checked;
        const url = this.elements.urlInput.value.trim();
        
        if (isAutoMode) {
            this.elements.previewSnippet.classList.add('active');
            if (url) {
                this.elements.previewSnippet.textContent = `Ready to auto-extract: ${this.shortenUrl(url)}`;
            } else {
                this.elements.previewSnippet.textContent = 'Auto Extract mode enabled - content will be extracted automatically when URL is entered.';
            }
        } else {
            this.elements.previewSnippet.classList.remove('active');
        }
    }

    addUrlToQueue(url) {
        this.elements.previewSnippet.textContent = `Queued: ${this.shortenUrl(url)}`;
        this.elements.previewSnippet.classList.add('active');
        
        // Add to history immediately
        this.addUrlToHistory(url);
        
        // If in auto mode, extract immediately
        if (this.elements.modeToggle.checked) {
            setTimeout(() => this.extractContent(), 500);
        }
        
        // Optional: POST to Flask backend for queuing
        this.sendToBackend(url);
    }

    async sendToBackend(url) {
        try {
            const response = await this.makeRequest('/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, action: 'queue' })
            });
            const result = await response.json();
            console.log('Queued to backend:', result);
        } catch (error) {
            console.warn('Failed to queue to backend:', error);
        }
    }

    handleAutoExtract() {
        if (!this.elements.modeToggle.checked) return;
        
        const url = this.elements.urlInput.value.trim();
        if (url && this.isValidUrl(url)) {
            // Debounce auto-extract to avoid too many requests
            clearTimeout(this.autoExtractTimeout);
            this.autoExtractTimeout = setTimeout(() => {
                this.updatePreviewSnippet();
                // Auto-extract after 1 second of inactivity
                setTimeout(() => {
                    if (this.elements.modeToggle.checked && this.elements.urlInput.value.trim() === url) {
                        this.extractContent();
                    }
                }, 1000);
            }, 500);
        } else {
            this.updatePreviewSnippet();
        }
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    shortenUrl(url) {
        if (url.length <= 50) return url;
        return url.substring(0, 47) + '...';
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
        
        // Auto-clear success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (this.elements.statusIndicator.textContent === message) {
                    this.elements.statusIndicator.textContent = '';
                    this.elements.statusIndicator.className = '';
                }
            }, 3000);
        }
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
            if (this.urlHistory.length > 50) { // Limit history to 50 items
                this.urlHistory = this.urlHistory.slice(0, 50);
            }
            this.saveToStorage('urlHistory', this.urlHistory);
            this.updateHistoryList();
        }
    }

    clearUrlHistory() {
        this.urlHistory = [];
        this.saveToStorage('urlHistory', this.urlHistory);
        this.updateHistoryList();
        this.updateStatus('History cleared', 'success');
    }

    updateHistoryList() {
        const list = this.elements.urlHistoryList;
        if (!list) return;
        list.innerHTML = '';
        this.urlHistory.forEach((url, index) => {
            const li = document.createElement('li');
            
            // Create history item structure
            const iconDiv = document.createElement('div');
            iconDiv.className = 'history-item-icon';
            iconDiv.textContent = (index + 1).toString();
            
            const contentDiv = document.createElement('div');
            contentDiv.style.flex = '1';
            contentDiv.style.minWidth = '0';
            
            const urlText = document.createElement('div');
            urlText.textContent = this.shortenUrl(url);
            urlText.style.fontWeight = '500';
            urlText.style.marginBottom = '2px';
            
            const timeText = document.createElement('div');
            timeText.textContent = 'Click to load';
            timeText.style.fontSize = '12px';
            timeText.style.color = 'var(--text-muted)';
            
            contentDiv.appendChild(urlText);
            contentDiv.appendChild(timeText);
            
            li.appendChild(iconDiv);
            li.appendChild(contentDiv);
            
            li.onclick = () => {
                this.elements.urlInput.value = url;
                this.validateInput();
                this.updateChapterPattern();
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
        if (text && text !== 'Your extracted content will appear here...') {
            navigator.clipboard.writeText(text).then(() => {
                this.updateStatus('📋 Copied to clipboard', 'success');
            }).catch(() => {
                this.updateStatus('Failed to copy to clipboard', 'error');
            });
        } else {
            this.updateStatus('No content to copy', 'error');
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', this.theme);
        this.saveToStorage('theme', this.theme);
        this.updateStatus(`Switched to ${this.theme} theme`, 'success');
    }

    saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return null;
        }
    }

    updateUI() {
        document.body.setAttribute('data-theme', this.theme);
        this.updateChapterPattern();
        this.updateModeToggleText();
        this.updatePreviewSnippet();
        
        // Set initial power icon color
        if (this.elements.powerIcon && this.elements.modeToggle) {
            this.elements.powerIcon.style.color = this.elements.modeToggle.checked ? '#0078d4' : '#ccc';
        }
    }

    async makeRequest(url, options) {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}

// -------------------------------
// Initialize App
// -------------------------------
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new WebTextExtractApp();
        console.log('WebTextExtract App successfully initialized');
    } catch (error) {
        console.error('Failed to initialize WebTextExtract App:', error);
    }
});
