document.addEventListener('DOMContentLoaded', function () {
    const scrapeBtn = document.getElementById('scrapeBtn');
    const urlInput = document.getElementById('urlInput');
    const contentDiv = document.getElementById('content');
    const navButtons = document.getElementById('navButtons');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let currentUrl = '';

    async function scrape(url) {
        contentDiv.innerHTML = "<p>Loading...</p>";
        try {
            const response = await fetch('/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();

            if (data.error) {
                contentDiv.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
                return;
            }

            currentUrl = data.url;
            contentDiv.innerHTML = `
                <h2>${data.title || 'No Title'}</h2>
                <p><strong>Words:</strong> ${data.word_count}</p>
                <div>${data.text.replace(/\n/g, '<br>')}</div>
            `;

            if (data.navigation.previous || data.navigation.next) {
                navButtons.style.display = 'block';
                prevBtn.disabled = !data.navigation.previous;
                nextBtn.disabled = !data.navigation.next;

                prevBtn.onclick = () => data.navigation.previous && scrape(data.navigation.previous);
                nextBtn.onclick = () => data.navigation.next && scrape(data.navigation.next);
            } else {
                navButtons.style.display = 'none';
            }
        } catch (err) {
            contentDiv.innerHTML = `<p style="color:red;">Error: ${err}</p>`;
        }
    }

    scrapeBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (url) scrape(url);
    });
});