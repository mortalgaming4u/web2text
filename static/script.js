document.addEventListener('DOMContentLoaded', () => {
    const scrapeBtn = document.getElementById('extractBtn');
    const urlInput = document.getElementById('urlInput');
    const contentDiv = document.getElementById('content');
    const navButtons = document.getElementById('navButtons');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const themeToggle = document.getElementById('themeToggle');
    const copyBtn = document.getElementById('copyBtn');
    const outputText = document.getElementById('outputText');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    let currentUrl = '';
    let history = JSON.parse(localStorage.getItem('scrapeHistory') || '[]');

    // ✅ Debug overlay
    const overlay = document.createElement('div');
    overlay.style = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0,0,0,0.85);
        color: #0f0;
        padding: 8px 12px;
        font-size: 12px;
        font-family: monospace;
        z-index: 9999;
        border-radius: 4px;
        white-space: pre-line;
    `;
    overlay.innerText = 'JS loaded ✅';
    document.body.appendChild(overlay);

    if (scrapeBtn) {
        overlay.innerText += '\nButton found ✅';
        scrapeBtn.addEventListener('click', () => {
            overlay.innerText += '\nExtract clicked ✅';
        });
    } else {
        overlay.innerText += '\nButton not found ❌';
    }

    function updateHistory(url) {
        if (!history.includes(url)) {
            history.push(url);
            localStorage.setItem('scrapeHistory', JSON.stringify(history));
        }
    }

    async function scrape(url) {
        contentDiv.innerHTML = "<p>Loading...</p>";
        try {
            const response = await fetch('/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            overlay.innerText += `\nFetch status: ${response.status}`;
            const data = await response.json();

            if (data.error) {
                contentDiv.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
                overlay.innerText += `\nError: ${data.error}`;
                return;
            }

            currentUrl = data.url;
            updateHistory(currentUrl);

            const formattedText = data.text.replace(/\n/g, '<br>');
            contentDiv.innerHTML = `
                <h2>${data.title || 'No Title'}</h2>
                <p><strong>Words:</strong> ${data.word_count}</p>
                <div>${formattedText}</div>
            `;
            outputText.textContent = data.text;

            const { previous, next } = data.navigation || {};
            navButtons.style.display = previous || next ? 'block' : 'none';
            prevBtn.disabled = !previous;
            nextBtn.disabled = !next;

            prevBtn.onclick = () => previous && scrape(previous);
            nextBtn.onclick = () => next && scrape(next);
        } catch (err) {
            contentDiv.innerHTML = `<p style="color:red;">Error: ${err.message || err}</p>`;
            overlay.innerText += `\nException: ${err.message || err}`;
        }
    }

    scrapeBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) {
            contentDiv.innerHTML = `<p style="color:red;">Please enter a valid URL.</p>`;
            overlay.innerText += '\nInvalid URL ❌';
            return;
        }
        scrape(url);
    });

    urlInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') scrapeBtn.click();
    });

    themeToggle?.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });

    copyBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(outputText.textContent)
            .then(() => alert('Copied to clipboard!'))
            .catch(() => alert('Copy failed.'));
    });

    clearHistoryBtn?.addEventListener('click', () => {
        localStorage.removeItem('scrapeHistory');
        history = [];
        alert('History cleared.');
    });
});