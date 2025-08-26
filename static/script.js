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
            
            // History elements
            historySection: document.getElementById('historySection'),
            urlHistoryList: document.getElementById('urlHistoryList'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn')
        };
    }

    // Bind event listeners
    bindEvents() {
        // URL input validation
        this.elements.urlInput.addEventListener('input', () => {
            this.validateInput();
        });

        // Extract button
        this.elements.extractBtn.addEventListener('click', () => {
            this.extractContent();
        });

        // Navigation buttons
        this.elements.prevBtn.addEventListener('click', () => {
            this.navigateChapter('previous');
        });

        this.elements.nextBtn.addEventListener('click', () => {
            this.navigateChapter('next');
        });

        // Copy button
        this.elements.copyBtn.addEventListener('click', () => {
            this.copyContent();
        });

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });

        // URL input enter key
        this.elements.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.elements.extractBtn.disabled) {
                this.extractContent();
            }
        });

        // Clear history button
        this.elements.clearHistoryBtn.addEventListener('click', () => {
            this.clearUrlHistory();
        });
    }

    // Validate input fields
    validateInput() {
        const url = this.elements.urlInput.value.trim();
        const isValidUrl = url.length > 0;
        
        const shouldEnable = isValidUrl && !this.isLoading;
        this.elements.extractBtn.disabled = !shouldEnable;
        
        console.log('Validation:', { url: !!url, loading: this.isLoading, enabled: shouldEnable });
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
        const lockPattern = ''; // Auto-detection mode

        if (!url) {
            this.updateStatus('Please enter a URL', 'error');
            return;
        }

        this.setLoading(true);

        try {
            // Save URL to sessionStorage
            this.saveLastURL(url);
            
            // Auto-detect pattern or validate provided pattern
            const lockResponse = await this.makeRequest('/check-lock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pattern: lockPattern, url: url })
            });

            const lockResult = await lockResponse.json();

            if (lockResult.status !== 'success') {
                this.updateStatus(lockResult.message || 'Unable to detect chapter pattern', 'error');
                this.setLoading(false);
                return;
            }

            // Store chapter info and pattern
            this.currentChapterInfo = lockResult.chapter_info;
            this.addUrlToHistory(url);
            this.updateChapterDisplay();
            this.enableNavigation(true);

            // Update status
            const statusText = lockResult.auto_detected ? 
                'Auto-detected pattern, extracting...' : 
                'Pattern validated, extracting...';
            this.updateStatus(statusText, 'loading');

            // Extract content
            const response = await this.makeRequest('/scrape', {
                method: 'POST',
                headers: { '极-Type': 'application/json' },
                body: JSON.stringify({ url: url })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.displayContent(result.content);
                this.updateStatus('Content extracted successfully!', 'success');
                
                // Add to scraped content history
                const contentEntry = {
                    url: url,
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

    // Navigate through chapters
    async navigateChapter(direction) {
        if (!this.currentChapterInfo || this.isLoading) return;

        this.setLoading(true);
        this.updateStatus(`Navigating to ${direction} chapter...`, 'loading');

        try {
            const response = await this.makeRequest('/navigate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    direction: direction,
                    current_url: this.elements.urlInput.value
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Update URL and chapter info
                this.elements.urlInput.value = result.new_url;
                this.currentChapterInfo.current_chapter = result.chapter;
                this.updateChapterDisplay();
                
                // Auto-extract the new chapter
                await this.extractContent(true); // Silent extraction
            } else {
                this.updateStatus(result.message || `Cannot navigate ${direction}`, 'error');
            }
        } catch (error) {
            console.error('Navigation error:', error);
            this.updateStatus('Navigation failed. Please try again.', 'error');
        }

        this.setLoading(false);
    }

    // Set loading state
    setLoading(loading) {
        this.isLoading = loading;
        
        // Update extract button
        this.elements.extractBtn.disabled = loading;
        const btnText = this.elements.extractBtn.querySelector('.btn-text');
        const spinner = this极.elements.extractBtn.querySelector('.spinner');
        
        if (btnText) btnText.style.display = loading ? 'none' : 'inline';
        if (spinner) spinner.classList.toggle('hidden', !loading);
        
        // Update navigation buttons
        this.elements.prevBtn.disabled = loading || !this.currentChapterInfo;
        this.elements.nextBtn.disabled = loading || !this.currentChapterInfo;
        
        this.validateInput();
    }

    // Update status messages
    updateStatus(message, type) {
        // Update main status indicator
        this.elements.statusIndicator.textContent = message;
        this.elements.statusIndicator.className = `status-indicator ${type}`;
        
        // Update status bar
        this.elements.extractStatus.textContent = message;
        this.elements.extractStatus.parentElement.className = `status-item ${type}`;
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                this.elements.statusIndicator.textContent = 'Ready';
                this.elements.statusIndicator.className = 'status-indicator';
                this.elements.extractStatus.textContent = 'Ready';
                this.elements.extractStatus.parentElement.className = 'status-item';
            }, 3000);
        }
    }

    // Display extracted content
    displayContent(content) {
        // Hide empty state
        const emptyState = this.elements.contentBox.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Show extracted text and copy button
        this.elements.extractedText.textContent = content;
        this.elements.extractedText.classList.remove('hidden');
        this.elements.copyBtn.classList.remove('hidden');
        
        // Update word count
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        this.elements.wordCountText.textContent = `${wordCount} words`;
        this.elements.wordCount.classList.remove('hidden');
    }

    // Update chapter display
    updateChapterDisplay() {
        if (this.currentChapterInfo && this.elements.chapterDisplay) {
            this.elements.chapterDisplay.textContent = `Chapter ${this.currentChapterInfo.current_chapter}`;
            this.elements.chapterDisplay.classList.remove('hidden');
            
            // Update status indicator
            const statusText = this.currentChapterInfo.auto_detected ? 'Auto-detected' : 'Pattern validated';
            this.elements.statusIndicator.textContent = statusText;
        }
    }

    // Enable/disable navigation
    enableNavigation(enable) {
        this.elements.prevBtn.disabled = !enable || this.isLoading;
        this.elements.nextBtn.disabled = !enable || this.isLoading;
    }

    // Copy content to clipboard
    copyContent() {
        const content = this.elements.extractedText.textContent;

        if (!content || content.trim() === '') {
            this.updateStatus('No content to copy', 'error');
            return;
        }

        navigator.clipboard.writeText(content).then(() => {
            // Visual feedback
            this.elements.copyBtn.classList.add('copied');
            this.elements.copyStatus.classList.remove('hidden');
            this.updateStatus('Content copied to clipboard!', 'success');
            
            // Reset after 2 seconds
            setTimeout(() => {
                this.elements.copyBtn.classList.remove('copied');
                this.elements.copyStatus.classList.add('hidden');
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = content;
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.updateStatus('Content copied to clipboard!', 'success');
                this.elements.copyBtn.classList.add('copied');
                this.elements.copyStatus.classList.remove('hidden');
                setTimeout(() => {
                    this.elements.copyBtn.classList.remove('copied');
                    this.elements.copyStatus.classList.add('hidden');
                }, 2000);
            } catch (err) {
                this.updateStatus('Failed to copy content', 'error');
            }
            
            document.body.removeChild(textArea);
        });
    }

    // Theme management
    initializeTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        this.updateThemeToggle();
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        this.saveToStorage('theme', this.theme);
        this.updateThemeToggle();
    }

    updateThemeToggle() {
        const sunIcon = this.elements.themeToggle.querySelector('.sun-icon');
        const moonIcon = this.elements.themeToggle.querySelector('.moon-icon');
        
        if (this.theme === 'dark') {
            sunIcon?.classList.add('hidden');
            moonIcon?.classList.remove('hidden');
        } else {
            sunIcon?.classList.remove('hidden');
            moonIcon?.classList.add('hidden');
        }
    }

    // URL and history management
    loadLastURL() {
        const lastURL = sessionStorage.getItem('lastWebnovelURL');
        if (lastURL && this.elements.urlInput.value === '') {
            this.elements.urlInput.value = lastURL;
            this.validateInput();
        }
    }

    saveLastURL(url) {
        sessionStorage.setItem('lastWebnovelURL', url);
    }

    addUrlToHistory(url) {
        const domain = new URL(url).hostname;
        const urlEntry = {
            url: url,
            domain: domain,
            timestamp: new Date().toLocaleString(),
            chapter: this.currentChapterInfo?.current_chapter || 'Unknown'
        };

        // Remove existing entry for same URL
        this.urlHistory = this.urlHistory.filter(entry => entry.url !== url);
        
        // Add to beginning
        this.urlHistory.unshift(urlEntry);
        
        // Keep only last 10 URLs
        this.urlHistory = this.urlHistory.slice(0, 10);
        
        this.saveToStorage('urlHistory', this.urlHistory);
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        if (!this.elements.urlHistoryList) return;

        if (this.urlHistory.length === 0) {
            this.elements.urlHistoryList.innerHTML = `
                <div class="empty-history">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1极6m0 6v6"/>
                        <path d="m21 12-6 0m-6 0-6 0"/>
                    </svg>
                    <p>No URLs in history yet</p>
                    <span>Extracted URLs will appear here</span>
                </div>
            `;
            return;
        }

        const historyHTML = this.urlHistory.map(entry => `
            <div class="history-item" onclick="app.loadFromHistory('${entry.url}')" title="${entry.url}">
                <div class="history-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                    </svg>
                </div>
                <div class="history-content">
                    <div class="history-title">${this.escapeHtml(entry.url)}</div>
                    <div class="history-meta">
                        <span class="history-domain">${this.escapeHtml(entry.domain)}</span>
                        <span>Chapter ${entry.chapter}</span>
                        <span>${entry.timestamp}</span>
                    </div>
                </div>
            </div>
        `).join('');

        this.elements.urlHistoryList.innerHTML = historyHTML;
    }

    loadFromHistory(url) {
        this.elements.url极nput.value = url;
        this.validateInput();
        this.extractContent();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    clearUrlHistory() {
        if (confirm('Are you sure you want to clear URL history?')) {
            this.urlHistory = [];
            this.saveToStorage('urlHistory', this.urlHistory);
            this.updateHistoryDisplay();
            this.updateStatus('URL history cleared', 'success');
        }
    }

    // Storage utilities
    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e